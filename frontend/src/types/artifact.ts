export enum ArtifactType {
  APK = "apk",
  TEST_SCRIPT = "test_script",
  LOG = "log",
  OTHER = "other",
  CONFIG = "config",
  IMAGE = "image",
  BINARY = "binary"
}

export enum DeploymentStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELED = "canceled",
  ROLLBACK_IN_PROGRESS = "rollback_in_progress",
  ROLLBACK_COMPLETE = "rollback_complete"
}

export interface Artifact {
  id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  artifact_type: ArtifactType;
  user_id: number;
  target_id: number | null;
  created_at: string;
  updated_at: string | null;
  user_username: string;
  
  // Extended properties for artifact management
  version: string;
  description: string | null;
  tags: string[];
  platform_compatibility: string[];
  metadata: Record<string, any>;
  is_latest: boolean;
  previous_version_id: number | null;
}

export interface ArtifactVersion {
  id: number;
  artifact_id: number;
  version: string;
  created_at: string;
  created_by: number;
  notes: string | null;
  is_active: boolean;
}

export interface ArtifactDeployment {
  id: number;
  artifact_id: number;
  target_ids: number[];
  status: DeploymentStatus;
  started_at: string;
  completed_at: string | null;
  initiated_by: number;
  logs: string[];
  is_dry_run: boolean;
  rollback_to_id: number | null;
  error_message: string | null;
}

export interface ArtifactFilter {
  type?: ArtifactType[];
  tags?: string[];
  platform?: string[];
  dateFrom?: string;
  dateTo?: string;
  project?: string;
  search?: string;
}

export interface ArtifactMetadata {
  version: string;
  type: ArtifactType;
  platform_compatibility: string[];
  description?: string;
  tags?: string[];
  project?: string;
}
