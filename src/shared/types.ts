import { z } from 'zod';

export const ExperienceLevelEnum = z.enum(['intern', 'fresher', 'entry', 'mid', 'unknown']);
export type ExperienceLevel = z.infer<typeof ExperienceLevelEnum>;

export const WorkModeEnum = z.enum(['remote', 'hybrid', 'onsite']);
export type WorkMode = z.infer<typeof WorkModeEnum>;

export const EmploymentTypeEnum = z.enum(['internship', 'full-time', 'contract']);
export type EmploymentType = z.infer<typeof EmploymentTypeEnum>;

export const RetrievalModeEnum = z.enum(['hybrid', 'semantic', 'keyword']);
export type RetrievalMode = z.infer<typeof RetrievalModeEnum>;

export const EducationItemSchema = z.object({
  institution: z.string().max(160),
  degree: z.string().max(160),
  field: z.string().max(120).default('Unknown'),
  graduationYear: z.string().max(40).default('Unknown'),
  gpa: z.string().max(40).default('Unknown'),
});

export const ProjectItemSchema = z.object({
  name: z.string().max(140),
  summary: z.string().max(500),
  technologies: z.array(z.string().max(60)).max(20).default([]),
});

export const InternshipItemSchema = z.object({
  role: z.string().max(140),
  organization: z.string().max(140),
  duration: z.string().max(80).default('Unknown'),
  highlights: z.string().max(500).default(''),
});

export const CandidateProfileSchema = z.object({
  userId: z.string().max(128).optional(),
  fullName: z.string().min(1).max(120).default('Unknown'),
  headline: z.string().max(180).default(''),
  experienceLevel: ExperienceLevelEnum.default('unknown'),
  experienceMonths: z.number().min(0).max(240).nullable().default(null),
  education: z.array(EducationItemSchema).max(10).default([]),
  skills: z.array(z.string().max(60)).max(80).default([]),
  programmingLanguages: z.array(z.string().max(60)).max(30).default([]),
  frameworksAndTools: z.array(z.string().max(60)).max(40).default([]),
  projects: z.array(ProjectItemSchema).max(15).default([]),
  internships: z.array(InternshipItemSchema).max(15).default([]),
  preferredRoles: z.array(z.string().max(80)).max(15).default([]),
  confirmed: z.boolean().default(false),
  updatedAt: z.string().optional(),
});
export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export const CandidatePreferencesSchema = z.object({
  userId: z.string().max(128).optional(),
  preferredRoles: z.array(z.string().max(80)).max(20).default([]),
  preferredLocations: z.array(z.string().max(80)).max(20).default([]),
  workModes: z.array(WorkModeEnum).max(5).default([]),
  preferredTechStack: z.array(z.string().max(60)).max(30).default([]),
  excludedLocations: z.array(z.string().max(80)).max(20).default([]),
  excludedCategories: z.array(z.string().max(80)).max(20).default([]),
  employmentTypes: z.array(EmploymentTypeEnum).max(5).default([]),
  updatedAt: z.string().optional(),
});
export type CandidatePreferences = z.infer<typeof CandidatePreferencesSchema>;

export const JobInputSchema = z.object({
  externalKey: z.string().min(2).max(160).optional(),
  title: z.string().min(2).max(180),
  company: z.string().min(1).max(140),
  description: z.string().min(10).max(15000),
  requiredSkills: z.array(z.string().max(60)).min(1).max(30),
  preferredSkills: z.array(z.string().max(60)).max(30).default([]),
  experienceLevel: z.enum(['intern', 'fresher', 'entry', 'mid']),
  experienceRequirement: z.string().max(180).default('0-1 years'),
  location: z.string().min(1).max(140),
  workMode: WorkModeEnum,
  employmentType: EmploymentTypeEnum,
  category: z.string().max(80).default('Software Engineering'),
  jobUrl: z.string().max(500).default(''),
  postedDate: z.string().max(40).default(''),
  source: z.string().max(120).default('Manual Entry'),
  isSyntheticDemo: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type JobInput = z.infer<typeof JobInputSchema>;

export interface JobRecord extends JobInput {
  id: string;
  externalKey: string;
  embedding?: number[];
  updatedAt: string;
}

export const SearchFiltersSchema = z.object({
  location: z.string().max(100).optional(),
  workMode: WorkModeEnum.optional(),
  experienceLevel: z.enum(['intern', 'fresher', 'entry', 'mid']).optional(),
  employmentType: EmploymentTypeEnum.optional(),
  category: z.string().max(80).optional(),
  onlyActive: z.boolean().default(true),
  applySavedPreferences: z.boolean().default(true),
});
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

export const SearchRequestSchema = z.object({
  query: z.string().max(400).default(''),
  mode: RetrievalModeEnum.default('hybrid'),
  filters: SearchFiltersSchema.default({ onlyActive: true, applySavedPreferences: true }),
  limit: z.number().int().min(1).max(50).default(15),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export interface SignalBreakdown {
  requiredSkillScore: number;
  preferredSkillScore: number;
  semanticScore: number;
  keywordScore: number;
  roleAlignmentScore: number;
  experienceCompatibilityScore: number;
  locationCompatibilityScore: number;
  workModeScore: number;
}

export interface RankedJobResult {
  job: Omit<JobRecord, 'embedding'>;
  relevanceScore: number; // 0-100 rule-based relevance score (not a hiring probability)
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedPreferredSkills: string[];
  experienceAlignment: 'Aligned' | 'Stretch' | 'Under-leveled' | 'Unknown';
  locationWorkModeAlignment: 'Aligned' | 'Partial' | 'Mismatch' | 'Open';
  signalBreakdown: SignalBreakdown;
  explanation: string;
  isSaved: boolean;
}

export interface AgentToolTrace {
  toolName: string;
  args: Record<string, unknown>;
  success: boolean;
  validationError: boolean;
  latencyMs: number;
  summary: string;
  errorMessage?: string;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolTraces?: AgentToolTrace[];
  referencedJobs?: RankedJobResult[];
  createdAt: string;
}

export interface EvaluationQueryMetric {
  queryId: string;
  query: string;
  precisionAt5: number;
  recallAt5: number;
  ndcgAt5: number;
  keywordPrecisionAt5: number;
  keywordNdcgAt5: number;
  hardFilterViolations: number;
  latencyMs: number;
}

export interface EvaluationReport {
  runAt: string;
  datasetSize: {
    jobsCount: number;
    queriesCount: number;
    judgmentsCount: number;
    agentTestCasesCount: number;
  };
  methodSummary: string;
  retrieval: {
    hybrid: { precisionAt5: number; recallAt5: number; ndcgAt5: number; avgLatencyMs: number };
    keywordBaseline: { precisionAt5: number; recallAt5: number; ndcgAt5: number; avgLatencyMs: number };
    hardFilterComplianceRate: number;
    perQuery: EvaluationQueryMetric[];
  };
  ranking: {
    explanationSignalAgreementRate: number;
    requiredSkillAccuracyRate: number;
  };
  agentAndSystem: {
    toolCallSuccessRate: number;
    invalidToolArgumentBlockRate: number;
    promptInjectionBlockRate: number;
    hallucinatedJobIdRejectRate: number;
    duplicateIngestionRejectRate: number;
    resumeSchemaValidationRate: number;
  };
}
