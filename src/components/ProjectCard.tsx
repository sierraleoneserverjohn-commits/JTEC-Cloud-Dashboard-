import React from 'react';
import {
  Music,
  Activity,
  HardDrive,
  Settings2,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import type { SupabaseProjectSummary } from '../types/dashboard';
import { StorageMeter } from './StorageMeter';

interface ProjectCardProps {
  project: SupabaseProjectSummary;
  onSelect: (project: SupabaseProjectSummary) => void;
  onOpenConfig: (project: SupabaseProjectSummary) => void;
  onTestConnection: (project: SupabaseProjectSummary) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onSelect,
  onOpenConfig,
  onTestConnection,
}) => {
  const isConnected = project.status === 'connected';
  const isNotConfigured = project.status === 'not_configured';
  const isError = project.status === 'error';

  const formatRefreshTime = (isoString: string | null) => {
    if (!isoString) return 'Not yet synced';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formattedUsed =
    project.audioTotalBytes !== null && project.audioTotalBytes !== undefined
      ? project.audioTotalBytes > 1024 * 1024 * 1024
        ? `${project.storageUsedGB} GB`
        : `${project.storageUsedMB} MB`
      : null;

  return (
    <div
      onClick={() => onSelect(project)}
      className="group relative flex flex-col justify-between rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-4 sm:p-5 transition-all duration-200 hover:border-neutral-700 hover:bg-neutral-900/90 hover:shadow-xl cursor-pointer"
    >
      {/* Top Section: Logo & Identity */}
      <div>
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3">
            {/* Project Logo Image with styled fallback */}
            <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
              {project.logo ? (
                <img
                  src={project.logo}
                  alt={`${project.name} logo`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              <div className="absolute inset-0 -z-10 flex items-center justify-center bg-neutral-950 text-neutral-500">
                <Music className="h-6 w-6" />
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-white group-hover:text-neutral-100 truncate">
                {project.name}
              </h2>
              <p className="text-xs text-neutral-400 font-normal truncate">
                {project.category}
              </p>
            </div>
          </div>

          {/* Quick Config Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenConfig(project);
            }}
            title="Configure Project Supabase Keys & Bucket"
            aria-label={`Configure ${project.name} project credentials`}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        {/* Clean unboxed status line */}
        <div className="mt-4 flex items-center gap-2 text-xs">
          {isConnected && (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{project.statusMessage || 'Connected & Verified'}</span>
            </span>
          )}
          {isNotConfigured && (
            <span className="flex items-center gap-1.5 text-neutral-400 font-medium">
              <HelpCircle className="h-3.5 w-3.5 text-neutral-500" />
              <span>Awaiting Supabase Credentials</span>
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1.5 text-rose-400 font-medium truncate" title={project.statusMessage || 'Connection Error'}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{project.statusMessage || 'Storage Error'}</span>
            </span>
          )}

          <span className="text-neutral-600" aria-hidden="true">·</span>
          <span className="text-neutral-400 font-mono text-[11px] truncate max-w-[120px]" title={project.storageBucket}>
            b/{project.storageBucket}
          </span>
        </div>

        {/* Storage Metric Meter */}
        <div className="mt-5 rounded-lg border border-neutral-800/60 bg-neutral-950/60 p-3.5">
          <StorageMeter
            usedBytes={project.audioTotalBytes}
            quotaBytes={project.storageQuotaBytes}
            usedFormatted={formattedUsed}
            status={project.status}
            error={project.error}
          />
        </div>

        {/* Key Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-800/80 pt-3.5 text-xs">
          <div>
            <div className="text-[11px] text-neutral-500">Audio Track Count</div>
            <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-neutral-200">
              {isConnected && project.audioFileCount !== null ? (
                <>
                  {project.audioFileCount}{' '}
                  <span className="text-xs font-normal text-neutral-400">tracks</span>
                </>
              ) : isNotConfigured ? (
                <span className="text-neutral-500 font-sans text-xs">Not configured</span>
              ) : (
                <span className="text-rose-400 font-sans text-xs">Listing failed</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-neutral-500">Total Audio Stored</div>
            <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-neutral-200">
              {isConnected && project.storageUsedMB !== null ? (
                <>
                  {project.storageUsedMB}{' '}
                  <span className="text-xs font-normal text-neutral-400">MB</span>
                </>
              ) : isNotConfigured ? (
                <span className="text-neutral-500 font-sans text-xs">No data</span>
              ) : (
                <span className="text-rose-400 font-sans text-xs">Unavailable</span>
              )}
            </div>
          </div>
        </div>

        {/* Quota & Capacity Line */}
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Configured Capacity:</span>
          <span className="font-mono text-neutral-300">
            {project.storageQuotaBytes
              ? `${(project.storageQuotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
              : 'Unavailable (Plan limit not set)'}
          </span>
        </div>

        {/* Real Error Callout */}
        {project.error && (
          <div className="mt-3 rounded border border-rose-900/40 bg-rose-950/30 px-2.5 py-1.5 text-[11px] text-rose-300 flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
            <p className="leading-snug">{project.error}</p>
          </div>
        )}
      </div>

      {/* Footer Info & Direct Controls */}
      <div className="mt-5 border-t border-neutral-800/80 pt-3">
        <div className="flex items-center justify-between text-[11px] text-neutral-500">
          <span className="flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3" />
            <span>Synced {formatRefreshTime(project.lastRefreshedAt)}</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTestConnection(project);
              }}
              aria-label={`Test connection for ${project.name}`}
              className="rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors border border-neutral-800 bg-neutral-950/60 min-h-[36px] flex items-center justify-center"
            >
              Test
            </button>
            <span
              className="flex items-center gap-1 text-xs font-medium text-neutral-300 group-hover:text-white py-1"
            >
              <span>Manage</span>
              <ExternalLink className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-200" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
