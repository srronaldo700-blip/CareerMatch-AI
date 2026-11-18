import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Compass, Layers, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const { signInWithGoogle, authError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0"
          >
            CareerMatch AI
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#475569]">
            <a href="#retrieval" className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0">
              Hybrid Search
            </a>
            <a href="#ranking" className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0">
              Explainable Ranking
            </a>
            <a href="#agent" className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0">
              Agent Tools
            </a>
            <a href="#evaluation" className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0">
              Evaluation
            </a>
          </nav>

          <div className="shrink-0">
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section id="top" className="max-w-7xl mx-auto px-6 pt-16 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between py-2">
            <div>
              <p className="text-xs font-medium text-[#2563EB] mb-4">
                Built for 2027 Computer Engineering Candidates
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#0F172A] leading-[1.12] max-w-xl">
                Job discovery driven by hybrid retrieval and explainable ranking.
              </h1>
              <p className="mt-6 text-base text-[#475569] leading-relaxed max-w-xl">
                Upload your resume, confirm your structured profile without invented credentials,
                search across a normalized job index using semantic embeddings and keyword signals,
                and inspect every matched or missing skill before you apply.
              </p>

              {authError && (
                <div className="mt-5 p-3.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#B91C1C]">
                  {authError}
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  onClick={handleSignIn}
                  disabled={signingIn}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  <span>{signingIn ? 'Connecting...' : 'Launch Candidate Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#retrieval"
                  className="px-4 py-2.5 text-sm font-medium text-[#334155] hover:text-[#0F172A] border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-lg transition-colors"
                >
                  Inspect Architecture
                </a>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-[#E2E8F0] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#64748B]">
              <span>PDF &amp; DOCX Resume Parsing</span>
              <span aria-hidden="true">·</span>
              <span>Hybrid Vector + Keyword Search</span>
              <span aria-hidden="true">·</span>
              <span>6 Zod-Validated Agent Tools</span>
              <span aria-hidden="true">·</span>
              <span>Live P@5 / NDCG@5 Evaluation</span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[320px] rounded-xl overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC]">
              {!imgFailed ? (
                <img
                  src="/src/assets/images/careermatch_workspace_hero_1794932168275.jpg"
                  alt="Bright minimalist software engineering workspace desk with laptop and cobalt notebook"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center bg-[#F8FAFC]">
                  <Compass className="w-10 h-10 text-[#2563EB] mb-3" />
                  <p className="font-display text-base font-semibold text-[#0F172A]">
                    CareerMatch AI Workspace
                  </p>
                  <p className="text-sm text-[#64748B] mt-1 max-w-xs">
                    Semantic search, deterministic ranking signals, and tool-grounded job assistance.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Breakdown */}
      <section id="retrieval" className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F172A]">
              Engineered as a transparent search and recommendation system
            </h2>
            <p className="mt-3 text-sm text-[#475569] leading-relaxed">
              Every score, filter, and agent recommendation is backed by live backend retrieval,
              explicit skill matching, and logged tool calls rather than ungrounded chat responses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6">
              <Layers className="w-5 h-5 text-[#2563EB] mb-4" />
              <h3 className="font-display text-base font-semibold text-[#0F172A]">
                01. Hybrid Retrieval &amp; Hard Filters
              </h3>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                Combines dense text embeddings with BM25-weighted keyword scoring while enforcing
                strict location, work-mode, experience, and active-status filters before ranking.
              </p>
            </div>

            <div id="ranking" className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6">
              <CheckCircle2 className="w-5 h-5 text-[#2563EB] mb-4" />
              <h3 className="font-display text-base font-semibold text-[#0F172A]">
                02. Explainable Signal Scoring
              </h3>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                Displays matched required skills, missing required skills, experience alignment,
                and weighted signal breakdowns. Scores express rule-based relevance, never hiring probability.
              </p>
            </div>

            <div id="agent" className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6">
              <ShieldCheck className="w-5 h-5 text-[#2563EB] mb-4" />
              <h3 className="font-display text-base font-semibold text-[#0F172A]">
                03. Controlled Tool-Calling Agent
              </h3>
              <p className="mt-2 text-sm text-[#475569] leading-relaxed">
                Executes six Zod-validated tools with bounded iterations, per-tool timeouts,
                prompt-injection sanitization, and persistent preference memory.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Evaluation & Transparency Strip */}
      <section id="evaluation" className="border-t border-[#E2E8F0] bg-[#FFFFFF] py-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-xl font-bold text-[#0F172A]">
              Reproducible Evaluation Built Directly Into the Workspace
            </h2>
            <p className="mt-2 text-sm text-[#475569] leading-relaxed">
              Sign in to run the live evaluation benchmark measuring Precision@5, Recall@5, NDCG@5
              (Hybrid vs. Keyword baseline), hard-filter compliance, duplicate rejection, and
              prompt-injection defenses on the curated 2027 fresher/intern dataset.
            </p>
          </div>
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sign in to Explore
          </button>
        </div>
      </section>

      <footer className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <span>CareerMatch AI — Agentic Job Discovery &amp; Recommendation Platform</span>
          <span>Seeded demo jobs are explicitly labeled as synthetic curriculum records.</span>
        </div>
      </footer>
    </div>
  );
}
