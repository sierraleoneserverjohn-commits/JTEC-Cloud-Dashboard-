import React, { useState, useEffect, useCallback } from 'react';
import {
  Music,
  Shield,
  ShieldAlert,
  Sparkles,
  HardDrive,
  RefreshCw,
  Plus,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Layers,
  ArrowUpRight,
  ArrowLeft,
} from 'lucide-react';
import type { SupabaseProjectSummary } from './types/dashboard';
import { Header } from './components/Header';
import { ProjectCard } from './components/ProjectCard';
import { ProjectDetailsModal } from './components/ProjectDetailsModal';
import { ProjectConfigModal } from './components/ProjectConfigModal';
import { AdminUploadModal } from './components/AdminUploadModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { SetupGuideModal } from './components/SetupGuideModal';
import { fetchProjects as loadProjectsData } from './services/dashboardService';

export default function App() {
  const [projects, setProjects] = useState<SupabaseProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read-only by default for initial deployment phase ("No login no account ok")
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Modal active states
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [configProjectId, setConfigProjectId] = useState<string | null>(null);
  const [diagnosticsProjectId, setDiagnosticsProjectId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);
  const [lastViewedProjectId, setLastViewedProjectId] = useState<string | null>(null);

  // Reactive resolution from projects array
  const configProject = projects.find((p) => p.id === configProjectId) || null;
  const diagnosticsProject = projects.find((p) => p.id === diagnosticsProjectId) || null;

  const fetchProjects = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const data = await loadProjectsData();
      setProjects(data);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message || 'Unable to communicate with dashboard');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Synchronize modal state with URL hash for seamless browser & Android back/forward navigation
  const syncStateFromHash = useCallback((hash: string, currentProjects: SupabaseProjectSummary[]) => {
    const raw = typeof hash === 'string' ? hash : '';
    const cleanHash = raw.replace(/^#\/?/, '').trim();
    
    if (!cleanHash || cleanHash === 'dashboard') {
      setSelectedProjectId(null);
      setConfigProjectId(null);
      setDiagnosticsProjectId(null);
      setIsUploadOpen(false);
      setIsSetupGuideOpen(false);
      return;
    }

    if (cleanHash.startsWith('project=')) {
      const id = cleanHash.split('=')[1]?.trim();
      if (id) {
        setSelectedProjectId(id);
        setLastViewedProjectId(id);
      }
      setConfigProjectId(null);
      setDiagnosticsProjectId(null);
      setIsUploadOpen(false);
      setIsSetupGuideOpen(false);
    } else if (cleanHash.startsWith('config=')) {
      const id = cleanHash.split('=')[1]?.trim();
      if (id) {
        setConfigProjectId(id);
      }
      setSelectedProjectId(null);
      setDiagnosticsProjectId(null);
      setIsUploadOpen(false);
      setIsSetupGuideOpen(false);
    } else if (cleanHash.startsWith('diagnostics=')) {
      const id = cleanHash.split('=')[1]?.trim();
      if (id) {
        setDiagnosticsProjectId(id);
      }
      setSelectedProjectId(null);
      setConfigProjectId(null);
      setIsUploadOpen(false);
      setIsSetupGuideOpen(false);
    } else if (cleanHash === 'upload') {
      setIsUploadOpen(true);
      setSelectedProjectId(null);
      setConfigProjectId(null);
      setDiagnosticsProjectId(null);
      setIsSetupGuideOpen(false);
    } else if (cleanHash === 'schema' || cleanHash === 'guide') {
      setIsSetupGuideOpen(true);
      setSelectedProjectId(null);
      setConfigProjectId(null);
      setDiagnosticsProjectId(null);
      setIsUploadOpen(false);
    } else if (cleanHash === 'verify' || cleanHash === 'phase1') {
      const target = currentProjects.find((p) => p.status === 'connected') || currentProjects[0];
      setDiagnosticsProjectId(target?.id || 'nasheed');
      setSelectedProjectId(null);
      setConfigProjectId(null);
      setIsUploadOpen(false);
      setIsSetupGuideOpen(false);
    } else {
      // Unrecognized or corrupted hash - close all modals and show dashboard
      setSelectedProjectId(null);
      setConfigProjectId(null);
      setDiagnosticsProjectId(null);
      setIsUploadOpen(false);
      setIsSetupGuideOpen(false);
    }
  }, []);

  // Update hash when opening/closing modals with safe argument handling
  const navigateTo = (newHash?: unknown) => {
    const clean = typeof newHash === 'string' ? newHash.replace(/^#\/?/, '').trim() : '';
    if (clean) {
      window.location.hash = clean;
      syncStateFromHash(clean, projects);
    } else {
      if (window.location.hash) {
        try {
          window.history.pushState(null, '', window.location.pathname + window.location.search);
        } catch {
          window.location.hash = '';
        }
      }
      syncStateFromHash('', projects);
    }
  };

  const handleCloseModal = (fallbackTarget?: unknown) => {
    if (typeof fallbackTarget === 'string' && fallbackTarget.trim() !== '') {
      navigateTo(fallbackTarget);
      return;
    }
    // Instant UI feedback: close modal in state immediately
    setSelectedProjectId(null);
    setConfigProjectId(null);
    setDiagnosticsProjectId(null);
    setIsUploadOpen(false);
    setIsSetupGuideOpen(false);

    if (window.location.hash) {
      try {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
      } catch {
        window.location.hash = '';
      }
    }
  };

  // Listen for browser popstate and hashchange
  useEffect(() => {
    const handlePopState = () => {
      syncStateFromHash(window.location.hash, projects);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    if (window.location.hash && projects.length > 0) {
      syncStateFromHash(window.location.hash, projects);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [projects, syncStateFromHash]);

  // Fleet storage summary
  const totalFiles = projects.reduce((acc, p) => acc + (p.audioFileCount || 0), 0);
  const totalBytes = projects.reduce((acc, p) => acc + (p.audioTotalBytes || 0), 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(3);
  const configuredProjects = projects.filter((p) => p.status === 'connected').length;

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-neutral-100 flex flex-col font-sans selection:bg-neutral-800">
      {/* Top Header */}
      <Header
        isAdminMode={isAdminMode}
        onToggleAdminMode={() => setIsAdminMode(!isAdminMode)}
        onRefreshAll={fetchProjects}
        isRefreshing={isRefreshing}
        onOpenUpload={() => navigateTo('upload')}
        onOpenSetupGuide={() => navigateTo('schema')}
        onOpenTestRunner={() => navigateTo('verify')}
        onNavigateHome={() => navigateTo('')}
      />

      {/* Main Viewport Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 sm:px-6 py-4 sm:py-8">
        
        {/* Editorial Sub-Header & Live Fleet Indicators */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-neutral-800/80 pb-5 sm:pb-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span className="font-semibold text-white">JTEC Music Fleet</span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span className="hidden xs:inline">Phase 1 Initial Deployment</span>
              <span aria-hidden="true" className="text-neutral-600 hidden xs:inline">·</span>
              <span className={isAdminMode ? 'text-emerald-400 font-medium' : 'text-neutral-400'}>
                {isAdminMode ? 'Admin Mode (Active)' : 'Read-Only Mode'}
              </span>
            </div>
            <h2 className="mt-2 text-xl xs:text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              Supabase Audio Fleet Console
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Real byte-accurate storage & database monitoring for NASHEED, LOVE & CHILL, and JTEC MUSIC catalogs.
            </p>
          </div>

          {/* Quick Metrics Bar (Responsive 3-column row on mobile, compact pills on desktop) */}
          <div className="grid grid-cols-3 gap-2 w-full lg:w-auto text-xs font-mono shrink-0">
            <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-2 sm:px-3.5 sm:py-2">
              <span className="text-[10px] sm:text-[11px] text-neutral-500 block font-sans">Fleet Audio</span>
              <span className="text-xs sm:text-sm font-semibold tabular-nums text-white truncate block">
                {configuredProjects > 0 ? (
                  <>
                    {totalMB} <span className="text-[10px] font-normal text-neutral-400">MB</span>
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-2 sm:px-3.5 sm:py-2">
              <span className="text-[10px] sm:text-[11px] text-neutral-500 block font-sans">Total Tracks</span>
              <span className="text-xs sm:text-sm font-semibold tabular-nums text-white truncate block">
                {configuredProjects > 0 ? totalFiles : '—'}
              </span>
            </div>
            <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-2 sm:px-3.5 sm:py-2">
              <span className="text-[10px] sm:text-[11px] text-neutral-500 block font-sans">Active Slots</span>
              <span className="text-xs sm:text-sm font-semibold tabular-nums text-emerald-400 truncate block">
                {configuredProjects} / 3
              </span>
            </div>
          </div>
        </div>

        {/* Read-Only Guidance Ribbon */}
        {!isAdminMode && (
          <div className="mt-3 sm:mt-4 flex flex-col xs:flex-row xs:items-center justify-between gap-2 rounded-xl border border-neutral-800/80 bg-neutral-900/30 px-3.5 py-2.5 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-neutral-400 shrink-0" />
              <span className="leading-snug">
                Dashboard is in safe <strong className="text-neutral-200">Read-Only Mode</strong>. View live metrics and inspect files safely.
              </span>
            </div>
            <button
              onClick={() => setIsAdminMode(true)}
              className="text-xs font-semibold text-neutral-200 hover:text-white underline underline-offset-4 whitespace-nowrap self-end xs:self-auto min-h-[36px] flex items-center"
            >
              Switch to Admin Mode
            </button>
          </div>
        )}

        {/* Global Error Notice if any */}
        {error && (
          <div className="mt-3 sm:mt-4 flex items-start gap-3 rounded-xl border border-rose-900/40 bg-rose-950/30 p-3.5 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">Backend Communication Warning</p>
              <p className="mt-0.5 text-rose-200/80">{error}</p>
            </div>
          </div>
        )}

        {/* Project Cards Section (Responsive Grid: 1 col on mobile, 2 col on tablet, 3 col on desktop) */}
        <section className="mt-5 sm:mt-6">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 mb-3.5">
            <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase">
              Supabase Project Containers (3 Independent Slots)
            </h3>
            <button
              onClick={() => navigateTo('schema')}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors self-start xs:self-auto py-1"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>View Schema & Env Instructions</span>
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-72 sm:h-80 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={(p) => navigateTo(`project=${p.id}`)}
                  onOpenConfig={(p) => navigateTo(`config=${p.id}`)}
                  onTestConnection={(p) => navigateTo(`diagnostics=${p.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Architectural Overview Strip */}
        <section className="mt-8 sm:mt-10 rounded-xl sm:rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-neutral-800/80 pb-3.5 sm:pb-4">
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-white">
                Multi-Project Isolation & Credential Security
              </h4>
              <p className="mt-0.5 text-[11px] sm:text-xs text-neutral-400">
                Phase 1 architectural guarantees for the JTEC Cloud deployment.
              </p>
            </div>
            <button
              onClick={() => navigateTo('verify')}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3.5 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 transition-colors self-start sm:self-auto min-h-[40px]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Run Verification Suite</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-neutral-200">
                <span className="font-mono text-neutral-500">01.</span>
                <span>Isolated Storage Buckets</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Audio files for Nasheed, Love & Chill, and JTEC Music are strictly isolated in designated buckets with distinct URLs.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-neutral-200">
                <span className="font-mono text-neutral-500">02.</span>
                <span>No Leaked Service Keys</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Service-role keys and Management API tokens are executed exclusively server-side. The frontend only receives sanitized summaries.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-neutral-200">
                <span className="font-mono text-neutral-500">03.</span>
                <span>Real Byte-Level Audits</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                No simulated or fabricated metrics. Storage is summed directly from actual objects in the Supabase bucket.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <footer className="mt-auto border-t border-neutral-900 bg-neutral-950 px-4 sm:px-6 py-5 text-xs text-neutral-500 safe-bottom">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>JTEC CLOUD DASHBOARD</span>
            <span aria-hidden="true">·</span>
            <span>PHASE 1 BUILD</span>
            <span aria-hidden="true">·</span>
            <span>MOBILE-FIRST</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={() => navigateTo('schema')}
              className="hover:text-neutral-300 transition-colors py-1"
            >
              Database Schema
            </button>
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className="hover:text-neutral-300 transition-colors py-1"
            >
              {isAdminMode ? 'Lock Read-Only' : 'Unlock Admin'}
            </button>
          </div>
        </div>
      </footer>

      {/* Subpage / Modal Overlays with Back Navigation & History Support */}
      {selectedProjectId && (
        <ProjectDetailsModal
          projectId={selectedProjectId}
          isAdminMode={isAdminMode}
          onClose={() => handleCloseModal()}
          onOpenConfig={() => navigateTo(`config=${selectedProjectId}`)}
          onOpenTest={() => navigateTo(`diagnostics=${selectedProjectId}`)}
          onOpenUpload={() => navigateTo('upload')}
        />
      )}

      {configProject && (
        <ProjectConfigModal
          project={configProject}
          onClose={() => handleCloseModal()}
          onNavigateHome={() => navigateTo('')}
          onNavigateBack={lastViewedProjectId ? () => navigateTo(`project=${lastViewedProjectId}`) : undefined}
          hasPreviousProject={Boolean(lastViewedProjectId)}
          onSaved={() => {
            fetchProjects();
          }}
          onRunTest={() => {
            navigateTo(`diagnostics=${configProject.id}`);
          }}
        />
      )}

      {diagnosticsProject && (
        <DiagnosticsModal
          project={diagnosticsProject}
          onClose={() => handleCloseModal()}
          onNavigateHome={() => navigateTo('')}
          onNavigateBack={lastViewedProjectId ? () => navigateTo(`project=${lastViewedProjectId}`) : undefined}
          hasPreviousProject={Boolean(lastViewedProjectId)}
          onRefreshProject={fetchProjects}
        />
      )}

      {isUploadOpen && (
        <AdminUploadModal
          projects={projects}
          defaultProjectId={lastViewedProjectId || selectedProjectId || undefined}
          onClose={() => handleCloseModal()}
          onNavigateHome={() => navigateTo('')}
          onNavigateBack={lastViewedProjectId ? () => navigateTo(`project=${lastViewedProjectId}`) : undefined}
          hasPreviousProject={Boolean(lastViewedProjectId)}
          onUploadSuccess={() => {
            fetchProjects();
          }}
        />
      )}

      {isSetupGuideOpen && (
        <SetupGuideModal
          onClose={() => handleCloseModal()}
          onNavigateHome={() => navigateTo('')}
        />
      )}
    </div>
  );
}
