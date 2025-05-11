// Gateway entity types

export interface Gateway {
  id: number;
  gateway_id: string;
  name: string;
  description?: string;
  gateway_type: 'STANDALONE' | 'CLUSTER' | 'EDGE';
  parent_gateway_id?: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'DEGRADED';
  hostname?: string;
  ip_address?: string;
  ssh_port?: number;
  api_port?: number;
  location?: string;
  region?: string;
  environment?: string;
  max_targets?: number;
  current_targets: number;
  max_concurrent_sessions?: number;
  current_sessions?: number;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  health_check_score?: number;
  health_check_details?: Record<string, any>;
  last_heartbeat?: string;
  tags?: string[];
  features?: string[];
  created_at: string;
  updated_at?: string;
  is_active: boolean;
}

export interface GatewayFormData {
  gateway_id: string;
  name: string;
  description?: string;
  gateway_type: string;
  parent_gateway_id?: string;
  hostname?: string;
  ip_address?: string;
  ssh_port?: number;
  api_port?: number;
  location?: string;
  region?: string;
  environment?: string;
  max_targets?: number;
  max_concurrent_sessions?: number;
  tags?: string[];
  features?: string[];
}

export interface GatewayStatistics {
  total_gateways: number;
  online_gateways: number;
  offline_gateways: number;
  maintenance_gateways: number;
  degraded_gateways: number;
  total_targets: number;
  connected_targets: number;
  total_sessions: number;
  gateway_types: Record<string, number>;
  regions: Record<string, number>;
  environments: Record<string, number>;
}

export interface GatewayAuditLog {
  id: number;
  gateway_id: string;
  action: string;
  user_id?: number;
  user_name?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface AssociatedTarget {
  target_id: number;
  target_name: string;
  gateway_id: string;
  association_timestamp?: string;
  association_status: string;
  association_details?: Record<string, any>;
  association_health?: number;
}

export interface TargetGatewayAssociation {
  id: number;
  target_id: number;
  gateway_id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;
  connection_details?: Record<string, any>;
  health_status?: number;
}
