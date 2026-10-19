import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  ShieldCheck,
  ShieldAlert,
  LogIn,
  LogOut,
  Key,
  Image as ImageIcon,
  ImagePlus,
  ImageOff,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Copy,
  Check,
  PlusCircle,
  RefreshCw,
  Ban,
  FastForward,
} from 'lucide-react';
import type { SupabaseProjectSummary, SongMetadataItem } from '../types/dashboard';
import {
  uploadAudioFile,
  getAdminUser,
  adminSignIn,
  adminSignOut,
  fetchProjectSongs,
} from '../services/dashboardService';
import { extractAudioArtworkAndMetadata } from '../utils/audioArtworkExtractor';
import {
  computeFileSha256,
  checkForDuplicates,
  DuplicateCheckResult,
  BatchItemSummary,
} from '../utils/duplicateDetector';
import { resolveProjectLogo } from '../assets/logos';

export interface CoverState {
  status: 'idle' | 'detecting' | 'found' | 'none' | 'custom';
  source: 'embedded' | 'custom' | 'none';
  previewUrl: string | null;
  file: File | null;
  mimeType: string | null;
  fileName?: string;
}

export interface QueueItem {
  id: string;
  file: File;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: string;
  sha256?: string;
  isHashing?: boolean;
  coverState: CoverState;
  
  // Duplicate detection state
  isDuplicate: boolean;
  duplicateMatch?: DuplicateCheckResult['match'];
  duplicateWarning?: string;
  allowDuplicateUpload?: boolean; // user explicitly clicked "Proceed with duplicate"
  
  // Upload lifecycle state
  status: 'idle' | 'uploading' | 'success' | 'error' | 'skipped';
  progress: number;
  errorMessage?: string;
  uploadedSong?: any;

  // UI state
  isExpanded?: boolean;
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

  // Multi-song upload queue (up to 50 files)
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [existingSongs, setExistingSongs] = useState<SongMetadataItem[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);

  // Global upload state
  const [isUploading, setIsUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const cancelUploadRef = useRef(false);

  // Active item targeted for custom cover art selection
  const [activeCoverTargetId, setActiveCoverTargetId] = useState<string | null>(null);

  // Copy SQL banner state
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlMigration, setShowSqlMigration] = useState(false);

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

  // 1. Fetch administrator session whenever selected project changes
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

  // 2. Load existing songs strictly for the selected project to power duplicate detection
  const loadSongsForProject = useCallback(async (projId: string) => {
    setIsLoadingSongs(true);
    try {
      const songs = await fetchProjectSongs(projId);
      setExistingSongs(songs || []);
      return songs || [];
    } catch (err) {
      console.warn(`Could not load songs for project ${projId}:`, err);
      setExistingSongs([]);
      return [];
    } finally {
      setIsLoadingSongs(false);
    }
  }, []);

  useEffect(() => {
    loadSongsForProject(selectedProjectId);
  }, [selectedProjectId, loadSongsForProject]);

  // 3. Whenever destination project changes or existing songs change, re-evaluate duplicates in the queue
  useEffect(() => {
    if (queue.length === 0) return;

    setQueue((prevQueue) => {
      const batchSummaries: BatchItemSummary[] = prevQueue.map((item) => ({
        id: item.id,
        name: item.file.name,
        size: item.file.size,
        sha256: item.sha256,
        title: item.title,
        artist: item.artist,
      }));

      return prevQueue.map((item) => {
        // Do not alter already completed or uploading items
        if (item.status === 'success' || item.status === 'uploading') return item;

        const dupResult = checkForDuplicates(
          item.file,
          item.sha256,
          item.title,
          item.artist,
          existingSongs,
          batchSummaries,
          item.id
        );

        return {
          ...item,
          isDuplicate: dupResult.isDuplicate,
          duplicateMatch: dupResult.match,
          duplicateWarning: dupResult.warningMessage,
        };
      });
    });
  }, [selectedProjectId, existingSongs]);

  // Support Escape key to return
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUploading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isUploading]);

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
      setGlobalError(null);
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

  // Helper to recompute duplicate status for all items in a queue
  const reevaluateQueueDuplicates = (currentQueue: QueueItem[], songs: SongMetadataItem[]): QueueItem[] => {
    const batchSummaries: BatchItemSummary[] = currentQueue.map((item) => ({
      id: item.id,
      name: item.file.name,
      size: item.file.size,
      sha256: item.sha256,
      title: item.title,
      artist: item.artist,
    }));

    return currentQueue.map((item) => {
      if (item.status === 'success' || item.status === 'uploading') return item;

      const dupResult = checkForDuplicates(
        item.file,
        item.sha256,
        item.title,
        item.artist,
        songs,
        batchSummaries,
        item.id
      );

      return {
        ...item,
        isDuplicate: dupResult.isDuplicate,
        duplicateMatch: dupResult.match,
        duplicateWarning: dupResult.warningMessage,
      };
    });
  };

  // Handle multi-file selection (supports up to 50 audio files)
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const rawFiles = Array.from(e.target.files);
    // Reset file input value so same files can be re-selected if removed
    e.target.value = '';

    const remainingSlots = Math.max(0, 50 - queue.length);
    if (remainingSlots <= 0) {
      setGlobalError('Maximum limit of 50 queued files reached. Please upload or clear existing files.');
      return;
    }

    const filesToProcess = rawFiles.slice(0, remainingSlots);
    if (rawFiles.length > remainingSlots) {
      setGlobalError(`Only ${remainingSlots} file(s) added. Maximum limit is 50 audio files per batch.`);
    } else {
      setGlobalError(null);
    }

    // Create preliminary queue items with idle status
    const initialNewItems: QueueItem[] = filesToProcess.map((f) => {
      const id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const cleanName = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      return {
        id,
        file: f,
        title: cleanName,
        artist: 'Unknown Artist',
        album: '',
        genre: '',
        duration: '',
        isHashing: true,
        coverState: {
          status: 'detecting',
          source: 'none',
          previewUrl: null,
          file: null,
          mimeType: null,
        },
        isDuplicate: false,
        status: 'idle',
        progress: 0,
        isExpanded: filesToProcess.length === 1 && queue.length === 0, // Auto-expand if single file
      };
    });

    const combinedQueue = [...queue, ...initialNewItems];
    setQueue(combinedQueue);

    // Asynchronously inspect each file: calculate SHA-256 hash, duration, and embedded artwork
    for (const item of initialNewItems) {
      // 1. Duration calculation via Audio element
      let detectedDuration = '';
      try {
        const audioUrl = URL.createObjectURL(item.file);
        const audio = new Audio(audioUrl);
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => {
            if (audio.duration && !isNaN(audio.duration)) {
              const mins = Math.floor(audio.duration / 60);
              const secs = Math.floor(audio.duration % 60);
              detectedDuration = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            }
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          setTimeout(resolve, 1500); // safety timeout
        });
      } catch {}

      // 2. SHA-256 Hash calculation using Web Crypto API
      const hash = await computeFileSha256(item.file);

      // 3. Embedded artwork & metadata extraction
      let finalTitle = item.title;
      let finalArtist = item.artist;
      let finalAlbum = item.album;
      let finalGenre = item.genre;
      let coverState: CoverState = {
        status: 'none',
        source: 'none',
        previewUrl: null,
        file: null,
        mimeType: null,
      };

      try {
        const metadata = await extractAudioArtworkAndMetadata(item.file);
        if (metadata.hasEmbeddedCover && metadata.coverPreviewUrl && metadata.coverFile) {
          coverState = {
            status: 'found',
            source: 'embedded',
            previewUrl: metadata.coverPreviewUrl,
            file: metadata.coverFile,
            mimeType: metadata.mimeType,
            fileName: metadata.coverFile.name,
          };
        }
        if (metadata.extractedTitle) finalTitle = metadata.extractedTitle;
        if (metadata.extractedArtist) finalArtist = metadata.extractedArtist;
        if (metadata.extractedAlbum) finalAlbum = metadata.extractedAlbum;
        if (metadata.extractedGenre) finalGenre = metadata.extractedGenre;
      } catch (err) {
        console.warn('Metadata extraction note:', err);
      }

      // Update item with hash and metadata, then re-check duplicates
      setQueue((prev) => {
        const updated = prev.map((q) => {
          if (q.id === item.id) {
            return {
              ...q,
              title: finalTitle,
              artist: finalArtist,
              album: finalAlbum,
              genre: finalGenre,
              duration: detectedDuration || q.duration,
              sha256: hash,
              isHashing: false,
              coverState,
            };
          }
          return q;
        });
        return reevaluateQueueDuplicates(updated, existingSongs);
      });
    }
  };

  // Remove single item from queue
  const handleRemoveItem = (id: string) => {
    if (isUploading) return;
    setQueue((prev) => {
      const remaining = prev.filter((item) => item.id !== id);
      return reevaluateQueueDuplicates(remaining, existingSongs);
    });
  };

  // Clear entire queue
  const handleClearQueue = () => {
    if (isUploading) return;
    setQueue([]);
    setGlobalError(null);
    setStatusMessage(null);
    setOverallProgress(0);
  };

  // Skip duplicate upload for an item
  const handleSkipDuplicate = (id: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'skipped' as const } : item))
    );
  };

  // Explicitly allow uploading duplicate
  const handleProceedDuplicate = (id: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              allowDuplicateUpload: true,
              status: item.status === 'skipped' ? 'idle' : item.status,
            }
          : item
      )
    );
  };

  // Toggle expand/collapse of item details
  const handleToggleExpand = (id: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isExpanded: !item.isExpanded } : item))
    );
  };

  // Update item field (title, artist, album, genre, duration)
  const handleUpdateItemField = (id: string, field: keyof QueueItem, value: any) => {
    setQueue((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, [field]: value } : item));
      if (field === 'title' || field === 'artist') {
        return reevaluateQueueDuplicates(updated, existingSongs);
      }
      return updated;
    });
  };

  // Custom cover attachment
  const handleTriggerCustomCover = (id: string) => {
    setActiveCoverTargetId(id);
    coverInputRef.current?.click();
  };

  const handleCustomCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeCoverTargetId || !e.target.files || !e.target.files[0]) return;
    const selectedImg = e.target.files[0];
    e.target.value = '';

    if (!selectedImg.type.startsWith('image/')) {
      setGlobalError('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    const preview = URL.createObjectURL(selectedImg);
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === activeCoverTargetId) {
          return {
            ...item,
            coverState: {
              status: 'custom',
              source: 'custom',
              previewUrl: preview,
              file: selectedImg,
              mimeType: selectedImg.type,
              fileName: selectedImg.name,
            },
          };
        }
        return item;
      })
    );
    setActiveCoverTargetId(null);
  };

  const handleRemoveCover = (id: string) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            coverState: {
              status: 'none',
              source: 'none',
              previewUrl: null,
              file: null,
              mimeType: null,
            },
          };
        }
        return item;
      })
    );
  };

  // Execute Batch Upload (Sequential & safe to prevent timeouts, rate limits, and memory bloat)
  const handleUploadAll = async () => {
    if (isUploading) return;
    if (queue.length === 0) {
      setGlobalError('Please select at least one audio file to upload.');
      return;
    }

    // Filter candidate items: non-successful and not skipped
    const eligibleItems = queue.filter(
      (item) => item.status !== 'success' && item.status !== 'skipped'
    );

    if (eligibleItems.length === 0) {
      setGlobalError('All queued tracks have already been processed.');
      return;
    }

    // Check if unapproved duplicates exist
    const unapprovedDuplicates = eligibleItems.filter(
      (item) => item.isDuplicate && !item.allowDuplicateUpload
    );

    if (unapprovedDuplicates.length > 0 && eligibleItems.length === unapprovedDuplicates.length) {
      setGlobalError(
        'All remaining items are flagged as duplicates. Please review them and click "Upload Anyway" or remove them to proceed.'
      );
      return;
    }

    setIsUploading(true);
    setGlobalError(null);
    cancelUploadRef.current = false;
    let completedCount = 0;
    let successCount = 0;

    const itemsToUpload = eligibleItems.filter(
      (item) => !item.isDuplicate || item.allowDuplicateUpload
    );

    setStatusMessage(`Preparing batch upload of ${itemsToUpload.length} track(s)...`);

    for (let i = 0; i < itemsToUpload.length; i++) {
      if (cancelUploadRef.current) {
        setStatusMessage('Upload cancelled by user.');
        break;
      }

      const current = itemsToUpload[i];

      // Mark current item uploading
      setQueue((prev) =>
        prev.map((item) =>
          item.id === current.id ? { ...item, status: 'uploading' as const, progress: 20 } : item
        )
      );

      setStatusMessage(`Uploading track ${i + 1} of ${itemsToUpload.length}: '${current.title}'...`);

      try {
        // Step progress simulation for responsive feedback
        setQueue((prev) =>
          prev.map((item) => (item.id === current.id ? { ...item, progress: 50 } : item))
        );

        const res = await uploadAudioFile(selectedProjectId, current.file, {
          title: current.title.trim() || current.file.name,
          artist: current.artist.trim() || 'Unknown Artist',
          album: current.album.trim(),
          genre: current.genre.trim(),
          duration: current.duration.trim(),
          coverFile: current.coverState.file,
          file_hash: current.sha256,
          allowDuplicate: current.allowDuplicateUpload,
        });

        successCount++;
        setQueue((prev) =>
          prev.map((item) =>
            item.id === current.id
              ? {
                  ...item,
                  status: 'success' as const,
                  progress: 100,
                  uploadedSong: res.song,
                  errorMessage: undefined,
                }
              : item
          )
        );
      } catch (err: any) {
        console.error(`Upload error for '${current.title}':`, err);
        setQueue((prev) =>
          prev.map((item) =>
            item.id === current.id
              ? {
                  ...item,
                  status: 'error' as const,
                  progress: 0,
                  errorMessage: err.message || 'Upload failed',
                }
              : item
          )
        );
      }

      completedCount++;
      const currentOverall = Math.round((completedCount / itemsToUpload.length) * 100);
      setOverallProgress(currentOverall);
    }

    setIsUploading(false);

    if (successCount > 0) {
      setStatusMessage(
        `Batch finished: successfully uploaded ${successCount} track(s) to '${selectedProject?.name}'.`
      );
      // Reload songs in project cache to keep duplicate detector fresh
      loadSongsForProject(selectedProjectId);
      onUploadSuccess();
    }
  };

  // Retry single failed item
  const handleRetryItem = async (id: string) => {
    if (isUploading) return;
    const target = queue.find((q) => q.id === id);
    if (!target) return;

    setIsUploading(true);
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: 'uploading' as const, progress: 25 } : q))
    );
    setStatusMessage(`Retrying upload for '${target.title}'...`);

    try {
      const res = await uploadAudioFile(selectedProjectId, target.file, {
        title: target.title.trim() || target.file.name,
        artist: target.artist.trim() || 'Unknown Artist',
        album: target.album.trim(),
        genre: target.genre.trim(),
        duration: target.duration.trim(),
        coverFile: target.coverState.file,
        file_hash: target.sha256,
        allowDuplicate: target.allowDuplicateUpload,
      });

      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
                status: 'success' as const,
                progress: 100,
                uploadedSong: res.song,
                errorMessage: undefined,
              }
            : q
        )
      );
      setStatusMessage(`Track '${target.title}' uploaded successfully!`);
      loadSongsForProject(selectedProjectId);
      onUploadSuccess();
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? { ...q, status: 'error' as const, progress: 0, errorMessage: err.message || 'Retry failed' }
            : q
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelPending = () => {
    cancelUploadRef.current = true;
    setStatusMessage('Stopping uploads after current track...');
  };

  const handleCopySql = () => {
    const sql = `ALTER TABLE songs ADD COLUMN IF NOT EXISTS file_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_songs_file_hash ON songs(file_hash);`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Queue metrics
  const totalQueued = queue.length;
  const duplicateCount = queue.filter((q) => q.isDuplicate && !q.allowDuplicateUpload).length;
  const successCount = queue.filter((q) => q.status === 'success').length;
  const failedCount = queue.filter((q) => q.status === 'error').length;
  const skippedCount = queue.filter((q) => q.status === 'skipped').length;
  const idleCount = queue.filter(
    (q) => q.status === 'idle' && (!q.isDuplicate || q.allowDuplicateUpload)
  ).length;

  // Eligible tracks for upload: not already success, not skipped, and approved if duplicate
  const eligibleItems = queue.filter(
    (q) => q.status !== 'success' && q.status !== 'skipped' && (!q.isDuplicate || q.allowDuplicateUpload)
  );
  const eligibleCount = eligibleItems.length;
  const readyCount = eligibleItems.filter((q) => q.status === 'idle').length;

  // Explicit status explanation when eligibleCount is zero
  let zeroEligibleExplanation: string | null = null;
  if (totalQueued > 0 && eligibleCount === 0) {
    if (successCount === totalQueued) {
      zeroEligibleExplanation = `All ${successCount} track(s) have been successfully uploaded.`;
    } else if (duplicateCount > 0 && duplicateCount === totalQueued - successCount - skippedCount) {
      zeroEligibleExplanation = `${duplicateCount} track(s) flagged as duplicates. Tap "Upload Anyway" or remove them to proceed.`;
    } else if (skippedCount > 0 && skippedCount === totalQueued - successCount) {
      zeroEligibleExplanation = `All remaining tracks in queue are skipped.`;
    } else {
      zeroEligibleExplanation = `No eligible tracks remaining in queue.`;
    }
  }

  const totalSizeBytes = queue.reduce((acc, q) => acc + q.file.size, 0);
  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm sm:p-3 md:p-6 overflow-y-auto safe-top safe-bottom p-0"
    >
      <div className="relative w-full max-w-2xl h-full sm:h-auto sm:max-h-[92dvh] flex flex-col min-h-0 rounded-none sm:rounded-2xl border-0 sm:border border-neutral-800 bg-neutral-950 shadow-2xl text-neutral-100 overflow-hidden">
        
        {/* Sticky Header Bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-neutral-800/80 px-3 sm:px-6 py-3 bg-neutral-900/90 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {hasPreviousProject ? (
              <button
                type="button"
                onClick={handleReturnBack}
                disabled={isUploading}
                className="flex items-center gap-1.5 text-neutral-300 hover:text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-neutral-800 transition-colors -ml-1 min-h-[44px] focus:outline-none focus:ring-1 focus:ring-neutral-700 cursor-pointer disabled:opacity-50"
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
                disabled={isUploading}
                className="flex items-center gap-1.5 text-neutral-300 hover:text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-neutral-800 transition-colors -ml-1 min-h-[44px] focus:outline-none focus:ring-1 focus:ring-neutral-700 cursor-pointer disabled:opacity-50"
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
                    disabled={isUploading}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Dashboard
                  </button>
                  <span className="text-neutral-600">/</span>
                </>
              )}
              <h3 className="text-sm font-semibold text-white">Batch Audio Upload</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !isUploading && onClose()}
            disabled={isUploading}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 touch-scroll pb-6">
          
          {/* Destination Project Selector */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-neutral-300">
                Destination Supabase Project
              </label>
              {isLoadingSongs && (
                <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                  <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                  <span>Loading catalog...</span>
                </span>
              )}
            </div>
            <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {projects.map((proj) => (
                <button
                  type="button"
                  key={proj.id}
                  disabled={isUploading}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className={`rounded-lg border p-2.5 text-left transition-colors min-h-[44px] cursor-pointer ${
                    selectedProjectId === proj.id
                      ? 'border-neutral-300 bg-neutral-800 text-white shadow-sm'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <p className="text-xs font-semibold truncate">{proj.name}</p>
                  <p className="text-[10px] text-neutral-400 truncate font-mono">
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
                  disabled={isUploading}
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

          {/* Audio Multi-File Picker Dropzone */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-neutral-300">
                Select Audio Files (up to 50 tracks)
              </label>
              <span className="text-[11px] text-neutral-400 font-mono">
                {queue.length}/50 selected
              </span>
            </div>

            <div
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`mt-1.5 flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 p-5 text-center transition-colors ${
                isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-neutral-500 hover:bg-neutral-900 cursor-pointer'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.m4b"
                onChange={handleFilesSelected}
                className="hidden"
                disabled={isUploading}
              />
              <FileAudio className="h-7 w-7 sm:h-8 sm:w-8 text-neutral-400" />
              <div className="mt-2 text-center">
                <p className="text-xs font-medium text-neutral-200">
                  Tap to browse or drop up to 50 audio tracks
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Multi-select supported on Android, mobile browsers, and desktop (.mp3, .wav, .m4a, .flac)
                </p>
              </div>
            </div>
          </div>

          {/* Hidden native input for custom cover image attachment */}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*,image/jpeg,image/png,image/webp,image/jpg"
            onChange={handleCustomCoverChange}
            className="hidden"
          />

          {/* Queue Summary & Overall Batch Progress Bar */}
          {queue.length > 0 && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Music className="h-3.5 w-3.5 text-neutral-400" />
                    <span>Upload Queue: {totalQueued} song(s) ({totalSizeMB} MB)</span>
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-neutral-400">
                    <span className="text-emerald-400 font-medium">{readyCount} Ready</span>
                    <span>·</span>
                    {duplicateCount > 0 && (
                      <>
                        <span className="text-amber-400 font-medium">
                          {duplicateCount} Duplicate Flagged
                        </span>
                        <span>·</span>
                      </>
                    )}
                    {successCount > 0 && (
                      <>
                        <span className="text-emerald-300 font-medium">{successCount} Uploaded</span>
                        <span>·</span>
                      </>
                    )}
                    {failedCount > 0 && (
                      <span className="text-rose-400 font-medium">{failedCount} Failed</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || queue.length >= 50}
                    className="flex items-center gap-1 text-[11px] font-medium text-neutral-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-neutral-400" />
                    <span>Add More</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearQueue}
                    disabled={isUploading}
                    className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-rose-950/40 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear Queue</span>
                  </button>
                </div>
              </div>

              {/* Overall Batch Progress */}
              {isUploading && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span className="flex items-center gap-1.5 truncate">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-200" />
                      <span className="truncate">{statusMessage}</span>
                    </span>
                    <span className="font-mono text-neutral-200">{overallProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full bg-white transition-all duration-300 rounded-full"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Queue Items List */}
          {queue.length > 0 && (
            <div className="space-y-2.5">
              <label className="block text-xs font-medium text-neutral-400">
                Queued Tracks ({queue.length})
              </label>

              <div className="space-y-2">
                {queue.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border transition-colors overflow-hidden ${
                      item.isDuplicate && !item.allowDuplicateUpload
                        ? 'border-amber-700/80 bg-amber-950/20'
                        : item.status === 'success'
                        ? 'border-emerald-800/80 bg-emerald-950/15'
                        : item.status === 'error'
                        ? 'border-rose-800/80 bg-rose-950/20'
                        : 'border-neutral-800 bg-neutral-900/70 hover:border-neutral-700'
                    }`}
                  >
                    {/* Item Main Summary Row */}
                    <div className="p-3 sm:p-3.5 flex items-start gap-3">
                      {/* Cover Thumbnail / Source Indicator */}
                      <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 shadow-inner">
                        {item.coverState.previewUrl ? (
                          <img
                            src={item.coverState.previewUrl}
                            alt="Cover thumbnail"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center bg-neutral-900">
                            <ImageIcon className="h-6 w-6 text-neutral-500" />
                            <span className="text-[8px] font-semibold text-neutral-400 mt-0.5">
                              Default
                            </span>
                          </div>
                        )}
                        {item.coverState.source === 'embedded' && (
                          <div className="absolute top-0 right-0 bg-emerald-600 px-1 py-0.2 text-[8px] font-bold text-white rounded-bl">
                            ID3
                          </div>
                        )}
                        {item.coverState.source === 'custom' && (
                          <div className="absolute top-0 right-0 bg-sky-600 px-1 py-0.2 text-[8px] font-bold text-white rounded-bl">
                            Custom
                          </div>
                        )}
                      </div>

                      {/* Title, Artist, Size, Hash */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs sm:text-sm font-semibold text-white truncate">
                            {item.title}
                          </p>
                          <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                            {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>

                        <p className="text-xs text-neutral-400 truncate">
                          {item.artist} {item.album ? `· ${item.album}` : ''}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-400 pt-0.5">
                          {item.duration && (
                            <span className="font-mono text-neutral-300">⏱️ {item.duration}</span>
                          )}
                          {item.sha256 ? (
                            <span
                              className="font-mono text-neutral-400 bg-neutral-800/80 px-1.5 py-0.5 rounded"
                              title={`Full SHA-256: ${item.sha256}`}
                            >
                              SHA-256: {item.sha256.slice(0, 10)}...
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-neutral-500 italic">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              Hashing...
                            </span>
                          )}

                          {/* Status Badge */}
                          {item.status === 'uploading' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              Uploading ({item.progress}%)
                            </span>
                          )}
                          {item.status === 'success' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                              Uploaded
                            </span>
                          )}
                          {item.status === 'skipped' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400">
                              <Ban className="h-2.5 w-2.5" />
                              Skipped
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Error
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Item Quick Actions */}
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(item.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                          title={item.isExpanded ? 'Collapse track metadata' : 'Edit track metadata & cover'}
                        >
                          {item.isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        {item.status === 'error' && (
                          <button
                            type="button"
                            onClick={() => handleRetryItem(item.id)}
                            disabled={isUploading}
                            className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-950/50 transition-colors cursor-pointer"
                            title="Retry upload"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isUploading}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-30"
                          title="Remove from queue"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Duplicate Detected Warning Banner (Requirement 1 & 3) */}
                    {item.isDuplicate && (
                      <div className="border-t border-amber-800/70 bg-amber-950/40 p-3 space-y-2.5 text-xs text-amber-200">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-bold text-amber-300">
                              Duplicate detected — this song may have already been uploaded.
                            </p>
                            {item.duplicateMatch && (
                              <div className="rounded bg-black/40 p-2 text-[11px] space-y-0.5 border border-amber-900/60 font-mono">
                                <p className="text-amber-100">
                                  Matching Track:{' '}
                                  <span className="font-semibold text-white">
                                    {item.duplicateMatch.title}
                                  </span>
                                </p>
                                <p className="text-amber-300">
                                  Matching Artist:{' '}
                                  <span className="text-white">{item.duplicateMatch.artist}</span>
                                </p>
                                <p className="text-amber-400">
                                  Matching File:{' '}
                                  <span className="text-white">{item.duplicateMatch.fileName}</span>
                                </p>
                                <p className="text-[10px] text-amber-300/80 italic pt-0.5">
                                  Detection Reason: {item.duplicateMatch.similarityNote}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Duplicate Decision Controls */}
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-amber-900/40">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={isUploading}
                            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSkipDuplicate(item.id)}
                            disabled={isUploading || item.status === 'skipped'}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                              item.status === 'skipped'
                                ? 'bg-amber-900/80 text-amber-200'
                                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                            }`}
                          >
                            {item.status === 'skipped' ? 'Skipped' : 'Skip'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleProceedDuplicate(item.id)}
                            disabled={isUploading}
                            className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                              item.allowDuplicateUpload
                                ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                : 'bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold'
                            }`}
                          >
                            {item.allowDuplicateUpload ? '✓ Approved to Upload' : 'Upload Anyway'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Upload Error Banner */}
                    {item.status === 'error' && item.errorMessage && (
                      <div className="border-t border-rose-800/80 bg-rose-950/40 p-2.5 text-xs text-rose-300 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold">Upload failed</p>
                          <p className="text-[11px] leading-relaxed text-rose-200">
                            {item.errorMessage}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Expandable Metadata & Cover Art Form */}
                    {item.isExpanded && (
                      <div className="border-t border-neutral-800 bg-neutral-950/60 p-3.5 space-y-3">
                        {/* Artwork Management for this track */}
                        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-neutral-200">
                              Album Cover Art
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleTriggerCustomCover(item.id)}
                                className="flex items-center gap-1 text-[11px] font-medium text-neutral-200 hover:text-white px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
                              >
                                <ImagePlus className="h-3 w-3 text-neutral-400" />
                                <span>{item.coverState.previewUrl ? 'Change Cover' : 'Add Cover'}</span>
                              </button>
                              {item.coverState.previewUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCover(item.id)}
                                  className="text-[11px] font-medium text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/50 transition-colors cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950">
                              {item.coverState.previewUrl ? (
                                <img
                                  src={item.coverState.previewUrl}
                                  alt="Cover preview"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-neutral-900">
                                  <ImageOff className="h-6 w-6 text-neutral-500" />
                                </div>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 flex-1 leading-snug">
                              {item.coverState.source === 'embedded' ? (
                                <p className="text-emerald-300">
                                  ✓ Embedded artwork detected in ID3 metadata. Will upload with audio track.
                                </p>
                              ) : item.coverState.source === 'custom' ? (
                                <p className="text-sky-300">
                                  ✓ Custom cover image attached ({item.coverState.fileName}).
                                </p>
                              ) : (
                                <p className="text-neutral-400">
                                  No embedded cover detected. Will use project fallback image or custom upload.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Metadata inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-medium text-neutral-400">
                              Title *
                            </label>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) =>
                                handleUpdateItemField(item.id, 'title', e.target.value)
                              }
                              placeholder="Track Title"
                              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-neutral-400">
                              Artist
                            </label>
                            <input
                              type="text"
                              value={item.artist}
                              onChange={(e) =>
                                handleUpdateItemField(item.id, 'artist', e.target.value)
                              }
                              placeholder="Artist name"
                              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-medium text-neutral-400">
                              Album
                            </label>
                            <input
                              type="text"
                              value={item.album}
                              onChange={(e) =>
                                handleUpdateItemField(item.id, 'album', e.target.value)
                              }
                              placeholder="Album name"
                              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-neutral-400">
                              Genre
                            </label>
                            <input
                              type="text"
                              value={item.genre}
                              onChange={(e) =>
                                handleUpdateItemField(item.id, 'genre', e.target.value)
                              }
                              placeholder="Genre"
                              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-neutral-400">
                              Duration
                            </label>
                            <input
                              type="text"
                              value={item.duration}
                              onChange={(e) =>
                                handleUpdateItemField(item.id, 'duration', e.target.value)
                              }
                              placeholder="e.g. 3:45"
                              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Database Schema Hash Migration Note (Requirement 3: Clean SQL for NASHEED) */}
          <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-3 space-y-2">
            <button
              type="button"
              onClick={() => setShowSqlMigration(!showSqlMigration)}
              className="w-full flex items-center justify-between text-left text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Optional Database Migration: Persistent SHA-256 Hash Column</span>
              </span>
              {showSqlMigration ? (
                <ChevronUp className="h-3.5 w-3.5 text-neutral-500" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
              )}
            </button>

            {showSqlMigration && (
              <div className="pt-2 text-[11px] text-neutral-400 space-y-2 border-t border-neutral-800/60">
                <p>
                  JTEC MUSIC already includes the <code className="text-neutral-300">file_hash</code> column. To allow permanent storage of SHA-256 file hashes in NASHEED or LOVE & CHILL, you may run this idempotent SQL query in your Supabase SQL Editor:
                </p>
                <div className="relative rounded-lg bg-neutral-950 p-2.5 font-mono text-[10px] text-neutral-300 border border-neutral-800">
                  <pre className="overflow-x-auto whitespace-pre-wrap">
                    {`ALTER TABLE songs ADD COLUMN IF NOT EXISTS file_hash TEXT;\nCREATE INDEX IF NOT EXISTS idx_songs_file_hash ON songs(file_hash);`}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-sans transition-colors cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-neutral-500">
                  * Note: If you do not run this SQL, duplicate detection continues to work smoothly using real-time SHA-256 computation, intra-batch checks, and metadata verification without any database errors.
                </p>
              </div>
            )}
          </div>

          {/* Global Status & Error Messages */}
          {statusMessage && !isUploading && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="font-semibold">{statusMessage}</p>
              </div>
            </div>
          )}

          {globalError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-900/40 bg-rose-950/30 p-3 text-xs text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Upload Notice</p>
                <p className="text-[11px] leading-relaxed">{globalError}</p>
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
              disabled={isUploading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors min-h-[44px] cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4 text-neutral-400" />
              <span>Back to Dashboard</span>
            </button>
            {hasPreviousProject && (
              <button
                type="button"
                onClick={handleReturnBack}
                disabled={isUploading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors min-h-[44px] cursor-pointer disabled:opacity-50"
              >
                <span>Back to {selectedProject?.name || 'Project'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isUploading ? (
              <button
                type="button"
                onClick={handleCancelPending}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-800/80 bg-amber-950/40 px-3.5 py-2.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/50 transition-colors min-h-[44px] cursor-pointer"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Cancel Pending</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClearQueue}
                disabled={queue.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-40 min-h-[44px] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}

            {zeroEligibleExplanation && !isUploading && (
              <span className="text-[11px] text-amber-300 font-medium px-2 py-1 bg-amber-950/40 border border-amber-900/60 rounded-lg max-w-[240px] sm:max-w-xs truncate text-center" title={zeroEligibleExplanation}>
                {zeroEligibleExplanation}
              </span>
            )}

            <button
              type="button"
              onClick={handleUploadAll}
              disabled={isUploading || queue.length === 0 || eligibleCount === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors disabled:opacity-40 min-h-[44px] cursor-pointer shadow-sm active:scale-95"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Uploading ({overallProgress}%)...</span>
                </>
              ) : failedCount > 0 && readyCount === 0 ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry Failed ({failedCount})</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload All ({eligibleCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
