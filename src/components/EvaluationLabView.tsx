import React, { useState } from 'react';
import { Activity, Play } from 'lucide-react';
import { api } from '../lib/api';
import { EvaluationReport } from '../shared/types';

function pct(val: number): string {
  return `${Math.round(val * 100)}%`;
}

export function EvaluationLabView() {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await api.runEvaluation();
      setReport(res.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation suite failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F172A]">
            Evaluation &amp; Reliability Lab
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Execute live retrieval (P@5, R@5, NDCG@5), Hybrid vs. Keyword baseline comparison, and agent safety probes.
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-lg whitespace-nowrap shrink-0 cursor-pointer self-start"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{running ? 'Running Live Benchmark...' : 'Run Evaluation Suite'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      {!report && !running && (
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-10 text-center">
          <Activity className="w-7 h-7 text-[#2563EB] mx-auto mb-3" />
          <h2 className="font-display text-base font-semibold text-[#0F172A]">
            No fabricated numbers — run the live benchmark to compute metrics
          </h2>
          <p className="text-xs text-[#64748B] mt-1.5 max-w-lg mx-auto leading-relaxed">
            Clicking “Run Evaluation Suite” executes all 6 labeled fresher/intern queries against both
            the Keyword-Only baseline and Hybrid (Vector + BM25) engine, checks hard-filter compliance,
            audits explanation consistency, and runs live Zod, prompt-injection, and hallucinated-ID tests.
          </p>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Dataset & Method Summary */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5">
            <p className="text-xs text-[#64748B]">
              Evaluated at {new Date(report.runAt).toLocaleString()} · {report.datasetSize.jobsCount} indexed jobs ·{' '}
              {report.datasetSize.queriesCount} benchmark queries · {report.datasetSize.judgmentsCount} relevance judgments ·{' '}
              {report.datasetSize.agentTestCasesCount} agent/system test probes
            </p>
            <p className="text-sm text-[#334155] mt-2 leading-relaxed">{report.methodSummary}</p>
          </div>

          {/* Hybrid vs Keyword Baseline Comparison */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="font-display text-sm font-semibold text-[#0F172A]">
                01. Retrieval Quality: Hybrid vs. Keyword-Only Baseline
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                  <tr>
                    <th className="py-3 px-6 font-medium">System Variant</th>
                    <th className="py-3 px-4 font-medium text-right">Precision@5</th>
                    <th className="py-3 px-4 font-medium text-right">Recall@5</th>
                    <th className="py-3 px-4 font-medium text-right">NDCG@5</th>
                    <th className="py-3 px-6 font-medium text-right">Avg Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] font-mono tabular-nums">
                  <tr>
                    <td className="py-3 px-6 font-sans font-medium text-[#0F172A]">
                      Keyword-Only Baseline (BM25)
                    </td>
                    <td className="py-3 px-4 text-right">{report.retrieval.keywordBaseline.precisionAt5.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right">{report.retrieval.keywordBaseline.recallAt5.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right">{report.retrieval.keywordBaseline.ndcgAt5.toFixed(3)}</td>
                    <td className="py-3 px-6 text-right">{report.retrieval.keywordBaseline.avgLatencyMs} ms</td>
                  </tr>
                  <tr className="bg-[#EFF6FF]/40">
                    <td className="py-3 px-6 font-sans font-semibold text-[#2563EB]">
                      Hybrid Retrieval (Embeddings + BM25 + Hard Filters)
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#0F172A]">
                      {report.retrieval.hybrid.precisionAt5.toFixed(3)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#0F172A]">
                      {report.retrieval.hybrid.recallAt5.toFixed(3)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#0F172A]">
                      {report.retrieval.hybrid.ndcgAt5.toFixed(3)}
                    </td>
                    <td className="py-3 px-6 text-right">{report.retrieval.hybrid.avgLatencyMs} ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Agent, Ranking & System Reliability Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-xs text-[#64748B]">Hard-Filter Compliance</p>
              <p className="font-mono text-xl font-semibold text-[#16A34A] tabular-nums mt-1">
                {pct(report.retrieval.hardFilterComplianceRate)}
              </p>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-xs text-[#64748B]">Explanation Signal Agreement</p>
              <p className="font-mono text-xl font-semibold text-[#16A34A] tabular-nums mt-1">
                {pct(report.ranking.explanationSignalAgreementRate)}
              </p>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-xs text-[#64748B]">Valid Tool-Call Success</p>
              <p className="font-mono text-xl font-semibold text-[#2563EB] tabular-nums mt-1">
                {pct(report.agentAndSystem.toolCallSuccessRate)}
              </p>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-xs text-[#64748B]">Invalid Tool Args Blocked</p>
              <p className="font-mono text-xl font-semibold text-[#16A34A] tabular-nums mt-1">
                {pct(report.agentAndSystem.invalidToolArgumentBlockRate)}
              </p>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-xs text-[#64748B]">Prompt Injections Sanitized</p>
              <p className="font-mono text-xl font-semibold text-[#16A34A] tabular-nums mt-1">
                {pct(report.agentAndSystem.promptInjectionBlockRate)}
              </p>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-xs text-[#64748B]">Hallucinated Job ID Rejected</p>
              <p className="font-mono text-xl font-semibold text-[#16A34A] tabular-nums mt-1">
                {pct(report.agentAndSystem.hallucinatedJobIdRejectRate)}
              </p>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-xs text-[#64748B]">Duplicate Ingestion Detected</p>
              <p className="font-mono text-xl font-semibold text-[#16A34A] tabular-nums mt-1">
                {pct(report.agentAndSystem.duplicateIngestionRejectRate)}
              </p>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-xs text-[#64748B]">Resume Schema Validation</p>
              <p className="font-mono text-xl font-semibold text-[#16A34A] tabular-nums mt-1">
                {pct(report.agentAndSystem.resumeSchemaValidationRate)}
              </p>
            </div>
          </div>

          {/* Per-Query Breakdown Table */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="font-display text-sm font-semibold text-[#0F172A]">
                02. Per-Query Retrieval Breakdown
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                  <tr>
                    <th className="py-2.5 px-6 font-medium">Query</th>
                    <th className="py-2.5 px-3 font-medium text-right">Hybrid P@5</th>
                    <th className="py-2.5 px-3 font-medium text-right">Hybrid R@5</th>
                    <th className="py-2.5 px-3 font-medium text-right">Hybrid NDCG@5</th>
                    <th className="py-2.5 px-3 font-medium text-right">KW NDCG@5</th>
                    <th className="py-2.5 px-6 font-medium text-right">Filter Violations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {report.retrieval.perQuery.map((q) => (
                    <tr key={q.queryId}>
                      <td className="py-2.5 px-6 text-[#0F172A]">{q.query}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{q.precisionAt5.toFixed(3)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{q.recallAt5.toFixed(3)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#2563EB]">
                        {q.ndcgAt5.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#64748B]">
                        {q.keywordNdcgAt5.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-6 text-right font-mono tabular-nums">{q.hardFilterViolations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
