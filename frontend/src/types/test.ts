export enum TestType {
  CUSTOM = "CUSTOM",
  INSTRUMENTATION = "INSTRUMENTATION",
  MONKEY = "MONKEY",
  UI_AUTOMATOR = "UI_AUTOMATOR",
  ESPRESSO = "ESPRESSO"
}

export enum TestStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  ERROR = "ERROR",
  CANCELLED = "CANCELLED"
}

export interface TestJob {
  id: string;
  user_id: number;
  target_id: number;
  artifact_id?: number;
  command: string;
  test_type: TestType;
  status: TestStatus;
  result_data: any;
  created_at: string;
  start_time?: string;
  end_time?: string;
}

export interface TestJobWithDetails extends TestJob {
  target_name?: string;
  artifact_filename?: string;
  user_username?: string;
}
