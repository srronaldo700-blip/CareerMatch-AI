import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bookmark,
  Bot,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Search,
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { api } from './lib/api';
import {
  CandidatePreferences,
  CandidateProfile,
  RankedJobResult,
} from './shared/types';
import { LandingPage } from './components/LandingPage';
import { DashboardView } from './components/DashboardView';
import { ResumeProfileView } from './components/ResumeProfileView';
import { SearchJobsView } from './components/SearchJobsView';
import { SavedJobsView } from './components/SavedJobsView';
import { AgentAssistantView } from './components/AgentAssistantView';
import { JobIngestionView } from './components/JobIngestionView';
import { EvaluationLabView } from './components/EvaluationLabView';
import { JobDetailModal } from './components/JobDetailModal';

type NavTab = 'dashboard' | 'search' | 'agent' | 'resume' | 'saved' | 'ingest' | 'evaluation';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'search', label: 'Job Search', icon: Search },
  { id: 'agent', label: 'AI Assistant', icon: Bot },
  { id: 'resume', label: 'Resume & Profile', icon: FileText },
  { id: 'saved', label: 'Saved Jobs', icon: Bookmark },
  { id: 'ingest', label: 'Job Index', icon: Database },
  { id: 'evaluation', label: 'Evaluation Lab', icon: Activity },
];

export default function App() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [preferences, setPreferences] = useState<CandidatePreferences | null>(null);
  const [savedJobs, setSavedJobs] = useState<(RankedJobResult & { notes?: string; savedAt?: string })[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<RankedJobResult | null>(null);

  const loadUserData = useCallback(async () => {
    if (!user) return;
    setSavedLoading(true);
    try {
      const [profRes, prefRes, savedRes] = await Promise.all([
        api.getProfile(),
        api.getPreferences(),
        api.getSavedJobs(),
      ]);
      setProfile(profRes.profile);
      setPreferences(prefRes.preferences);
      setSavedJobs(savedRes.savedJobs);
    } catch (err) {
      console.error('Failed to hydrate workspace state:', err);
    } finally {
      setSavedLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user, loadUserData]);

  const handleToggleSave = async (jobId: string, currentlySaved: boolean) => {
    if (currentlySaved) {
      await api.removeSavedJob(jobId);
    } else {
      await api.saveJob(jobId);
    }
    if (selectedJob && selectedJob.job.id === jobId) {
      setSelectedJob({ ...selectedJob, isSaved: !currentlySaved });
    }
    const savedRes = await api.getSavedJobs();
    setSavedJobs(savedRes.savedJobs);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <p className="text-sm text-[#64748B]">Loading CareerMatch AI...</p>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex">
      {/* Fixed Left Workspace Sidebar (240px) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-[#FFFFFF] border-r border-[#E2E8F0] sticky top-0 h-screen">
        <div className="h-16 px-6 flex items-center border-b border-[#E2E8F0]">
          <span className="font-display text-base font-bold tracking-tight text-[#0F172A] whitespace-nowrap">
            CareerMatch AI
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#EFF6FF] text-[#2563EB]'
                    : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.id === 'saved' && savedJobs.length > 0 && (
                  <span className="ml-auto font-mono text-xs text-[#64748B] tabular-nums">
                    {savedJobs.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E2E8F0]">
          <div className="text-xs font-medium text-[#0F172A] truncate">
            {user.displayName || 'Candidate'}
          </div>
          <div className="text-[11px] text-[#64748B] truncate mt-0.5">{user.email}</div>
          <button
            onClick={logout}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Contextual Header */}
        <header className="sticky top-0 z-20 h-16 bg-[#FFFFFF] border-b border-[#E2E8F0] px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-[#64748B] hidden sm:inline">Workspace</span>
            <span className="text-[#CBD5E1] hidden sm:inline">/</span>
            <span className="font-display font-semibold text-[#0F172A] truncate">
              {currentNav?.label}
            </span>
          </div>

          {/* Mobile compact nav selector */}
          <div className="flex items-center gap-2">
            <select
              aria-label="Navigate workspace"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as NavTab)}
              className="md:hidden px-2.5 py-1.5 text-xs border border-[#E2E8F0] rounded-lg bg-[#FFFFFF]"
            >
              {NAV_ITEMS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setActiveTab('agent')}
              className="px-3.5 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ask Agent
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              profile={profile}
              preferences={preferences}
              savedCount={savedJobs.length}
              onNavigate={(tab) => setActiveTab(tab as NavTab)}
              onSelectJob={setSelectedJob}
              onToggleSave={handleToggleSave}
            />
          )}

          {activeTab === 'search' && (
            <SearchJobsView
              onSelectJob={setSelectedJob}
              onToggleSave={handleToggleSave}
            />
          )}

          {activeTab === 'agent' && (
            <AgentAssistantView
              onSelectJob={setSelectedJob}
              onDataMutated={loadUserData}
            />
          )}

          {activeTab === 'resume' && (
            <ResumeProfileView
              profile={profile}
              preferences={preferences}
              onProfileSaved={setProfile}
              onPreferencesSaved={setPreferences}
            />
          )}

          {activeTab === 'saved' && (
            <SavedJobsView
              savedJobs={savedJobs}
              loading={savedLoading}
              onSelectJob={setSelectedJob}
              onRemove={(jobId) => handleToggleSave(jobId, true)}
              onGoToSearch={() => setActiveTab('search')}
            />
          )}

          {activeTab === 'ingest' && <JobIngestionView />}

          {activeTab === 'evaluation' && <EvaluationLabView />}
        </main>
      </div>

      {/* Job Details & Explainable Match Drawer */}
      <JobDetailModal
        item={selectedJob}
        onClose={() => setSelectedJob(null)}
        onToggleSave={handleToggleSave}
      />
    </div>
  );
}
