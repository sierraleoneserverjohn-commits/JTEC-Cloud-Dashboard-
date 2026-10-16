import React, { useState } from 'react';
import {
  RefreshCw,
  Shield,
  ShieldAlert,
  Sparkles,
  BookOpen,
  Upload,
  Menu,
  X,
  Database,
  Sliders,
} from 'lucide-react';

interface HeaderProps {
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
  onOpenUpload: () => void;
  onOpenSetupGuide: () => void;
  onOpenTestRunner: () => void;
  onNavigateHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isAdminMode,
  onToggleAdminMode,
  onRefreshAll,
  isRefreshing,
  onOpenUpload,
  onOpenSetupGuide,
  onOpenTestRunner,
  onNavigateHome,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/95 backdrop-blur-md safe-top">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6">
        {/* Zone 1: Brand Wordmark (Tap to return home) */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 sm:gap-3 text-left shrink-0 rounded-lg p-1 hover:opacity-90 transition-opacity focus:outline-none focus:ring-1 focus:ring-neutral-700 cursor-pointer"
          title="Return to main dashboard"
        >
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-200">
            <svg
              className="h-4 w-4 sm:h-5 sm:w-5 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap">
              JTEC CLOUD
            </h1>
            <p className="text-[9px] sm:text-[10px] tracking-wider text-neutral-400 uppercase leading-none">
              Supabase Fleet
            </p>
          </div>
        </button>

        {/* Zone 2: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-xs text-neutral-400">
          <button
            type="button"
            onClick={onOpenSetupGuide}
            className="flex items-center gap-1.5 hover:text-neutral-200 transition-colors whitespace-nowrap min-h-[44px] cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Setup & Schema</span>
          </button>
          <button
            type="button"
            onClick={onOpenTestRunner}
            className="flex items-center gap-1.5 hover:text-neutral-200 transition-colors whitespace-nowrap min-h-[44px] cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Phase 1 Verification</span>
          </button>
          <button
            type="button"
            onClick={onToggleAdminMode}
            className="flex items-center gap-1.5 transition-colors whitespace-nowrap hover:text-neutral-200 min-h-[44px] cursor-pointer"
          >
            {isAdminMode ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Shield className="h-3.5 w-3.5" />
                <span>Admin Mode</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-neutral-400">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Read-Only</span>
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Primary Action & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            title="Refresh real metrics"
            aria-label="Refresh real storage metrics"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
          </button>

          {isAdminMode ? (
            <button
              type="button"
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-neutral-100 px-3 sm:px-3.5 py-2 text-xs font-semibold text-neutral-900 hover:bg-white transition-colors shadow-sm whitespace-nowrap min-h-[44px] cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Upload Track</span>
              <span className="xs:hidden">Upload</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleAdminMode}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors whitespace-nowrap min-h-[44px] cursor-pointer"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Unlock Admin</span>
            </button>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation (Active on small screens) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-800 bg-neutral-950/98 px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
            <span className="text-xs text-neutral-400">Quick Navigation</span>
            <button
              type="button"
              onClick={onToggleAdminMode}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border border-neutral-800 bg-neutral-900 cursor-pointer"
            >
              {isAdminMode ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Admin Mode
                </span>
              ) : (
                <span className="text-neutral-400 flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" /> Read-Only Mode
                </span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSetupGuide();
              }}
              className="flex items-center gap-2.5 rounded-lg bg-neutral-900/80 p-3 text-left text-neutral-200 hover:bg-neutral-800 transition-colors min-h-[44px] cursor-pointer"
            >
              <BookOpen className="h-4 w-4 text-neutral-400" />
              <div>
                <p className="font-semibold text-white">Setup Guide & SQL Schema</p>
                <p className="text-[11px] text-neutral-400">Database table definition & env vars</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenTestRunner();
              }}
              className="flex items-center gap-2.5 rounded-lg bg-neutral-900/80 p-3 text-left text-neutral-200 hover:bg-neutral-800 transition-colors min-h-[44px] cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-neutral-400" />
              <div>
                <p className="font-semibold text-white">Phase 1 Verification Suite</p>
                <p className="text-[11px] text-neutral-400">Run live Supabase integration tests</p>
              </div>
            </button>

            {isAdminMode && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenUpload();
                }}
                className="flex items-center gap-2.5 rounded-lg bg-neutral-100 p-3 text-left text-neutral-950 font-semibold hover:bg-white transition-colors min-h-[44px] cursor-pointer"
              >
                <Upload className="h-4 w-4 text-neutral-900" />
                <span>Upload New Audio Track</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
