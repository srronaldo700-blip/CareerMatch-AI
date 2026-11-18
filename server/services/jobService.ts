import crypto from 'crypto';
import { firestoreRest } from '../lib/firestoreRest.ts';
import { embedText } from '../lib/gemini.ts';
import { SEED_DEMO_JOBS } from '../data/seedJobs.ts';
import { JobInput, JobInputSchema, JobRecord } from '../../src/shared/types.ts';

const JOBS_COLLECTION = 'jobs';

// In-memory cache of job records & embeddings
let jobCache: Map<string, JobRecord> | null = null;
let seededInFirestore = false;

export function buildExternalKey(
  input: Pick<JobInput, 'externalKey' | 'title' | 'company' | 'location'>
): string {
  if (input.externalKey && input.externalKey.trim().length >= 2) {
    return input.externalKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .slice(0, 140);
  }
  const normalized = `${input.title}|${input.company}|${input.location}`.toLowerCase().trim();
  const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `job-${slug}-${hash}`;
}

export function buildJobEmbeddingText(
  job: Pick<
    JobInput,
    | 'title'
    | 'company'
    | 'description'
    | 'requiredSkills'
    | 'preferredSkills'
    | 'experienceLevel'
    | 'location'
    | 'workMode'
    | 'employmentType'
    | 'category'
  >
): string {
  return [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Category: ${job.category}`,
    `Level: ${job.experienceLevel} | Type: ${job.employmentType} | Mode: ${job.workMode} | Location: ${job.location}`,
    `Required Skills: ${job.requiredSkills.join(', ')}`,
    `Preferred Skills: ${job.preferredSkills.join(', ')}`,
    `Description: ${job.description}`,
  ].join('\n');
}

function normalizeJobInput(raw: JobInput): JobInput & { externalKey: string } {
  const cleanList = (items: string[]) =>
    Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));

  return {
    ...raw,
    externalKey: buildExternalKey(raw),
    title: raw.title.trim(),
    company: raw.company.trim(),
    description: raw.description.trim(),
    location: raw.location.trim(),
    category: raw.category.trim() || 'Software Engineering',
    requiredSkills: cleanList(raw.requiredSkills),
    preferredSkills: cleanList(raw.preferredSkills),
    postedDate: raw.postedDate?.trim() || new Date().toISOString().slice(0, 10),
    source: raw.source?.trim() || 'Manual Entry',
  };
}

function getSeededMemoryMap(): Map<string, JobRecord> {
  const map = new Map<string, JobRecord>();
  const now = new Date().toISOString();
  for (const seed of SEED_DEMO_JOBS) {
    const normalized = normalizeJobInput(seed);
    map.set(normalized.externalKey, {
      id: normalized.externalKey,
      ...normalized,
      updatedAt: now,
    });
  }
  return map;
}

export async function ensureJobsSeeded(idToken?: string): Promise<void> {
  if (!idToken) {
    if (!jobCache) {
      jobCache = getSeededMemoryMap();
    }
    return;
  }

  if (seededInFirestore && jobCache && jobCache.size > 0) {
    return;
  }

  try {
    const existing = await firestoreRest.listCollection<Omit<JobRecord, 'id'>>(
      JOBS_COLLECTION,
      idToken,
      100
    );

    if (existing.length === 0) {
      const now = new Date().toISOString();
      const map = new Map<string, JobRecord>();
      for (const seed of SEED_DEMO_JOBS) {
        const normalized = normalizeJobInput(seed);
        const docData = { ...normalized, updatedAt: now };
        map.set(normalized.externalKey, { id: normalized.externalKey, ...docData });
        firestoreRest
          .setDoc(JOBS_COLLECTION, normalized.externalKey, docData, idToken)
          .catch((err) => console.warn(`Seed write skipped for ${normalized.externalKey}:`, err));
      }
      jobCache = map;
    } else {
      const map = new Map<string, JobRecord>();
      for (const item of existing) {
        map.set(item.id, {
          id: item.id,
          ...item.data,
          externalKey: item.data.externalKey || item.id,
        });
      }
      jobCache = map;
    }

    seededInFirestore = true;
  } catch (err) {
    console.warn('Firestore jobs sync fell back to curated demo index:', err);
    if (!jobCache) {
      jobCache = getSeededMemoryMap();
    }
  }
}

export async function listAllJobs(idToken?: string, forceRefresh = false): Promise<JobRecord[]> {
  await ensureJobsSeeded(idToken);
  if (idToken && (!jobCache || forceRefresh)) {
    const existing = await firestoreRest.listCollection<Omit<JobRecord, 'id'>>(
      JOBS_COLLECTION,
      idToken,
      100
    );
    const map = new Map<string, JobRecord>();
    for (const item of existing) {
      const prev = jobCache?.get(item.id);
      map.set(item.id, {
        id: item.id,
        ...item.data,
        externalKey: item.data.externalKey || item.id,
        embedding: item.data.embedding || prev?.embedding,
      });
    }
    jobCache = map;
  }
  return Array.from((jobCache || getSeededMemoryMap()).values());
}

export async function getJobById(jobId: string, idToken?: string): Promise<JobRecord | null> {
  const jobs = await listAllJobs(idToken);
  return jobs.find((j) => j.id === jobId || j.externalKey === jobId) || null;
}

export async function ensureJobEmbeddings(jobs: JobRecord[], idToken?: string): Promise<void> {
  const missing = jobs.filter((j) => !j.embedding || j.embedding.length === 0);
  if (missing.length === 0) return;

  const batchSize = 6;
  for (let i = 0; i < missing.length; i += batchSize) {
    const slice = missing.slice(i, i + batchSize);
    await Promise.all(
      slice.map(async (job) => {
        const vector = await embedText(buildJobEmbeddingText(job));
        job.embedding = vector;
        if (jobCache) {
          jobCache.set(job.id, job);
        }
        // Keep embeddings in memory cache; persist full doc if idToken is present
        if (idToken) {
          try {
            const { id: _id, ...docData } = job;
            await firestoreRest.setDoc(JOBS_COLLECTION, job.id, docData, idToken);
          } catch {
            // Non-fatal: embedding remains cached in memory for instant search
          }
        }
      })
    );
  }
}

export interface IngestResult {
  inserted: number;
  updated: number;
  duplicatesSkipped: number;
  invalidCount: number;
  errors: string[];
  records: Omit<JobRecord, 'embedding'>[];
}

export async function ingestJobs(
  rawRecords: unknown[],
  idToken: string,
  options: { updateDuplicates?: boolean; computeEmbeddings?: boolean } = {}
): Promise<IngestResult> {
  const { updateDuplicates = false, computeEmbeddings = true } = options;
  await ensureJobsSeeded(idToken);
  const existingJobs = await listAllJobs(idToken);
  const existingKeys = new Set(existingJobs.map((j) => j.externalKey));

  const result: IngestResult = {
    inserted: 0,
    updated: 0,
    duplicatesSkipped: 0,
    invalidCount: 0,
    errors: [],
    records: [],
  };

  const now = new Date().toISOString();

  for (let idx = 0; idx < rawRecords.length; idx++) {
    const parsed = JobInputSchema.safeParse(rawRecords[idx]);
    if (!parsed.success) {
      result.invalidCount++;
      result.errors.push(
        `Row ${idx + 1}: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`
      );
      continue;
    }

    const normalized = normalizeJobInput(parsed.data);
    const key = normalized.externalKey;
    const exists = existingKeys.has(key);

    if (exists && !updateDuplicates) {
      result.duplicatesSkipped++;
      continue;
    }

    let embedding: number[] | undefined;
    if (computeEmbeddings && process.env.GEMINI_API_KEY) {
      try {
        embedding = await embedText(buildJobEmbeddingText(normalized));
      } catch (err) {
        console.warn(`Embedding skipped during ingest for ${key}:`, err);
      }
    }

    const recordToSave: Omit<JobRecord, 'id'> = {
      ...normalized,
      ...(embedding ? { embedding } : {}),
      updatedAt: now,
    };

    await firestoreRest.setDoc(JOBS_COLLECTION, key, recordToSave, idToken);
    existingKeys.add(key);

    const fullRecord: JobRecord = { id: key, ...recordToSave };
    if (jobCache) {
      jobCache.set(key, fullRecord);
    }

    if (exists) {
      result.updated++;
    } else {
      result.inserted++;
    }

    const { embedding: _ignored, ...publicRecord } = fullRecord;
    result.records.push(publicRecord);
  }

  return result;
}

export async function setJobActiveStatus(
  jobId: string,
  isActive: boolean,
  idToken: string
): Promise<JobRecord | null> {
  const existing = await getJobById(jobId, idToken);
  if (!existing) return null;

  const updatedAt = new Date().toISOString();
  const updated: JobRecord = { ...existing, isActive, updatedAt };
  const { id: _id, ...docData } = updated;
  await firestoreRest.setDoc(JOBS_COLLECTION, existing.id, docData, idToken);

  if (jobCache) {
    jobCache.set(existing.id, updated);
  }
  return updated;
}

export function parseJobsCsv(csvText: string): Record<string, unknown>[] {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const splitCsvLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      const val = values[idx] ?? '';
      if (header === 'requiredSkills' || header === 'preferredSkills') {
        row[header] = val
          .split(/[;|]/)
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (header === 'isActive' || header === 'isSyntheticDemo') {
        row[header] = val.toLowerCase() !== 'false';
      } else {
        row[header] = val;
      }
    });
    rows.push(row);
  }

  return rows;
}
