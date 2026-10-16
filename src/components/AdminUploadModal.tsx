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
} from 'lucide-react';
import type { SupabaseProjectSummary } from '../types/dashboard';
import { uploadAudioFile } from '../services/dashboardService';

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

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedSong, setUploadedSong] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      // Auto-extract track title from filename
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

    const formData = new FormData();
    formData.append('audioFile', file);
    formData.append('title', title.trim());
    formData.append('artist', artist.trim() || 'Unknown Artist');
    formData.append('album', album.trim());
    formData.append('genre', genre.trim());
    formData.append('duration', duration.trim());

    try {
      setUploadProgress(50);
      const res = await uploadAudioFile(selectedProjectId, file, {
        title: title.trim(),
        artist: artist.trim() || 'Unknown Artist',
        album: album.trim(),
        genre: genre.trim(),
        duration: duration.trim(),
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
