import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  Activity,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  Terminal,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { SupabaseProjectSummary, ConnectionTestResult, DiagnosticCheck } from '../types/dashboard';

interface DiagnosticsModalProps {
  project: SupabaseProjectSummary;
  onClose: () => void;
  onRefreshProject: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  project,
  onClose,
  onRefreshProject,
}) => {
  const [activeMode, setActiveMode] = useState<'health' | 'phase1'>('health');
  const [healthResult, setHealthResult] = useState<ConnectionTestResult | null>(null);
  const [isTestingHealth, setIsTestingHealth] = useState(false);

  const [phase1Steps, setPhase1Steps] = useState<
    Array<{ name: string; status: 'passed' | 'failed' | 'warning' | 'skipped'; detail: string }>
  >([]);
  const [isRunningPhase1, setIsRunningPhase1] = useState(false);
  const [phase1Summary, setPhase1Summary] = useState<string | null>(null);
  const [phase1Error, setPhase1Error] = useState<string | null>(null);

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

  const runHealthTest = async () => {
    setIsTestingHealth(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/test-connection`, {
        method: 'POST',
      });
      const data = await res.json();
      setHealthResult(data);
      onRefreshProject();
    } catch (err: any) {
      setHealthResult({
        projectId: project.id,
        overallStatus: 'failed',
        testedAt: new Date().toISOString(),
        checks: [
          {
            step: 'network',
            title: 'Network Communication',
            status: 'failed',
            message: err.message || 'Failed to ping diagnostic endpoint',
          },
        ],
      });
    } finally {
      setIsTestingHealth(false);
    }
  };

  const runPhase1Verification = async () => {
    setIsRunningPhase1(true);
    setPhase1Summary(null);
    setPhase1Error(null);
    setPhase1Steps([]);

    try {
      const res = await fetch(`/api/projects/${project.id}/run-self-test`, {
        method: 'POST',
      });
      const data = await res.json();
      setPhase1Steps(data.steps || []);

      if (data.success) {
        setPhase1Summary(data.message || 'All Phase 1 tests passed successfully on live backend.');
      } else {
        setPhase1Error(data.error || 'One or more verification steps failed.');
      }
      onRefreshProject();
    } catch (err: any) {
      setPhase1Error(err.message || 'Self-test execution error');
    } finally {
      setIsRunningPhase1(false);
    }
  };

  useEffect(() => {
    runHealthTest();
  }, [project.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm sm:p-3 md:p-6 overflow-hidden safe-top safe-bottom">
      <div className="relative w-full max-w-2xl h-full sm:h-auto sm:max-h-[90dvh] flex flex-col rounded-none sm:rounded-2xl border-0 sm:border border-neutral-800 bg-neutral-950 shadow-2xl text-neutral-100 overflow-hidden">
        
        {/* Sticky Header Bar with Prominent Back Button */}
        <div className="shrink-0 flex items-center justify-between border-b border-neutral-800/80 px-3 sm:px-6 py-3 bg-neutral-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
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
                {project.name} Diagnostics
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="shrink-0 flex items-center gap-1.5 border-b border-neutral-800 px-4 py-2.5 bg-neutral-950 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveMode('health')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap min-h-[36px] ${
              activeMode === 'health'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}
          >
            Connection Health Checks
          </button>
          <button
            onClick={() => setActiveMode('phase1')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap min-h-[36px] ${
              activeMode === 'phase1'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="h-3 w-3 text-neutral-400" />
            <span>Phase 1 Verification Suite</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 touch-scroll">
          {/* Tab 1: Health Diagnostic Checks */}
          {activeMode === 'health' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-400">
                <span className="truncate">
                  Target: <span className="font-mono text-neutral-200">{project.url || 'Not configured'}</span>
                </span>
                <button
                  onClick={runHealthTest}
                  disabled={isTestingHealth}
                  className="self-start sm:self-auto flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 font-medium text-neutral-200 hover:bg-neutral-800 transition-colors disabled:opacity-50 min-h-[36px]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isTestingHealth ? 'animate-spin' : ''}`} />
                  <span>Rerun Test</span>
                </button>
              </div>

              {isTestingHealth ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-10 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
                  <p className="mt-3 text-xs text-neutral-300">
                    Testing Supabase connectivity, storage bucket and database table...
                  </p>
                </div>
              ) : healthResult ? (
                <div className="space-y-2.5">
                  {healthResult.checks.map((check, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 rounded-lg border border-neutral-800/80 bg-neutral-900/50 p-3.5 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        {check.status === 'passed' && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                        )}
                        {check.status === 'warning' && (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                        )}
                        {check.status === 'failed' && (
                          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                        )}
                        {check.status === 'skipped' && (
                          <Clock className="h-4 w-4 shrink-0 text-neutral-500 mt-0.5" />
                        )}
                        <div>
                          <p className="font-semibold text-white">{check.title}</p>
                          <p className="mt-0.5 text-neutral-400 leading-relaxed font-mono text-[11px] break-all">
                            {check.message}
                          </p>
                        </div>
                      </div>
                      {check.durationMs !== undefined && (
                        <span className="shrink-0 font-mono text-[11px] text-neutral-500 self-end sm:self-auto">
                          {check.durationMs}ms
                        </span>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center justify-between border-t border-neutral-800 pt-3 text-[11px] text-neutral-500 font-mono">
                    <span>Tested at: {new Date(healthResult.testedAt).toLocaleTimeString()}</span>
                    <span>
                      Status:{' '}
                      <span
                        className={
                          healthResult.overallStatus === 'passed'
                            ? 'text-emerald-400 font-semibold'
                            : healthResult.overallStatus === 'partial'
                            ? 'text-amber-400 font-semibold'
                            : 'text-rose-400 font-semibold'
                        }
                      >
                        {healthResult.overallStatus.toUpperCase()}
                      </span>
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Tab 2: Phase 1 Verification Suite */}
          {activeMode === 'phase1' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Phase 1 Verification Protocol
                </h4>
                <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                  Executes the 6-step verification: authenticates credentials, checks storage bucket & table schema, uploads test track 1, uploads test track 2, verifies both audio files exist in Supabase storage, confirms file counts and real sizes update, and validates refresh error handling.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="font-mono text-[11px] text-neutral-500 truncate">
                    Target: {project.name} ({project.storageBucket})
                  </span>
                  <button
                    onClick={runPhase1Verification}
                    disabled={isRunningPhase1}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors disabled:opacity-50 min-h-[44px]"
                  >
                    {isRunningPhase1 ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Executing Test Steps...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>Execute Phase 1 Tests</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {phase1Summary && (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="font-semibold">Tests Executed & Passed</p>
                    <p className="text-[11px] leading-relaxed mt-0.5">{phase1Summary}</p>
                  </div>
                </div>
              )}

              {phase1Error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-900/40 bg-rose-950/30 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <p className="font-semibold">Test Execution Notice</p>
                    <p className="text-[11px] leading-relaxed mt-0.5">{phase1Error}</p>
                  </div>
                </div>
              )}

              {phase1Steps.length > 0 && (
                <div className="space-y-2">
                  {phase1Steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-neutral-800/80 bg-neutral-900/50 p-3 text-xs"
                    >
                      {step.status === 'passed' && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                      )}
                      {step.status === 'warning' && (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                      )}
                      {step.status === 'failed' && (
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                      )}
                      {step.status === 'skipped' && (
                        <Clock className="h-4 w-4 shrink-0 text-neutral-500 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold text-white">{step.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-neutral-400 leading-relaxed">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Bottom Actions Bar */}
        <div className="shrink-0 flex items-center justify-between border-t border-neutral-800/80 p-3 sm:px-6 sm:py-3.5 bg-neutral-950/95 gap-3 safe-bottom">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4 text-neutral-400" />
            <span>Back to Dashboard</span>
          </button>

          {activeMode === 'health' ? (
            <button
              type="button"
              onClick={runHealthTest}
              disabled={isTestingHealth}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3.5 py-2 text-xs font-semibold text-neutral-950 hover:bg-white transition-colors disabled:opacity-50 min-h-[44px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isTestingHealth ? 'animate-spin' : ''}`} />
              <span>Rerun Health Test</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={runPhase1Verification}
              disabled={isRunningPhase1}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3.5 py-2 text-xs font-semibold text-neutral-950 hover:bg-white transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {isRunningPhase1 ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Executing Tests...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Execute Verification</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
