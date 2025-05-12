export enum DeviceType {
  PHYSICAL = "physical",
  VIRTUAL = "virtual",
  EMULATOR = "emulator"
}

export enum DeviceStatus {
  AVAILABLE = "available",
  RESERVED = "reserved",
  OFFLINE = "offline",
  MAINTENANCE = "maintenance",
  UNHEALTHY = "unhealthy"
}

export enum NetworkCapability {
  WIFI = "wifi",
  ETHERNET = "ethernet",
  CELLULAR = "cellular",
  BLUETOOTH = "bluetooth",
  NFC = "nfc"
}

export interface Target {
  id: number;
  name: string;
  gateway_id?: string;
  device_type: string;
  ip_address?: string;
  serial_number?: string;
  android_version: string;
  api_level: number;
  manufacturer: string;
  model: string;
  
  // Location information
  location?: string;
  
  // Endpoint information
  adb_endpoint?: string;
  ssh_endpoint?: string;
  
  // Hardware specifications
  cpu_info?: Record<string, any>;
  gpu_info?: Record<string, any>;
  memory_mb?: number;
  storage_gb?: number;
  screen_size_inch?: number;
  screen_resolution?: string;
  
  // Network capabilities
  network_capabilities?: string[];
  
  // HAL support
  hal_support?: Record<string, any>;
  
  // Tags and purpose
  tags: string[];
  purpose: string[];
  
  // Status fields
  status: string;
  adb_status: boolean;
  serial_status: boolean;
  
  // Health check information
  health_check_timestamp?: string;
  health_check_status?: Record<string, any>;
  health_check_score?: number;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
  last_heartbeat: string;
  
  // Heartbeat configuration
  heartbeat_interval_seconds?: number;
  
  // Audit fields
  is_active: boolean;
  created_by?: number;
  updated_by?: number;
}

export interface TargetGroup {
  id: number;
  name: string;
  description?: string;
  target_ids: number[];
  created_at: string;
  updated_at?: string;
  created_by: number;
  is_active: boolean;
}

export interface TargetFilter {
  status?: string[];
  device_type?: string[];
  is_active?: boolean;
  tags?: string[];
  purpose?: string[];
  android_version?: string;
  api_level_min?: number;
  api_level_max?: number;
  manufacturer?: string;
  model?: string;
  location?: string;
  network_capabilities?: string[];
  health_score_min?: number;
  search?: string;
}
