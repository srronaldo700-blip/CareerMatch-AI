import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileUp, Save, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import {
  CandidatePreferences,
  CandidateProfile,
  ExperienceLevel,
  WorkMode,
} from '../shared/types';

interface ResumeProfileViewProps {
  profile: CandidateProfile | null;
  preferences: CandidatePreferences | null;
  onProfileSaved: (p: CandidateProfile) => void;
  onPreferencesSaved: (p: CandidatePreferences) => void;
}

const EMPTY_PROFILE: CandidateProfile = {
  fullName: '',
  headline: '',
  experienceLevel: 'intern',
  experienceMonths: null,
  education: [],
  skills: [],
  programmingLanguages: [],
  frameworksAndTools: [],
  projects: [],
  internships: [],
  preferredRoles: [],
  confirmed: false,
};

const EMPTY_PREFS: CandidatePreferences = {
  preferredRoles: [],
  preferredLocations: [],
  workModes: [],
  preferredTechStack: [],
  excludedLocations: [],
  excludedCategories: [],
  employmentTypes: [],
};

function parseCsvList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

export function ResumeProfileView({
  profile,
  preferences,
  onProfileSaved,
  onPreferencesSaved,
}: ResumeProfileViewProps) {
  const [draft, setDraft] = useState<CandidateProfile>(profile || EMPTY_PROFILE);
  const [prefsDraft, setPrefsDraft] = useState<CandidatePreferences>(preferences || EMPTY_PREFS);

  const [skillsText, setSkillsText] = useState((profile?.skills || []).join(', '));
  const [langsText, setLangsText] = useState((profile?.programmingLanguages || []).join(', '));
  const [toolsText, setToolsText] = useState((profile?.frameworksAndTools || []).join(', '));
  const [rolesText, setRolesText] = useState((profile?.preferredRoles || []).join(', '));

  const [prefRolesText, setPrefRolesText] = useState((preferences?.preferredRoles || []).join(', '));
  const [prefLocsText, setPrefLocsText] = useState((preferences?.preferredLocations || []).join(', '));
  const [prefStackText, setPrefStackText] = useState((preferences?.preferredTechStack || []).join(', '));
  const [exclLocsText, setExclLocsText] = useState((preferences?.excludedLocations || []).join(', '));
  const [exclCatsText, setExclCatsText] = useState((preferences?.excludedCategories || []).join(', '));

  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsNotice, setPrefsNotice] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDraft(profile);
      setSkillsText(profile.skills.join(', '));
      setLangsText(profile.programmingLanguages.join(', '));
      setToolsText(profile.frameworksAndTools.join(', '));
      setRolesText(profile.preferredRoles.join(', '));
    }
  }, [profile]);

  useEffect(() => {
    if (preferences) {
      setPrefsDraft(preferences);
      setPrefRolesText(preferences.preferredRoles.join(', '));
      setPrefLocsText(preferences.preferredLocations.join(', '));
      setPrefStackText(preferences.preferredTechStack.join(', '));
      setExclLocsText(preferences.excludedLocations.join(', '));
      setExclCatsText(preferences.excludedCategories.join(', '));
    }
  }, [preferences]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadInfo(null);

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx') && !lower.endsWith('.txt')) {
      setUploadError('Invalid file format. Please upload a .pdf, .docx, or .txt resume.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File exceeds the 5 MB upload limit.');
      return;
    }

    setUploading(true);
    try {
      const res = await api.uploadResume(file);
      const parsed = res.parsedProfile;
      setDraft(parsed);
      setSkillsText(parsed.skills.join(', '));
      setLangsText(parsed.programmingLanguages.join(', '));
      setToolsText(parsed.frameworksAndTools.join(', '));
      setRolesText(parsed.preferredRoles.join(', '));
      setUploadInfo(
        `Parsed "${res.fileName}" successfully. Review all extracted fields below and click "Confirm & Save Profile" to persist.`
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Resume parsing failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const payload: CandidateProfile = {
        ...draft,
        fullName: draft.fullName.trim() || 'Unknown',
        skills: parseCsvList(skillsText),
        programmingLanguages: parseCsvList(langsText),
        frameworksAndTools: parseCsvList(toolsText),
        preferredRoles: parseCsvList(rolesText),
        confirmed: true,
      };
      const res = await api.saveProfile(payload);
      onProfileSaved(res.profile);
      setProfileNotice('Candidate profile confirmed and persisted.');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleWorkMode = (mode: WorkMode) => {
    setPrefsDraft((prev) => ({
      ...prev,
      workModes: prev.workModes.includes(mode)
        ? prev.workModes.filter((m) => m !== mode)
        : [...prev.workModes, mode],
    }));
  };

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefsNotice(null);
    try {
      const payload: CandidatePreferences = {
        ...prefsDraft,
        preferredRoles: parseCsvList(prefRolesText),
        preferredLocations: parseCsvList(prefLocsText),
        preferredTechStack: parseCsvList(prefStackText),
        excludedLocations: parseCsvList(exclLocsText),
        excludedCategories: parseCsvList(exclCatsText),
      };
      const res = await api.savePreferences(payload);
      onPreferencesSaved(res.preferences);
      setPrefsNotice('Saved preferences updated. Future searches and agent queries will respect these rules.');
    } catch (err) {
      setPrefsNotice(err instanceof Error ? err.message : 'Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleClearPrefs = async () => {
    setSavingPrefs(true);
    try {
      await api.clearPreferences();
      setPrefsDraft(EMPTY_PREFS);
      setPrefRolesText('');
      setPrefLocsText('');
      setPrefStackText('');
      setExclLocsText('');
      setExclCatsText('');
      onPreferencesSaved(EMPTY_PREFS);
      setPrefsNotice('All saved preferences cleared.');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0F172A]">
          Resume Parsing, Profile &amp; Preference Memory
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          Upload a PDF or DOCX resume for structured extraction. Missing data is marked as Unknown rather than invented.
        </p>
      </div>

      {/* Resume Upload Panel */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A]">
              01. Upload Resume (PDF, DOCX, or TXT · Max 5 MB)
            </h2>
            <p className="text-xs text-[#64748B] mt-1">
              Text is extracted server-side, validated against our candidate schema, and staged for your confirmation.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0">
            <FileUp className="w-4 h-4" />
            <span>{uploading ? 'Parsing Resume...' : 'Select Resume File'}</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {uploadError && (
          <div className="mt-4 p-3.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-xs text-[#B91C1C]">
            {uploadError}
          </div>
        )}
        {uploadInfo && (
          <div className="mt-4 p-3.5 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-xs text-[#15803D] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{uploadInfo}</span>
          </div>
        )}
      </div>

      {/* Structured Candidate Profile Confirmation Form */}
      <form onSubmit={handleSaveProfile} className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#E2E8F0]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A]">
              02. Structured Candidate Profile
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Status: {draft.confirmed ? 'Confirmed in database' : 'Pending candidate confirmation'}
            </p>
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingProfile ? 'Saving...' : 'Confirm & Save Profile'}</span>
          </button>
        </div>

        {profileNotice && (
          <p className="text-xs font-medium text-[#16A34A]">{profileNotice}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">Full Name</label>
            <input
              type="text"
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              placeholder="e.g. Aarav Kulkarni"
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">Experience Level</label>
            <select
              value={draft.experienceLevel}
              onChange={(e) => setDraft({ ...draft, experienceLevel: e.target.value as ExperienceLevel })}
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#FFFFFF] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="intern">Intern (2027 Student)</option>
              <option value="fresher">Fresher / New Grad</option>
              <option value="entry">Entry-Level (0–2 yrs)</option>
              <option value="mid">Mid-Level</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">
              Internship / Work Months
            </label>
            <input
              type="number"
              min={0}
              max={120}
              value={draft.experienceMonths ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  experienceMonths: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              placeholder="Unknown"
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] tabular-nums"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#334155] mb-1">Headline / Summary</label>
          <input
            type="text"
            value={draft.headline}
            onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
            placeholder="e.g. 2027 B.Tech Computer Engineering Student — Python, FastAPI, AI/ML"
            className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">
              All Skills (comma-separated)
            </label>
            <textarea
              rows={2}
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="Python, FastAPI, PostgreSQL, TypeScript, React, LLMs, Embeddings"
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">
              Programming Languages (comma-separated)
            </label>
            <textarea
              rows={2}
              value={langsText}
              onChange={(e) => setLangsText(e.target.value)}
              placeholder="Python, TypeScript, Java, SQL, C++"
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">
              Frameworks &amp; Tools (comma-separated)
            </label>
            <textarea
              rows={2}
              value={toolsText}
              onChange={(e) => setToolsText(e.target.value)}
              placeholder="FastAPI, Express, React, Docker, Git, PostgreSQL"
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">
              Preferred Roles from Profile (comma-separated)
            </label>
            <textarea
              rows={2}
              value={rolesText}
              onChange={(e) => setRolesText(e.target.value)}
              placeholder="Backend Engineering Intern, AI/ML Intern, Software Engineer"
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>

        {/* Extracted Education & Projects Readout */}
        {(draft.education.length > 0 || draft.projects.length > 0 || draft.internships.length > 0) && (
          <div className="pt-4 border-t border-[#E2E8F0] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="font-semibold text-[#0F172A] mb-2">Education ({draft.education.length})</p>
              {draft.education.map((ed, i) => (
                <div key={i} className="mb-2 text-[#475569]">
                  <p className="font-medium text-[#0F172A]">{ed.degree} · {ed.field}</p>
                  <p>{ed.institution} · {ed.graduationYear}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="font-semibold text-[#0F172A] mb-2">Projects ({draft.projects.length})</p>
              {draft.projects.map((p, i) => (
                <div key={i} className="mb-2 text-[#475569]">
                  <p className="font-medium text-[#0F172A]">{p.name}</p>
                  <p className="line-clamp-2">{p.summary}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="font-semibold text-[#0F172A] mb-2">Internships ({draft.internships.length})</p>
              {draft.internships.map((inItem, i) => (
                <div key={i} className="mb-2 text-[#475569]">
                  <p className="font-medium text-[#0F172A]">{inItem.role} · {inItem.organization}</p>
                  <p>{inItem.duration}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>

      {/* Persistent Candidate Preference Memory */}
      <form onSubmit={handleSavePrefs} className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#E2E8F0]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A]">
              03. Persistent Preference Memory
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Saved separately from temporary chat context. Used automatically by Search and the AI Agent.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearPrefs}
              disabled={savingPrefs}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#B91C1C] border border-[#FECACA] hover:bg-[#FEF2F2] rounded-lg cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="submit"
              disabled={savingPrefs}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingPrefs ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </div>

        {prefsNotice && <p className="text-xs font-medium text-[#2563EB]">{prefsNotice}</p>}

        <div>
          <label className="block text-xs font-medium text-[#334155] mb-2">Preferred Work Modes</label>
          <div className="flex items-center gap-2">
            {(['remote', 'hybrid', 'onsite'] as WorkMode[]).map((mode) => {
              const active = prefsDraft.workModes.includes(mode);
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => toggleWorkMode(mode)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize cursor-pointer ${
                    active
                      ? 'bg-[#2563EB] border-[#2563EB] text-white'
                      : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">
              Preferred Locations (comma-separated)
            </label>
            <input
              type="text"
              value={prefLocsText}
              onChange={(e) => setPrefLocsText(e.target.value)}
              placeholder="Bengaluru, Mumbai, Remote"
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">
              Preferred Role Titles (comma-separated)
            </label>
            <input
              type="text"
              value={prefRolesText}
              onChange={(e) => setPrefRolesText(e.target.value)}
              placeholder="Python Backend Intern, AI/ML Intern, Software Engineer"
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">
              Preferred Tech Stack (comma-separated)
            </label>
            <input
              type="text"
              value={prefStackText}
              onChange={(e) => setPrefStackText(e.target.value)}
              placeholder="Python, FastAPI, PostgreSQL, TypeScript, LLMs"
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">
              Excluded Locations (Hard Filter)
            </label>
            <input
              type="text"
              value={exclLocsText}
              onChange={(e) => setExclLocsText(e.target.value)}
              placeholder="e.g. Gurugram"
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#334155] mb-1">
            Excluded Categories (Hard Filter, comma-separated)
          </label>
          <input
            type="text"
            value={exclCatsText}
            onChange={(e) => setExclCatsText(e.target.value)}
            placeholder="e.g. Frontend Engineering"
            className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
          />
        </div>
      </form>
    </div>
  );
}
