import React, { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, RotateCcw, Scale, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../lib/api';
import {
  EmploymentType,
  RankedJobResult,
  RetrievalMode,
  WorkMode,
} from '../shared/types';

interface SearchJobsViewProps {
  onSelectJob: (item: RankedJobResult) => void;
  onToggleSave: (jobId: string, currentlySaved: boolean) => Promise<void>;
}

const EXAMPLE_QUERIES = [
  'Python backend internship with FastAPI',
  'Entry-level software engineering jobs in Bengaluru',
  'Remote AI/ML internships involving embeddings and LLMs',
];

const ROLE_CATEGORIES = [
  'Backend',
  'AI/ML',
  'Software Engineering',
  'Full-Stack',
  'Data Engineering',
  'Frontend',
];

interface FilterState {
  location: string;
  workMode: WorkMode | '';
  experienceLevel: 'intern' | 'fresher' | 'entry' | 'mid' | '';
  employmentType: EmploymentType | '';
  category: string;
  onlyActive: boolean;
  applySavedPreferences: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  location: '',
  workMode: '',
  experienceLevel: '',
  employmentType: '',
  category: '',
  onlyActive: true,
  applySavedPreferences: true,
};

export function SearchJobsView({ onSelectJob, onToggleSave }: SearchJobsViewProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<RetrievalMode>('hybrid');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const [results, setResults] = useState<RankedJobResult[]>([]);
  const [totalEligible, setTotalEligible] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<RankedJobResult[] | null>(null);
  const [comparing, setComparing] = useState(false);

  const runSearch = async (
    overrideQuery?: string,
    overrideFilters?: FilterState,
    overrideMode?: RetrievalMode
  ) => {
    setLoading(true);
    setError(null);
    const q = overrideQuery !== undefined ? overrideQuery : query;
    const f = overrideFilters !== undefined ? overrideFilters : filters;
    const m = overrideMode !== undefined ? overrideMode : mode;

    try {
      const data = await api.searchJobs({
        query: q,
        mode: m,
        filters: {
          location: f.location.trim() || undefined,
          workMode: f.workMode || undefined,
          experienceLevel: f.experienceLevel || undefined,
          employmentType: f.employmentType || undefined,
          category: f.category.trim() || undefined,
          onlyActive: f.onlyActive,
          applySavedPreferences: f.applySavedPreferences,
        },
        limit: 20,
      });
      setResults(data.results);
      setTotalEligible(data.totalEligible);
      setLatencyMs(data.latencyMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSearch('', DEFAULT_FILTERS, 'hybrid');
  }, []);

  const applyFilterUpdate = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    runSearch(query, next, mode);
  };

  const handleModeChange = (nextMode: RetrievalMode) => {
    setMode(nextMode);
    runSearch(query, filters, nextMode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query, filters, mode);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    runSearch(query, DEFAULT_FILTERS, mode);
  };

  const toggleCompare = (jobId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(jobId)) return prev.filter((id) => id !== jobId);
      if (prev.length >= 3) return [...prev.slice(1), jobId];
      return [...prev, jobId];
    });
  };

  const handleCompareRun = async () => {
    if (compareIds.length < 2) return;
    setComparing(true);
    try {
      const data = await api.compareJobs(compareIds);
      setComparison(data.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed.');
    } finally {
      setComparing(false);
    }
  };

  const handleSave = async (e: React.MouseEvent, item: RankedJobResult) => {
    e.stopPropagation();
    await onToggleSave(item.job.id, item.isSaved);
    setResults((prev) =>
      prev.map((r) => (r.job.id === item.job.id ? { ...r, isSaved: !r.isSaved } : r))
    );
  };

  const isRemoteActive = filters.workMode === 'remote';
  const isInternshipActive = filters.employmentType === 'internship';
  const isEntryLevelActive = filters.experienceLevel === 'entry';
  const isBackendActive = filters.category.toLowerCase() === 'backend';

  const activeFilterCount = [
    filters.location,
    filters.workMode,
    filters.experienceLevel,
    filters.employmentType,
    filters.category,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F172A]">
            Hybrid Job Search &amp; Explainable Ranking
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Combine semantic embeddings, BM25 keyword retrieval, and strict eligibility filters.
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-[#F1F5F9] rounded-lg border border-[#E2E8F0] self-start">
          {(['hybrid', 'semantic', 'keyword'] as RetrievalMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleModeChange(m)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                mode === m
                  ? 'bg-[#FFFFFF] text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Filtering Sidebar + Search Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Filtering Sidebar */}
        <aside className="lg:col-span-3 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 space-y-5 lg:sticky lg:top-20">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#2563EB]" />
              <h2 className="font-display text-sm font-semibold text-[#0F172A]">
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </h2>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Quick One-Click Toggles */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#334155]">Quick Toggles</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  applyFilterUpdate({ workMode: isRemoteActive ? '' : 'remote' })
                }
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer whitespace-nowrap ${
                  isRemoteActive
                    ? 'bg-[#2563EB] border-[#2563EB] text-white'
                    : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]'
                }`}
              >
                Remote
              </button>

              <button
                type="button"
                onClick={() =>
                  applyFilterUpdate({
                    employmentType: isInternshipActive ? '' : 'internship',
                  })
                }
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer whitespace-nowrap ${
                  isInternshipActive
                    ? 'bg-[#2563EB] border-[#2563EB] text-white'
                    : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]'
                }`}
              >
                Internship
              </button>

              <button
                type="button"
                onClick={() =>
                  applyFilterUpdate({
                    experienceLevel: isEntryLevelActive ? '' : 'entry',
                  })
                }
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer whitespace-nowrap ${
                  isEntryLevelActive
                    ? 'bg-[#2563EB] border-[#2563EB] text-white'
                    : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]'
                }`}
              >
                Entry-level
              </button>

              <button
                type="button"
                onClick={() =>
                  applyFilterUpdate({ category: isBackendActive ? '' : 'Backend' })
                }
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer whitespace-nowrap ${
                  isBackendActive
                    ? 'bg-[#2563EB] border-[#2563EB] text-white'
                    : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]'
                }`}
              >
                Backend
              </button>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1.5">
              Location
            </label>
            <input
              type="text"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearch(query, filters, mode);
                }
              }}
              placeholder="e.g. Bengaluru, Mumbai"
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          {/* Work Mode */}
          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1.5">
              Work Mode
            </label>
            <select
              value={filters.workMode}
              onChange={(e) => applyFilterUpdate({ workMode: e.target.value as WorkMode | '' })}
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg bg-[#FFFFFF] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">All Work Modes</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>

          {/* Experience Level */}
          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1.5">
              Experience Level
            </label>
            <select
              value={filters.experienceLevel}
              onChange={(e) =>
                applyFilterUpdate({
                  experienceLevel: e.target.value as 'intern' | 'fresher' | 'entry' | 'mid' | '',
                })
              }
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg bg-[#FFFFFF] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">All Levels</option>
              <option value="intern">Intern</option>
              <option value="fresher">Fresher</option>
              <option value="entry">Entry-level</option>
              <option value="mid">Mid-level</option>
            </select>
          </div>

          {/* Role Category */}
          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1.5">
              Role Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => applyFilterUpdate({ category: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg bg-[#FFFFFF] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">All Categories</option>
              {ROLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Hard Eligibility Toggles */}
          <div className="pt-3 border-t border-[#E2E8F0] space-y-2.5 text-xs text-[#475569]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.onlyActive}
                onChange={(e) => applyFilterUpdate({ onlyActive: e.target.checked })}
                className="rounded border-[#CBD5E1] text-[#2563EB]"
              />
              <span>Active jobs only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.applySavedPreferences}
                onChange={(e) =>
                  applyFilterUpdate({ applySavedPreferences: e.target.checked })
                }
                className="rounded border-[#CBD5E1] text-[#2563EB]"
              />
              <span>Enforce saved exclusions</span>
            </label>
          </div>
        </aside>

        {/* Right Column: Search Input + Results */}
        <div className="lg:col-span-9 space-y-5 min-w-0">
          <form
            onSubmit={handleSubmit}
            className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 space-y-3.5"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search naturally, e.g. Python backend internship with FastAPI..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                {loading ? 'Searching...' : 'Search Jobs'}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Try:</span>
                {EXAMPLE_QUERIES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setQuery(example);
                      runSearch(example, filters, mode);
                    }}
                    className="text-[#2563EB] hover:underline text-left cursor-pointer"
                  >
                    “{example}”
                  </button>
                ))}
              </div>

              {latencyMs !== null && (
                <span className="font-mono tabular-nums shrink-0">
                  {results.length} of {totalEligible} eligible · {latencyMs} ms
                </span>
              )}
            </div>
          </form>

          {/* Compare Tray */}
          {compareIds.length > 0 && (
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#1E3A8A]">
                <span className="font-semibold">{compareIds.length} job(s) selected</span> (pick 2–3 to compare side by side).
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCompareIds([]);
                    setComparison(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-[#1E3A8A] hover:underline cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={handleCompareRun}
                  disabled={compareIds.length < 2 || comparing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>{comparing ? 'Comparing...' : 'Compare Selected'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Side-by-Side Comparison Matrix */}
          {comparison && (
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-[#0F172A]">
                  Side-by-Side Job Comparison
                </h2>
                <button
                  onClick={() => setComparison(null)}
                  className="p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                  aria-label="Close comparison"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-4 font-medium text-[#64748B] w-40">Dimension</th>
                      {comparison.map((c) => (
                        <th key={c.job.id} className="py-3 px-4 font-semibold text-[#0F172A]">
                          {c.job.title}
                          <div className="font-normal text-[#64748B] mt-0.5">{c.job.company}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    <tr>
                      <td className="py-2.5 px-4 text-[#64748B]">Relevance Score</td>
                      {comparison.map((c) => (
                        <td
                          key={c.job.id}
                          className="py-2.5 px-4 font-mono font-semibold text-[#2563EB] tabular-nums"
                        >
                          {c.relevanceScore} / 100
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[#64748B]">Location · Mode</td>
                      {comparison.map((c) => (
                        <td key={c.job.id} className="py-2.5 px-4 text-[#334155]">
                          {c.job.location} · {c.job.workMode}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[#64748B]">Matched Required</td>
                      {comparison.map((c) => (
                        <td key={c.job.id} className="py-2.5 px-4 text-[#16A34A]">
                          {c.matchedRequiredSkills.join(', ') || 'None'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[#64748B]">Missing Required</td>
                      {comparison.map((c) => (
                        <td key={c.job.id} className="py-2.5 px-4 text-[#D97706]">
                          {c.missingRequiredSkills.join(', ') || 'None'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#B91C1C]">
              {error}
            </div>
          )}

          {/* Results List */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
            {loading ? (
              <div className="divide-y divide-[#E2E8F0]">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-6 animate-pulse space-y-2">
                    <div className="h-4 bg-[#E2E8F0] rounded w-1/3" />
                    <div className="h-3 bg-[#F1F5F9] rounded w-1/2" />
                    <div className="h-3 bg-[#F1F5F9] rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="p-12 text-center">
                <p className="font-display text-sm font-semibold text-[#0F172A]">
                  No eligible jobs matched your active filters
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  Hard eligibility filters exclude ineligible roles even when semantically similar. Try clearing a sidebar toggle.
                </p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-4 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {results.map((item) => {
                  const isCompared = compareIds.includes(item.job.id);
                  return (
                    <div
                      key={item.job.id}
                      onClick={() => onSelectJob(item)}
                      className="p-6 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2">
                            <h3 className="font-display text-base font-semibold text-[#0F172A]">
                              {item.job.title}
                            </h3>
                            {!item.job.isActive && (
                              <span className="text-xs font-medium text-[#DC2626]">· Expired</span>
                            )}
                            {item.job.isSyntheticDemo && (
                              <span className="text-xs text-[#64748B]">· Demo Record</span>
                            )}
                          </div>

                          <p className="text-xs text-[#64748B] mt-1">
                            {item.job.company} · {item.job.location} · {item.job.workMode} · {item.job.experienceLevel} · {item.job.employmentType} · {item.job.category}
                          </p>

                          <p className="text-sm text-[#334155] mt-2.5 leading-relaxed">
                            {item.explanation}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                            <span className="text-[#16A34A]">
                              Matched: {item.matchedRequiredSkills.join(', ') || 'None'}
                            </span>
                            {item.missingRequiredSkills.length > 0 && (
                              <span className="text-[#D97706]">
                                Missing: {item.missingRequiredSkills.join(', ')}
                              </span>
                            )}
                            <span className="text-[#64748B] font-mono tabular-nums">
                              Sem {item.signalBreakdown.semanticScore}% · KW {item.signalBreakdown.keywordScore}%
                            </span>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-mono text-xl font-semibold text-[#2563EB] tabular-nums">
                              {item.relevanceScore}
                            </span>
                            <span className="text-xs text-[#64748B] ml-1">/ 100</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCompare(item.job.id);
                              }}
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                                isCompared
                                  ? 'bg-[#EFF6FF] border-[#2563EB] text-[#1D4ED8]'
                                  : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]'
                              }`}
                            >
                              {isCompared ? 'Selected' : 'Compare'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSave(e, item)}
                              aria-label={item.isSaved ? 'Remove bookmark' : 'Save job'}
                              className="p-1.5 text-[#475569] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors cursor-pointer"
                            >
                              {item.isSaved ? (
                                <BookmarkCheck className="w-4 h-4 text-[#2563EB]" />
                              ) : (
                                <Bookmark className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
