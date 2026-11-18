import { cosineSimilarity, embedText } from '../lib/gemini.ts';
import { ensureJobEmbeddings, listAllJobs } from './jobService.ts';
import {
  CandidatePreferences,
  CandidateProfile,
  JobRecord,
  RankedJobResult,
  RetrievalMode,
  SearchFilters,
  SignalBreakdown,
} from '../../src/shared/types.ts';

/**
 * Transparent, configurable ranking weights (sum = 1.00).
 * These compute rule-based relevance, NOT hiring probability.
 */
export const RANKING_WEIGHTS = {
  requiredSkill: 0.30,
  semantic: 0.22,
  keyword: 0.14,
  preferredSkill: 0.10,
  roleAlignment: 0.08,
  experience: 0.08,
  locationWorkMode: 0.08,
} as const;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'in', 'on', 'at', 'to', 'of', 'a', 'an', 'is', 'are',
  'as', 'by', 'or', 'be', 'from', 'that', 'this', 'jobs', 'job', 'role', 'roles',
  'looking', 'find', 'me', 'show', 'involving', 'using', 'based',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildCandidateSkillSet(profile: CandidateProfile | null, prefs: CandidatePreferences | null): Set<string> {
  const set = new Set<string>();
  const addAll = (arr?: string[]) => {
    (arr || []).forEach((s) => {
      const n = normalizeSkill(s);
      if (n) set.add(n);
    });
  };
  addAll(profile?.skills);
  addAll(profile?.programmingLanguages);
  addAll(profile?.frameworksAndTools);
  addAll(prefs?.preferredTechStack);
  return set;
}

/**
 * Hard eligibility filter — semantically similar jobs MUST NOT bypass these filters.
 */
export function passesHardFilters(
  job: JobRecord,
  filters: SearchFilters,
  prefs: CandidatePreferences | null
): boolean {
  if (filters.onlyActive && !job.isActive) {
    return false;
  }

  if (filters.workMode && job.workMode !== filters.workMode) {
    return false;
  }

  if (filters.experienceLevel && job.experienceLevel !== filters.experienceLevel) {
    return false;
  }

  if (filters.employmentType && job.employmentType !== filters.employmentType) {
    return false;
  }

  if (filters.category && filters.category.trim().length > 0) {
    const catQuery = filters.category.toLowerCase().trim();
    const jobText = `${job.category} ${job.title}`.toLowerCase();
    if (!jobText.includes(catQuery)) return false;
  }

  if (filters.location && filters.location.trim().length > 0) {
    const locQuery = filters.location.toLowerCase().trim();
    const jobLoc = job.location.toLowerCase();
    const matchesLoc = jobLoc.includes(locQuery) || (locQuery === 'remote' && job.workMode === 'remote');
    if (!matchesLoc) return false;
  }

  // Respect explicit user exclusions from saved preference memory
  if (filters.applySavedPreferences && prefs) {
    const jobLocLower = job.location.toLowerCase();
    const excludedLocHit = (prefs.excludedLocations || []).some(
      (ex) => ex.trim() && jobLocLower.includes(ex.toLowerCase().trim())
    );
    if (excludedLocHit) return false;

    const jobCatLower = `${job.category} ${job.title}`.toLowerCase();
    const excludedCatHit = (prefs.excludedCategories || []).some(
      (ex) => ex.trim() && jobCatLower.includes(ex.toLowerCase().trim())
    );
    if (excludedCatHit) return false;
  }

  return true;
}

/**
 * BM25-inspired keyword scoring with field boosts (title > skills > description).
 */
export function computeKeywordScore(query: string, job: JobRecord, corpus: JobRecord[]): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0.5; // neutral when browsing without query

  const titleTokens = new Set(tokenize(job.title));
  const skillTokens = new Set(tokenize([...job.requiredSkills, ...job.preferredSkills].join(' ')));
  const metaTokens = new Set(tokenize(`${job.company} ${job.location} ${job.workMode} ${job.experienceLevel} ${job.category}`));
  const descTokens = new Set(tokenize(job.description));

  const N = Math.max(corpus.length, 1);
  let weightedHits = 0;
  let maxPossible = 0;

  for (const token of queryTokens) {
    // IDF approximation
    let df = 0;
    for (const doc of corpus) {
      const text = `${doc.title} ${doc.requiredSkills.join(' ')} ${doc.location} ${doc.description}`.toLowerCase();
      if (text.includes(token)) df++;
    }
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5)) + 0.5;
    maxPossible += idf * 1.5;

    if (titleTokens.has(token)) {
      weightedHits += idf * 1.5;
    } else if (skillTokens.has(token)) {
      weightedHits += idf * 1.3;
    } else if (metaTokens.has(token)) {
      weightedHits += idf * 1.0;
    } else if (descTokens.has(token)) {
      weightedHits += idf * 0.7;
    }
  }

  return maxPossible > 0 ? Math.min(1, weightedHits / maxPossible) : 0;
}

const LEVEL_RANK: Record<string, number> = {
  intern: 0,
  fresher: 1,
  entry: 2,
  mid: 3,
};

function computeExperienceCompatibility(
  profileLevel: string | undefined,
  jobLevel: string
): { score: number; label: 'Aligned' | 'Stretch' | 'Under-leveled' | 'Unknown' } {
  if (!profileLevel || profileLevel === 'unknown') {
    return { score: 0.65, label: 'Unknown' };
  }
  const candRank = LEVEL_RANK[profileLevel] ?? 1;
  const jobRank = LEVEL_RANK[jobLevel] ?? 1;
  const diff = jobRank - candRank;

  if (diff === 0) return { score: 1.0, label: 'Aligned' };
  if (diff === 1) return { score: 0.75, label: 'Aligned' };
  if (diff >= 2) return { score: 0.25, label: 'Stretch' };
  return { score: 0.7, label: 'Under-leveled' };
}

function computeLocationAndWorkMode(
  job: JobRecord,
  prefs: CandidatePreferences | null
): {
  locScore: number;
  workModeScore: number;
  label: 'Aligned' | 'Partial' | 'Mismatch' | 'Open';
} {
  const hasLocPref = (prefs?.preferredLocations?.length || 0) > 0;
  const hasModePref = (prefs?.workModes?.length || 0) > 0;

  if (!hasLocPref && !hasModePref) {
    return { locScore: 0.75, workModeScore: 0.75, label: 'Open' };
  }

  const jobLoc = job.location.toLowerCase();
  const locMatch = !hasLocPref
    ? true
    : prefs!.preferredLocations.some(
        (loc) =>
          jobLoc.includes(loc.toLowerCase().trim()) ||
          (loc.toLowerCase().trim() === 'remote' && job.workMode === 'remote')
      );

  const modeMatch = !hasModePref ? true : prefs!.workModes.includes(job.workMode);

  const locScore = locMatch ? 1.0 : job.workMode === 'remote' ? 0.8 : 0.3;
  const workModeScore = modeMatch ? 1.0 : 0.35;

  if (locMatch && modeMatch) return { locScore, workModeScore, label: 'Aligned' };
  if (locMatch || modeMatch) return { locScore, workModeScore, label: 'Partial' };
  return { locScore, workModeScore, label: 'Mismatch' };
}

function computeRoleAlignment(
  job: JobRecord,
  profile: CandidateProfile | null,
  prefs: CandidatePreferences | null
): number {
  const targetRoles = [
    ...(prefs?.preferredRoles || []),
    ...(profile?.preferredRoles || []),
  ].filter(Boolean);

  if (targetRoles.length === 0) return 0.65;

  const jobTitleAndCat = `${job.title} ${job.category}`.toLowerCase();
  for (const role of targetRoles) {
    const roleTokens = tokenize(role);
    if (roleTokens.length === 0) continue;
    const hits = roleTokens.filter((t) => jobTitleAndCat.includes(t)).length;
    if (hits / roleTokens.length >= 0.5) return 1.0;
    if (hits > 0) return 0.75;
  }
  return 0.35;
}

export function scoreJobForCandidate(params: {
  job: JobRecord;
  query: string;
  mode: RetrievalMode;
  semanticSim: number;
  keywordSim: number;
  profile: CandidateProfile | null;
  prefs: CandidatePreferences | null;
  savedJobIds: Set<string>;
}): RankedJobResult {
  const { job, mode, semanticSim, keywordSim, profile, prefs, savedJobIds } = params;
  const candidateSkills = buildCandidateSkillSet(profile, prefs);

  const matchedRequiredSkills: string[] = [];
  const missingRequiredSkills: string[] = [];

  for (const reqSkill of job.requiredSkills) {
    const norm = normalizeSkill(reqSkill);
    const matched =
      candidateSkills.has(norm) ||
      Array.from(candidateSkills).some((cs) => cs.includes(norm) || norm.includes(cs));
    if (matched) {
      matchedRequiredSkills.push(reqSkill);
    } else {
      missingRequiredSkills.push(reqSkill);
    }
  }

  const matchedPreferredSkills = job.preferredSkills.filter((prefSkill) => {
    const norm = normalizeSkill(prefSkill);
    return (
      candidateSkills.has(norm) ||
      Array.from(candidateSkills).some((cs) => cs.includes(norm) || norm.includes(cs))
    );
  });

  const requiredSkillScore =
    job.requiredSkills.length > 0
      ? candidateSkills.size > 0
        ? matchedRequiredSkills.length / job.requiredSkills.length
        : 0.5
      : 0.7;

  const preferredSkillScore =
    job.preferredSkills.length > 0
      ? candidateSkills.size > 0
        ? matchedPreferredSkills.length / job.preferredSkills.length
        : 0.4
      : 0.5;

  const roleAlignmentScore = computeRoleAlignment(job, profile, prefs);
  const exp = computeExperienceCompatibility(profile?.experienceLevel, job.experienceLevel);
  const locMode = computeLocationAndWorkMode(job, prefs);

  // Mode-adjusted retrieval signal
  const effectiveSemantic = mode === 'keyword' ? 0 : semanticSim;
  const effectiveKeyword = mode === 'semantic' ? 0 : keywordSim;

  let weightedSum = 0;
  if (mode === 'keyword') {
    weightedSum =
      requiredSkillScore * 0.32 +
      effectiveKeyword * 0.34 +
      preferredSkillScore * 0.10 +
      roleAlignmentScore * 0.08 +
      exp.score * 0.08 +
      ((locMode.locScore + locMode.workModeScore) / 2) * 0.08;
  } else if (mode === 'semantic') {
    weightedSum =
      requiredSkillScore * 0.30 +
      effectiveSemantic * 0.36 +
      preferredSkillScore * 0.10 +
      roleAlignmentScore * 0.08 +
      exp.score * 0.08 +
      ((locMode.locScore + locMode.workModeScore) / 2) * 0.08;
  } else {
    weightedSum =
      requiredSkillScore * RANKING_WEIGHTS.requiredSkill +
      effectiveSemantic * RANKING_WEIGHTS.semantic +
      effectiveKeyword * RANKING_WEIGHTS.keyword +
      preferredSkillScore * RANKING_WEIGHTS.preferredSkill +
      roleAlignmentScore * RANKING_WEIGHTS.roleAlignment +
      exp.score * RANKING_WEIGHTS.experience +
      ((locMode.locScore + locMode.workModeScore) / 2) * RANKING_WEIGHTS.locationWorkMode;
  }

  const relevanceScore = Math.round(Math.max(0, Math.min(1, weightedSum)) * 100);

  const signalBreakdown: SignalBreakdown = {
    requiredSkillScore: Math.round(requiredSkillScore * 100),
    preferredSkillScore: Math.round(preferredSkillScore * 100),
    semanticScore: Math.round(effectiveSemantic * 100),
    keywordScore: Math.round(effectiveKeyword * 100),
    roleAlignmentScore: Math.round(roleAlignmentScore * 100),
    experienceCompatibilityScore: Math.round(exp.score * 100),
    locationCompatibilityScore: Math.round(locMode.locScore * 100),
    workModeScore: Math.round(locMode.workModeScore * 100),
  };

  // Transparent, deterministic explanation tied directly to the computed signals
  const parts: string[] = [];
  if (candidateSkills.size === 0) {
    parts.push('Add your resume or skills to unlock personalized required-skill matching.');
  } else if (matchedRequiredSkills.length === job.requiredSkills.length) {
    parts.push(`Matches all ${job.requiredSkills.length} required skills (${matchedRequiredSkills.join(', ')}).`);
  } else if (matchedRequiredSkills.length > 0) {
    parts.push(
      `Matches ${matchedRequiredSkills.length}/${job.requiredSkills.length} required skills (${matchedRequiredSkills.join(', ')}); missing ${missingRequiredSkills.join(', ')}.`
    );
  } else {
    parts.push(`Missing required skills: ${missingRequiredSkills.join(', ')}.`);
  }

  if (exp.label === 'Aligned') {
    parts.push(`Experience level (${job.experienceLevel}) aligns with your profile.`);
  } else if (exp.label === 'Stretch') {
    parts.push(`Experience level (${job.experienceLevel}) is a stretch relative to your profile.`);
  }

  if (locMode.label === 'Aligned') {
    parts.push(`Location (${job.location}) and ${job.workMode} work mode match your saved preferences.`);
  } else if (locMode.label === 'Partial') {
    parts.push(`Partially matches your location/work-mode preferences (${job.location} · ${job.workMode}).`);
  }

  const { embedding: _unused, ...publicJob } = job;

  return {
    job: publicJob,
    relevanceScore,
    matchedRequiredSkills,
    missingRequiredSkills,
    matchedPreferredSkills,
    experienceAlignment: exp.label,
    locationWorkModeAlignment: locMode.label,
    signalBreakdown,
    explanation: parts.join(' '),
    isSaved: savedJobIds.has(job.id),
  };
}

export async function searchAndRankJobs(params: {
  query: string;
  mode: RetrievalMode;
  filters: SearchFilters;
  limit: number;
  profile: CandidateProfile | null;
  prefs: CandidatePreferences | null;
  savedJobIds: Set<string>;
  idToken?: string;
}): Promise<{ results: RankedJobResult[]; totalEligible: number; latencyMs: number }> {
  const start = Date.now();
  const { query, mode, filters, limit, profile, prefs, savedJobIds, idToken } = params;

  const allJobs = await listAllJobs(idToken);
  const eligibleJobs = allJobs.filter((job) => passesHardFilters(job, filters, prefs));

  if (eligibleJobs.length === 0) {
    return { results: [], totalEligible: 0, latencyMs: Date.now() - start };
  }

  let queryVector: number[] = [];
  if (mode !== 'keyword') {
    await ensureJobEmbeddings(eligibleJobs, idToken);
    const semanticInput =
      query.trim() ||
      [
        ...(prefs?.preferredRoles || []),
        ...(profile?.skills?.slice(0, 12) || []),
        profile?.headline || '',
      ]
        .filter(Boolean)
        .join(' ') ||
      'Entry-level software engineering backend Python AI ML internship';

    queryVector = await embedText(semanticInput);
  }

  const scored = eligibleJobs.map((job) => {
    const keywordSim = computeKeywordScore(query, job, eligibleJobs);
    const semanticSim =
      mode === 'keyword' || !job.embedding?.length || !queryVector.length
        ? 0
        : cosineSimilarity(queryVector, job.embedding);

    return scoreJobForCandidate({
      job,
      query,
      mode,
      semanticSim,
      keywordSim,
      profile,
      prefs,
      savedJobIds,
    });
  });

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    results: scored.slice(0, limit),
    totalEligible: eligibleJobs.length,
    latencyMs: Date.now() - start,
  };
}
