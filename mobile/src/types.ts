export type ThemeMode = "system" | "light" | "dark";
export type HomeMode = "running" | "feed";
export type AppTab = "home" | "feed" | "run" | "crew" | "profile";
export type RunGoalType = "open" | "distance" | "time";

export type UserProfile = {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  total_distance_m: number;
  is_private: boolean;
  experience_points: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  onboarding_completed: boolean;
  theme_mode: ThemeMode;
  default_home: HomeMode;
  weight_kg: number | null;
  voice_enabled: boolean;
  voice_mix_mode: "duck" | "mix";
  voice_distance_interval_m: number;
  voice_time_interval_min: number;
  voice_read_distance: boolean;
  voice_read_split_pace: boolean;
  voice_read_total_time: boolean;
  voice_read_goal_progress: boolean;
  voice_volume: number;
  voice_rate: number;
};

export type RunPoint = {
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  recorded_at: string;
  is_mocked: boolean;
};

export type RunSplit = {
  split_index: number;
  distance_m: number;
  duration_s: number;
  pace_s: number | null;
};

export type ActiveRun = {
  id: string;
  startedAt: string;
  goalType: RunGoalType;
  goalValue: number | null;
  distanceM: number;
  movingSeconds: number;
  pausedSeconds: number;
  manualPaused: boolean;
  autoPaused: boolean;
  voiceEnabled: boolean;
  lastVoiceDistanceM: number;
  lastVoiceMinute: number;
  splitStartDistanceM: number;
  splitStartMovingSeconds: number;
  groupRunId?: string | null;
};

export type TogetherRun = {
  id: string;
  host_id: string;
  title: string;
  session_code: string;
  max_members: number;
  status: "ready" | "running" | "finished" | "cancelled";
  synchronized_start_at: string | null;
  members?: string[];
};

export type TogetherLocation = {
  group_run_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  distance_m: number;
  elapsed_s: number;
  updated_at: string;
  handle?: string;
  avatar_url?: string | null;
};

export type RunRecord = {
  id: string;
  user_id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  distance_m: number;
  duration_s: number;
  moving_duration_s: number;
  paused_duration_s: number;
  average_pace_s: number | null;
  visibility: "public" | "friends" | "private";
  xp_earned: number;
  streak_day: number;
  route_image_url: string | null;
  goal_type: RunGoalType;
  goal_value: number | null;
  gps_quality: number | null;
  verified: boolean;
  route_visible: boolean;
  run_splits?: RunSplit[];
};

export type StudioLayer = {
  id: string;
  kind: "text" | "metric" | "sticker";
  text: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
  backgroundColor: string;
  opacity: number;
  fontSize: number;
  align: "left" | "center" | "right";
  shadow: boolean;
  border: boolean;
};
