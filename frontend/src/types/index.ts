// Shared TypeScript types definition for fyp frontend
// All shapes mirror the DynamoDB records returned by FastAPI backend
// This are for developer convenient. Nothing to do with the system, it is just a typescript thing that need to have
// Because, typescript check everything before the code even run

export interface EmployeeProfile {
  email: string;
  name: string;
  department: string;
  role: string;
}

export interface Folder {
  folder_id: string;
  name: string;
  department: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  parent_folder_id?: string;
}

/** Public key-derivation parameters of a locked file (not secret). */
export interface LockKdf {
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  /** base64 */
  salt: string;
}

export interface Document {
  file_id: string;
  display_name: string;
  s3_key: string;
  department: string;
  folder_id?: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  file_size: number;
  content_type: string;
  /** Absent on files uploaded before locking existed; treat as false. */
  is_locked?: boolean;
  lock_kdf?: LockKdf;
}

export interface UploadResponse {
  file_id: string;
  display_name: string;
  s3_key: string;
  department: string;
  folder_id?: string;
  uploaded_by: string;
  uploaded_at: string;
  file_size: number;
  content_type: string;
  is_locked?: boolean;
  lock_kdf?: LockKdf;
}

export interface UnlockResponse {
  file_id: string;
  filename: string;
  content_type: string;
  /** Short-lived presigned URL of the ciphertext. */
  url: string;
  /** base64 AES-GCM IV, released only after the verifier matched. */
  iv: string;
  lock_kdf: LockKdf;
}

export interface DownloadResponse {
  file_id: string;
  filename: string;
  url: string;
}

export interface ScanLogEntry {
  department: string;
  scan_id: string;
  file_id: string;
  file_name: string;
  user_email: string;
  scan_type: "upload" | "download" | "lock";
  result: "clean" | "infected" | "not_fully_scanned" | "error";
  timestamp: string;
  details?: string;
}

export interface FolderListResponse {
  department: string;
  folders: Folder[];
}

export interface DocumentListResponse {
  department: string;
  folder_id: string | null;
  files: Document[];
}

export interface MoveResponse {
  moved_files: number;
  moved_folders: number;
  destination_folder_id: string | null;
}

export interface MoveTarget {
  fileIds: string[];
  folderIds: string[];
}

export interface Employee {
  email: string;
  name: string;
  department: string;
  role: string;
  personal_email: string;
  status: string;
  onboarding_complete?: boolean;
}

export interface FullProfile {
  name: string;
  department: string;
  role: string;
  personal_email: string | null;
  address: string | null;
  phone: string | null;
}

export interface RegisterEmployeePayload {
  email: string;
  name: string;
  department: string;
  role: string;
  personal_email: string;
  temp_password: string;
}

export interface AuditLogEntry {
  department: string;
  log_id: string;
  action: string;
  actor_email: string;
  timestamp: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  details?: string;
}

export interface AuditLogResponse {
  department: string | null;
  action: string | null;
  logs: AuditLogEntry[];
}

export interface FileTypeStat {
  extension: string;
  count: number;
  percent: number;
}

export interface RecentUpload {
  file_id: string;
  display_name: string;
  uploaded_at: string;
}

export interface LargestFile {
  file_id: string;
  display_name: string;
  file_size: number;
}

export interface BusiestFolder {
  folder_id: string;
  name: string;
  file_count: number;
}

export interface OverviewResponse {
  department: string;
  total_documents: number;
  total_folders: number;
  total_storage_bytes: number;
  uploaded_this_week: number;
  file_types: FileTypeStat[];
  recent_uploads: RecentUpload[];
  largest_files: LargestFile[];
  busiest_folders: BusiestFolder[];
}
