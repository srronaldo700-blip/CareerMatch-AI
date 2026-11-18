import React, { useEffect, useState } from 'react';
import { ArrowRight, Bookmark, BookmarkCheck, FileText, RefreshCw, Search, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { CandidatePreferences, CandidateProfile, RankedJobResult } from '../shared/types';

interface DashboardViewProps {
  profile: CandidateProfile | null;
  preferences: CandidatePreferences | null;
  savedCount: number;
  onNavigate: (tab: string) => void;
  onSelectJob: (item: RankedJobResult) => void;
  onToggleSave: (jobId: string, currentlySaved: boolean) => Promise<void>;
}

export function DashboardView({
  profile,
  preferences,
  savedCount,
  onNavigate,
  onSelectJob,
  onToggleSave,
}: DashboardViewProps) {
  const [recommendations, setRecommendations] = useState<RankedJobResult[]>([]);
  const [totalEligible, setTotalEligible] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecommendations();
      setRecommendations(data.results);
      setTotalEligible(data.totalEligible);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecs();
  }, [profile?.updatedAt, preferences?.updatedAt]);

  const handleSaveClick = async (e: React.MouseEvent, item: RankedJobResult) => {
    e.stopPropagation();
    await onToggleSave(item.job.id, item.isSaved);
    setRecommendations((prev) =>
      prev.map((r) => (r.job.id === item.job.id ? { ...r, isSaved: !r.isSaved } : r))
    );
  };

  const topScore = recommendations[0]?.relevanceScore ?? 0;

  return (
    <div className="space-y-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F172A]">
            Candidate Dashboard
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Personalized job recommendations ranked from live hybrid retrieval and your confirmed profile.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('resume')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#334155] bg-[#FFFFFF] border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{profile ? 'Update Resume' : 'Upload Resume'}</span>
          </button>
          <button
            onClick={() => onNavigate('search')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Hybrid Search</span>
          </button>
        </div>
      </div>

      {/* KPI Strip — Flat single elevation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs text-[#64748B]">Profile Status</p>
          <p className="font-display text-lg font-bold text-[#0F172A] mt-1">
            {profile?.confirmed ? 'Confirmed' : profile ? 'Draft' : 'Not Uploaded'}
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            {profile ? `${profile.skills.length} verified skills` : 'Upload PDF/DOCX to personalize'}
          </p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs text-[#64748B]">Eligible Active Jobs</p>
          <p className="font-mono text-2xl font-semibold text-[#0F172A] tabular-nums mt-1">
            {loading ? '—' : totalEligible}
          </p>
          <p className="text-xs text-[#64748B] mt-1">After hard eligibility filters</p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs text-[#64748B]">Top Relevance Score</p>
          <p className="font-mono text-2xl font-semibold text-[#2563EB] tabular-nums mt-1">
            {loading ? '—' : `${topScore}/100`}
          </p>
          <p className="text-xs text-[#64748B] mt-1">Rule-based match signal</p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs text-[#64748B]">Saved Bookmarks</p>
          <p className="font-mono text-2xl font-semibold text-[#0F172A] tabular-nums mt-1">
            {savedCount}
          </p>
          <button
            onClick={() => onNavigate('saved')}
            className="text-xs font-medium text-[#2563EB] hover:underline mt-1 cursor-pointer"
          >
            View saved jobs
          </button>
        </div>
      </div>

      {/* Onboarding prompt if profile is missing */}
      {!profile && (
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A]">
              Complete your candidate profile for accurate skill-gap explanations
            </h2>
            <p className="text-sm text-[#475569] mt-1">
              Upload a PDF or DOCX resume to extract your skills, projects, and education with
              mandatory review before saving.
            </p>
          </div>
          <button
            onClick={() => onNavigate('resume')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Upload Resume</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Ranked Recommendations Table/List */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A]">
              Top Ranked Opportunities
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Scores reflect skill overlap, semantic similarity, experience, and saved preferences—not hiring probability.
            </p>
          </div>
          <button
            onClick={loadRecs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#334155] border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="p-6 text-sm text-[#B91C1C] bg-[#FEF2F2] border-b border-[#FECACA]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="divide-y divide-[#E2E8F0]">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="p-6 animate-pulse flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-[#E2E8F0] rounded w-1/3" />
                  <div className="h-3 bg-[#F1F5F9] rounded w-2/3" />
                </div>
                <div className="h-8 w-16 bg-[#E2E8F0] rounded" />
              </div>
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-[#0F172A]">No matching active jobs found</p>
            <p className="text-xs text-[#64748B] mt-1">
              Adjust your excluded locations/categories in preferences or ingest new jobs.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {recommendations.slice(0, 6).map((item) => (
              <div
                key={item.job.id}
                onClick={() => onSelectJob(item)}
                className="px-6 py-4 hover:bg-[#F8FAFC] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <h3 className="font-display text-sm font-semibold text-[#0F172A]">
                      {item.job.title}
                    </h3>
                    {item.job.isSyntheticDemo && (
                      <span className="text-[11px] text-[#64748B]">· Demo Record</span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-1">
                    {item.job.company} · {item.job.location} · {item.job.workMode} · {item.job.experienceLevel} · {item.job.employmentType}
                  </p>
                  <p className="text-xs text-[#334155] mt-2 line-clamp-2">{item.explanation}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="font-mono text-base font-semibold text-[#2563EB] tabular-nums">
                      {item.relevanceScore}
                    </p>
                    <p className="text-[11px] text-[#64748B]">Relevance</p>
                  </div>

                  <button
                    onClick={(e) => handleSaveClick(e, item)}
                    aria-label={item.isSaved ? 'Remove bookmark' : 'Save job'}
                    className="p-2 text-[#475569] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors cursor-pointer"
                  >
                    {item.isSaved ? (
                      <BookmarkCheck className="w-4 h-4 text-[#2563EB]" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Assistant Launch */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-[#2563EB] mt-0.5 shrink-0" />
          <div>
            <h3 className="font-display text-sm font-semibold text-[#0F172A]">
              Ask the Controlled Job-Search Agent
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Compare two roles, ask why a job matches your resume, or update your saved preferences through audited tool calls.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('agent')}
          className="px-4 py-2 text-xs font-medium text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          Open Assistant
        </button>
      </div>
    </div>
  );
}
