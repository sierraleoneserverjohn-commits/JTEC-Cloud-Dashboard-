import type { SongMetadataItem } from '../types/dashboard';

export interface DuplicateMatch {
  title: string;
  artist: string;
  fileName: string;
  id?: string | number;
  reason: 'content_hash' | 'filename' | 'metadata' | 'batch_duplicate';
  similarityNote: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  match?: DuplicateMatch;
  warningMessage?: string;
}

/**
 * Calculate standard SHA-256 hash of a File using Web Crypto API.
 * Works natively in all modern browsers and Android WebViews.
 */
export async function computeFileSha256(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('Crypto subtle SHA-256 error, falling back to pseudo-hash:', err);
    // Fallback pseudo-hash based on size and name
    return `size_${file.size}_name_${file.name.replace(/[^a-zA-Z0-9]/g, '')}`;
  }
}

/**
 * Normalize text for resilient title and artist matching:
 * - Strips diacritics / accents
 * - Strips bracketed tags like (Lyrics), [Official Audio], (Slowed + Reverb)
 * - Strips trailing 10-14 digit Unix timestamps (e.g. 1792252116851)
 * - Lowercases and normalizes whitespace
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\[.*?\]|\(.*?\)/g, ' ')
    .replace(/[-_]?\b\d{10,14}\b/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/[-_–—/\\|:.]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip common audio file extensions
 */
export function stripAudioExtension(fileName: string): string {
  return fileName.replace(/\.(mp3|wav|m4a|aac|flac|ogg|opus|webm|wma|alac|aiff)$/i, '');
}

export interface BatchItemSummary {
  id: string;
  name: string;
  size: number;
  sha256?: string;
  title: string;
  artist: string;
}

/**
 * Check a candidate audio file against:
 * 1. Other files selected in the same upload batch (intra-batch check)
 * 2. Existing songs cataloged in the selected Supabase project
 */
export function checkForDuplicates(
  file: File,
  fileSha256: string | undefined,
  candidateTitle: string,
  candidateArtist: string,
  existingSongs: SongMetadataItem[],
  batchItems: BatchItemSummary[],
  currentItemId: string
): DuplicateCheckResult {
  const normCandidateTitle = normalizeText(candidateTitle || stripAudioExtension(file.name));
  const normCandidateArtist = normalizeText(candidateArtist || 'Unknown Artist');
  const cleanFileName = file.name.trim().toLowerCase();

  // 1. Check for duplicate within the same batch (intra-batch duplicate)
  for (const item of batchItems) {
    if (item.id === currentItemId) continue;

    // Check same SHA-256 content hash in batch
    if (fileSha256 && item.sha256 && fileSha256 === item.sha256) {
      return {
        isDuplicate: true,
        match: {
          title: item.title || item.name,
          artist: item.artist || 'Unknown Artist',
          fileName: item.name,
          reason: 'batch_duplicate',
          similarityNote: 'Identical file selected multiple times in this batch (SHA-256 match)',
        },
        warningMessage: 'Duplicate detected — this song may have already been uploaded.',
      };
    }

    // Check exact same name and size in batch
    if (cleanFileName === item.name.trim().toLowerCase() && file.size === item.size) {
      return {
        isDuplicate: true,
        match: {
          title: item.title || item.name,
          artist: item.artist || 'Unknown Artist',
          fileName: item.name,
          reason: 'batch_duplicate',
          similarityNote: 'Identical file name and size selected twice in this batch',
        },
        warningMessage: 'Duplicate detected — this song may have already been uploaded.',
      };
    }
  }

  // 2. Check against existing songs in destination Supabase project
  for (const song of existingSongs) {
    const existingFileName = (song.file_name || '').trim().toLowerCase();
    const existingStoragePath = (song.storage_path || '').trim().toLowerCase();
    const existingHash = (song as any).file_hash ? String((song as any).file_hash).trim() : '';

    // Check 2a: Exact SHA-256 hash match against stored file_hash
    if (fileSha256 && existingHash) {
      if (
        existingHash === fileSha256 ||
        existingHash.includes(fileSha256) ||
        fileSha256.includes(existingHash)
      ) {
        return {
          isDuplicate: true,
          match: {
            title: song.title,
            artist: song.artist || 'Unknown Artist',
            fileName: song.file_name,
            id: song.id,
            reason: 'content_hash',
            similarityNote: `Identical SHA-256 content hash matches existing song in this project`,
          },
          warningMessage: 'Duplicate detected — this song may have already been uploaded.',
        };
      }
    }

    // Check 2b: Exact filename match (or filename embedded in storage path)
    if (
      existingFileName &&
      (cleanFileName === existingFileName ||
        existingStoragePath.endsWith(`/${cleanFileName}`) ||
        existingStoragePath === cleanFileName)
    ) {
      return {
        isDuplicate: true,
        match: {
          title: song.title,
          artist: song.artist || 'Unknown Artist',
          fileName: song.file_name,
          id: song.id,
          reason: 'filename',
          similarityNote: `A file with this name ('${song.file_name}') is already cataloged in this project`,
        },
        warningMessage: 'Duplicate detected — this song may have already been uploaded.',
      };
    }

    // Check 2c: Metadata title and artist fuzzy match
    const normExistingTitle = normalizeText(song.title);
    const normExistingArtist = normalizeText(song.artist || '');

    if (normCandidateTitle.length >= 3 && normExistingTitle.length >= 3) {
      const titlesMatch =
        normCandidateTitle === normExistingTitle ||
        (normCandidateTitle.length > 5 && normExistingTitle.includes(normCandidateTitle)) ||
        (normExistingTitle.length > 5 && normCandidateTitle.includes(normExistingTitle));

      if (titlesMatch) {
        const artistsMatch =
          !normCandidateArtist ||
          normCandidateArtist === 'unknown artist' ||
          !normExistingArtist ||
          normExistingArtist === 'unknown artist' ||
          normCandidateArtist === normExistingArtist ||
          normCandidateArtist.includes(normExistingArtist) ||
          normExistingArtist.includes(normCandidateArtist);

        const sizeMatches =
          song.file_size && song.file_size > 0
            ? Math.abs(song.file_size - file.size) < 1024 * 100 // within 100KB
            : false;

        if (artistsMatch || sizeMatches) {
          return {
            isDuplicate: true,
            match: {
              title: song.title,
              artist: song.artist || 'Unknown Artist',
              fileName: song.file_name,
              id: song.id,
              reason: 'metadata',
              similarityNote: `Matches existing track title '${song.title}' by '${song.artist || 'Unknown Artist'}'`,
            },
            warningMessage: 'Duplicate detected — this song may have already been uploaded.',
          };
        }
      }
    }
  }

  return { isDuplicate: false };
}
