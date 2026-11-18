import React from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { RankedJobResult } from '../shared/types';

interface SavedJobsViewProps {
  savedJobs: (RankedJobResult & { notes?: string; savedAt?: string })[];
  loading: boolean;
  onSelectJob: (item: RankedJobResult) => void;
  onRemove: (jobId: string) => Promise<void>;
  onGoToSearch: () => void;
}

export function SavedJobsView({
  savedJobs,
  loading,
  onSelectJob,
  onRemove,
  onGoToSearch,
}: SavedJobsViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0F172A]">Saved Jobs</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Bookmarked opportunities persisted to your account with live skill-match scoring.
        </p>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-14 bg-[#F1F5F9] rounded-lg" />
            ))}
          </div>
        ) : savedJobs.length === 0 ? (
          <div className="p-12 text-center">
            <Bookmark className="w-7 h-7 text-[#94A3B8] mx-auto mb-3" />
            <p className="font-display text-sm font-semibold text-[#0F172A]">No saved jobs yet</p>
            <p className="text-xs text-[#64748B] mt-1">
              Bookmark roles from Hybrid Search, Dashboard, or the AI Assistant to track them here.
            </p>
            <button
              onClick={onGoToSearch}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg cursor-pointer"
            >
              Browse Jobs
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {savedJobs.map((item) => (
              <div
                key={item.job.id}
                onClick={() => onSelectJob(item)}
                className="p-6 hover:bg-[#F8FAFC] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-semibold text-[#0F172A]">
                    {item.job.title}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1">
                    {item.job.company} · {item.job.location} · {item.job.workMode} · {item.job.experienceLevel}
                  </p>
                  <p className="text-xs text-[#334155] mt-2">{item.explanation}</p>
                  {item.notes && (
                    <p className="text-xs text-[#475569] mt-1.5 italic">Note: {item.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="font-mono text-lg font-semibold text-[#2563EB] tabular-nums">
                      {item.relevanceScore}
                    </span>
                    <span className="text-xs text-[#64748B] ml-1">/ 100</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.job.id);
                    }}
                    aria-label="Remove saved job"
                    className="p-2 text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
