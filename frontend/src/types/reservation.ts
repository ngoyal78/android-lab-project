export enum ReservationStatus {
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  EXPIRED = "expired"
}

export enum ReservationPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  CRITICAL = "critical"
}

export interface Reservation {
  id: number;
  user_id: number;
  target_id: number;
  policy_id?: number;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  priority: ReservationPriority;
  is_recurring: boolean;
  recurrence_pattern?: any;
  is_admin_override: boolean;
  override_reason?: string;
  created_at: string;
  updated_at?: string;
  last_accessed_at?: string;
}

export interface ReservationWithDetails extends Reservation {
  target_name: string;
  target_type: string;
  user_username: string;
}

export interface ReservationPolicy {
  id: number;
  name: string;
  description?: string;
  max_duration_minutes: number;
  cooldown_minutes: number;
  max_reservations_per_day: number;
  max_reservation_days_in_advance: number;
  priority_level: number;
  allowed_device_types?: string[];
  allowed_roles?: string[];
  auto_expire_enabled: boolean;
  auto_expire_minutes: number;
  notification_before_start_minutes: number;
  notification_before_end_minutes: number;
  created_at: string;
  updated_at?: string;
}

export interface ReservationSuggestion {
  target_id: number;
  target_name: string;
  device_type: string;
  start_time: string;
  end_time: string;
  reason: string;
  score: number;
}

export interface AvailabilityResponse {
  available: boolean;
  reason: string;
  conflicts: ReservationConflict[];
}

export interface ReservationConflict {
  id: number;
  user: string;
  start_time: string;
  end_time: string;
  priority: ReservationPriority;
  is_admin_override: boolean;
}
