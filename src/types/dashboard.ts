export type ConnectionStatus = 'connected' | 'not_configured' | 'error' | 'untested';

export interface SupabaseProjectSummary {
  id: string; // 'nasheed' | 'love-chill' | 'jtec-music'
  name: string;
  category: string;
  logo: string;
  url: string;
  anonKey: string;
  hasServiceRoleKey: boolean;
  hasManagementToken: boolean;
  projectRef: string;
  storageBucket: string;
  tableName: string;
  storageQuotaBytes: number | null; // e.g. 1073741824 for 1GB
  status: ConnectionStatus;
  statusMessage?: string;
  audioFileCount: number | null;
  audioTotalBytes: number | null;
  storageUsedMB: string | null;
  storageUsedGB: string | null;
  percentUsed: number | null; // null if quota unknown
  remainingBytes: number | null; // null if quota unknown
  lastRefreshedAt: string | null;
  lastTestedAt: string | null;
  error: string | null;
  availableBuckets?: string[];
}

export interface AudioFileItem {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  created_at: string;
  updated_at: string;
  mimetype: string;
  publicUrl?: string;
}

export interface SongMetadataItem {
  id: string | number;
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  duration?: string | number;
  file_name: string;
  file_size?: number;
  storage_path?: string;
  public_url?: string;
  cover_url?: string;
  created_at: string;
}

export interface UploadActivityLog {
  id: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  title: string;
  artist: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  timestamp: string;
}

export interface DiagnosticCheck {
  step: string;
  title: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  durationMs?: number;
}

export interface ConnectionTestResult {
  projectId: string;
  overallStatus: 'passed' | 'failed' | 'partial';
  testedAt: string;
  checks: DiagnosticCheck[];
}

export interface ProjectDetails extends SupabaseProjectSummary {
  bucketAccessible: boolean;
  tableAccessible: boolean;
  files: AudioFileItem[];
  songs: SongMetadataItem[];
  recentUploads: UploadActivityLog[];
  managementApiUsage?: {
    storageBytesTotal?: number;
    egressBytes?: number;
    planName?: string;
    isAvailable: boolean;
    reason?: string;
  };
}

export interface ProjectConfigPayload {
  url?: string;
  anonKey?: string;
  serviceRoleKey?: string;
  storageBucket?: string;
  tableName?: string;
  storageQuotaBytes?: number | null;
  managementApiToken?: string;
  projectRef?: string;
}
