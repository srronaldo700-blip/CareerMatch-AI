import React, { useEffect, useState } from 'react';
import { Database, PlusCircle, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { EmploymentType, JobRecord, WorkMode } from '../shared/types';

const SAMPLE_JSON_BATCH = JSON.stringify(
  [
    {
      externalKey: 'custom-ingest-py-ml-2027',
      title: 'Graduate Python & Vector Search Engineer',
      company: 'Loomis Data Systems',
      description:
        'Work on pgvector similarity search, hybrid BM25 retrieval, and FastAPI backend services for enterprise document discovery.',
      requiredSkills: ['Python', 'FastAPI', 'PostgreSQL', 'Vector Search'],
      preferredSkills: ['Docker', 'LLMs', 'pytest'],
      experienceLevel: 'fresher',
      experienceRequirement: '0-1 years; 2027 graduates',
      location: 'Bengaluru, India',
      workMode: 'hybrid',
      employmentType: 'full-time',
      category: 'Backend Engineering',
      source: 'Recruiter JSON Import',
      isSyntheticDemo: true,
      isActive: true,
    },
  ],
  null,
  2
);

export function JobIngestionView() {
  const [jobs, setJobs] = useState<Omit<JobRecord, 'embedding'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'single' | 'json' | 'csv'>('single');
  const [batchText, setBatchText] = useState(SAMPLE_JSON_BATCH);
  const [updateDuplicates, setUpdateDuplicates] = useState(false);

  // Manual form state
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('Bengaluru, India');
  const [workMode, setWorkMode] = useState<WorkMode>('hybrid');
  const [experienceLevel, setExperienceLevel] = useState<'intern' | 'fresher' | 'entry' | 'mid'>('intern');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('internship');
  const [requiredSkills, setRequiredSkills] = useState('Python, FastAPI, PostgreSQL');
  const [preferredSkills, setPreferredSkills] = useState('Docker, Git');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await api.listJobs(true);
      setJobs(data.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job index.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSummary(null);
    setError(null);
    try {
      let payload: unknown;
      if (mode === 'single') {
        payload = {
          title,
          company,
          location,
          workMode,
          experienceLevel,
          employmentType,
          requiredSkills: requiredSkills.split(',').map((s) => s.trim()).filter(Boolean),
          preferredSkills: preferredSkills.split(',').map((s) => s.trim()).filter(Boolean),
          description,
          source: 'Manual Recruiter Entry',
          isSyntheticDemo: false,
          isActive: true,
        };
      } else {
        payload = batchText;
      }

      const res = await api.ingestJobs({ format: mode, payload, updateDuplicates });
      setSummary(
        `Ingestion complete: ${res.inserted} inserted · ${res.updated} updated · ${res.duplicatesSkipped} duplicates skipped · ${res.invalidCount} invalid.${
          res.errors.length > 0 ? ` Errors: ${res.errors.join(' | ')}` : ''
        }`
      );
      if (mode === 'single' && res.inserted > 0) {
        setTitle('');
        setCompany('');
        setDescription('');
      }
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingestion failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (job: Omit<JobRecord, 'embedding'>) => {
    try {
      await api.toggleJobStatus(job.id, !job.isActive);
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, isActive: !j.isActive } : j))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job status.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F172A]">
            Job Ingestion &amp; Index Management
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Add opportunities manually or in JSON/CSV batches with stable-key deduplication and live embedding generation.
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-[#F1F5F9] rounded-lg border border-[#E2E8F0] self-start">
          {(['single', 'json', 'csv'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                if (m === 'json' && !batchText.trim().startsWith('[')) {
                  setBatchText(SAMPLE_JSON_BATCH);
                } else if (m === 'csv') {
                  setBatchText(
                    'externalKey,title,company,description,requiredSkills,preferredSkills,experienceLevel,location,workMode,employmentType,source,isSyntheticDemo,isActive\ncsv-demo-1,Backend Intern,Orbit Systems,Build FastAPI services and PostgreSQL queries for telemetry.,Python;FastAPI;PostgreSQL,Docker;Git,intern,Pune,hybrid,internship,CSV Upload,true,true'
                  );
                }
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md uppercase transition-colors cursor-pointer ${
                mode === m
                  ? 'bg-[#FFFFFF] text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {m === 'single' ? 'Manual Entry' : `${m} Batch`}
            </button>
          ))}
        </div>
      </div>

      {/* Ingestion Form */}
      <form onSubmit={handleIngest} className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6 space-y-4">
        {mode === 'single' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Job Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Backend Engineering Intern"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Company</label>
                <input
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Veridian Cloud"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Location</label>
                <input
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Work Mode</label>
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value as WorkMode)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#FFFFFF]"
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) =>
                    setExperienceLevel(e.target.value as 'intern' | 'fresher' | 'entry' | 'mid')
                  }
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#FFFFFF]"
                >
                  <option value="intern">Intern</option>
                  <option value="fresher">Fresher</option>
                  <option value="entry">Entry</option>
                  <option value="mid">Mid</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Employment Type</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-[#FFFFFF]"
                >
                  <option value="internship">Internship</option>
                  <option value="full-time">Full-Time</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">
                  Required Skills (comma-separated)
                </label>
                <input
                  required
                  value={requiredSkills}
                  onChange={(e) => setRequiredSkills(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">
                  Preferred Skills (comma-separated)
                </label>
                <input
                  value={preferredSkills}
                  onChange={(e) => setPreferredSkills(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Description</label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Role responsibilities, technical stack, and eligibility criteria..."
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1.5">
              {mode === 'json' ? 'JSON Array of Job Records' : 'CSV Job Dataset (use ; between skills)'}
            </label>
            <textarea
              rows={8}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-mono border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <label className="inline-flex items-center gap-2 text-xs text-[#475569] cursor-pointer">
            <input
              type="checkbox"
              checked={updateDuplicates}
              onChange={(e) => setUpdateDuplicates(e.target.checked)}
              className="rounded border-[#CBD5E1] text-[#2563EB]"
            />
            <span>Update existing records if externalKey already exists (otherwise skip duplicates)</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {mode === 'single' ? <PlusCircle className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{submitting ? 'Ingesting & Embedding...' : 'Ingest into Job Index'}</span>
          </button>
        </div>

        {summary && (
          <div className="p-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-xs text-[#15803D]">
            {summary}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-xs text-[#B91C1C]">
            {error}
          </div>
        )}
      </form>

      {/* Live Job Index Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#2563EB]" />
            <h2 className="font-display text-sm font-semibold text-[#0F172A]">
              Indexed Jobs ({jobs.length})
            </h2>
          </div>
          <span className="text-xs text-[#64748B]">Deduplicated by stable externalKey</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Title &amp; Company</th>
                <th className="py-2.5 px-4 font-medium">Location · Mode</th>
                <th className="py-2.5 px-4 font-medium">Level</th>
                <th className="py-2.5 px-4 font-medium">Source</th>
                <th className="py-2.5 px-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#64748B]">
                    Loading job index...
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-[#0F172A]">{j.title}</div>
                      <div className="text-[#64748B]">{j.company}</div>
                    </td>
                    <td className="py-2.5 px-4 text-[#334155]">
                      {j.location} · {j.workMode}
                    </td>
                    <td className="py-2.5 px-4 text-[#334155] capitalize">
                      {j.experienceLevel} · {j.employmentType}
                    </td>
                    <td className="py-2.5 px-4 text-[#64748B]">{j.source}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(j)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded border cursor-pointer ${
                          j.isActive
                            ? 'text-[#16A34A] border-[#BBF7D0] bg-[#F0FDF4]'
                            : 'text-[#DC2626] border-[#FECACA] bg-[#FEF2F2]'
                        }`}
                      >
                        {j.isActive ? 'Active' : 'Expired'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
