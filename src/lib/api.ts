import { auth } from './firebase';
import {
  AgentChatMessage,
  AgentToolTrace,
  CandidatePreferences,
  CandidateProfile,
  EvaluationReport,
  JobRecord,
  RankedJobResult,
  SearchRequest,
} from '../shared/types';

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    ...(extra || {}),
  };
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders(
    options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' }
  );
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getProfile: () => apiFetch<{ profile: CandidateProfile | null }>('/api/profile'),
  saveProfile: (profile: CandidateProfile) =>
    apiFetch<{ profile: CandidateProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),

  uploadResume: (file: File) => {
    const fd = new FormData();
    fd.append('resume', file);
    return apiFetch<{
      resumeId: string;
      fileName: string;
      extractedTextPreview: string;
      parsedProfile: CandidateProfile;
    }>('/api/resumes/upload', {
      method: 'POST',
      body: fd,
    });
  },

  getPreferences: () => apiFetch<{ preferences: CandidatePreferences }>('/api/preferences'),
  savePreferences: (preferences: CandidatePreferences) =>
    apiFetch<{ preferences: CandidatePreferences }>('/api/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    }),
  clearPreferences: () =>
    apiFetch<{ cleared: boolean }>('/api/preferences', { method: 'DELETE' }),

  searchJobs: (request: SearchRequest) =>
    apiFetch<{
      results: RankedJobResult[];
      totalEligible: number;
      latencyMs: number;
      mode: string;
    }>('/api/search', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getRecommendations: () =>
    apiFetch<{
      results: RankedJobResult[];
      totalEligible: number;
      latencyMs: number;
    }>('/api/recommendations'),

  getJobDetails: (jobId: string) =>
    apiFetch<{ result: RankedJobResult }>(`/api/jobs/${encodeURIComponent(jobId)}`),

  listJobs: (includeInactive = true) =>
    apiFetch<{ total: number; jobs: Omit<JobRecord, 'embedding'>[] }>(
      `/api/jobs?includeInactive=${includeInactive}`
    ),

  ingestJobs: (payload: {
    format: 'single' | 'json' | 'csv';
    payload: unknown;
    updateDuplicates?: boolean;
  }) =>
    apiFetch<{
      inserted: number;
      updated: number;
      duplicatesSkipped: number;
      invalidCount: number;
      errors: string[];
    }>('/api/jobs/ingest', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  toggleJobStatus: (jobId: string, isActive: boolean) =>
    apiFetch<{ job: Omit<JobRecord, 'embedding'> }>(`/api/jobs/${encodeURIComponent(jobId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  compareJobs: (jobIds: string[]) =>
    apiFetch<{ comparison: RankedJobResult[] }>('/api/jobs/compare', {
      method: 'POST',
      body: JSON.stringify({ jobIds }),
    }),

  getSavedJobs: () =>
    apiFetch<{ savedJobs: (RankedJobResult & { notes: string; savedAt: string })[] }>(
      '/api/saved-jobs'
    ),

  saveJob: (jobId: string, notes = '') =>
    apiFetch<{ saved: boolean }>('/api/saved-jobs', {
      method: 'POST',
      body: JSON.stringify({ jobId, notes }),
    }),

  removeSavedJob: (jobId: string) =>
    apiFetch<{ removed: boolean }>(`/api/saved-jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    }),

  getAgentSessions: () =>
    apiFetch<{ sessions: Array<{ id: string; sessionId: string; title: string; messages: AgentChatMessage[]; updatedAt: string }> }>(
      '/api/agent/sessions'
    ),

  sendAgentMessage: (message: string, sessionId?: string) =>
    apiFetch<{
      sessionId: string;
      message: AgentChatMessage;
      toolTraces: AgentToolTrace[];
      referencedJobs: RankedJobResult[];
    }>('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId }),
    }),

  runEvaluation: () =>
    apiFetch<{ report: EvaluationReport }>('/api/evaluation/run', {
      method: 'POST',
    }),
};
