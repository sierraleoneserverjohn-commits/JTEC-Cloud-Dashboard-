/**
 * Audio Artwork & Metadata Extractor
 * Automatically inspects audio files (MP3 ID3v2, FLAC, M4A/MP4) for embedded album covers and tags.
 */

export interface ExtractedAudioResult {
  hasEmbeddedCover: boolean;
  coverBlob: Blob | null;
  coverFile: File | null;
  coverPreviewUrl: string | null;
  mimeType: string | null;
  extractedTitle?: string;
  extractedArtist?: string;
  extractedAlbum?: string;
  extractedGenre?: string;
}

/**
 * Decode text buffer according to ID3 encoding flag
 * 0 = ISO-8859-1 (Latin1)
 * 1 = UTF-16 with BOM
 * 2 = UTF-16BE without BOM
 * 3 = UTF-8
 */
function decodeId3Text(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      // Latin1 / ISO-8859-1
      const decoder = new TextDecoder('latin1');
      return decoder.decode(bytes).replace(/\0.*$/, '').trim();
    }
    if (encoding === 1) {
      // UTF-16 with BOM (or default to utf-16le)
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        const decoder = new TextDecoder('utf-16be');
        return decoder.decode(bytes.subarray(2)).replace(/\0.*$/, '').trim();
      }
      const decoder = new TextDecoder('utf-16le');
      const start = (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) ? 2 : 0;
      return decoder.decode(bytes.subarray(start)).replace(/\0.*$/, '').trim();
    }
    if (encoding === 2) {
      // UTF-16BE
      const decoder = new TextDecoder('utf-16be');
      return decoder.decode(bytes).replace(/\0.*$/, '').trim();
    }
    // Default UTF-8
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes).replace(/\0.*$/, '').trim();
  } catch {
    return '';
  }
}

/**
 * Determine MIME type and file extension from image signature magic bytes
 */
function getImageDetailsFromBytes(bytes: Uint8Array): { mimeType: string; extension: string } {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return { mimeType: 'image/jpeg', extension: 'jpg' };
}

/**
 * Search a buffer for known image header magic bytes (JPEG, PNG, WebP)
 */
function findImageMagicOffset(bytes: Uint8Array): number {
  const maxScan = Math.min(bytes.length, 1024 * 1024);
  for (let i = 0; i < maxScan - 4; i++) {
    // JPEG: FF D8 FF
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      return i;
    }
    // PNG: 89 50 4E 47
    if (
      bytes[i] === 0x89 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x4e &&
      bytes[i + 3] === 0x47
    ) {
      return i;
    }
    // WebP: RIFF ... WEBP
    if (
      bytes[i] === 0x52 &&
      bytes[i + 1] === 0x49 &&
      bytes[i + 2] === 0x46 &&
      bytes[i + 3] === 0x46 &&
      i + 11 < maxScan &&
      bytes[i + 8] === 0x57 &&
      bytes[i + 9] === 0x45 &&
      bytes[i + 10] === 0x42 &&
      bytes[i + 11] === 0x50
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Extract embedded artwork and ID3 metadata from an audio File
 */
export async function extractAudioArtworkAndMetadata(
  file: File
): Promise<ExtractedAudioResult> {
  const result: ExtractedAudioResult = {
    hasEmbeddedCover: false,
    coverBlob: null,
    coverFile: null,
    coverPreviewUrl: null,
    mimeType: null,
  };

  try {
    // Read up to 8MB header which contains ID3v2, FLAC, or MP4 metadata
    const sliceSize = Math.min(file.size, 8 * 1024 * 1024);
    const slice = file.slice(0, sliceSize);
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 1. Check ID3v2 (MP3, WAV with ID3 chunk, etc.)
    if (
      bytes.length > 10 &&
      bytes[0] === 0x49 &&
      bytes[1] === 0x44 &&
      bytes[2] === 0x33 // "ID3"
    ) {
      const version = bytes[3]; // 2 = v2.2, 3 = v2.3, 4 = v2.4
      const tagSize =
        ((bytes[6] & 0x7f) << 21) |
        ((bytes[7] & 0x7f) << 14) |
        ((bytes[8] & 0x7f) << 7) |
        (bytes[9] & 0x7f);

      const endOfTag = Math.min(10 + tagSize, bytes.length);
      let offset = 10;

      while (offset < endOfTag) {
        if (version === 2) {
          // ID3v2.2 frames: 3-byte ID, 3-byte size
          if (offset + 6 > endOfTag) break;
          const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
          if (frameId === '\0\0\0') break;
          const frameSize =
            (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5];
          if (frameSize <= 0 || offset + 6 + frameSize > endOfTag) break;

          const frameData = bytes.subarray(offset + 6, offset + 6 + frameSize);
          if (frameId === 'PIC') {
            const magicIdx = findImageMagicOffset(frameData);
            if (magicIdx !== -1) {
              const imgBytes = frameData.subarray(magicIdx);
              createCoverFromBytes(imgBytes, result, file.name);
            }
          } else if (frameId === 'TT2') {
            result.extractedTitle = decodeId3Text(frameData.subarray(1), frameData[0]);
          } else if (frameId === 'TP1') {
            result.extractedArtist = decodeId3Text(frameData.subarray(1), frameData[0]);
          } else if (frameId === 'TAL') {
            result.extractedAlbum = decodeId3Text(frameData.subarray(1), frameData[0]);
          }

          offset += 6 + frameSize;
        } else {
          // ID3v2.3 / ID3v2.4 frames: 4-byte ID, 4-byte size, 2-byte flags
          if (offset + 10 > endOfTag) break;
          const frameId = String.fromCharCode(
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3]
          );
          if (frameId === '\0\0\0\0') break;

          let frameSize = 0;
          if (version === 4) {
            frameSize =
              ((bytes[offset + 4] & 0x7f) << 21) |
              ((bytes[offset + 5] & 0x7f) << 14) |
              ((bytes[offset + 6] & 0x7f) << 7) |
              (bytes[offset + 7] & 0x7f);
          } else {
            frameSize =
              ((bytes[offset + 4] << 24) >>> 0) |
              (bytes[offset + 5] << 16) |
              (bytes[offset + 6] << 8) |
              bytes[offset + 7];
          }

          if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) {
            break;
          }

          const frameData = bytes.subarray(offset + 10, offset + 10 + frameSize);

          if (frameId === 'APIC' && !result.hasEmbeddedCover) {
            // Find image magic within APIC frame
            const magicIdx = findImageMagicOffset(frameData);
            if (magicIdx !== -1) {
              const imgBytes = frameData.subarray(magicIdx);
              createCoverFromBytes(imgBytes, result, file.name);
            } else {
              // Standard parse: skip encoding, MIME string (null-terminated), pic type (1 byte), desc (null-terminated)
              const encoding = frameData[0] || 0;
              let pos = 1;
              while (pos < frameData.length && frameData[pos] !== 0) pos++;
              pos++; // skip null
              pos++; // skip picture type byte
              // skip description
              if (encoding === 1 || encoding === 2) {
                while (pos + 1 < frameData.length && !(frameData[pos] === 0 && frameData[pos + 1] === 0)) {
                  pos += 2;
                }
                pos += 2;
              } else {
                while (pos < frameData.length && frameData[pos] !== 0) pos++;
                pos++;
              }
              if (pos < frameData.length) {
                const imgBytes = frameData.subarray(pos);
                createCoverFromBytes(imgBytes, result, file.name);
              }
            }
          } else if (frameId === 'TIT2' && !result.extractedTitle) {
            result.extractedTitle = decodeId3Text(frameData.subarray(1), frameData[0]);
          } else if (frameId === 'TPE1' && !result.extractedArtist) {
            result.extractedArtist = decodeId3Text(frameData.subarray(1), frameData[0]);
          } else if (frameId === 'TALB' && !result.extractedAlbum) {
            result.extractedAlbum = decodeId3Text(frameData.subarray(1), frameData[0]);
          } else if (frameId === 'TCON' && !result.extractedGenre) {
            result.extractedGenre = decodeId3Text(frameData.subarray(1), frameData[0]);
          }

          offset += 10 + frameSize;
        }
      }
    }

    // 2. Check FLAC format ('fLaC')
    if (
      !result.hasEmbeddedCover &&
      bytes.length > 4 &&
      bytes[0] === 0x66 &&
      bytes[1] === 0x4c &&
      bytes[2] === 0x61 &&
      bytes[3] === 0x43
    ) {
      let flacOffset = 4;
      while (flacOffset + 4 < bytes.length) {
        const header = bytes[flacOffset];
        const isLast = (header & 0x80) !== 0;
        const blockType = header & 0x7f;
        const blockLength =
          (bytes[flacOffset + 1] << 16) | (bytes[flacOffset + 2] << 8) | bytes[flacOffset + 3];

        if (blockType === 6) {
          // PICTURE block
          const blockData = bytes.subarray(flacOffset + 4, flacOffset + 4 + blockLength);
          const magicIdx = findImageMagicOffset(blockData);
          if (magicIdx !== -1) {
            const imgBytes = blockData.subarray(magicIdx);
            createCoverFromBytes(imgBytes, result, file.name);
            break;
          }
        }
        flacOffset += 4 + blockLength;
        if (isLast) break;
      }
    }

    // 3. Check MP4 / M4A format (starts with 'ftyp' atom or has 'moov')
    if (!result.hasEmbeddedCover && bytes.length > 8) {
      const atomName = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
      if (atomName === 'ftyp' || bytes[0] === 0x00) {
        // Scan for 'covr' followed by 'data'
        for (let i = 0; i < bytes.length - 8; i++) {
          if (
            bytes[i] === 0x63 &&
            bytes[i + 1] === 0x6f &&
            bytes[i + 2] === 0x76 &&
            bytes[i + 3] === 0x72 // "covr"
          ) {
            const magicIdx = findImageMagicOffset(bytes.subarray(i + 4, i + 500));
            if (magicIdx !== -1) {
              const imgBytes = bytes.subarray(i + 4 + magicIdx);
              createCoverFromBytes(imgBytes, result, file.name);
              break;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Cover extraction notice:', err);
  }

  return result;
}

/**
 * Helper to construct Blob, File, and Preview URL from extracted image bytes
 */
function createCoverFromBytes(
  imgBytes: Uint8Array,
  result: ExtractedAudioResult,
  originalAudioName: string
) {
  if (imgBytes.length < 32) return;
  const { mimeType, extension } = getImageDetailsFromBytes(imgBytes);

  // Clean filename base
  const cleanBase = originalAudioName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const coverFileName = `${cleanBase}_cover.${extension}`;

  const blob = new Blob([imgBytes as unknown as BlobPart], { type: mimeType });
  const file = new File([blob], coverFileName, { type: mimeType });
  const previewUrl = URL.createObjectURL(blob);

  result.hasEmbeddedCover = true;
  result.coverBlob = blob;
  result.coverFile = file;
  result.coverPreviewUrl = previewUrl;
  result.mimeType = mimeType;
}
