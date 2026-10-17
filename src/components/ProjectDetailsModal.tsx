import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  RefreshCw,
  Activity,
  HardDrive,
  Database,
  Music,
  Clock,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Settings2,
  Trash2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import type { ProjectDetails, AudioFileItem, SongMetadataItem } from '../types/dashboard';
import { StorageMeter } from './StorageMeter';
import { fetchProjectDetails } from '../services/dashboardService';
import { resolveProjectLogo } from '../assets/logos';

interface ProjectDetailsModalProps {
  projectId: string;
  onClose: () => void;
  onOpenConfig: () => void;
  onOpenTest: () => void;
  onOpenUpload: () => void;
  isAdminMode: boolean;
}

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  projectId,
  onClose,
  onOpenConfig,
  onOpenTest,
  onOpenUpload,
  isAdminMode,
}) => {
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'catalog' | 'activity' | 'telemetry'>('files');
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const fetchDetails = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await fetchProjectDetails(projectId);
      setDetails(data);
    } catch (err: any) {
      setError(err.message || 'Error loading project');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [projectId]);

  // Support Escape key to return to dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const togglePlay = (url: string | undefined) => {
    if (!url) return;
    if (playingUrl === url) {
      audioElement?.pause();
      setPlayingUrl(null);
    } else {
      audioElement?.pause();
      const audio = new Audio(url);
      audio.play().catch((e) => console.warn('Audio playback error:', e));
      audio.onended = () => setPlayingUrl(null);
      setAudioElement(audio);
      setPlayingUrl(url);
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!isAdminMode) return;
    if (!confirm(`Are you sure you want to remove '${fileName}' from storage and database?`)) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/files/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Delete failed');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 safe-top safe-bottom">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <RefreshCw className="h-6 w-6 animate-spin text-neutral-300" />
          <p className="text-xs">Fetching real storage metrics from Supabase...</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 safe-top safe-bottom">
        <div className="max-w-md w-full rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-400" />
          <h3 className="mt-3 text-sm font-semibold text-white">Project Not Found</h3>
          <p className="mt-1 text-xs text-neutral-400">{error || 'Could not retrieve project information.'}</p>
          <button
            onClick={onClose}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 py-2.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm sm:p-3 md:p-6 overflow-y-auto safe-top safe-bottom p-0 sm:p-3"
    >
      <div className="relative w-full max-w-5xl h-full sm:h-auto sm:max-h-[92dvh] flex flex-col min-h-0 rounded-none sm:rounded-2xl border-0 sm:border border-neutral-800 bg-neutral-950 text-neutral-100 shadow-2xl overflow-hidden">
        
        {/* Navigation Breadcrumb & Back Bar */}
        <div className="shrink-0 border-b border-neutral-800/80 bg-neutral-900/80 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 text-neutral-300 hover:text-white font-medium py-1.5 px-2.5 -ml-2 rounded-lg hover:bg-neutral-800/80 transition-colors min-h-[44px] focus:outline-none focus:ring-1 focus:ring-neutral-700 cursor-pointer"
              title="Return to Dashboard (or press Esc)"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4 text-neutral-400 group-hover:text-white" />
              <span className="hidden xs:inline">Back to Dashboard</span>
              <span className="xs:hidden">Back</span>
            </button>
            <span className="text-neutral-600 hidden xs:inline" aria-hidden="true">/</span>
            <span className="text-neutral-400 font-mono text-[11px] truncate hidden sm:inline max-w-[200px]">
              {details.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={fetchDetails}
              disabled={refreshing}
              title="Refresh real metrics"
              aria-label="Refresh metrics"
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-neutral-400 hover:text-white transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-white' : ''}`} />
            </button>
            <button
              onClick={onOpenConfig}
              title="Configure project credentials"
              aria-label="Configure project"
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-neutral-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              title="Close panel (Esc)"
              aria-label="Close"
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-neutral-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Project Profile Header */}
        <div className="shrink-0 border-b border-neutral-800/80 bg-neutral-950 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
                {details.logo ? (
                  <img
                    src={resolveProjectLogo(details.id, details.logo)}
                    alt={details.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-neutral-500">
                    <Music className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">
                    {details.name}
                  </h2>
                  <span className="text-neutral-500 text-xs hidden sm:inline">·</span>
                  <span className="text-xs text-neutral-400 truncate">{details.category}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-neutral-400">
                  <span className="flex items-center gap-1 font-mono text-[11px] truncate">
                    <HardDrive className="h-3 w-3 text-neutral-400 shrink-0" />
                    <span>Bucket: {details.storageBucket}</span>
                    {details.bucketAccessible ? (
                      <span className="text-emerald-400 font-medium ml-1">(Online)</span>
                    ) : (
                      <span className="text-rose-400 font-medium ml-1">(Offline)</span>
                    )}
                  </span>
                  <span className="text-neutral-700 hidden sm:inline" aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 font-mono text-[11px] truncate">
                    <Database className="h-3 w-3 text-neutral-400 shrink-0" />
                    <span>Table: {details.tableName}</span>
                    {details.tableAccessible ? (
                      <span className="text-emerald-400 font-medium ml-1">(Active)</span>
                    ) : (
                      <span className="text-neutral-500 ml-1">(Pending)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={onOpenTest}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 transition-colors min-h-[40px]"
              >
                <Activity className="h-3.5 w-3.5 text-neutral-400" />
                <span>Test Connection</span>
              </button>
              {isAdminMode && (
                <button
                  onClick={onOpenUpload}
                  className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-white transition-colors min-h-[40px]"
                >
                  <Music className="h-3.5 w-3.5" />
                  <span>Upload Track</span>
                </button>
              )}
            </div>
          </div>

          {/* High-Level Metrics Strip (Responsive 2 cols on mobile, 4 on desktop) */}
          <div className="mt-4 sm:mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/50 p-2.5 sm:p-3">
              <div className="text-[10px] sm:text-[11px] text-neutral-500">Audio Track Count</div>
              <div className="mt-1 font-mono text-base sm:text-lg font-semibold tabular-nums text-white">
                {details.audioFileCount !== null ? (
                  details.audioFileCount
                ) : details.status === 'not_configured' ? (
                  <span className="text-neutral-500 font-sans text-xs">Unconfigured</span>
                ) : (
                  <span className="text-rose-400 font-sans text-xs">Error</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/50 p-2.5 sm:p-3">
              <div className="text-[10px] sm:text-[11px] text-neutral-500">Storage Used (MB)</div>
              <div className="mt-1 font-mono text-base sm:text-lg font-semibold tabular-nums text-white">
                {details.storageUsedMB !== null ? (
                  <>
                    {details.storageUsedMB} <span className="text-xs font-normal text-neutral-400">MB</span>
                  </>
                ) : (
                  <span className="text-neutral-500 font-sans text-xs">—</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/50 p-2.5 sm:p-3">
              <div className="text-[10px] sm:text-[11px] text-neutral-500">Storage Used (GB)</div>
              <div className="mt-1 font-mono text-base sm:text-lg font-semibold tabular-nums text-white">
                {details.storageUsedGB !== null ? (
                  <>
                    {details.storageUsedGB} <span className="text-xs font-normal text-neutral-400">GB</span>
                  </>
                ) : (
                  <span className="text-neutral-500 font-sans text-xs">—</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/50 p-2.5 sm:p-3">
              <div className="text-[10px] sm:text-[11px] text-neutral-500">Configured Quota</div>
              <div className="mt-1 font-mono text-xs sm:text-sm font-semibold tabular-nums text-white truncate">
                {details.storageQuotaBytes
                  ? `${(details.storageQuotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
                  : 'Unavailable'}
              </div>
            </div>
          </div>

          {/* Storage Meter Bar */}
          <div className="mt-3.5 rounded-lg border border-neutral-800/60 bg-neutral-950 p-3">
            <StorageMeter
              usedBytes={details.audioTotalBytes}
              quotaBytes={details.storageQuotaBytes}
              usedFormatted={
                details.storageUsedMB !== null
                  ? `${details.storageUsedMB} MB (${details.storageUsedGB} GB)`
                  : null
              }
              status={details.status}
              error={details.error}
            />
          </div>
        </div>

        {/* Tab Controls (Horizontally scrollable with clean padding) */}
        <div className="shrink-0 border-b border-neutral-800 bg-neutral-950 px-3 sm:px-6 pt-2 pb-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setActiveTab('files')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] ${
                activeTab === 'files'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
              }`}
            >
              Storage Objects ({details.files.length})
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] ${
                activeTab === 'catalog'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
              }`}
            >
              Song Catalog Database ({details.songs.length})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] ${
                activeTab === 'activity'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
              }`}
            >
              Upload Activity ({details.recentUploads.length})
            </button>
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] ${
                activeTab === 'telemetry'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
              }`}
            >
              Management API Telemetry
            </button>
          </div>
        </div>

        {/* Tab Contents (Full normal scrolling with bottom padding) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24 sm:pb-8 touch-scroll bg-neutral-950">
          
          {/* TAB 1: Storage Bucket Objects */}
          {activeTab === 'files' && (
            <div>
              {details.files.length === 0 ? (
                <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-8 text-center">
                  <HardDrive className="mx-auto h-8 w-8 text-neutral-600" />
                  <p className="mt-2 text-xs font-medium text-neutral-300">
                    No audio objects found in bucket '{details.storageBucket}'
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {details.status === 'not_configured'
                      ? 'Configure Supabase credentials first to connect this bucket.'
                      : 'Upload your first audio track using the upload tool.'}
                  </p>
                </div>
              ) : (
                <div>
                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block divide-y divide-neutral-900 border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/40">
                    <div className="grid grid-cols-12 bg-neutral-900/80 px-4 py-2.5 text-[11px] font-medium text-neutral-400">
                      <span className="col-span-6">File Name</span>
                      <span className="col-span-2 text-right">Size</span>
                      <span className="col-span-2 text-right">Uploaded</span>
                      <span className="col-span-2 text-right">Actions</span>
                    </div>
                    {details.files.map((file) => (
                      <div
                        key={file.id}
                        className="grid grid-cols-12 items-center px-4 py-3 text-xs hover:bg-neutral-900/70 transition-colors"
                      >
                        <div className="col-span-6 flex items-center gap-2.5 min-w-0 pr-2">
                          <button
                            onClick={() => togglePlay(file.publicUrl)}
                            disabled={!file.publicUrl}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-40"
                            title={file.publicUrl ? 'Play audio preview' : 'No public URL'}
                          >
                            {playingUrl === file.publicUrl ? (
                              <Pause className="h-3.5 w-3.5" />
                            ) : (
                              <Play className="h-3.5 w-3.5 ml-0.5" />
                            )}
                          </button>
                          <span className="font-mono truncate text-neutral-200" title={file.name}>
                            {file.name}
                          </span>
                        </div>

                        <div className="col-span-2 text-right font-mono tabular-nums text-neutral-300">
                          {file.sizeFormatted}
                        </div>

                        <div className="col-span-2 text-right font-mono text-[11px] text-neutral-400">
                          {new Date(file.created_at).toLocaleDateString()}
                        </div>

                        <div className="col-span-2 flex items-center justify-end gap-1.5">
                          {file.publicUrl && (
                            <a
                              href={file.publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 min-h-[32px] min-w-[32px] flex items-center justify-center"
                              title="Direct public link"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {isAdminMode && (
                            <button
                              onClick={() => handleDeleteFile(file.name)}
                              className="rounded p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-rose-400 min-h-[32px] min-w-[32px] flex items-center justify-center"
                              title="Delete file from bucket"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mobile Stacked Card View (< sm: 320px–430px) */}
                  <div className="sm:hidden space-y-2">
                    {details.files.map((file) => (
                      <div
                        key={file.id}
                        className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-3 space-y-2.5 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => togglePlay(file.publicUrl)}
                            disabled={!file.publicUrl}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-200 hover:bg-neutral-700 min-h-[36px] min-w-[36px]"
                            title={file.publicUrl ? 'Play audio preview' : 'No public URL'}
                          >
                            {playingUrl === file.publicUrl ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4 ml-0.5" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs text-white break-all leading-snug">
                              {file.name}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
                              <span className="font-mono tabular-nums text-neutral-300">
                                {file.sizeFormatted}
                              </span>
                              <span>·</span>
                              <span>{new Date(file.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-neutral-800/60 pt-2 text-[11px]">
                          <span className="text-neutral-500 font-mono truncate max-w-[180px]">
                            {file.mimetype || 'audio/mpeg'}
                          </span>
                          <div className="flex items-center gap-2">
                            {file.publicUrl && (
                              <a
                                href={file.publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-neutral-300 hover:text-white px-2 py-1 rounded bg-neutral-800/60"
                              >
                                <span>Link</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {isAdminMode && (
                              <button
                                onClick={() => handleDeleteFile(file.name)}
                                className="text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-950/40"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Song Catalog Database Table */}
          {activeTab === 'catalog' && (
            <div>
              {details.songs.length === 0 ? (
                <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-8 text-center">
                  <Database className="mx-auto h-8 w-8 text-neutral-600" />
                  <p className="mt-2 text-xs font-medium text-neutral-300">
                    No records found in table '{details.tableName}'
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Uploaded songs and their metadata will appear here.
                  </p>
                </div>
              ) : (
                <div>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block divide-y divide-neutral-900 border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/40">
                    <div className="grid grid-cols-12 bg-neutral-900/80 px-4 py-2.5 text-[11px] font-medium text-neutral-400">
                      <span className="col-span-5">Title</span>
                      <span className="col-span-4">Artist</span>
                      <span className="col-span-3 text-right">Recorded Date</span>
                    </div>
                    {details.songs.map((song) => (
                      <div
                        key={song.id}
                        className="grid grid-cols-12 items-center px-4 py-2.5 text-xs hover:bg-neutral-900/70 transition-colors"
                      >
                        <div className="col-span-5 font-semibold text-white truncate pr-2 flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0 border border-neutral-800 bg-neutral-950 flex items-center justify-center">
                            {song.cover_url ? (
                              <img
                                src={song.cover_url}
                                alt={song.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <img
                                src={resolveProjectLogo(details.id, details.logo)}
                                alt={song.title}
                                className="h-full w-full object-cover opacity-70"
                              />
                            )}
                          </div>
                          <span className="truncate">{song.title}</span>
                        </div>
                        <div className="col-span-4 text-neutral-400 truncate pr-2">
                          {song.artist || 'Unknown'}
                        </div>
                        <div className="col-span-3 text-right font-mono text-[11px] text-neutral-400">
                          {new Date(song.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mobile Stacked Card View */}
                  <div className="sm:hidden space-y-2">
                    {details.songs.map((song) => (
                      <div
                        key={song.id}
                        className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-3 space-y-2 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 border border-neutral-800 bg-neutral-950 flex items-center justify-center">
                            {song.cover_url ? (
                              <img
                                src={song.cover_url}
                                alt={song.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <img
                                src={resolveProjectLogo(details.id, details.logo)}
                                alt={song.title}
                                className="h-full w-full object-cover opacity-70"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white leading-snug truncate">{song.title}</p>
                            <p className="text-neutral-400 text-[11px] truncate">
                              {song.artist || 'Unknown Artist'} {song.album ? `· ${song.album}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-[10px] text-neutral-500 font-mono">
                          <span className="truncate max-w-[180px]">{song.file_name}</span>
                          <span>{new Date(song.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Recent Upload Activity */}
          {activeTab === 'activity' && (
            <div>
              {details.recentUploads.length === 0 ? (
                <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-8 text-center text-xs text-neutral-400">
                  No recent upload activity logged for this project.
                </div>
              ) : (
                <div className="space-y-2">
                  {details.recentUploads.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-neutral-800/80 bg-neutral-900/50 p-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium text-white">{log.title}</p>
                          <p className="text-[11px] text-neutral-400 font-mono break-all">
                            {log.fileName} · {(log.fileSize / (1024 * 1024)).toFixed(2)} MB
                          </p>
                          {log.errorMessage && (
                            <p className="text-[11px] text-rose-300 mt-0.5">{log.errorMessage}</p>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-neutral-500 whitespace-nowrap self-end sm:self-auto">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Supabase Management API Authoritative Telemetry */}
          {activeTab === 'telemetry' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 sm:p-5">
                <h4 className="text-sm font-semibold text-white">Authoritative Management API Quota</h4>
                <p className="mt-1 text-xs text-neutral-400">
                  Supabase Management API provides authoritative project-wide infrastructure metrics directly from your cloud project.
                </p>

                {details.managementApiUsage?.isAvailable ? (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                      <div className="text-[11px] text-neutral-500">Total Infrastructure Storage</div>
                      <div className="mt-1 font-mono text-base font-semibold text-white">
                        {details.managementApiUsage.storageBytesTotal
                          ? `${(details.managementApiUsage.storageBytesTotal / (1024 * 1024)).toFixed(2)} MB`
                          : 'Active'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                      <div className="text-[11px] text-neutral-500">Plan Tier</div>
                      <div className="mt-1 font-mono text-base font-semibold text-white">
                        {details.managementApiUsage.planName || 'Supabase Free'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/80 p-4">
                    <div className="flex items-center gap-2 text-neutral-300 text-xs font-medium">
                      <ShieldAlert className="h-4 w-4 text-neutral-400" />
                      <span>Authoritative Project-Wide Telemetry: Unavailable</span>
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      Reason: {details.managementApiUsage?.reason || 'Token not configured'}.
                    </p>
                    <p className="mt-2 text-[11px] text-neutral-500">
                      Note: Audio bucket metrics are calculated accurately directly from stored audio objects. To enable project-wide quota sync, add a Supabase Management API Personal Access Token in Project Settings.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Mobile Bottom Bar with Visible Back to Dashboard Button */}
        <div className="sm:hidden shrink-0 border-t border-neutral-800/90 bg-neutral-950/95 p-3 flex items-center justify-between gap-3 safe-bottom">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 text-xs font-medium text-neutral-300 bg-neutral-900 border border-neutral-700/80 px-3.5 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors min-h-[44px] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
          {isAdminMode && (
            <button
              type="button"
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 text-xs font-semibold text-neutral-950 bg-white px-3.5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors min-h-[44px] cursor-pointer"
            >
              <Music className="h-3.5 w-3.5" />
              <span>Upload</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
