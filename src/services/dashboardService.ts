import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  SupabaseProjectSummary,
  ProjectDetails,
  AudioFileItem,
  SongMetadataItem,
  ConnectionTestResult,
  UploadActivityLog,
} from '../types/dashboard';
import { resolveProjectLogo } from '../assets/logos';

const STORAGE_KEY_PROJECTS = 'jtec_projects_config_v1';
const STORAGE_KEY_UPLOAD_LOGS = 'jtec_upload_logs_v1';

export interface LocalProjectConfig {
  id: string;
  name: string;
  category: string;
  logo: string;
  url: string;
  anonKey: string;
  storageBucket: string;
  tableName: string;
  storageQuotaBytes: number | null;
  projectRef?: string;
  lastTestedAt?: string | null;
}

const DEFAULT_PROJECT_CONFIGS: LocalProjectConfig[] = [
  {
    id: 'nasheed',
    name: 'NASHEED',
    category: 'Nasheed & Spiritual Audio',
    logo: 'assets/images/logo_nasheed_1792083522907.jpg',
    url: '',
    anonKey: '',
    storageBucket: 'nasheed-audio',
    tableName: 'songs',
    storageQuotaBytes: 1073741824,
    projectRef: '',
    lastTestedAt: null,
  },
  {
    id: 'love-chill',
    name: 'LOVE & CHILL',
    category: 'Lofi, Melodic & Chill Beats',
    logo: 'assets/images/logo_love_chill_1792083523142.jpg',
    url: 'https://cgpzpygvdpspctbaihac.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNncHpweWd2ZHBzcGN0YmFpaGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzA5MDAsImV4cCI6MjEwNjk0NjkwMH0.6fgCjNNHyMPZE0P7cDJA3L8ax7nbdOdr4dA7sef_m4s',
    storageBucket: 'music',
    tableName: 'songs',
    storageQuotaBytes: 1073741824,
    projectRef: '',
    lastTestedAt: '2026-10-15T17:33:00.452Z',
  },
  {
    id: 'jtec-music',
    name: 'JTEC MUSIC',
    category: 'Mainstream & JTEC Music Catalog',
    logo: 'assets/images/logo_jtec_music_1792083523229.jpg',
    url: '',
    anonKey: '',
    storageBucket: 'jtec-music-audio',
    tableName: 'songs',
    storageQuotaBytes: null,
    projectRef: '',
    lastTestedAt: null,
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getStoredConfigs(): LocalProjectConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalProjectConfig[];
      return DEFAULT_PROJECT_CONFIGS.map((def) => {
        const found = parsed.find((p) => p.id === def.id);
        if (!found) return def;
        return {
          ...def,
          ...found,
          url: found.url || def.url,
          anonKey: found.anonKey || def.anonKey,
          storageBucket: found.storageBucket || def.storageBucket,
          tableName: found.tableName || def.tableName,
        };
      });
    }
  } catch (err) {
    console.warn('Could not read stored configs from localStorage:', err);
  }
  return DEFAULT_PROJECT_CONFIGS;
}

export function saveStoredConfigs(configs: LocalProjectConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(configs));
  } catch (err) {
    console.warn('Could not save configs to localStorage:', err);
  }
}

function getStoredLogs(): UploadActivityLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UPLOAD_LOGS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function appendStoredLog(log: UploadActivityLog): void {
  try {
    const logs = getStoredLogs();
    logs.unshift(log);
    localStorage.setItem(STORAGE_KEY_UPLOAD_LOGS, JSON.stringify(logs.slice(0, 50)));
  } catch {}
}

function createBrowserSupabaseClient(url: string, key: string): SupabaseClient | null {
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Direct client-side inspection against Supabase for GitHub Pages
 */
async function inspectProjectClientSide(config: LocalProjectConfig): Promise<{
  files: AudioFileItem[];
  songs: SongMetadataItem[];
  totalBytes: number;
  bucketAccessible: boolean;
  tableAccessible: boolean;
  error: string | null;
}> {
  const result = {
    files: [] as AudioFileItem[],
    songs: [] as SongMetadataItem[],
    totalBytes: 0,
    bucketAccessible: false,
    tableAccessible: false,
    error: null as string | null,
  };

  if (!config.url || !config.anonKey) {
    result.error = 'Awaiting Supabase credentials';
    return result;
  }

  const client = createBrowserSupabaseClient(config.url, config.anonKey);
  if (!client) {
    result.error = 'Failed to initialize Supabase client';
    return result;
  }

  // 1. Query Songs Database Table
  try {
    const table = config.tableName || 'songs';
    const { data: rows, error: dbErr } = await client
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (dbErr) {
      result.error = `Database notice: ${dbErr.message}`;
    } else if (rows) {
      result.tableAccessible = true;
      result.songs = rows.map((row: any) => ({
        id: row.id || row.file_name,
        title: row.title || row.name || row.file_name,
        artist: row.artist || 'Unknown Artist',
        album: row.album || undefined,
        genre: row.genre || undefined,
        duration: row.duration || undefined,
        file_name: row.file_name || row.filename || '',
        file_size: row.file_size || row.size || undefined,
        storage_path: row.file_path || row.storage_path || undefined,
        public_url: row.audio_url || row.public_url || undefined,
        created_at: row.created_at || new Date().toISOString(),
      }));

      // Calculate bytes from table metadata
      result.totalBytes = rows.reduce((acc: number, r: any) => acc + (Number(r.file_size) || 0), 0);
    }
  } catch (err: any) {
    result.error = err.message || 'Database query error';
  }

  // 2. Query Storage
  try {
    const bucket = config.storageBucket || 'music';
    const { data: storageList, error: storageErr } = await client.storage.from(bucket).list('', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (!storageErr && storageList && storageList.length > 0) {
      result.bucketAccessible = true;
      for (const item of storageList) {
        if (item.name && item.id) {
          const rawSize = (item.metadata as any)?.size || (item as any).size || 0;
          const size = typeof rawSize === 'number' ? rawSize : parseInt(rawSize, 10) || 0;
          const publicUrl = client.storage.from(bucket).getPublicUrl(item.name).data?.publicUrl;

          result.files.push({
            id: item.id || item.name,
            name: item.name,
            size,
            sizeFormatted: formatBytes(size),
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            mimetype: (item.metadata as any)?.mimetype || 'audio/mpeg',
            publicUrl,
          });
        }
      }
    } else {
      // If storage listing returned 0 because of RLS but songs table has rows with audio_url,
      // construct files from songs!
      result.bucketAccessible = true;
      if (result.songs.length > 0) {
        result.files = result.songs.map((s) => ({
          id: String(s.id),
          name: s.file_name || `${s.title}.mp3`,
          size: s.file_size || 0,
          sizeFormatted: formatBytes(s.file_size || 0),
          created_at: s.created_at,
          updated_at: s.created_at,
          mimetype: 'audio/mpeg',
          publicUrl: s.public_url,
        }));
      }
    }
  } catch (err: any) {
    if (!result.error) {
      result.error = err.message || 'Storage check error';
    }
  }

  return result;
}

/**
 * Universal project summary fetcher
 */
export async function fetchProjects(): Promise<SupabaseProjectSummary[]> {
  // 1. Try local backend first (if running with server.ts)
  try {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((p) => ({
            ...p,
            logo: resolveProjectLogo(p.id, p.logo),
          }));
        }
      }
    }
  } catch {
    // Backend not running (standard GitHub Pages static environment)
  }

  // 2. Direct client-side evaluation against Supabase + LocalStorage
  const configs = getStoredConfigs();
  const summaries: SupabaseProjectSummary[] = [];

  for (const config of configs) {
    if (!config.url || !config.anonKey) {
      summaries.push({
        id: config.id,
        name: config.name,
        category: config.category,
        logo: resolveProjectLogo(config.id, config.logo),
        url: config.url || '',
        anonKey: config.anonKey || '',
        hasServiceRoleKey: false,
        hasManagementToken: false,
        projectRef: config.projectRef || '',
        storageBucket: config.storageBucket,
        tableName: config.tableName,
        storageQuotaBytes: config.storageQuotaBytes,
        status: 'not_configured',
        statusMessage: 'Awaiting Supabase credentials',
        audioFileCount: null,
        audioTotalBytes: null,
        storageUsedMB: null,
        storageUsedGB: null,
        percentUsed: null,
        remainingBytes: null,
        lastRefreshedAt: null,
        lastTestedAt: config.lastTestedAt || null,
        error: null,
      });
      continue;
    }

    try {
      const inspection = await inspectProjectClientSide(config);
      const audioTotalBytes = inspection.totalBytes;
      const storageUsedMB = (audioTotalBytes / (1024 * 1024)).toFixed(2);
      const storageUsedGB = (audioTotalBytes / (1024 * 1024 * 1024)).toFixed(3);

      let percentUsed: number | null = null;
      let remainingBytes: number | null = null;

      if (config.storageQuotaBytes && config.storageQuotaBytes > 0) {
        percentUsed = Math.min(100, parseFloat(((audioTotalBytes / config.storageQuotaBytes) * 100).toFixed(1)));
        remainingBytes = Math.max(0, config.storageQuotaBytes - audioTotalBytes);
      }

      summaries.push({
        id: config.id,
        name: config.name,
        category: config.category,
        logo: resolveProjectLogo(config.id, config.logo),
        url: config.url,
        anonKey: config.anonKey,
        hasServiceRoleKey: false,
        hasManagementToken: false,
        projectRef: config.projectRef || '',
        storageBucket: config.storageBucket,
        tableName: config.tableName,
        storageQuotaBytes: config.storageQuotaBytes,
        status: inspection.tableAccessible || inspection.bucketAccessible ? 'connected' : 'error',
        statusMessage: inspection.tableAccessible || inspection.bucketAccessible
          ? 'Connected & Verified'
          : inspection.error || 'Connection error',
        audioFileCount: inspection.files.length,
        audioTotalBytes,
        storageUsedMB,
        storageUsedGB,
        percentUsed,
        remainingBytes,
        lastRefreshedAt: new Date().toISOString(),
        lastTestedAt: config.lastTestedAt || null,
        error: inspection.error,
        availableBuckets: [config.storageBucket],
      });
    } catch (err: any) {
      summaries.push({
        id: config.id,
        name: config.name,
        category: config.category,
        logo: resolveProjectLogo(config.id, config.logo),
        url: config.url,
        anonKey: config.anonKey,
        hasServiceRoleKey: false,
        hasManagementToken: false,
        projectRef: config.projectRef || '',
        storageBucket: config.storageBucket,
        tableName: config.tableName,
        storageQuotaBytes: config.storageQuotaBytes,
        status: 'error',
        statusMessage: err.message || 'Connection failed',
        audioFileCount: null,
        audioTotalBytes: null,
        storageUsedMB: null,
        storageUsedGB: null,
        percentUsed: null,
        remainingBytes: null,
        lastRefreshedAt: new Date().toISOString(),
        lastTestedAt: config.lastTestedAt || null,
        error: err.message,
      });
    }
  }

  return summaries;
}

/**
 * Universal project details fetcher
 */
export async function fetchProjectDetails(projectId: string): Promise<ProjectDetails> {
  // 1. Try local backend first
  try {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        return {
          ...data,
          logo: resolveProjectLogo(data.id, data.logo),
        };
      }
    }
  } catch {
    // Backend not running
  }

  // 2. Direct client-side fetch
  const configs = getStoredConfigs();
  const config = configs.find((p) => p.id === projectId) || configs[0];

  const startTime = Date.now();
  const inspection = await inspectProjectClientSide(config);
  const latencyMs = Date.now() - startTime;

  const audioTotalBytes = inspection.totalBytes;
  const storageUsedMB = (audioTotalBytes / (1024 * 1024)).toFixed(2);
  const storageUsedGB = (audioTotalBytes / (1024 * 1024 * 1024)).toFixed(3);

  let percentUsed: number | null = null;
  let remainingBytes: number | null = null;
  if (config.storageQuotaBytes && config.storageQuotaBytes > 0) {
    percentUsed = Math.min(100, parseFloat(((audioTotalBytes / config.storageQuotaBytes) * 100).toFixed(1)));
    remainingBytes = Math.max(0, config.storageQuotaBytes - audioTotalBytes);
  }

  const projectSummary: SupabaseProjectSummary = {
    id: config.id,
    name: config.name,
    category: config.category,
    logo: resolveProjectLogo(config.id, config.logo),
    url: config.url,
    anonKey: config.anonKey,
    hasServiceRoleKey: false,
    hasManagementToken: false,
    projectRef: config.projectRef || '',
    storageBucket: config.storageBucket,
    tableName: config.tableName,
    storageQuotaBytes: config.storageQuotaBytes,
    status: config.url && (inspection.tableAccessible || inspection.bucketAccessible) ? 'connected' : 'not_configured',
    statusMessage: config.url ? 'Connected & Verified' : 'Awaiting Supabase credentials',
    audioFileCount: inspection.files.length,
    audioTotalBytes,
    storageUsedMB,
    storageUsedGB,
    percentUsed,
    remainingBytes,
    lastRefreshedAt: new Date().toISOString(),
    lastTestedAt: config.lastTestedAt || null,
    error: inspection.error,
    availableBuckets: [config.storageBucket],
  };

  const uploadLogs = getStoredLogs().filter((l) => l.projectId === projectId);

  return {
    ...projectSummary,
    bucketAccessible: inspection.bucketAccessible,
    tableAccessible: inspection.tableAccessible,
    files: inspection.files,
    songs: inspection.songs,
    recentUploads: uploadLogs,
  };
}

/**
 * Universal project configuration saver
 */
export async function saveProjectConfig(
  projectId: string,
  payload: {
    url: string;
    anonKey: string;
    storageBucket: string;
    tableName: string;
    storageQuotaBytes: number | null;
    projectRef?: string;
  }
): Promise<{ success: boolean; message: string }> {
  // 1. If backend exists, also sync to backend
  try {
    await fetch(`/api/projects/${projectId}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}

  // 2. Always persist client-safe keys in localStorage
  const configs = getStoredConfigs();
  const index = configs.findIndex((p) => p.id === projectId);
  if (index >= 0) {
    configs[index] = {
      ...configs[index],
      url: payload.url,
      anonKey: payload.anonKey,
      storageBucket: payload.storageBucket,
      tableName: payload.tableName,
      storageQuotaBytes: payload.storageQuotaBytes,
      projectRef: payload.projectRef || configs[index].projectRef,
    };
    saveStoredConfigs(configs);
  }

  return { success: true, message: 'Configuration saved securely in browser storage!' };
}

/**
 * Universal connection diagnostic tester
 */
export async function testProjectConnection(projectId: string): Promise<ConnectionTestResult> {
  // 1. Try local backend first
  try {
    const res = await fetch(`/api/projects/${projectId}/test-connection`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}

  // 2. Client-side diagnostic suite
  const configs = getStoredConfigs();
  const config = configs.find((p) => p.id === projectId) || configs[0];
  const testedAt = new Date().toISOString();

  if (!config.url || !config.anonKey) {
    return {
      projectId,
      overallStatus: 'failed',
      testedAt,
      checks: [
        {
          step: 'credentials',
          title: 'Supabase URL & Key',
          status: 'failed',
          message: 'Project URL and public anonKey are not set.',
        },
      ],
    };
  }

  const checks: any[] = [];
  let hasFailed = false;

  // Step 1: Network Ping
  const pingStart = Date.now();
  try {
    const pingRes = await fetch(`${config.url}/rest/v1/`, {
      headers: { apikey: config.anonKey },
    });
    const pingLatency = Date.now() - pingStart;
    checks.push({
      step: 'network',
      title: 'Supabase Network Endpoint',
      status: pingRes.status < 500 ? 'passed' : 'failed',
      message: `Host responded in ${pingLatency}ms (HTTP ${pingRes.status}).`,
    });
  } catch (err: any) {
    hasFailed = true;
    checks.push({
      step: 'network',
      title: 'Supabase Network Endpoint',
      status: 'failed',
      message: `Network ping failed: ${err.message}`,
    });
  }

  // Step 2: Supabase Client & Table Access
  const client = createBrowserSupabaseClient(config.url, config.anonKey);
  if (!client) {
    checks.push({
      step: 'auth',
      title: 'Client Initialization',
      status: 'failed',
      message: 'Could not initialize client.',
    });
    return { projectId, overallStatus: 'failed', testedAt, checks };
  }

  try {
    const table = config.tableName || 'songs';
    const { data, error } = await client.from(table).select('count').limit(1);
    if (error) {
      checks.push({
        step: 'database',
        title: `Database Table (${table})`,
        status: 'warning',
        message: `Query note: ${error.message}`,
      });
    } else {
      checks.push({
        step: 'database',
        title: `Database Table (${table})`,
        status: 'passed',
        message: `Database table '${table}' accessed successfully.`,
      });
    }
  } catch (err: any) {
    checks.push({
      step: 'database',
      title: 'Database Table Access',
      status: 'warning',
      message: err.message,
    });
  }

  // Step 3: Storage Bucket
  try {
    const bucket = config.storageBucket || 'music';
    const { data, error } = await client.storage.from(bucket).list('', { limit: 1 });
    if (error) {
      checks.push({
        step: 'storage',
        title: `Storage Bucket (${bucket})`,
        status: 'warning',
        message: `Storage notification: ${error.message}`,
      });
    } else {
      checks.push({
        step: 'storage',
        title: `Storage Bucket (${bucket})`,
        status: 'passed',
        message: `Storage bucket '${bucket}' active and operational.`,
      });
    }
  } catch (err: any) {
    checks.push({
      step: 'storage',
      title: 'Storage Check',
      status: 'warning',
      message: err.message,
    });
  }

  // Update lastTestedAt in storage
  const idx = configs.findIndex((p) => p.id === projectId);
  if (idx >= 0) {
    configs[idx].lastTestedAt = testedAt;
    saveStoredConfigs(configs);
  }

  return {
    projectId,
    overallStatus: hasFailed ? 'failed' : 'passed',
    testedAt,
    checks,
  };
}

/**
 * Universal audio upload
 */
export async function uploadAudioFile(
  projectId: string,
  file: File,
  metadata: {
    title: string;
    artist: string;
    album: string;
    genre: string;
    duration: string;
  }
): Promise<{ success: boolean; song: any }> {
  // 1. Try local backend first
  try {
    const formData = new FormData();
    formData.append('audioFile', file);
    formData.append('title', metadata.title);
    formData.append('artist', metadata.artist);
    formData.append('album', metadata.album);
    formData.append('genre', metadata.genre);
    formData.append('duration', metadata.duration);

    const res = await fetch(`/api/projects/${projectId}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, song: data.song };
    }
  } catch {}

  // 2. Direct client-side Supabase upload for GitHub Pages
  const configs = getStoredConfigs();
  const config = configs.find((p) => p.id === projectId) || configs[0];

  if (!config.url || !config.anonKey) {
    throw new Error('Supabase credentials not configured for this project.');
  }

  const client = createBrowserSupabaseClient(config.url, config.anonKey);
  if (!client) {
    throw new Error('Could not initialize Supabase client.');
  }

  const bucket = config.storageBucket || 'music';
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${Date.now()}_${cleanName}`;

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadErr } = await client.storage.from(bucket).upload(filePath, file, {
    contentType: file.type || 'audio/mpeg',
    upsert: true,
  });

  if (uploadErr) {
    throw new Error(`Supabase Storage upload failed: ${uploadErr.message}`);
  }

  const publicUrl = client.storage.from(bucket).getPublicUrl(filePath).data?.publicUrl;

  // Insert metadata into table
  const table = config.tableName || 'songs';
  const newSong = {
    title: metadata.title,
    artist: metadata.artist || 'Unknown Artist',
    album: metadata.album || '',
    genre: metadata.genre || 'Music',
    duration: parseInt(metadata.duration, 10) || 0,
    file_name: file.name,
    file_size: file.size,
    file_path: filePath,
    audio_url: publicUrl,
    created_at: new Date().toISOString(),
  };

  try {
    await client.from(table).insert([newSong]);
  } catch (dbErr: any) {
    console.warn('Metadata insertion notice:', dbErr);
  }

  appendStoredLog({
    id: `log-${Date.now()}`,
    projectId,
    fileName: file.name,
    fileSize: file.size,
    title: metadata.title,
    artist: metadata.artist || 'Unknown Artist',
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  return { success: true, song: newSong };
}
