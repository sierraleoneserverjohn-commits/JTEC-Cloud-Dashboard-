import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Music,
  Play,
  Pause,
  Edit2,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
  Search,
  ExternalLink,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  FileAudio,
  HardDrive,
  Clock,
  Disc,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import type { SongMetadataItem } from '../types/dashboard';
import {
  updateSongMetadata,
  updateSongCover,
  replaceSongAudio,
  deleteCloudSong,
} from '../services/dashboardService';
import { computeFileSha256 } from '../utils/duplicateDetector';
import { resolveProjectLogo } from '../assets/logos';

interface CloudMusicManagerProps {
  projectId: string;
  projectName: string;
  storageBucket: string;
  tableName: string;
  projectLogo: string;
  songs: SongMetadataItem[];
  isAdminMode: boolean;
  onRefresh: () => Promise<void> | void;
  onOpenUpload: () => void;
  onSongDeleted?: (song: SongMetadataItem) => void;
}

function formatDuration(duration?: string | number): string {
  if (!duration) return '—';
  const totalSecs = typeof duration === 'number' ? Math.round(duration) : parseInt(duration, 10);
  if (isNaN(totalSecs) || totalSecs <= 0) return '—';
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '—';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const CloudMusicManager: React.FC<CloudMusicManagerProps> = ({
  projectId,
  projectName,
  storageBucket,
  tableName,
  projectLogo,
  songs,
  isAdminMode,
  onRefresh,
  onOpenUpload,
  onSongDeleted,
}) => {
  // Local active songs state for immediate optimistic updates and persistent deletion memory
  const deletedSongKeysRef = useRef<Set<string>>(new Set());
  const [localSongs, setLocalSongs] = useState<SongMetadataItem[]>(() => {
    return songs.filter(
      (s) => !deletedSongKeysRef.current.has(String(s.id)) && !deletedSongKeysRef.current.has(s.file_name)
    );
  });

  // Keep localSongs in sync with props while ensuring deleted songs never reappear from stale caches
  useEffect(() => {
    setLocalSongs(
      songs.filter(
        (s) => !deletedSongKeysRef.current.has(String(s.id)) && !deletedSongKeysRef.current.has(s.file_name)
      )
    );
  }, [songs]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  // Playback preview state
  const [playingSongId, setPlayingSongId] = useState<string | number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sub-modals
  const [editingSong, setEditingSong] = useState<SongMetadataItem | null>(null);
  const [coverSong, setCoverSong] = useState<SongMetadataItem | null>(null);
  const [replaceAudioSong, setReplaceAudioSong] = useState<SongMetadataItem | null>(null);
  const [deletingSong, setDeletingSong] = useState<SongMetadataItem | null>(null);

  // Form states for Edit Metadata
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Form states for Cover Artwork
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isSavingCover, setIsSavingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Form states for Replace Audio
  const [replacementAudioFile, setReplacementAudioFile] = useState<File | null>(null);
  const [replacementDuration, setReplacementDuration] = useState<number | null>(null);
  const [replacementHash, setReplacementHash] = useState<string | null>(null);
  const [isReplacingAudio, setIsReplacingAudio] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);

  // Status banners / toast
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fallbackLogo = resolveProjectLogo(projectId, projectLogo);

  // Collect unique genres
  const uniqueGenres = useMemo(() => {
    const set = new Set<string>();
    localSongs.forEach((s) => {
      if (s.genre && s.genre.trim()) set.add(s.genre.trim());
    });
    return Array.from(set).sort();
  }, [localSongs]);

  // Filter songs
  const filteredSongs = useMemo(() => {
    return localSongs.filter((song) => {
      const matchSearch =
        searchQuery === '' ||
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (song.artist && song.artist.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (song.album && song.album.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (song.file_name && song.file_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchGenre = selectedGenre === 'all' || song.genre === selectedGenre;
      return matchSearch && matchGenre;
    });
  }, [localSongs, searchQuery, selectedGenre]);

  // Cleanup audio preview on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePlay = (song: SongMetadataItem) => {
    const audioUrl = song.public_url;
    if (!audioUrl) {
      setFeedback({ type: 'error', message: 'No valid streaming URL available for this track.' });
      return;
    }

    if (playingSongId === song.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Append cache-busting timestamp to bypass stale browser cache on replaced files
    const streamUrl = audioUrl.includes('?') ? `${audioUrl}&_t=${Date.now()}` : `${audioUrl}?_t=${Date.now()}`;
    const audio = new Audio(streamUrl);
    audioRef.current = audio;
    setPlayingSongId(song.id);
    setIsPlaying(true);

    audio.play().catch((err) => {
      console.warn('Playback error:', err);
      setIsPlaying(false);
      setPlayingSongId(null);
      setFeedback({
        type: 'error',
        message: 'Could not play audio preview. Verify bucket public access policy in Supabase SQL editor.',
      });
    });

    audio.onended = () => {
      setIsPlaying(false);
      setPlayingSongId(null);
    };

    audio.onerror = () => {
      setIsPlaying(false);
      setPlayingSongId(null);
    };
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      setFeedback({ type: 'success', message: 'Cloud library refreshed from Supabase.' });
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Failed to refresh cloud songs.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Open Edit Metadata modal
  const openEditModal = (song: SongMetadataItem) => {
    setEditingSong(song);
    setEditTitle(song.title);
    setEditArtist(song.artist || '');
    setEditAlbum(song.album || '');
    setEditGenre(song.genre || '');
    setEditDuration(song.duration ? String(song.duration) : '');
  };

  const handleSaveMetadata = async () => {
    if (!editingSong) return;
    if (!editTitle.trim()) {
      setFeedback({ type: 'error', message: 'Song title is required.' });
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await updateSongMetadata(projectId, editingSong.id, {
        title: editTitle.trim(),
        artist: editArtist.trim() || 'Unknown Artist',
        album: editAlbum.trim() || 'Single',
        genre: editGenre.trim() || 'Music',
        duration: editDuration.trim() ? parseInt(editDuration.trim(), 10) : undefined,
      });

      // Update local state immediately
      setLocalSongs((prev) =>
        prev.map((s) =>
          s.id === editingSong.id
            ? {
                ...s,
                title: editTitle.trim(),
                artist: editArtist.trim() || 'Unknown Artist',
                album: editAlbum.trim() || 'Single',
                genre: editGenre.trim() || 'Music',
                duration: editDuration.trim() ? parseInt(editDuration.trim(), 10) : s.duration,
              }
            : s
        )
      );

      setEditingSong(null);
      setFeedback({ type: 'success', message: `Saved changes for '${editTitle.trim()}'.` });
      await onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update song metadata in Supabase.' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Cover Artwork modal
  const openCoverModal = (song: SongMetadataItem) => {
    setCoverSong(song);
    setCoverFile(null);
    setCoverPreviewUrl(song.cover_url || null);
  };

  const handleCoverFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Please select a valid image file (JPEG, PNG, WebP).' });
      return;
    }

    setCoverFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverPreviewUrl(objectUrl);
  };

  const handleSaveCover = async () => {
    if (!coverSong || !coverFile) return;

    setIsSavingCover(true);
    try {
      const res = await updateSongCover(projectId, coverSong.id, coverFile, coverSong.cover_url);

      // Update local state immediately
      if (res.cover_url) {
        setLocalSongs((prev) =>
          prev.map((s) => (s.id === coverSong.id ? { ...s, cover_url: res.cover_url } : s))
        );
      }

      setCoverSong(null);
      setCoverFile(null);
      setCoverPreviewUrl(null);
      setFeedback({ type: 'success', message: `Updated cover artwork for '${coverSong.title}'.` });
      await onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update cover in Supabase.' });
    } finally {
      setIsSavingCover(false);
    }
  };

  // Open Replace Audio modal
  const openReplaceAudioModal = (song: SongMetadataItem) => {
    setReplaceAudioSong(song);
    setReplacementAudioFile(null);
    setReplacementDuration(null);
    setReplacementHash(null);
  };

  const handleAudioFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReplacementAudioFile(file);

    try {
      const hash = await computeFileSha256(file);
      setReplacementHash(hash);
    } catch {}

    try {
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(file);
      audio.src = objectUrl;
      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration)) {
          setReplacementDuration(Math.round(audio.duration));
        }
        URL.revokeObjectURL(objectUrl);
      };
    } catch {}
  };

  const handleSaveReplaceAudio = async () => {
    if (!replaceAudioSong || !replacementAudioFile) return;

    setIsReplacingAudio(true);
    try {
      const res = await replaceSongAudio(projectId, replaceAudioSong.id, replacementAudioFile, {
        duration: replacementDuration || undefined,
        file_hash: replacementHash || undefined,
      });

      // Update local state immediately
      setLocalSongs((prev) =>
        prev.map((s) =>
          s.id === replaceAudioSong.id
            ? {
                ...s,
                file_name: replacementAudioFile.name,
                file_size: replacementAudioFile.size,
                duration: replacementDuration || s.duration,
                file_hash: replacementHash || s.file_hash,
                public_url: res.song?.public_url || s.public_url,
              }
            : s
        )
      );

      setReplaceAudioSong(null);
      setReplacementAudioFile(null);
      setFeedback({
        type: 'success',
        message: `Successfully replaced audio file for '${replaceAudioSong.title}'. Storage and database updated.`,
      });
      await onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to replace audio file in Supabase.' });
    } finally {
      setIsReplacingAudio(false);
    }
  };

  // Open Delete confirmation dialog
  const openDeleteModal = (song: SongMetadataItem) => {
    setDeletingSong(song);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSong || isDeleting) return;

    setIsDeleting(true);
    const targetSong = deletingSong;
    const targetKey = String(targetSong.id);
    const targetFileName = targetSong.file_name;

    try {
      // 1. Perform actual database and storage deletion
      await deleteCloudSong(projectId, targetSong);

      // 2. Prevent future resurrection from stale caches
      deletedSongKeysRef.current.add(targetKey);
      if (targetFileName) {
        deletedSongKeysRef.current.add(targetFileName);
      }

      // 3. Pause playback if deleting currently playing song
      if (playingSongId === targetSong.id && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        setPlayingSongId(null);
      }

      // 4. Immediately remove from local list without waiting for server response
      setLocalSongs((prev) =>
        prev.filter((s) => String(s.id) !== targetKey && s.file_name !== targetFileName)
      );

      // 5. Notify parent modal to immediately decrement song counts and storage metrics
      if (onSongDeleted) {
        onSongDeleted(targetSong);
      }

      // 6. Close modal and show clear success feedback
      setDeletingSong(null);
      setFeedback({
        type: 'success',
        message: `Permanently deleted '${targetSong.title}' from Supabase table and storage bucket.`,
      });

      // 7. Background sync with Supabase
      try {
        await onRefresh();
      } catch {}
    } catch (err: any) {
      // Deletion failed: do not report success, preserve song in list
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to delete song from Supabase. No changes were made.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          className={`flex items-start justify-between gap-2.5 rounded-xl border p-3 text-xs transition-all ${
            feedback.type === 'success'
              ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-200'
              : 'border-rose-800/80 bg-rose-950/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-neutral-400 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Controls Toolbar: Search, Filter, Refresh, Upload Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-3 sm:p-4">
        {/* Search & Genre Filter */}
        <div className="flex flex-1 flex-col xs:flex-row items-stretch xs:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, artist, album, filename..."
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 pl-8 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none min-h-[38px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {uniqueGenres.length > 0 && (
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-300 focus:border-neutral-600 focus:outline-none min-h-[38px]"
            >
              <option value="all">All Genres ({uniqueGenres.length})</option>
              {uniqueGenres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50 min-h-[38px] cursor-pointer"
            title="Refresh cloud library from Supabase"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
            <span>Refresh</span>
          </button>

          {isAdminMode && (
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 px-3.5 py-2 text-xs font-semibold transition-colors min-h-[38px] cursor-pointer shadow-sm"
              title="Upload new tracks to this project"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload New Music</span>
            </button>
          )}
        </div>
      </div>

      {/* Library Summary Strip */}
      <div className="flex items-center justify-between px-1 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">
            {filteredSongs.length} {filteredSongs.length === 1 ? 'cloud track' : 'cloud tracks'}
          </span>
          {searchQuery && (
            <span className="text-neutral-500 text-[11px]">
              (filtered from {localSongs.length} total)
            </span>
          )}
        </div>
        <span className="text-[11px] text-neutral-500 font-mono">
          Bucket: <span className="text-neutral-300">{storageBucket}</span> · Table:{' '}
          <span className="text-neutral-300">{tableName}</span>
        </span>
      </div>

      {/* Empty State */}
      {filteredSongs.length === 0 ? (
        <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-10 text-center">
          <Disc className="mx-auto h-10 w-10 text-neutral-600 animate-pulse" />
          <h4 className="mt-3 text-sm font-semibold text-white">
            {searchQuery ? 'No matching songs found' : 'No cloud songs uploaded yet'}
          </h4>
          <p className="mt-1 text-xs text-neutral-400 max-w-sm mx-auto">
            {searchQuery
              ? `No tracks matched '${searchQuery}'. Try clearing your search term.`
              : `The Supabase '${tableName}' catalog is currently empty for ${projectName}. Upload audio files using the upload tool to manage details, cover artwork, and audio streams.`}
          </p>
          {isAdminMode && !searchQuery && (
            <button
              onClick={onOpenUpload}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-900 hover:bg-white transition-colors cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Audio Files</span>
            </button>
          )}
        </div>
      ) : (
        /* Song Cards List: Clean, well-spaced, naturally scrollable cards */
        <div className="space-y-3">
          {filteredSongs.map((song) => {
            const isCurrentlyPlaying = playingSongId === song.id && isPlaying;
            const coverImage = song.cover_url || fallbackLogo;

            return (
              <div
                key={song.id}
                className="relative rounded-xl border border-neutral-800/90 bg-neutral-900/70 hover:bg-neutral-900/95 p-3.5 sm:p-4 transition-all duration-200 shadow-md"
              >
                {/* Main Card Content */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                  {/* Left: Artwork + Track Information */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Artwork Container with Play/Pause Button */}
                    <div className="relative h-16 w-16 sm:h-18 sm:w-18 shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-inner group/art">
                      <img
                        src={coverImage}
                        alt={song.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = fallbackLogo;
                        }}
                      />
                      {/* Play / Pause Overlay Button */}
                      <button
                        type="button"
                        onClick={() => handleTogglePlay(song)}
                        className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity cursor-pointer ${
                          isCurrentlyPlaying ? 'opacity-100 text-emerald-400' : 'opacity-0 group-hover/art:opacity-100 text-white'
                        }`}
                        title={isCurrentlyPlaying ? 'Pause preview' : 'Play preview stream'}
                        aria-label={isCurrentlyPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                      >
                        {isCurrentlyPlaying ? (
                          <Pause className="h-7 w-7 fill-current" />
                        ) : (
                          <Play className="h-7 w-7 ml-0.5 fill-current" />
                        )}
                      </button>
                    </div>

                    {/* Text Details & Metadata Tags */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm sm:text-base font-bold text-white truncate" title={song.title}>
                          {song.title}
                        </h4>
                        {isCurrentlyPlaying && (
                          <span className="flex items-center gap-1 rounded bg-emerald-950/90 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>Playing</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-300">
                        <span className="font-medium text-neutral-200 truncate max-w-[180px]">
                          {song.artist || 'Unknown Artist'}
                        </span>
                        {song.album && (
                          <>
                            <span className="text-neutral-600">·</span>
                            <span className="truncate max-w-[160px] text-neutral-400">{song.album}</span>
                          </>
                        )}
                      </div>

                      {/* Metadata Chips: Duration, File Size, Genre, File Name */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono text-neutral-400">
                        <span className="flex items-center gap-1 rounded bg-neutral-950 px-2 py-0.5 border border-neutral-800 text-neutral-300">
                          <Clock className="h-3 w-3 text-neutral-400" />
                          <span>{formatDuration(song.duration)}</span>
                        </span>

                        <span className="flex items-center gap-1 rounded bg-neutral-950 px-2 py-0.5 border border-neutral-800 text-neutral-300">
                          <HardDrive className="h-3 w-3 text-neutral-400" />
                          <span>{formatBytes(song.file_size)}</span>
                        </span>

                        {song.genre && (
                          <span className="rounded bg-neutral-800/80 px-2 py-0.5 text-neutral-300 font-sans text-[10px] font-medium">
                            {song.genre}
                          </span>
                        )}

                        <span className="truncate max-w-[180px] text-neutral-500 hidden sm:inline" title={song.file_name}>
                          {song.file_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions Bar (Preview, Download, Edit, Artwork, Audio, Delete) */}
                  <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 border-t md:border-t-0 border-neutral-800/80 pt-3 md:pt-0 shrink-0">
                    {/* Play / Preview Button on Mobile */}
                    <button
                      type="button"
                      onClick={() => handleTogglePlay(song)}
                      className="md:hidden flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-800/90 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-700 min-h-[40px] cursor-pointer"
                      title={isCurrentlyPlaying ? 'Pause audio' : 'Play audio preview'}
                    >
                      {isCurrentlyPlaying ? (
                        <>
                          <Pause className="h-3.5 w-3.5 text-emerald-400 fill-current" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Preview</span>
                        </>
                      )}
                    </button>

                    {/* Direct Public Stream / Download Link */}
                    {song.public_url && (
                      <a
                        href={song.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors min-h-[40px] min-w-[40px]"
                        title="Download / Open Audio Stream"
                        aria-label="Direct public audio link"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {/* Admin Actions */}
                    {isAdminMode ? (
                      <>
                        {/* 1. Edit Details */}
                        <button
                          type="button"
                          onClick={() => openEditModal(song)}
                          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white px-3 py-2 text-xs font-medium transition-colors min-h-[40px] cursor-pointer"
                          title="Edit track details (title, artist, album, genre)"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-neutral-400" />
                          <span>Edit</span>
                        </button>

                        {/* 2. Artwork */}
                        <button
                          type="button"
                          onClick={() => openCoverModal(song)}
                          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white px-3 py-2 text-xs font-medium transition-colors min-h-[40px] cursor-pointer"
                          title="Add or replace album cover artwork"
                        >
                          <ImageIcon className="h-3.5 w-3.5 text-neutral-400" />
                          <span>Artwork</span>
                        </button>

                        {/* 3. Audio Replacement */}
                        <button
                          type="button"
                          onClick={() => openReplaceAudioModal(song)}
                          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white px-3 py-2 text-xs font-medium transition-colors min-h-[40px] cursor-pointer"
                          title="Replace cloud audio file"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-neutral-400" />
                          <span>Audio</span>
                        </button>

                        {/* 4. Delete Song Button */}
                        <button
                          type="button"
                          onClick={() => openDeleteModal(song)}
                          className="flex items-center gap-1.5 rounded-lg border border-rose-900/60 bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 hover:text-rose-100 px-3.5 py-2 text-xs font-semibold transition-colors min-h-[40px] cursor-pointer"
                          title="Delete song from Supabase database and storage"
                          aria-label={`Delete ${song.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                          <span>Delete</span>
                        </button>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-2 text-xs text-neutral-500 font-mono border border-neutral-800/80 min-h-[40px]">
                        <ShieldAlert className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Read-Only</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 1: EDIT SONG METADATA */}
      {/* ========================================================================= */}
      {editingSong && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 safe-top safe-bottom">
          <div className="relative w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6 text-neutral-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-neutral-300" />
                <h3 className="text-sm font-semibold text-white">Edit Song Details</h3>
              </div>
              <button
                onClick={() => setEditingSong(null)}
                className="text-neutral-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-400 mb-1 font-medium">Song Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none min-h-[40px]"
                  placeholder="Enter track title"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1 font-medium">Artist</label>
                  <input
                    type="text"
                    value={editArtist}
                    onChange={(e) => setEditArtist(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none min-h-[40px]"
                    placeholder="Artist name"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1 font-medium">Album</label>
                  <input
                    type="text"
                    value={editAlbum}
                    onChange={(e) => setEditAlbum(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none min-h-[40px]"
                    placeholder="Album title"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1 font-medium">Genre</label>
                  <input
                    type="text"
                    value={editGenre}
                    onChange={(e) => setEditGenre(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none min-h-[40px]"
                    placeholder="Genre"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1 font-medium">Duration (seconds)</label>
                  <input
                    type="number"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none min-h-[40px]"
                    placeholder="e.g. 214"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-neutral-800/80 bg-neutral-950 p-3 text-[11px] text-neutral-400 space-y-1 font-mono">
                <div>File: <span className="text-neutral-300">{editingSong.file_name}</span></div>
                <div>Size: <span className="text-neutral-300">{formatBytes(editingSong.file_size)}</span></div>
                {editingSong.storage_path && (
                  <div>Storage path: <span className="text-neutral-300 truncate block">{editingSong.storage_path}</span></div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-800 pt-3">
              <button
                type="button"
                onClick={() => setEditingSong(null)}
                disabled={isSavingEdit}
                className="rounded-lg border border-neutral-800 bg-neutral-800/50 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMetadata}
                disabled={isSavingEdit || !editTitle.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 min-h-[40px] cursor-pointer"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving to Supabase...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 2: ADD OR REPLACE COVER ARTWORK */}
      {/* ========================================================================= */}
      {coverSong && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 safe-top safe-bottom">
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6 text-neutral-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-neutral-300" />
                <h3 className="text-sm font-semibold text-white">Cover Artwork</h3>
              </div>
              <button
                onClick={() => setCoverSong(null)}
                className="text-neutral-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-center">
              <div>
                <h4 className="font-semibold text-white truncate">{coverSong.title}</h4>
                <p className="text-neutral-400 text-[11px] truncate">{coverSong.artist || 'Unknown Artist'}</p>
              </div>

              {/* Artwork Preview Box */}
              <div className="relative mx-auto h-40 w-40 overflow-hidden rounded-2xl border-2 border-dashed border-neutral-700 bg-neutral-950 flex items-center justify-center shadow-inner">
                {coverPreviewUrl ? (
                  <img
                    src={coverPreviewUrl}
                    alt="Cover preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = fallbackLogo;
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-neutral-500 p-4">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-[11px]">No artwork assigned</span>
                  </div>
                )}
              </div>

              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleCoverFileSelected}
              />

              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors min-h-[38px] cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{coverPreviewUrl ? 'Choose New Image' : 'Select Image'}</span>
                </button>
              </div>

              {coverFile && (
                <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/60 p-2 text-[11px] text-emerald-300 text-left">
                  Ready to upload: <span className="font-mono font-medium">{coverFile.name}</span> ({(coverFile.size / 1024).toFixed(1)} KB)
                </div>
              )}

              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Images are uploaded to bucket <strong className="text-neutral-400">'{storageBucket}'</strong> under <code className="font-mono text-neutral-300">covers/</code> and linked to the song record. Old replaced covers in the bucket are safely cleaned up.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-800 pt-3">
              <button
                type="button"
                onClick={() => setCoverSong(null)}
                disabled={isSavingCover}
                className="rounded-lg border border-neutral-800 bg-neutral-800/50 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCover}
                disabled={isSavingCover || !coverFile}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 min-h-[40px] cursor-pointer"
              >
                {isSavingCover ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Uploading Cover...</span>
                  </>
                ) : (
                  <span>Save Artwork</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 3: REPLACE AUDIO FILE */}
      {/* ========================================================================= */}
      {replaceAudioSong && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 safe-top safe-bottom">
          <div className="relative w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-5 sm:p-6 text-neutral-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-neutral-300" />
                <h3 className="text-sm font-semibold text-white">Replace Cloud Audio File</h3>
              </div>
              <button
                onClick={() => setReplaceAudioSong(null)}
                className="text-neutral-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Song Target Banner */}
              <div className="rounded-xl border border-neutral-800/80 bg-neutral-950 p-3.5 flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 shrink-0">
                  <img
                    src={replaceAudioSong.cover_url || fallbackLogo}
                    alt={replaceAudioSong.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-white truncate">{replaceAudioSong.title}</h4>
                  <p className="text-neutral-400 text-[11px] truncate">
                    {replaceAudioSong.artist || 'Unknown Artist'} · Current: {replaceAudioSong.file_name} ({formatBytes(replaceAudioSong.file_size)})
                  </p>
                </div>
              </div>

              {/* Guarantees Box */}
              <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/60 p-3 text-[11px] text-neutral-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-white">
                  <Sparkles className="h-3.5 w-3.5 text-neutral-400" />
                  <span>Metadata & Artwork Preservation Guarantee</span>
                </div>
                <p className="text-neutral-400 leading-relaxed">
                  The title, artist, album, genre, and album artwork will remain exactly as configured. Only the underlying audio stream in bucket <strong className="text-neutral-200">'{storageBucket}'</strong> and its database file references will be refreshed.
                </p>
              </div>

              {/* File Input */}
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac"
                className="hidden"
                onChange={handleAudioFileSelected}
              />

              <div className="text-center py-4 border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-950/60">
                {replacementAudioFile ? (
                  <div className="space-y-1.5 px-4 text-left">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                      <FileAudio className="h-4 w-4 shrink-0" />
                      <span className="truncate">{replacementAudioFile.name}</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono space-y-0.5">
                      <div>Size: {formatBytes(replacementAudioFile.size)}</div>
                      {replacementDuration && <div>Detected duration: {formatDuration(replacementDuration)}</div>}
                      {replacementHash && (
                        <div className="truncate">SHA-256: {replacementHash}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => audioInputRef.current?.click()}
                      className="mt-2 text-xs text-neutral-300 underline underline-offset-4 hover:text-white cursor-pointer"
                    >
                      Choose different audio file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileAudio className="mx-auto h-8 w-8 text-neutral-500" />
                    <p className="text-xs text-neutral-300 font-medium">Select replacement audio file</p>
                    <p className="text-[11px] text-neutral-500">Supports MP3, M4A, WAV, AAC, OGG, FLAC</p>
                    <button
                      type="button"
                      onClick={() => audioInputRef.current?.click()}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 hover:text-white min-h-[38px] cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Browse Files</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-800 pt-3">
              <button
                type="button"
                onClick={() => setReplaceAudioSong(null)}
                disabled={isReplacingAudio}
                className="rounded-lg border border-neutral-800 bg-neutral-800/50 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReplaceAudio}
                disabled={isReplacingAudio || !replacementAudioFile}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 min-h-[40px] cursor-pointer"
              >
                {isReplacingAudio ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Replacing Audio in Supabase...</span>
                  </>
                ) : (
                  <span>Confirm Audio Replacement</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 4: DELETE CLOUD SONG CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      {deletingSong && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 safe-top safe-bottom">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-900/60 bg-neutral-900 p-5 sm:p-6 text-neutral-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="text-sm font-semibold text-white">Delete Cloud Song</h3>
              </div>
              <button
                onClick={() => setDeletingSong(null)}
                className="text-neutral-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="rounded-xl border border-neutral-800/80 bg-neutral-950 p-3 flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 shrink-0">
                  <img
                    src={deletingSong.cover_url || fallbackLogo}
                    alt={deletingSong.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-white truncate">{deletingSong.title}</h4>
                  <p className="text-neutral-400 text-[11px] truncate">
                    {deletingSong.artist || 'Unknown Artist'} {deletingSong.album ? `· ${deletingSong.album}` : ''}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-3 text-rose-200 text-[11px] space-y-1.5 leading-relaxed">
                <p className="font-semibold text-rose-300">
                  This action will permanently remove:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-rose-200/90 font-mono text-[10px]">
                  <li>Database record from table '{tableName}'</li>
                  <li>Audio file from bucket '{storageBucket}' ({deletingSong.file_name})</li>
                  {deletingSong.cover_url && deletingSong.cover_url.includes(`/storage/v1/object/public/${storageBucket}/`) && (
                    <li>Associated uploaded cover image from storage</li>
                  )}
                </ul>
                <p className="pt-1 text-rose-300/80">
                  The Android app and web stream will immediately stop serving this track upon refresh.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-800 pt-3">
              <button
                type="button"
                onClick={() => setDeletingSong(null)}
                disabled={isDeleting}
                className="rounded-lg border border-neutral-800 bg-neutral-800/50 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 min-h-[40px] cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting from Cloud...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
