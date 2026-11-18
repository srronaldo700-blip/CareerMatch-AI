import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import { AuthRequest, requireAuth } from './server/lib/firebaseAdmin.ts';
import { firestoreRest } from './server/lib/firestoreRest.ts';
import {
  ensureJobsSeeded,
  getJobById,
  ingestJobs,
  listAllJobs,
  parseJobsCsv,
  setJobActiveStatus,
} from './server/services/jobService.ts';
import {
  extractTextFromResume,
  MAX_RESUME_SIZE_BYTES,
  parseResumeToProfile,
  validateResumeFile,
} from './server/services/resumeService.ts';
import {
  RANKING_WEIGHTS,
  scoreJobForCandidate,
  searchAndRankJobs,
} from './server/services/searchRankingService.ts';
import { runAgentTurn } from './server/services/agentService.ts';
import { runLiveEvaluation } from './server/services/evaluationService.ts';
import {
  AgentChatMessage,
  CandidatePreferences,
  CandidatePreferencesSchema,
  CandidateProfile,
  CandidateProfileSchema,
  SearchRequestSchema,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_SIZE_BYTES },
});

async function getUserContext(userId: string, idToken: string) {
  const [profile, prefs, savedRows] = await Promise.all([
    firestoreRest.getDoc<CandidateProfile>('candidate_profiles', userId, idToken),
    firestoreRest.getDoc<CandidatePreferences>('candidate_preferences', userId, idToken),
    firestoreRest.queryByUserId<{ jobId?: string }>('saved_jobs', userId, idToken),
  ]);

  const savedJobIds = new Set<string>();
  for (const row of savedRows) {
    if (row.data.jobId) savedJobIds.add(String(row.data.jobId));
  }

  return { profile, prefs, savedJobIds };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // 1. Health Check
  app.get('/api/health', async (_req, res) => {
    try {
      await ensureJobsSeeded();
      const jobs = await listAllJobs();
      res.json({
        status: 'ok',
        service: 'CareerMatch AI API',
        indexedJobs: jobs.length,
        rankingWeights: RANKING_WEIGHTS,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  });

  // 2. Auth Sync
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const idToken = req.idToken!;
      const email = req.user!.email || '';
      const displayName = req.user!.name || email.split('@')[0] || 'Candidate';
      const now = new Date().toISOString();

      const existing = await firestoreRest.getDoc<{ createdAt?: string }>('users', uid, idToken);
      await firestoreRest.setDoc(
        'users',
        uid,
        {
          uid,
          email,
          displayName,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        },
        idToken
      );

      res.json({ uid, email, displayName });
    } catch (error) {
      console.error('Auth sync error:', error);
      res.status(500).json({ error: 'Failed to synchronize user account.' });
    }
  });

  // 3. Candidate Profile
  app.get('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const profile = await firestoreRest.getDoc<CandidateProfile>(
        'candidate_profiles',
        req.user!.uid,
        req.idToken!
      );
      res.json({ profile });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to load candidate profile.' });
    }
  });

  app.put('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const parsed = CandidateProfileSchema.safeParse({
        ...req.body,
        userId: req.user!.uid,
        updatedAt: new Date().toISOString(),
      });
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid profile payload',
          details: parsed.error.issues,
        });
        return;
      }
      await firestoreRest.setDoc(
        'candidate_profiles',
        req.user!.uid,
        parsed.data as Record<string, unknown>,
        req.idToken!
      );
      res.json({ profile: parsed.data });
    } catch (error) {
      console.error('Save profile error:', error);
      res.status(500).json({ error: 'Failed to save candidate profile.' });
    }
  });

  // 4. Resume Upload & Structured Parsing
  app.post('/api/resumes/upload', requireAuth, upload.single('resume'), async (req: AuthRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No resume file provided. Attach a PDF or DOCX file.' });
        return;
      }

      validateResumeFile(file);
      const extractedText = await extractTextFromResume(file.buffer, file.originalname, file.mimetype);
      const parsedProfile = await parseResumeToProfile(extractedText, req.user!.uid);

      const resumeId = await firestoreRest.addDoc(
        'resumes',
        {
          userId: req.user!.uid,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          extractedText: extractedText.slice(0, 35000),
          parsedProfile,
          status: 'parsed',
          createdAt: new Date().toISOString(),
        },
        req.idToken!
      );

      res.json({
        resumeId,
        fileName: file.originalname,
        extractedTextPreview: extractedText.slice(0, 1200),
        parsedProfile,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Resume parsing failed.';
      console.error('Resume upload error:', error);
      const isClientErr =
        msg.includes('Unsupported') ||
        msg.includes('size limit') ||
        msg.includes('empty') ||
        msg.includes('readable text');
      res.status(isClientErr ? 400 : 500).json({ error: msg });
    }
  });

  // 5. Candidate Preferences (Persistent Memory)
  app.get('/api/preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      const existing = await firestoreRest.getDoc<CandidatePreferences>(
        'candidate_preferences',
        req.user!.uid,
        req.idToken!
      );
      if (!existing) {
        res.json({
          preferences: CandidatePreferencesSchema.parse({
            userId: req.user!.uid,
            updatedAt: new Date().toISOString(),
          }),
        });
        return;
      }
      res.json({ preferences: existing });
    } catch (error) {
      console.error('Get preferences error:', error);
      res.status(500).json({ error: 'Failed to load preferences.' });
    }
  });

  app.put('/api/preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      const parsed = CandidatePreferencesSchema.safeParse({
        ...req.body,
        userId: req.user!.uid,
        updatedAt: new Date().toISOString(),
      });
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid preferences payload', details: parsed.error.issues });
        return;
      }
      await firestoreRest.setDoc(
        'candidate_preferences',
        req.user!.uid,
        parsed.data as Record<string, unknown>,
        req.idToken!
      );
      res.json({ preferences: parsed.data });
    } catch (error) {
      console.error('Save preferences error:', error);
      res.status(500).json({ error: 'Failed to save preferences.' });
    }
  });

  app.delete('/api/preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      await firestoreRest.deleteDoc('candidate_preferences', req.user!.uid, req.idToken!);
      res.json({ cleared: true });
    } catch (error) {
      console.error('Delete preferences error:', error);
      res.status(500).json({ error: 'Failed to clear preferences.' });
    }
  });

  // 6. Jobs Index, Details, Ingestion & Activation
  app.get('/api/jobs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const jobs = await listAllJobs(req.idToken!);
      const filtered = includeInactive ? jobs : jobs.filter((j) => j.isActive);
      res.json({
        total: filtered.length,
        jobs: filtered.map(({ embedding: _e, ...rest }) => rest),
      });
    } catch (error) {
      console.error('List jobs error:', error);
      res.status(500).json({ error: 'Failed to list jobs.' });
    }
  });

  app.get('/api/jobs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const job = await getJobById(String(req.params.id), req.idToken!);
      if (!job) {
        res.status(404).json({ error: 'Job not found.' });
        return;
      }
      const { profile, prefs, savedJobIds } = await getUserContext(req.user!.uid, req.idToken!);
      const ranked = scoreJobForCandidate({
        job,
        query: '',
        mode: 'keyword',
        semanticSim: 0.72,
        keywordSim: 0.72,
        profile,
        prefs,
        savedJobIds,
      });
      res.json({ result: ranked });
    } catch (error) {
      console.error('Get job detail error:', error);
      res.status(500).json({ error: 'Failed to fetch job details.' });
    }
  });

  app.post('/api/jobs/ingest', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { format, payload, updateDuplicates } = req.body as {
        format?: 'json' | 'csv' | 'single';
        payload?: unknown;
        updateDuplicates?: boolean;
      };

      let records: unknown[] = [];
      if (format === 'csv' && typeof payload === 'string') {
        records = parseJobsCsv(payload);
      } else if (format === 'json') {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        records = Array.isArray(parsed) ? parsed : [parsed];
      } else if (format === 'single' && payload && typeof payload === 'object') {
        records = [payload];
      } else {
        res.status(400).json({ error: 'Invalid ingestion format. Use "single", "json", or "csv".' });
        return;
      }

      if (records.length === 0) {
        res.status(400).json({ error: 'No job records found in payload.' });
        return;
      }

      const summary = await ingestJobs(records, req.idToken!, {
        updateDuplicates: Boolean(updateDuplicates),
        computeEmbeddings: true,
      });
      res.json(summary);
    } catch (error) {
      console.error('Job ingestion error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Job ingestion failed.',
      });
    }
  });

  app.patch('/api/jobs/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ isActive: z.boolean() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Expected { isActive: boolean }.' });
        return;
      }
      const updated = await setJobActiveStatus(
        String(req.params.id),
        parsed.data.isActive,
        req.idToken!
      );
      if (!updated) {
        res.status(404).json({ error: 'Job not found.' });
        return;
      }
      const { embedding: _e, ...publicJob } = updated;
      res.json({ job: publicJob });
    } catch (error) {
      console.error('Job status update error:', error);
      res.status(500).json({ error: 'Failed to update job status.' });
    }
  });

  // 7. Hybrid Semantic + Keyword Search & Explainable Ranking
  app.post('/api/search', requireAuth, async (req: AuthRequest, res) => {
    try {
      const parsed = SearchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid search request', details: parsed.error.issues });
        return;
      }

      const { profile, prefs, savedJobIds } = await getUserContext(req.user!.uid, req.idToken!);
      const searchResult = await searchAndRankJobs({
        ...parsed.data,
        profile,
        prefs,
        savedJobIds,
        idToken: req.idToken!,
      });

      if (parsed.data.query.trim().length > 0) {
        firestoreRest
          .addDoc(
            'search_history',
            {
              userId: req.user!.uid,
              query: parsed.data.query.trim(),
              mode: parsed.data.mode,
              filters: parsed.data.filters,
              resultCount: searchResult.results.length,
              latencyMs: searchResult.latencyMs,
              createdAt: new Date().toISOString(),
            },
            req.idToken!
          )
          .catch((err) => console.warn('Search history write failed:', err));
      }

      res.json({
        ...searchResult,
        mode: parsed.data.mode,
        rankingWeights: RANKING_WEIGHTS,
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Search failed.',
      });
    }
  });

  // 8. Personalized Recommendations
  app.get('/api/recommendations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { profile, prefs, savedJobIds } = await getUserContext(req.user!.uid, req.idToken!);
      const query = [
        ...(prefs?.preferredRoles || []),
        ...(profile?.preferredRoles || []),
        ...(profile?.skills?.slice(0, 6) || []),
      ]
        .filter(Boolean)
        .join(' ');

      const searchResult = await searchAndRankJobs({
        query,
        mode: 'hybrid',
        filters: { onlyActive: true, applySavedPreferences: true },
        limit: 10,
        profile,
        prefs,
        savedJobIds,
        idToken: req.idToken!,
      });

      res.json({
        ...searchResult,
        rankingWeights: RANKING_WEIGHTS,
      });
    } catch (error) {
      console.error('Recommendations error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to compute recommendations.',
      });
    }
  });

  // 9. Job Comparison
  app.post('/api/jobs/compare', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        jobIds: z.array(z.string().min(1).max(160)).min(2).max(3),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Select 2 to 3 valid job IDs to compare.' });
        return;
      }

      const { profile, prefs, savedJobIds } = await getUserContext(req.user!.uid, req.idToken!);
      const results = [];
      for (const id of parsed.data.jobIds) {
        const job = await getJobById(id, req.idToken!);
        if (!job) {
          res.status(404).json({ error: `Job ID "${id}" not found.` });
          return;
        }
        results.push(
          scoreJobForCandidate({
            job,
            query: '',
            mode: 'keyword',
            semanticSim: 0.72,
            keywordSim: 0.72,
            profile,
            prefs,
            savedJobIds,
          })
        );
      }

      res.json({ comparison: results });
    } catch (error) {
      console.error('Compare jobs error:', error);
      res.status(500).json({ error: 'Failed to compare jobs.' });
    }
  });

  // 10. Saved Jobs
  app.get('/api/saved-jobs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { profile, prefs, savedJobIds } = await getUserContext(req.user!.uid, req.idToken!);
      const savedRows = await firestoreRest.queryByUserId<{
        jobId?: string;
        notes?: string;
        savedAt?: string;
      }>('saved_jobs', req.user!.uid, req.idToken!);

      const items = [];
      for (const row of savedRows) {
        const data = row.data;
        if (!data.jobId) continue;
        const job = await getJobById(String(data.jobId), req.idToken!);
        if (!job) continue;
        const ranked = scoreJobForCandidate({
          job,
          query: '',
          mode: 'keyword',
          semanticSim: 0.72,
          keywordSim: 0.72,
          profile,
          prefs,
          savedJobIds,
        });
        items.push({
          ...ranked,
          notes: data.notes || '',
          savedAt: data.savedAt || '',
        });
      }

      items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      res.json({ savedJobs: items });
    } catch (error) {
      console.error('Get saved jobs error:', error);
      res.status(500).json({ error: 'Failed to load saved jobs.' });
    }
  });

  app.post('/api/saved-jobs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        jobId: z.string().min(1).max(160),
        notes: z.string().max(1000).optional().default(''),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid jobId.' });
        return;
      }

      const job = await getJobById(parsed.data.jobId, req.idToken!);
      if (!job) {
        res.status(404).json({ error: 'Job not found.' });
        return;
      }

      const docId = `${req.user!.uid}_${job.id}`;
      const payload = {
        userId: req.user!.uid,
        jobId: job.id,
        notes: parsed.data.notes,
        savedAt: new Date().toISOString(),
      };
      await firestoreRest.setDoc('saved_jobs', docId, payload, req.idToken!);
      res.json({ saved: true, ...payload });
    } catch (error) {
      console.error('Save job error:', error);
      res.status(500).json({ error: 'Failed to save job.' });
    }
  });

  app.delete('/api/saved-jobs/:jobId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const docId = `${req.user!.uid}_${String(req.params.jobId)}`;
      await firestoreRest.deleteDoc('saved_jobs', docId, req.idToken!);
      res.json({ removed: true });
    } catch (error) {
      console.error('Delete saved job error:', error);
      res.status(500).json({ error: 'Failed to remove saved job.' });
    }
  });

  // 11. Agentic Assistant & Tool Logs
  app.get('/api/agent/sessions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await firestoreRest.queryByUserId<Record<string, unknown>>(
        'agent_sessions',
        req.user!.uid,
        req.idToken!
      );
      const sessions = rows
        .map((r) => ({ id: r.id, ...r.data }))
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
        );
      res.json({ sessions });
    } catch (error) {
      console.error('Get agent sessions error:', error);
      res.status(500).json({ error: 'Failed to load agent sessions.' });
    }
  });

  app.post('/api/agent/chat', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        sessionId: z.string().max(128).optional(),
        message: z.string().min(1).max(1500),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Message is required (max 1500 chars).' });
        return;
      }

      const uid = req.user!.uid;
      const idToken = req.idToken!;
      const sessionId = parsed.data.sessionId || `sess_${Date.now()}`;
      const docId = `${uid}_${sessionId}`;
      const existing = await firestoreRest.getDoc<{ messages?: AgentChatMessage[] }>(
        'agent_sessions',
        docId,
        idToken
      );
      const existingMessages: AgentChatMessage[] = existing?.messages || [];

      const { profile, prefs, savedJobIds } = await getUserContext(uid, idToken);

      const agentRes = await runAgentTurn({
        userId: uid,
        idToken,
        sessionId,
        message: parsed.data.message,
        history: existingMessages.map((m) => ({ role: m.role, content: m.content })),
        profile,
        prefs,
        savedJobIds,
      });

      const now = new Date().toISOString();
      const userMsg: AgentChatMessage = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        content: parsed.data.message,
        createdAt: now,
      };
      const assistantMsg: AgentChatMessage = {
        id: `msg_a_${Date.now() + 1}`,
        role: 'assistant',
        content: agentRes.reply,
        toolTraces: agentRes.toolTraces,
        referencedJobs: agentRes.referencedJobs,
        createdAt: new Date().toISOString(),
      };

      const updatedMessages = [...existingMessages, userMsg, assistantMsg].slice(-30);
      await firestoreRest.setDoc(
        'agent_sessions',
        docId,
        {
          userId: uid,
          sessionId,
          title: existingMessages[0]?.content.slice(0, 60) || parsed.data.message.slice(0, 60),
          messages: updatedMessages,
          updatedAt: new Date().toISOString(),
        },
        idToken
      );

      res.json({
        sessionId,
        message: assistantMsg,
        toolTraces: agentRes.toolTraces,
        referencedJobs: agentRes.referencedJobs,
      });
    } catch (error) {
      console.error('Agent chat error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Agent interaction failed.',
      });
    }
  });

  app.get('/api/agent/logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await firestoreRest.queryByUserId<Record<string, unknown>>(
        'agent_tool_logs',
        req.user!.uid,
        req.idToken!
      );
      const logs = rows
        .map((r) => ({ id: r.id, ...r.data }))
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        )
        .slice(0, 50);
      res.json({ logs });
    } catch (error) {
      console.error('Agent logs error:', error);
      res.status(500).json({ error: 'Failed to load agent tool logs.' });
    }
  });

  // 12. Live Evaluation Runner
  app.post('/api/evaluation/run', requireAuth, async (req: AuthRequest, res) => {
    try {
      const report = await runLiveEvaluation(req.user!.uid, req.idToken!);
      res.json({ report });
    } catch (error) {
      console.error('Evaluation run error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Evaluation suite failed.',
      });
    }
  });

  // Vite Dev Middleware or Static Production Build
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CareerMatch AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CareerMatch AI server:', err);
  process.exit(1);
});
