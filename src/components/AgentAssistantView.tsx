import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Send, ShieldAlert, Wrench } from 'lucide-react';
import { api } from '../lib/api';
import { AgentChatMessage, RankedJobResult } from '../shared/types';

interface AgentAssistantViewProps {
  onSelectJob: (item: RankedJobResult) => void;
  onDataMutated: () => void;
}

const STARTER_PROMPTS = [
  'Find remote AI/ML internships involving embeddings and LLMs, and explain my top match.',
  'Search for Python FastAPI backend internships and compare the top two roles.',
  'Save my preferred locations as Bengaluru and Remote, and preferred work modes as remote and hybrid.',
  'Check if there are any Quantum Computing Hardware internships in Antarctica.',
];

export function AgentAssistantView({ onSelectJob, onDataMutated }: AgentAssistantViewProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getAgentSessions()
      .then((res) => {
        if (res.sessions.length > 0) {
          const latest = res.sessions[0];
          setSessionId(latest.sessionId);
          setMessages(latest.messages || []);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError(null);
    setInput('');
    const optimisticUser: AgentChatMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);

    try {
      const res = await api.sendAgentMessage(trimmed, sessionId);
      setSessionId(res.sessionId);
      setMessages((prev) => [...prev, res.message]);

      // Refresh parent profile/prefs/saved state if the agent mutated preferences or saved a job
      const mutated = res.toolTraces.some(
        (t) => t.success && (t.toolName === 'update_preferences' || t.toolName === 'save_job')
      );
      if (mutated) {
        onDataMutated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent request failed.');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const toggleTrace = (key: string) => {
    setExpandedTraces((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F172A]">
            Controlled Agentic Job-Search Assistant
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Uses 6 Zod-validated tools (search, details, explain, compare, save, preferences) with iteration limits and prompt-injection guards.
          </p>
        </div>
        <button
          onClick={() => {
            setSessionId(`sess_${Date.now()}`);
            setMessages([]);
            setError(null);
          }}
          className="px-3.5 py-2 text-xs font-medium text-[#334155] bg-[#FFFFFF] border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg whitespace-nowrap shrink-0 cursor-pointer self-start"
        >
          New Session
        </button>
      </div>

      {/* Main Chat Container */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl flex flex-col h-[640px]">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto py-8 space-y-5">
              <div>
                <h2 className="font-display text-base font-semibold text-[#0F172A]">
                  Ask the assistant to search, compare, explain, or bookmark jobs
                </h2>
                <p className="text-xs text-[#64748B] mt-1">
                  Every recommendation is retrieved via live backend tools—never invented from memory.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left p-3.5 rounded-lg border border-[#E2E8F0] hover:border-[#2563EB] hover:bg-[#F8FAFC] transition-colors text-xs text-[#334155] leading-relaxed cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A]'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>

                {/* Audited Tool Execution Traces */}
                {msg.toolTraces && msg.toolTraces.length > 0 && (
                  <div className="mt-2.5 w-full max-w-3xl space-y-1.5">
                    {msg.toolTraces.map((trace, idx) => {
                      const traceKey = `${msg.id}_${idx}`;
                      const isOpen = Boolean(expandedTraces[traceKey]);
                      return (
                        <div
                          key={traceKey}
                          className="border border-[#E2E8F0] rounded-lg bg-[#FFFFFF] overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleTrace(traceKey)}
                            className="w-full px-3 py-2 flex items-center justify-between gap-3 text-xs hover:bg-[#F8FAFC] cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                              )}
                              <Wrench className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                              <span className="font-mono font-medium text-[#0F172A]">
                                {trace.toolName}
                              </span>
                              <span className="text-[#64748B] truncate">— {trace.summary}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[11px] text-[#64748B] tabular-nums">
                                {trace.latencyMs}ms
                              </span>
                              {trace.success ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                              ) : (
                                <ShieldAlert className="w-3.5 h-3.5 text-[#DC2626]" />
                              )}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="px-3 py-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC] font-mono text-[11px] text-[#334155] space-y-1">
                              <div>Args: {JSON.stringify(trace.args)}</div>
                              {trace.errorMessage && (
                                <div className="text-[#DC2626]">Error: {trace.errorMessage}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Grounded Referenced Jobs */}
                {msg.referencedJobs && msg.referencedJobs.length > 0 && (
                  <div className="mt-3 w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {msg.referencedJobs.slice(0, 4).map((item) => (
                      <button
                        key={item.job.id}
                        type="button"
                        onClick={() => onSelectJob(item)}
                        className="text-left p-3.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#2563EB] transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display text-xs font-semibold text-[#0F172A] line-clamp-1">
                            {item.job.title}
                          </p>
                          <span className="font-mono text-xs font-semibold text-[#2563EB] tabular-nums shrink-0">
                            {item.relevanceScore}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-0.5">
                          {item.job.company} · {item.job.location} · {item.job.workMode}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#2563EB]" />
              <span>Executing validated tools and synthesizing grounded response...</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-xs text-[#B91C1C]">
              {error}
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-[#E2E8F0] flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder="Ask to search jobs, compare roles, explain a match, or update preferences..."
            className="flex-1 px-4 py-2.5 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
