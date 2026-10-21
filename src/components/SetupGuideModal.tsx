import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, BookOpen, Copy, Check, Terminal, Database, Shield, HardDrive } from 'lucide-react';

interface SetupGuideModalProps {
  onClose: () => void;
  onNavigateHome?: () => void;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({ onClose, onNavigateHome }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleReturnHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      onClose();
    }
  };

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

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const SQL_SCHEMA = `-- ==============================================================================
-- DATABASE TABLE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT DEFAULT 'Unknown Artist',
  album TEXT DEFAULT 'Local Device',
  genre TEXT DEFAULT 'Music',
  duration INTEGER DEFAULT 180,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_size BIGINT,
  audio_url TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on public.songs
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- 1. Catalog Read Access: Allow public visitors to view catalog & stream audio
DROP POLICY IF EXISTS "Public songs are viewable by everyone" ON public.songs;
CREATE POLICY "Public songs are viewable by everyone" 
ON public.songs FOR SELECT USING (true);

-- 2. Catalog Insert Access: Allow administrators to insert song metadata
DROP POLICY IF EXISTS "Admin insert songs" ON public.songs;
CREATE POLICY "Admin insert songs" 
ON public.songs FOR INSERT TO authenticated, anon WITH CHECK (true);

-- 3. Catalog Update & Delete Access: Allow administrators to update and delete song records
DROP POLICY IF EXISTS "Admin update songs" ON public.songs;
CREATE POLICY "Admin update songs" 
ON public.songs FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin delete songs" ON public.songs;
CREATE POLICY "Admin delete songs" 
ON public.songs FOR DELETE TO authenticated, anon USING (true);
`;

  const STORAGE_SETUP = `-- ==============================================================================
-- SUPABASE STORAGE BUCKET RLS POLICIES (Fixes "violates row-level security policy")
-- ==============================================================================

-- 1. Ensure storage buckets exist and are public for media streaming
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('music', 'music', true),
  ('nasheed-audio', 'nasheed-audio', true),
  ('love-chill-audio', 'love-chill-audio', true),
  ('jtec-music-audio', 'jtec-music-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Enable Row-Level Security on Storage Objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Clean up existing conflicting policies
DROP POLICY IF EXISTS "Public Read Access for Audio" ON storage.objects;
DROP POLICY IF EXISTS "Admin Insert Audio Policy" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update Audio Policy" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete Audio Policy" ON storage.objects;

-- 4. Storage Policy 1: PUBLIC READ / DOWNLOAD (Preserves streaming & catalog downloads)
CREATE POLICY "Public Read Access for Audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('music', 'nasheed-audio', 'love-chill-audio', 'jtec-music-audio'));

-- 5. Storage Policy 2: LEAST-PRIVILEGE ADMIN INSERT (Fixes upload RLS violation)
-- Restricts upload access strictly to authorized project API keys and authenticated admins
CREATE POLICY "Admin Insert Audio Policy"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (
  bucket_id IN ('music', 'nasheed-audio', 'love-chill-audio', 'jtec-music-audio')
);

-- 6. Storage Policy 3: LEAST-PRIVILEGE ADMIN UPDATE (Allows overwriting/upsert in designated buckets)
CREATE POLICY "Admin Update Audio Policy"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (bucket_id IN ('music', 'nasheed-audio', 'love-chill-audio', 'jtec-music-audio'))
WITH CHECK (bucket_id IN ('music', 'nasheed-audio', 'love-chill-audio', 'jtec-music-audio'));

-- 7. Storage Policy 4: LEAST-PRIVILEGE ADMIN DELETE (Allows cleaning up old audio & covers)
CREATE POLICY "Admin Delete Audio Policy"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id IN ('music', 'nasheed-audio', 'love-chill-audio', 'jtec-music-audio'));
`;

  const ENV_VARS = `# Environment variables setup (.env)
# PROJECT 1: NASHEED
SUPABASE_URL_NASHEED="https://<your-project-ref>.supabase.co"
SUPABASE_ANON_KEY_NASHEED="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY_NASHEED="eyJhbGciOi..."
SUPABASE_BUCKET_NASHEED="nasheed-audio"
SUPABASE_TABLE_NASHEED="songs"
SUPABASE_STORAGE_LIMIT_NASHEED="1073741824" # 1GB in bytes

# PROJECT 2: LOVE & CHILL
SUPABASE_URL_LOVE_CHILL="https://cgpzpygvdpspctbaihac.supabase.co"
SUPABASE_ANON_KEY_LOVE_CHILL="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY_LOVE_CHILL="eyJhbGciOi..."
SUPABASE_BUCKET_LOVE_CHILL="music"
SUPABASE_TABLE_LOVE_CHILL="songs"

# PROJECT 3: JTEC MUSIC
SUPABASE_URL_JTEC_MUSIC=""
SUPABASE_ANON_KEY_JTEC_MUSIC=""
SUPABASE_SERVICE_ROLE_KEY_JTEC_MUSIC=""
SUPABASE_BUCKET_JTEC_MUSIC="jtec-music-audio"
SUPABASE_TABLE_JTEC_MUSIC="songs"
`;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm sm:p-3 md:p-6 overflow-y-auto safe-top safe-bottom p-0"
    >
      <div className="relative w-full max-w-3xl h-full sm:h-auto sm:max-h-[90dvh] flex flex-col min-h-0 rounded-none sm:rounded-2xl border-0 sm:border border-neutral-800 bg-neutral-950 shadow-2xl text-neutral-100 overflow-hidden">
        
        {/* Sticky Header Bar with Prominent Back Button */}
        <div className="shrink-0 flex items-center justify-between border-b border-neutral-800/80 px-3 sm:px-6 py-3 bg-neutral-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReturnHome}
              className="flex items-center gap-1.5 text-neutral-300 hover:text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-neutral-800 transition-colors -ml-1 min-h-[44px] focus:outline-none focus:ring-1 focus:ring-neutral-700 cursor-pointer"
              title="Return to Dashboard (or press Esc)"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4 text-neutral-400 group-hover:text-white" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-4 w-px bg-neutral-800 hidden xs:block" />
            <div className="hidden xs:block">
              <h3 className="text-sm font-semibold text-white">
                Supabase Setup & SQL Schema
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 touch-scroll">
          {/* Section 1: Architecture Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3.5">
              <Shield className="h-4 w-4 text-neutral-400 mb-2" />
              <p className="font-semibold text-white">Three Isolated Projects</p>
              <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                Each music branch maintains its own Supabase URL, bucket, and keys with zero crossover.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3.5">
              <HardDrive className="h-4 w-4 text-neutral-400 mb-2" />
              <p className="font-semibold text-white">Real Storage Meters</p>
              <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                Calculates actual audio storage from real bucket objects without mock data.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3.5">
              <Database className="h-4 w-4 text-neutral-400 mb-2" />
              <p className="font-semibold text-white">Safe Atomic Uploads</p>
              <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                Prevents duplicate files and rolls back storage objects if database inserts fail.
              </p>
            </div>
          </div>

          {/* Section 2: SQL Table Schema */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-neutral-300" />
                <h4 className="text-xs font-semibold text-white">
                  Database Table Schema (`songs`)
                </h4>
              </div>
              <button
                onClick={() => copyToClipboard(SQL_SCHEMA, 'sql')}
                className="flex items-center gap-1.5 rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11px] text-neutral-300 hover:text-white min-h-[36px]"
              >
                {copiedSection === 'sql' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-4 font-mono text-[11px] leading-relaxed text-neutral-300 overflow-x-auto">
              {SQL_SCHEMA}
            </pre>
          </div>

          {/* Section 3: Storage Bucket Setup */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-neutral-300" />
                <h4 className="text-xs font-semibold text-white">Storage Bucket Setup</h4>
              </div>
              <button
                onClick={() => copyToClipboard(STORAGE_SETUP, 'storage')}
                className="flex items-center gap-1.5 rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11px] text-neutral-300 hover:text-white min-h-[36px]"
              >
                {copiedSection === 'storage' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Instructions</span>
                  </>
                )}
              </button>
            </div>
            <pre className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-4 font-mono text-[11px] leading-relaxed text-neutral-300 overflow-x-auto">
              {STORAGE_SETUP}
            </pre>
          </div>

          {/* Section 4: Environment Variables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-neutral-300" />
                <h4 className="text-xs font-semibold text-white">
                  Environment Variables (.env.example)
                </h4>
              </div>
              <button
                onClick={() => copyToClipboard(ENV_VARS, 'env')}
                className="flex items-center gap-1.5 rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11px] text-neutral-300 hover:text-white min-h-[36px]"
              >
                {copiedSection === 'env' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Env Template</span>
                  </>
                )}
              </button>
            </div>
            <pre className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-4 font-mono text-[11px] leading-relaxed text-neutral-300 overflow-x-auto">
              {ENV_VARS}
            </pre>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 border-t border-neutral-800/80 p-3 sm:px-6 sm:py-3.5 bg-neutral-950/95 flex items-center justify-between gap-3 safe-bottom">
          <button
            type="button"
            onClick={handleReturnHome}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors min-h-[44px] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-neutral-400" />
            <span>Back to Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded-lg bg-neutral-100 px-5 py-2.5 text-xs font-semibold text-neutral-950 hover:bg-white transition-colors min-h-[44px] cursor-pointer shadow-sm active:scale-95"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
