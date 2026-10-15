import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  Settings2,
  Key,
  Database,
  HardDrive,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import type { SupabaseProjectSummary } from '../types/dashboard';

interface ProjectConfigModalProps {
  project: SupabaseProjectSummary;
  onClose: () => void;
  onSaved: () => void;
  onRunTest: () => void;
}

export const ProjectConfigModal: React.FC<ProjectConfigModalProps> = ({
  project,
  onClose,
  onSaved,
  onRunTest,
}) => {
  const [url, setUrl] = useState(project.url || '');
  const [anonKey, setAnonKey] = useState(project.anonKey || '');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [storageBucket, setStorageBucket] = useState(project.storageBucket || 'songs');
  const [tableName, setTableName] = useState(project.tableName || 'songs');
  const [quotaGB, setQuotaGB] = useState(
    project.storageQuotaBytes ? (project.storageQuotaBytes / (1024 * 1024 * 1024)).toString() : '1'
  );
  const [managementToken, setManagementToken] = useState('');
  const [projectRef, setProjectRef] = useState(project.projectRef || '');

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Support Escape key to return
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const quotaBytes = quotaGB.trim() ? Math.round(parseFloat(quotaGB) * 1024 * 1024 * 1024) : null;

    try {
      const res = await fetch(`/api/projects/${project.id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          anonKey: anonKey.trim(),
          serviceRoleKey: serviceRoleKey.trim() || undefined,
          storageBucket: storageBucket.trim(),
          tableName: tableName.trim(),
          storageQuotaBytes: quotaBytes,
          managementApiToken: managementToken.trim() || undefined,
          projectRef: projectRef.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update configuration');
      }

      setSuccessMessage('Configuration saved securely on backend!');
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || 'Save error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm sm:p-3 md:p-6 overflow-hidden safe-top safe-bottom">
      <div className="relative w-full max-w-xl h-full sm:h-auto sm:max-h-[90dvh] flex flex-col rounded-none sm:rounded-2xl border-0 sm:border border-neutral-800 bg-neutral-950 shadow-2xl text-neutral-100 overflow-hidden">
        
        {/* Sticky Header Bar with Prominent Back Button */}
        <div className="shrink-0 flex items-center justify-between border-b border-neutral-800/80 px-3 sm:px-6 py-3 bg-neutral-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 text-neutral-300 hover:text-white text-xs font-medium py-1.5 px-2.5 -ml-2 rounded-lg hover:bg-neutral-800/80 transition-colors min-h-[44px] focus:outline-none focus:ring-1 focus:ring-neutral-700"
              title="Return to Dashboard (or press Esc)"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4 text-neutral-400 group-hover:text-white" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-4 w-px bg-neutral-800 hidden xs:block" />
            <div className="hidden xs:block">
              <h3 className="text-sm font-semibold text-white truncate max-w-[160px] sm:max-w-xs">
                {project.name} Settings
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 touch-scroll pb-6">
          {/* Supabase URL */}
          <div>
            <label className="block text-xs font-medium text-neutral-300">
              Supabase Project URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project-ref.supabase.co"
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              Found in your Supabase Dashboard under Settings &gt; API
            </p>
          </div>

          {/* Anon Public Key */}
          <div>
            <label className="block text-xs font-medium text-neutral-300">
              Public Anon / Publishable Key
            </label>
            <input
              type="text"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOi..."
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
            />
          </div>

          {/* Service Role Key (Backend Only) */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-neutral-300">
                Service Role Key (Elevated Server Secret)
              </label>
              {project.hasServiceRoleKey && (
                <span className="text-[11px] text-emerald-400 font-medium">
                  Configured on server
                </span>
              )}
            </div>
            <input
              type="password"
              value={serviceRoleKey}
              onChange={(e) => setServiceRoleKey(e.target.value)}
              placeholder={project.hasServiceRoleKey ? '•••••••••••••••••••• (Leave blank to keep current)' : 'eyJhbGciOi...'}
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              Kept strictly server-side. Enables administrative bypass of storage RLS during upload.
            </p>
          </div>

          {/* Storage Bucket & Table Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300">
                Storage Bucket Name
              </label>
              <input
                type="text"
                value={storageBucket}
                onChange={(e) => setStorageBucket(e.target.value)}
                placeholder="e.g. music"
                required
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
              />
              {project.availableBuckets && project.availableBuckets.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-neutral-500">Detected:</span>
                  {project.availableBuckets.map((b) => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => setStorageBucket(b)}
                      className={`rounded px-1.5 py-0.5 font-mono ${
                        storageBucket === b
                          ? 'bg-neutral-200 text-neutral-900 font-semibold'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300">
                Songs Database Table
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="songs"
                required
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
              />
            </div>
          </div>

          {/* Configured Storage Quota */}
          <div>
            <label className="block text-xs font-medium text-neutral-300">
              Configured Storage Quota (GB)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={quotaGB}
              onChange={(e) => setQuotaGB(e.target.value)}
              placeholder="e.g. 1.0 (Leave blank if unlimited / unknown)"
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              Used for storage meter gauge and capacity warnings.
            </p>
          </div>

          {/* Optional Supabase Management API */}
          <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
              <ShieldAlert className="h-3.5 w-3.5 text-neutral-400" />
              <span>Optional Authoritative Quota Sync (Supabase Management API)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-neutral-400">Project Reference ID</label>
                <input
                  type="text"
                  value={projectRef}
                  onChange={(e) => setProjectRef(e.target.value)}
                  placeholder="e.g. abcdefghijklm"
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 font-mono text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-400">Management Access Token</label>
                <input
                  type="password"
                  value={managementToken}
                  onChange={(e) => setManagementToken(e.target.value)}
                  placeholder={project.hasManagementToken ? '••••••••••••' : 'sbp_...'}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 font-mono text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
                />
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-900/40 bg-rose-950/30 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="shrink-0 flex flex-col xs:flex-row items-stretch xs:items-center justify-between border-t border-neutral-800/80 p-3 sm:px-6 sm:py-3.5 bg-neutral-950/95 gap-2.5 safe-bottom">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4 text-neutral-400" />
              <span>Back to Dashboard</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRunTest();
                }}
                className="flex-1 xs:flex-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors min-h-[44px]"
              >
                Test Connection
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 xs:flex-none flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
