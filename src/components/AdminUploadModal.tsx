import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  Upload,
  Music,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileAudio,
  HardDrive,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  LogIn,
  LogOut,
  Key,
  Image as ImageIcon,
  ImagePlus,
  ImageOff,
  Sparkles,
} from 'lucide-react';
import type { SupabaseProjectSummary } from '../types/dashboard';
import {
  uploadAudioFile,
  getAdminUser,
  adminSignIn,
  adminSignOut,
} from '../services/dashboardService';
import { extractAudioArtworkAndMetadata } from '../utils/audioArtworkExtractor';
import { resolveProjectLogo } from '../assets/logos';

interface CoverState {
  status: 'idle' | 'detecting' | 'found' | 'none' | 'custom';
  source: 'embedded' | 'custom' | 'none';
  previewUrl: string | null;
  file: File | null;
  mimeType: string | null;
  fileName?: string;
}

interface AdminUploadModalProps {
  projects: SupabaseProjectSummary[];
  defaultProjectId?: string;
  onClose: () => void;
  onNavigateHome?: () => void;
  onNavigateBack?: () => void;
  hasPreviousProject?: boolean;
  onUploadSuccess: () => void;
}

export const AdminUploadModal: React.FC<AdminUploadModalProps> = ({
  projects,
  defaultProjectId,
  onClose,
  onNavigateHome,
  onNavigateBack,
  hasPreviousProject = false,
  onUploadSuccess,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    defaultProjectId || (projects[0]?.id || 'nasheed')
  );
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [duration, setDuration] = useState('');

  // Artwork detection & custom cover state (Upgraded for NASHEED)
  const [coverState, setCoverState] = useState<CoverState>({
    status: 'idle',
    source: 'none',
    previewUrl: null,
    file: null,
    mimeType: null,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedSong, setUploadedSong] = useState<any | null>(null);

  // Admin authentication state
  const [adminUser, setAdminUser] = useState<{ email: string; id: string } | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Check administrator session whenever selected project changes
  useEffect(() => {
    let active = true;
    setIsLoadingAuth(true);
    setAuthError(null);
    getAdminUser(selectedProjectId)
      .then((user) => {
        if (active) {
          setAdminUser(user);
          setIsLoadingAuth(false);
        }
      })
      .catch(() => {
        if (active) {
          setAdminUser(null);
          setIsLoadingAuth(false);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedProjectId]);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword) {
      setAuthError('Please enter administrator email and password.');
      return;
    }
    setIsSigningIn(true);
    setAuthError(null);
    const res = await adminSignIn(selectedProjectId, authEmail.trim(), authPassword);
    setIsSigningIn(false);
    if (res.success && res.user) {
      setAdminUser(res.user);
      setShowAuthForm(false);
      setAuthPassword('');
      setErrorMessage(null);
    } else {
      setAuthError(res.error || 'Failed to authenticate administrator.');
    }
  };

  const handleAdminSignOut = async () => {
    await adminSignOut(selectedProjectId);
    setAdminUser(null);
  };

  const handleReturnBack = () => {
    if (onNavigateBack) {
      onNavigateBack();
    } else {
      onClose();
    }
  };

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      // Auto-extract track title from filename as initial fallback
      const cleanName = selected.name.replace(/\.[^/.]+$/, '');
      if (!title) {
        setTitle(cleanName.replace(/[-_]/g, ' '));
      }
      setErrorMessage(null);
      setStatusMessage(null);
      setUploadedSong(null);

      // Attempt to inspect audio duration client-side
      const audioUrl = URL.createObjectURL(selected);
      const audio = new Audio(audioUrl);
      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration)) {
          const mins = Math.floor(audio.duration / 60);
          const secs = Math.floor(audio.duration % 60);
          setDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
        }
      };

      // Detect embedded album artwork (automatic detection for NASHEED)
      setCoverState({
        status: 'detecting',
        source: 'none',
        previewUrl: null,
        file: null,
        mimeType: null,
      });

      try {
        const metadata = await extractAudioArtworkAndMetadata(selected);
        if (metadata.hasEmbeddedCover && metadata.coverPreviewUrl && metadata.coverFile) {
          setCoverState({
            status: 'found',
            source: 'embedded',
            previewUrl: metadata.coverPreviewUrl,
            file: metadata.coverFile,
            mimeType: metadata.mimeType,
            fileName: metadata.coverFile.name,
          });
          // Auto-fill tags from ID3 metadata if available
          if (metadata.extractedTitle) setTitle(metadata.extractedTitle);
          if (metadata.extractedArtist) setArtist(metadata.extractedArtist);
          if (metadata.extractedAlbum) setAlbum(metadata.extractedAlbum);
          if (metadata.extractedGenre) setGenre(metadata.extractedGenre);
        } else {
          setCoverState({
            status: 'none',
            source: 'none',
            previewUrl: null,
            file: null,
            mimeType: null,
          });
          if (metadata.extractedTitle) setTitle(metadata.extractedTitle);
          if (metadata.extractedArtist) setArtist(metadata.extractedArtist);
          if (metadata.extractedAlbum) setAlbum(metadata.extractedAlbum);
          if (metadata.extractedGenre) setGenre(metadata.extractedGenre);
        }
      } catch (extractErr) {
        console.warn('Artwork extraction notice:', extractErr);
        setCoverState({
          status: 'none',
          source: 'none',
          previewUrl: null,
          file: null,
          mimeType: null,
        });
      }
    }
  };

  const handleCustomCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedImg = e.target.files[0];
      if (!selectedImg.type.startsWith('image/')) {
        setErrorMessage('Please select a valid image file (JPG, JPEG, PNG, or WebP).');
        return;
      }
      const preview = URL.createObjectURL(selectedImg);
      setCoverState({
        status: 'custom',
        source: 'custom',
        previewUrl: preview,
        file: selectedImg,
        mimeType: selectedImg.type,
        fileName: selectedImg.name,
      });
      setErrorMessage(null);
    }
  };

  const handleRemoveCover = () => {
    setCoverState({
      status: 'none',
      source: 'none',
      previewUrl: null,
      file: null,
      mimeType: null,
    });
    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please select an audio file to upload.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Please provide a track title.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);
    setErrorMessage(null);
    setStatusMessage('Transmitting audio package to Supabase...');

    try {
      setUploadProgress(50);
      const res = await uploadAudioFile(selectedProjectId, file, {
        title: title.trim(),
        artist: artist.trim() || 'Unknown Artist',
        album: album.trim(),
        genre: genre.trim(),
        duration: duration.trim(),
        coverFile: coverState.file,
      });

      setUploadProgress(100);
      setStatusMessage(`Upload succeeded! Stored in '${selectedProject?.storageBucket}'`);
      setUploadedSong(res.song);
      onUploadSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during upload');
      setStatusMessage(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setTitle('');
    setArtist('');
    setAlbum('');
    setGenre('');
    setDuration('');
    setErrorMessage(null);
    setStatusMessage(null);
    setUploadedSong(null);
    setUploadProgress(0);
    setCoverState({
      status: 'idle',
      source: 'none',
      previewUrl: null,
      file: null,
      mimeType: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm sm:p-3 md:p-6 overflow-y-auto safe-top safe-bottom p-0"
    >
      <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[90dvh] flex flex-col min-h-0 rounded-none sm:rounded-2xl border-0 sm:border border-neutral-800 bg-neutral-950 shadow-2xl text-neutral-100 overflow-hidden">
        
        {/* Sticky Header Bar with Prominent Back Button */}
        <div className="shrink-0 flex items-center justify-between border-b border-neutral-800/80 px-3 sm:px-6 py-3 bg-neutral-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {hasPreviousProject ? (
              <button
                type="button"
                onClick={handleReturnBack}
                className="flex items-center gap-1.5 text-neutral-300 hover:text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-neutral-800 transition-colors -ml-1 min-h-[44px] focus:outline-none focus:ring-1 focus:ring-neutral-700 cursor-pointer"
                title={`Return to ${selectedProject?.name || 'Project'}`}
                aria-label="Back to project"
              >
                <ArrowLeft className="h-4 w-4 text-neutral-400 group-hover:text-white shrink-0" />
                <span className="truncate max-w-[130px] sm:max-w-none">
                  Back to {selectedProject?.name || 'Project'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReturnHome}
                className="flex items-center gap-1.5 text-neutral-300 hover:text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-neutral-800 transition-colors -ml-1 min-h-[44px] focus:outline-none focus:ring-1 focus:ring-neutral-700 cursor-pointer"
                title="Return to Dashboard (or press Esc)"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="h-4 w-4 text-neutral-400 group-hover:text-white shrink-0" />
                <span>Back to Dashboard</span>
              </button>
            )}

            <div className="h-4 w-px bg-neutral-800 hidden xs:block" />
            <div className="hidden xs:flex items-center gap-1.5 text-xs text-neutral-400">
              {hasPreviousProject && (
                <>
                  <button
                    type="button"
                    onClick={handleReturnHome}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Dashboard
                  </button>
                  <span className="text-neutral-600">/</span>
                </>
              )}
              <h3 className="text-sm font-semibold text-white">Admin Upload</h3>
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleUpload} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 touch-scroll pb-6">
          {/* Destination Project Selector (Responsive 1-col on mobile, 3-col on sm) */}
          <div>
            <label className="block text-xs font-medium text-neutral-300">
              Destination Supabase Project
            </label>
            <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {projects.map((proj) => (
                <button
                  type="button"
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className={`rounded-lg border p-2.5 text-left transition-colors min-h-[44px] ${
                    selectedProjectId === proj.id
                      ? 'border-neutral-400 bg-neutral-800 text-white'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <p className="text-xs font-semibold truncate">{proj.name}</p>
                  <p className="text-[10px] text-neutral-500 truncate font-mono">
                    b/{proj.storageBucket}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Administrator Authentication & Storage RLS Status Card */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {adminUser ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                )}
                <div>
                  <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>Admin Storage Authorization (RLS)</span>
                    {adminUser && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950 border border-emerald-800/80 text-emerald-300">
                        Authenticated
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {adminUser
                      ? `Active session: ${adminUser.email}`
                      : `Uploads require administrator session to satisfy Storage RLS on '${selectedProject?.storageBucket || 'music'}'.`}
                  </p>
                </div>
              </div>

              {adminUser ? (
                <button
                  type="button"
                  onClick={handleAdminSignOut}
                  className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-white px-2.5 py-1 rounded bg-neutral-800/80 hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuthForm(!showAuthForm)}
                  className="flex items-center gap-1 text-[11px] font-medium text-neutral-200 hover:text-white px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  <LogIn className="h-3 w-3 text-amber-400" />
                  <span>{showAuthForm ? 'Hide Sign In' : 'Sign In as Admin'}</span>
                </button>
              )}
            </div>

            {/* Collapsible Sign In Form */}
            {(!adminUser || showAuthForm) && (
              <div className={`pt-2 border-t border-neutral-800/60 ${!showAuthForm && !adminUser ? 'hidden sm:block' : ''}`}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="Admin Email (e.g. admin@example.com)"
                    className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Admin Password"
                    className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAdminSignIn}
                    disabled={isSigningIn}
                    className="flex items-center justify-center gap-1 rounded-lg bg-neutral-100 hover:bg-white text-neutral-950 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSigningIn ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
                    <span>Authenticate</span>
                  </button>
                </div>
                {authError && (
                  <p className="mt-1.5 text-[11px] text-rose-400">{authError}</p>
                )}
              </div>
            )}
          </div>

          {/* Audio File Picker */}
          <div>
            <label className="block text-xs font-medium text-neutral-300">
              Select Audio File (.mp3, .wav, .m4a, .aac, .flac)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-1.5 flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 p-5 sm:p-6 text-center hover:border-neutral-500 hover:bg-neutral-900 cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileAudio className="h-7 w-7 sm:h-8 sm:w-8 text-neutral-400" />
              {file ? (
                <div className="mt-2 text-center w-full px-2">
                  <p className="text-xs font-medium text-white truncate max-w-full">{file.name}</p>
                  <p className="font-mono text-[11px] text-neutral-400">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type || 'audio file'}
                  </p>
                </div>
              ) : (
                <div className="mt-2 text-center">
                  <p className="text-xs font-medium text-neutral-300">
                    Tap to browse or drop an audio file
                  </p>
                  <p className="text-[11px] text-neutral-500">Maximum 50MB per track</p>
                </div>
              )}
            </div>
          </div>

          {/* Hidden native image input for custom cover selection (opens gallery/local files) */}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={handleCustomCoverChange}
            className="hidden"
          />

          {/* Embedded Artwork Detection & Cover Status Card (NASHEED Upgraded Flow) */}
          {file && (
            <div className="space-y-2">
              {coverState.status === 'detecting' && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5 flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-neutral-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-white">Detecting Album Artwork...</p>
                    <p className="text-[11px] text-neutral-400">
                      Scanning audio file for embedded ID3v2 APIC, FLAC picture, or MP4 cover art
                    </p>
                  </div>
                </div>
              )}

              {/* Case 1: Embedded Cover Detected */}
              {coverState.status === 'found' && (
                <div className="rounded-xl border border-emerald-900/70 bg-emerald-950/25 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 border border-emerald-700/80 text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Cover Found</span>
                      </span>
                      <span className="text-xs font-medium text-neutral-300">
                        Embedded Album Artwork
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400">Kept as Track Cover</span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-lg border border-emerald-800/80 bg-neutral-900 shadow-inner">
                      {coverState.previewUrl ? (
                        <img
                          src={coverState.previewUrl}
                          alt="Embedded cover preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-neutral-500 m-auto" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-semibold text-white truncate">
                        {coverState.fileName || 'Embedded Artwork'}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        MIME: <span className="font-mono text-neutral-300">{coverState.mimeType || 'image/jpeg'}</span>
                      </p>
                      <p className="text-[11px] text-emerald-300/90 leading-tight">
                        Embedded artwork is active and will be uploaded to Supabase Storage with this song. No need to upload another one.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Case 2: No Cover Detected -> Show "No Cover Found" & prominent "Add Cover" button */}
              {coverState.status === 'none' && (
                <div className="rounded-xl border border-amber-900/60 bg-amber-950/25 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 border border-amber-700/80 text-amber-300">
                        <ImageOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>No Cover Found</span>
                      </span>
                      <span className="text-xs font-medium text-neutral-300 hidden xs:inline">
                        No Embedded Artwork
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-600/70 bg-amber-900/50 hover:bg-amber-800/60 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors cursor-pointer min-h-[36px] shadow-sm active:scale-95"
                    >
                      <ImagePlus className="h-3.5 w-3.5 text-amber-300" />
                      <span>Add Cover</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-dashed border-amber-800/70 bg-neutral-900/80 flex items-center justify-center">
                      <ImageOff className="h-6 w-6 text-amber-500/70" />
                    </div>
                    <div className="text-[11px] text-neutral-300 leading-relaxed flex-1">
                      <p className="text-neutral-200">
                        No embedded artwork was detected in this audio file.
                      </p>
                      <p className="text-neutral-400 mt-0.5">
                        Tap <strong className="text-amber-200 font-semibold">Add Cover</strong> to choose an image from your gallery/files, or continue without one to use the fallback artwork.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Case 3: Custom Cover Selected */}
              {coverState.status === 'custom' && (
                <div className="rounded-xl border border-sky-900/70 bg-sky-950/25 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-950 border border-sky-700/80 text-sky-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                        <span>Custom Cover Attached</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="text-[11px] font-medium text-neutral-300 hover:text-white px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveCover}
                        className="text-[11px] font-medium text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/50 transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-lg border border-sky-800/80 bg-neutral-900 shadow-inner">
                      {coverState.previewUrl ? (
                        <img
                          src={coverState.previewUrl}
                          alt="Custom cover preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-neutral-500 m-auto" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-semibold text-white truncate">
                        {coverState.fileName || coverState.file?.name}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        Format: <span className="font-mono text-neutral-300">{coverState.mimeType}</span>
                      </p>
                      <p className="text-[11px] text-sky-300/90 leading-tight">
                        Custom cover will be uploaded together with the song to Supabase Storage and saved as <code className="text-sky-200">songs.cover_url</code>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metadata Fields (Responsive 1-col on xs, 2-col on sm) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400">Track Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Track Title"
                required
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name"
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400">Album</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Album name"
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400">Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Genre"
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400">Duration</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 3:45"
                className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none font-mono min-h-[40px]"
              />
            </div>
          </div>

          {/* Pre-Upload Track Preview & Validation Card (Requirement 4) */}
          {file && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                <h4 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-neutral-400" />
                  <span>Track Preview & Pre-Upload Validation</span>
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                  Ready to Upload
                </span>
              </div>

              <div className="flex items-start gap-3.5">
                {/* Cover Preview or Fallback Artwork */}
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950 shadow-md">
                  <img
                    src={
                      coverState.previewUrl ||
                      resolveProjectLogo(selectedProjectId, selectedProject?.logo)
                    }
                    alt="Track cover preview"
                    className="h-full w-full object-cover"
                  />
                  {!coverState.previewUrl && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-xs py-0.5 text-center">
                      <span className="text-[9px] font-semibold text-amber-300">Fallback</span>
                    </div>
                  )}
                </div>

                {/* Song Title, Artist, Duration, Destination */}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-white truncate">
                    {title.trim() || file?.name || 'Untitled Track'}
                  </p>
                  <p className="text-xs text-neutral-300 truncate">
                    {artist.trim() || 'Unknown Artist'} {album.trim() ? `· ${album.trim()}` : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-neutral-400">
                    <span className="font-mono text-neutral-200">⏱️ {duration || 'Detecting...'}</span>
                    <span>·</span>
                    <span className="font-mono text-neutral-400">
                      Bucket: {selectedProject?.storageBucket || 'nasheed-audio'}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 italic pt-0.5">
                    {coverState.previewUrl
                      ? 'Artwork verified. Audio & cover will be uploaded together.'
                      : 'Missing cover will not block upload. Fallback artwork will be used.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Progress / Status feedback */}
          {isUploading && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-300">
                <span className="flex items-center gap-2 truncate pr-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-200 shrink-0" />
                  <span className="truncate">{statusMessage}</span>
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full bg-white transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {statusMessage && !isUploading && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="font-semibold">{statusMessage}</p>
                {uploadedSong && (
                  <p className="mt-1 font-mono text-[11px] text-emerald-200 break-all">
                    File: {uploadedSong.file_name} · Track: {uploadedSong.title}
                  </p>
                )}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-900/40 bg-rose-950/30 p-3 text-xs text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Upload Error</p>
                <p className="text-[11px] leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-neutral-800/80 p-3 sm:px-6 sm:py-3.5 bg-neutral-950/95 gap-2.5 safe-bottom">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReturnHome}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors min-h-[44px] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 text-neutral-400" />
                <span>Back to Dashboard</span>
              </button>
              {hasPreviousProject && (
                <button
                  type="button"
                  onClick={handleReturnBack}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors min-h-[44px] cursor-pointer"
                >
                  <span>Back to {selectedProject?.name || 'Project'}</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={isUploading}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50 min-h-[44px] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
              <button
                type="submit"
                disabled={isUploading || !file}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors disabled:opacity-40 min-h-[44px] cursor-pointer shadow-sm active:scale-95"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Track</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
