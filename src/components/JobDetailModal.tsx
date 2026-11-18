import React from 'react';
import { Bookmark, BookmarkCheck, ExternalLink, Scale, X } from 'lucide-react';
import { RankedJobResult } from '../shared/types';

interface JobDetailModalProps {
  item: RankedJobResult | null;
  onClose: () => void;
  onToggleSave: (jobId: string, currentlySaved: boolean) => void;
  isCompared?: boolean;
  onToggleCompare?: (jobId: string) => void;
}

interface RadarAxis {
  label: string;
  value: number; // 0-100
}

function MatchSpiderChart({ axes }: { axes: RadarAxis[] }) {
  const size = 250;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 82;
  const levels = [25, 50, 75, 100];

  const pointAt = (index: number, pct: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    const r = (pct / 100) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const polygonPoints = axes
    .map((axis, idx) => {
      const p = pointAt(idx, Math.max(6, axis.value));
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[260px] mx-auto"
      role="img"
      aria-label="Spider chart comparing candidate match across six ranking dimensions"
    >
      {/* Concentric guide polygons */}
      {levels.map((lvl) => {
        const pts = axes
          .map((_, idx) => {
            const p = pointAt(idx, lvl);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(' ');
        return (
          <polygon
            key={lvl}
            points={pts}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={lvl === 100 ? 1.2 : 0.8}
          />
        );
      })}

      {/* Radial axes */}
      {axes.map((_, idx) => {
        const outer = pointAt(idx, 100);
        return (
          <line
            key={idx}
            x1={cx}
            y1={cy}
            x2={outer.x}
            y2={outer.y}
            stroke="#E2E8F0"
            strokeWidth={0.9}
          />
        );
      })}

      {/* Candidate Match Polygon */}
      <polygon
        points={polygonPoints}
        fill="rgba(37, 99, 235, 0.16)"
        stroke="#2563EB"
        strokeWidth={2}
      />

      {/* Vertex dots */}
      {axes.map((axis, idx) => {
        const p = pointAt(idx, Math.max(6, axis.value));
        return (
          <circle
            key={axis.label}
            cx={p.x}
            cy={p.y}
            r={3.2}
            fill="#2563EB"
            stroke="#FFFFFF"
            strokeWidth={1.2}
          />
        );
      })}

      {/* Axis labels */}
      {axes.map((axis, idx) => {
        const p = pointAt(idx, 123);
        const anchor =
          Math.abs(p.x - cx) < 10 ? 'middle' : p.x > cx ? 'start' : 'end';
        return (
          <text
            key={axis.label}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-[#475569] text-[10px] font-medium"
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

export function JobDetailModal({
  item,
  onClose,
  onToggleSave,
  isCompared,
  onToggleCompare,
}: JobDetailModalProps) {
  if (!item) return null;
  const { job, signalBreakdown } = item;

  const totalRequired = job.requiredSkills.length;
  const matchedRequiredCount = item.matchedRequiredSkills.length;
  const skillCoveragePct =
    totalRequired > 0 ? Math.round((matchedRequiredCount / totalRequired) * 100) : 0;

  const radarAxes: RadarAxis[] = [
    { label: 'Req Skills', value: signalBreakdown.requiredSkillScore },
    { label: 'Semantic', value: signalBreakdown.semanticScore },
    { label: 'Keyword', value: signalBreakdown.keywordScore },
    { label: 'Pref Skills', value: signalBreakdown.preferredSkillScore },
    { label: 'Experience', value: signalBreakdown.experienceCompatibilityScore },
    {
      label: 'Loc / Mode',
      value: Math.round(
        (signalBreakdown.locationCompatibilityScore + signalBreakdown.workModeScore) / 2
      ),
    },
  ];

  const signalRows = [
    { label: 'Required Skills Overlap (30%)', value: signalBreakdown.requiredSkillScore },
    { label: 'Semantic Embedding Similarity (22%)', value: signalBreakdown.semanticScore },
    { label: 'Keyword / BM25 Match (14%)', value: signalBreakdown.keywordScore },
    { label: 'Preferred Skills Overlap (10%)', value: signalBreakdown.preferredSkillScore },
    { label: 'Role Alignment (8%)', value: signalBreakdown.roleAlignmentScore },
    { label: 'Experience Compatibility (8%)', value: signalBreakdown.experienceCompatibilityScore },
    { label: 'Location Compatibility (4%)', value: signalBreakdown.locationCompatibilityScore },
    { label: 'Work-Mode Preference (4%)', value: signalBreakdown.workModeScore },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F172A]/40 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Job details for ${job.title}`}
    >
      <div className="w-full max-w-2xl bg-[#FFFFFF] h-full overflow-y-auto border-l border-[#E2E8F0] flex flex-col">
        <div className="sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-[#64748B]">
              {job.company} · {job.location} · {job.workMode}
            </p>
            <h2 className="font-display text-lg font-bold text-[#0F172A] mt-0.5">
              {job.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close job details"
            className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* Primary Meta + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E2E8F0]">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold text-[#2563EB] tabular-nums">
                  {item.relevanceScore}
                </span>
                <span className="text-xs text-[#64748B]">/ 100 Relevance Score</span>
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                Rule-based relevance according to ranking weights, not a hiring probability.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onToggleCompare && (
                <button
                  onClick={() => onToggleCompare(job.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    isCompared
                      ? 'bg-[#EFF6FF] border-[#2563EB] text-[#1D4ED8]'
                      : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>{isCompared ? 'In Compare' : 'Compare'}</span>
                </button>
              )}
              <button
                onClick={() => onToggleSave(job.id, item.isSaved)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  item.isSaved
                    ? 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
                    : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
                }`}
              >
                {item.isSaved ? (
                  <>
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Save Job</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Visual Explainable Match: Required-Skill Progress Bar + Spider Chart */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center pb-5 border-b border-[#E2E8F0]">
            <div className="sm:col-span-6 space-y-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-[#0F172A]">
                  Explainable Match Profile
                </h3>
                <p className="text-xs text-[#475569] mt-1.5 leading-relaxed">
                  {item.explanation}
                </p>
              </div>

              {/* Required Skills Coverage Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#0F172A]">Required Skills Coverage</span>
                  <span className="font-mono font-semibold text-[#2563EB] tabular-nums">
                    {matchedRequiredCount}/{totalRequired} ({skillCoveragePct}%)
                  </span>
                </div>
                <div
                  className="h-2.5 w-full rounded-full bg-[#F1F5F9] overflow-hidden border border-[#E2E8F0]"
                  role="progressbar"
                  aria-valuenow={skillCoveragePct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-[#2563EB] rounded-full transition-all duration-200"
                    style={{ width: `${skillCoveragePct}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-medium text-[#16A34A]">Matched Required: </span>
                  <span className="text-[#334155]">
                    {item.matchedRequiredSkills.length > 0
                      ? item.matchedRequiredSkills.join(' · ')
                      : 'None matched against current profile'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-[#D97706]">Missing Required: </span>
                  <span className="text-[#334155]">
                    {item.missingRequiredSkills.length > 0
                      ? item.missingRequiredSkills.join(' · ')
                      : 'No required skill gaps'}
                  </span>
                </div>
                {item.matchedPreferredSkills.length > 0 && (
                  <div>
                    <span className="font-medium text-[#0F172A]">Matched Preferred: </span>
                    <span className="text-[#475569]">
                      {item.matchedPreferredSkills.join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:col-span-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
              <MatchSpiderChart axes={radarAxes} />
            </div>
          </div>

          {/* Signal Breakdown with Visual Progress Bars */}
          <div>
            <h3 className="font-display text-sm font-semibold text-[#0F172A] mb-3">
              Ranking Signal Breakdown
            </h3>
            <div className="border border-[#E2E8F0] rounded-lg divide-y divide-[#E2E8F0]">
              {signalRows.map((row) => (
                <div key={row.label} className="px-4 py-2.5 flex items-center gap-4 text-xs">
                  <span className="text-[#334155] w-56 shrink-0">{row.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB] rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, row.value))}%` }}
                    />
                  </div>
                  <span className="font-mono tabular-nums text-[#0F172A] w-10 text-right shrink-0">
                    {row.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Role Metadata & Description */}
          <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
            <h3 className="font-display text-sm font-semibold text-[#0F172A]">
              Role Description &amp; Requirements
            </h3>
            <div className="text-xs text-[#64748B] flex flex-wrap gap-x-4 gap-y-1">
              <span>Experience: {job.experienceLevel} ({job.experienceRequirement})</span>
              <span>·</span>
              <span>Type: {job.employmentType}</span>
              <span>·</span>
              <span>Posted: {job.postedDate}</span>
              <span>·</span>
              <span>Source: {job.source}</span>
            </div>
            <p className="text-sm text-[#334155] leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
            {job.jobUrl && (
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:underline pt-1"
              >
                <span>View original listing link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
