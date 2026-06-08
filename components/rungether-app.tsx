"use client";

import type { User } from "@supabase/supabase-js";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleStop,
  Clock3,
  CircleHelp,
  Heart,
  Home,
  Info,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Pause,
  Play,
  Plus,
  Route,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { KakaoLoginButton } from "@/components/auth/kakao-login-button";
import {
  KakaoMap,
  type LocationStatus,
  type MapPoint,
  type SharedMapLocation
} from "@/components/kakao-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type View = "home" | "run" | "feed" | "friends" | "crew" | "chat" | "profile";
type Visibility = "public" | "friends" | "private";
type LocationShareScope = "everyone" | "followers" | "crew" | "selected";

type Profile = {
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
};

type FeedPost = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  likes: string[];
  media_urls: string[];
  run_id: string | null;
  visibility: Visibility;
  runs?: {
    average_pace_s: number | null;
    distance_m: number;
    duration_s: number;
    id: string;
    route_image_url: string | null;
    title: string | null;
    user_id: string;
    visibility: Visibility;
  } | null;
};

type RunRecord = {
  crew_id: string | null;
  id: string;
  user_id: string;
  title: string | null;
  distance_m: number;
  duration_s: number;
  average_pace_s?: number | null;
  route_image_url: string | null;
  started_at: string;
  visibility: Visibility;
  xp_earned: number;
  streak_day: number;
};

type FriendEdge = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
};

type FollowEdge = {
  follower_id: string;
  following_id: string;
  status: "pending" | "accepted";
};

type PostComment = {
  author_id: string;
  body: string;
  created_at: string;
  id: string;
  post_id: string;
};

type ChatMessage = {
  chat_id: string;
  id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
};

type DirectChat = {
  crewId: string | null;
  id: string;
  memberIds: string[];
  title: string | null;
};

type Story = {
  author_id: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  id: string;
  media_url: string;
};

type GroupRun = {
  crew_id: string | null;
  host_id: string;
  id: string;
  max_members: number;
  meeting_place: string;
  members: string[];
  starts_at: string;
  title: string;
};

type Crew = {
  description: string | null;
  experience_points: number;
  guest_default_hours: number;
  guest_recruiting: boolean;
  id: string;
  image_url: string | null;
  is_private: boolean;
  meeting_place: string | null;
  name: string;
  owner_id: string;
};

type CrewMember = {
  crew_id: string;
  joined_at: string;
  role: string;
  user_id: string;
};

type CrewContribution = {
  active: boolean;
  contribution_xp: number;
  crew_id: string;
  joined_at: string;
  left_at: string | null;
  user_id: string;
};

type CrewGuestPass = {
  contribution_xp: number;
  crew_id: string;
  ends_at: string;
  group_run_id: string | null;
  id: string;
  request_id: string | null;
  starts_at: string;
  status: "accepted" | "cancelled" | "expired";
  user_id: string;
};

type CrewGuestRequest = {
  crew_id: string;
  decided_at: string | null;
  ends_at: string | null;
  id: string;
  request_chat_id: string | null;
  requested_at: string;
  requester_id: string;
  starts_at: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

type CrewBlock = {
  blocked_by: string;
  created_at: string;
  crew_id: string;
  reason: string | null;
  user_id: string;
};

type CrewXpEvent = {
  crew_id: string;
  earned_at: string;
  source: "member" | "guest";
  user_id: string | null;
  xp: number;
};

type CrewMonthlyBenefit = {
  benefit_code: string;
  crew_id: string;
  rank: number;
  season_month: string;
  season_xp: number;
  valid_from: string;
  valid_until: string;
};

type LiveLocation = {
  crew_ids: string[];
  latitude: number;
  longitude: number;
  selected_user_ids: string[];
  updated_at: string;
  user_id: string;
  visibility_scope: LocationShareScope;
};

const sampleProfiles: Profile[] = [
  {
    id: "sample-runner",
    handle: "seoul.runner",
    display_name: "서울러너",
    bio: "한강을 달리는 저녁 러너",
    avatar_url: null,
    total_distance_m: 348200,
    is_private: false,
    experience_points: 3820,
    level: 9,
    current_streak: 4,
    longest_streak: 12,
    onboarding_completed: true
  },
  {
    id: "sample-crew",
    handle: "run.together",
    display_name: "런투게더 크루",
    bio: "누구나 함께 달릴 수 있는 러닝 크루",
    avatar_url: null,
    total_distance_m: 1204000,
    is_private: false,
    experience_points: 11240,
    level: 20,
    current_streak: 8,
    longest_streak: 24,
    onboarding_completed: true
  }
];
const fallbackPosts: FeedPost[] = [
  {
    id: "sample-1",
    author_id: "sample-runner",
    body: "한강 야간 러닝 7km 완료. 바람이 좋아서 마지막 1km는 페이스를 올렸어요.",
    created_at: "2026-06-07T04:40:00.000Z",
    likes: [],
    media_urls: [],
    run_id: null,
    visibility: "public"
  },
  {
    id: "sample-2",
    author_id: "sample-crew",
    body: "이번 일요일 오전 8시 여의나루역 2번 출구에서 초보자 환영 러닝을 진행합니다.",
    created_at: "2026-06-07T02:00:00.000Z",
    likes: [],
    media_urls: [],
    run_id: null,
    visibility: "public"
  }
];
const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "home", label: "홈", icon: Home },
  { id: "run", label: "러닝", icon: Activity },
  { id: "feed", label: "피드", icon: Heart },
  { id: "friends", label: "팔로우", icon: UserPlus },
  { id: "crew", label: "크루", icon: Users },
  { id: "chat", label: "채팅", icon: MessageCircle },
  { id: "profile", label: "마이", icon: UserRound }
];

function distanceBetween(a: MapPoint, b: MapPoint) {
  const radius = 6371000;
  const latitude = ((b.latitude - a.latitude) * Math.PI) / 180;
  const longitude = ((b.longitude - a.longitude) * Math.PI) / 180;
  const firstLatitude = (a.latitude * Math.PI) / 180;
  const secondLatitude = (b.latitude * Math.PI) / 180;
  const value =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitude / 2) ** 2;

  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .filter((_, index) => hours > 0 || index > 0)
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatDistance(distanceM: number) {
  return (distanceM / 1000).toFixed(2);
}

function experienceAtLevel(level: number) {
  const completedLevels = Math.max(0, Math.min(level, 100) - 1);
  return (completedLevels * (400 + (completedLevels - 1) * 50)) / 2;
}

function formatKoreanDateTime(value: string) {
  const date = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = String(hour % 12 || 12).padStart(2, "0");

  return `${month}월 ${day}일 ${period} ${displayHour}:${minute}`;
}

function toKoreanDateTimeLocal(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function nextKoreanHour() {
  const next = new Date();
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return toKoreanDateTimeLocal(next);
}

function maximumGuestEnd(startValue: string) {
  const startDate = startValue.slice(0, 10);
  const startDay = new Date(`${startDate}T00:00:00+09:00`);
  startDay.setUTCDate(startDay.getUTCDate() + 3);
  return toKoreanDateTimeLocal(startDay);
}

function koreanLocalToIso(value: string) {
  return new Date(`${value}:00+09:00`).toISOString();
}

function recentKoreanMonthOptions() {
  const now = new Date();
  const korean = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return [0, 1, 2].map((offset) => {
    const date = new Date(
      Date.UTC(korean.getUTCFullYear(), korean.getUTCMonth() - offset, 1)
    );
    const value = `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1
    ).padStart(2, "0")}`;
    return {
      label: `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월`,
      value
    };
  });
}

function koreanPeriodBounds(
  period: "day" | "week" | "month",
  anchorDate: string
) {
  const anchor = new Date(`${anchorDate}T00:00:00+09:00`);
  const korean = new Date(anchor.getTime() + 9 * 60 * 60 * 1000);
  const year = korean.getUTCFullYear();
  const month = korean.getUTCMonth();
  const day = korean.getUTCDate();
  let start = new Date(Date.UTC(year, month, day) - 9 * 60 * 60 * 1000);
  let end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  if (period === "week") {
    const weekday = korean.getUTCDay();
    const daysFromMonday = (weekday + 6) % 7;
    start = new Date(start.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
    end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    start = new Date(Date.UTC(year, month, 1) - 9 * 60 * 60 * 1000);
    end = new Date(Date.UTC(year, month + 1, 1) - 9 * 60 * 60 * 1000);
  }

  return { end: end.getTime(), start: start.getTime() };
}

async function createRouteShareImage(
  points: MapPoint[],
  distanceM: number,
  durationS: number,
  paceS: number | null
) {
  if (!points.length) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.fillStyle = "#101513";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,.06)";
  context.lineWidth = 2;
  for (let index = 0; index <= 12; index += 1) {
    const offset = 90 + index * 75;
    context.beginPath();
    context.moveTo(70, offset);
    context.lineTo(1010, offset);
    context.stroke();
    context.beginPath();
    context.moveTo(offset, 70);
    context.lineTo(offset, 1010);
    context.stroke();
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = Math.max(maxLatitude - minLatitude, 0.0004);
  const longitudeRange = Math.max(maxLongitude - minLongitude, 0.0004);
  const project = (point: MapPoint) => ({
    x: 130 + ((point.longitude - minLongitude) / longitudeRange) * 820,
    y: 950 - ((point.latitude - minLatitude) / latitudeRange) * 780
  });

  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#31e39b";
  context.shadowColor = "rgba(49,227,155,.4)";
  context.shadowBlur = 18;
  context.lineWidth = 18;
  context.beginPath();
  points.forEach((point, index) => {
    const projected = project(point);
    if (index === 0) {
      context.moveTo(projected.x, projected.y);
    } else {
      context.lineTo(projected.x, projected.y);
    }
  });
  context.stroke();
  context.shadowBlur = 0;

  const start = project(points[0]);
  const end = project(points.at(-1)!);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(start.x, start.y, 17, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#31e39b";
  context.beginPath();
  context.arc(end.x, end.y, 22, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "900 54px sans-serif";
  context.fillText("RUNGETHER", 72, 1090);
  context.fillStyle = "#8e9b96";
  context.font = "700 28px sans-serif";
  context.fillText("오늘의 러닝", 72, 1135);

  const metrics = [
    ["거리", `${formatDistance(distanceM)} km`],
    ["시간", formatDuration(durationS)],
    ["평균 페이스", paceS ? `${formatDuration(paceS)} /km` : "--:--"]
  ];
  metrics.forEach(([label, value], index) => {
    const x = 72 + index * 335;
    context.fillStyle = "#8e9b96";
    context.font = "700 23px sans-serif";
    context.fillText(label, x, 1215);
    context.fillStyle = "#ffffff";
    context.font = "900 38px sans-serif";
    context.fillText(value, x, 1270);
  });

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
}

export function RungetherApp() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [activeView, setActiveView] = useState<View>("home");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>(sampleProfiles);
  const [posts, setPosts] = useState<FeedPost[]>(fallbackPosts);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [friends, setFriends] = useState<FriendEdge[]>([]);
  const [follows, setFollows] = useState<FollowEdge[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [groupRuns, setGroupRuns] = useState<GroupRun[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [crewContributions, setCrewContributions] = useState<CrewContribution[]>([]);
  const [crewGuestPasses, setCrewGuestPasses] = useState<CrewGuestPass[]>([]);
  const [crewGuestRequests, setCrewGuestRequests] = useState<CrewGuestRequest[]>([]);
  const [crewBlocks, setCrewBlocks] = useState<CrewBlock[]>([]);
  const [crewXpEvents, setCrewXpEvents] = useState<CrewXpEvent[]>([]);
  const [crewMonthlyBenefits, setCrewMonthlyBenefits] = useState<
    CrewMonthlyBenefit[]
  >([]);
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [shareSettingsOpen, setShareSettingsOpen] = useState(false);
  const [locationShareScope, setLocationShareScope] =
    useState<LocationShareScope>("followers");
  const [selectedLocationUsers, setSelectedLocationUsers] = useState<string[]>([]);
  const [selectedLocationCrews, setSelectedLocationCrews] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shareRunId, setShareRunId] = useState("");
  const [openCrewChatId, setOpenCrewChatId] = useState("");
  const [openDirectChatId, setOpenDirectChatId] = useState("");
  const [runCrewId, setRunCrewId] = useState("");
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<MapPoint | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [routePoints, setRoutePoints] = useState<MapPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const locationRequestedRef = useRef(false);
  const lastRecordedPointRef = useRef<MapPoint | null>(null);
  const sharingLocationRef = useRef(false);
  const locationShareScopeRef = useRef<LocationShareScope>("followers");
  const selectedLocationUsersRef = useRef<string[]>([]);
  const selectedLocationCrewsRef = useRef<string[]>([]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const requestCurrentLocation = useCallback(
    (showError = true) =>
      new Promise<MapPoint | null>((resolve) => {
        if (!navigator.geolocation) {
          setLocationStatus("unavailable");
          if (showError) {
            showToast("이 기기에서는 위치 기능을 사용할 수 없습니다.");
          }
          resolve(null);
          return;
        }

        setLocationStatus("requesting");
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const point: MapPoint = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              recordedAt: new Date(position.timestamp).toISOString(),
              speedMps: position.coords.speed
            };
            setCurrentPosition(point);
            setLocationStatus("ready");
            resolve(point);
          },
          (error) => {
            setLocationStatus(
              error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"
            );
            if (showError) {
              showToast(
                error.code === error.PERMISSION_DENIED
                  ? "러닝 기록을 위해 브라우저 위치 권한을 허용해 주세요."
                  : "현재 위치를 가져오지 못했습니다."
              );
            }
            resolve(null);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000
          }
        );
      }),
    [showToast]
  );

  const loadAppData = useCallback(
    async (userId?: string) => {
      if (!supabase) {
        return;
      }

      const [
        profilesResult,
        postsResult,
        likesResult,
        runsResult,
        friendsResult,
        storiesResult,
        groupRunsResult,
        groupRunMembersResult,
        followsResult,
        commentsResult,
        crewsResult,
        crewMembersResult,
        crewContributionsResult,
        crewGuestPassesResult,
        crewGuestRequestsResult,
        crewBlocksResult,
        crewXpEventsResult,
        crewMonthlyBenefitsResult,
        liveLocationsResult
      ] =
        await Promise.all([
          (supabase.from("users") as any)
            .select("id,handle,display_name,bio,avatar_url,total_distance_m,is_private,experience_points,level,current_streak,longest_streak,onboarding_completed")
            .order("experience_points", { ascending: false })
            .limit(100),
          (supabase.from("posts") as any)
            .select("id,author_id,body,created_at,media_urls,run_id,visibility,runs(id,user_id,title,distance_m,duration_s,average_pace_s,route_image_url,visibility)")
            .order("created_at", { ascending: false })
            .limit(30),
          (supabase.from("likes") as any).select("post_id,user_id").limit(500),
          (supabase.from("runs") as any)
            .select("id,user_id,crew_id,title,distance_m,duration_s,average_pace_s,route_image_url,started_at,visibility,xp_earned,streak_day")
            .order("started_at", { ascending: false })
            .limit(80),
          userId
            ? (supabase.from("friends") as any)
                .select("id,requester_id,addressee_id,status")
                .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
            : Promise.resolve({ data: [] }),
          (supabase.from("stories") as any)
            .select("id,author_id,media_url,caption,created_at,expires_at")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(60),
          (supabase.from("group_runs") as any)
            .select("id,crew_id,host_id,title,meeting_place,starts_at,max_members")
            .gte("starts_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
            .order("starts_at", { ascending: true })
            .limit(30),
          (supabase.from("group_run_members") as any)
            .select("group_run_id,user_id")
            .limit(300),
          userId
            ? (supabase.from("follows") as any)
                .select("follower_id,following_id,status")
                .or(`follower_id.eq.${userId},following_id.eq.${userId}`)
            : Promise.resolve({ data: [] }),
          (supabase.from("comments") as any)
            .select("id,post_id,author_id,body,created_at")
            .order("created_at", { ascending: true })
            .limit(500),
          (supabase.from("crews") as any)
            .select("id,owner_id,name,description,is_private,meeting_place,image_url,experience_points,guest_recruiting,guest_default_hours")
            .order("experience_points", { ascending: false })
            .limit(500),
          (supabase.from("crew_members") as any)
            .select("crew_id,user_id,role,joined_at")
            .limit(500),
          (supabase.from("crew_contributions") as any)
            .select("crew_id,user_id,joined_at,left_at,contribution_xp,active")
            .order("contribution_xp", { ascending: false })
            .limit(1000),
          userId
            ? (supabase.from("crew_guest_passes") as any)
                .select("id,crew_id,user_id,group_run_id,request_id,starts_at,ends_at,status,contribution_xp")
                .or(`user_id.eq.${userId},status.eq.accepted`)
                .order("ends_at", { ascending: false })
                .limit(500)
            : Promise.resolve({ data: [] }),
          userId
            ? (supabase.from("crew_guest_requests") as any)
                .select("id,crew_id,requester_id,request_chat_id,status,requested_at,decided_at,starts_at,ends_at")
                .order("requested_at", { ascending: false })
                .limit(500)
            : Promise.resolve({ data: [] }),
          userId
            ? (supabase.from("crew_blocks") as any)
                .select("crew_id,user_id,blocked_by,reason,created_at")
                .limit(500)
            : Promise.resolve({ data: [] }),
          (supabase.from("crew_xp_events") as any)
            .select("crew_id,user_id,xp,source,earned_at")
            .gte(
              "earned_at",
              (() => {
                const oldestMonth = recentKoreanMonthOptions().at(-1)!.value;
                return new Date(`${oldestMonth}-01T00:00:00+09:00`).toISOString();
              })()
            )
            .order("earned_at", { ascending: false })
            .limit(10000),
          (supabase.from("crew_monthly_benefits") as any)
            .select("crew_id,season_month,rank,season_xp,benefit_code,valid_from,valid_until")
            .order("season_month", { ascending: false })
            .limit(60),
          userId
            ? (supabase.from("live_locations") as any)
                .select("user_id,latitude,longitude,updated_at,visibility_scope,selected_user_ids,crew_ids")
                .gt("sharing_until", new Date().toISOString())
            : Promise.resolve({ data: [] })
        ]);

      const loadedProfiles = (profilesResult.data ?? []) as Profile[];
      const loadedLikes = (likesResult.data ?? []) as Array<{
        post_id: string;
        user_id: string;
      }>;
      const loadedPosts = ((postsResult.data ?? []) as Omit<FeedPost, "likes">[]).map(
        (post) => ({
          ...post,
          likes: loadedLikes
            .filter((like) => like.post_id === post.id)
            .map((like) => like.user_id)
        })
      );

      if (loadedProfiles.length) {
        setProfiles([...loadedProfiles, ...sampleProfiles]);
      }
      if (loadedPosts.length) {
        setPosts(loadedPosts);
      }
      setRuns((runsResult.data ?? []) as RunRecord[]);
      setFriends((friendsResult.data ?? []) as FriendEdge[]);
      setFollows((followsResult.data ?? []) as FollowEdge[]);
      setComments((commentsResult.data ?? []) as PostComment[]);
      setStories((storiesResult.data ?? []) as Story[]);
      setCrews((crewsResult.data ?? []) as Crew[]);
      setCrewMembers((crewMembersResult.data ?? []) as CrewMember[]);
      setCrewContributions(
        (crewContributionsResult.data ?? []) as CrewContribution[]
      );
      setCrewGuestPasses((crewGuestPassesResult.data ?? []) as CrewGuestPass[]);
      setCrewGuestRequests(
        (crewGuestRequestsResult.data ?? []) as CrewGuestRequest[]
      );
      setCrewBlocks((crewBlocksResult.data ?? []) as CrewBlock[]);
      setCrewXpEvents((crewXpEventsResult.data ?? []) as CrewXpEvent[]);
      setCrewMonthlyBenefits(
        (crewMonthlyBenefitsResult.data ?? []) as CrewMonthlyBenefit[]
      );
      setLiveLocations((liveLocationsResult.data ?? []) as LiveLocation[]);
      const loadedMembers = (groupRunMembersResult.data ?? []) as Array<{
        group_run_id: string;
        user_id: string;
      }>;
      setGroupRuns(
        ((groupRunsResult.data ?? []) as Omit<GroupRun, "members">[]).map((run) => ({
          ...run,
          members: loadedMembers
            .filter((member) => member.group_run_id === run.id)
            .map((member) => member.user_id)
        }))
      );
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    async function syncSession(user: User | null) {
      if (!mounted) {
        return;
      }

      setAuthUser(user);

      if (!user) {
        setProfile(null);
        setAuthLoading(false);
        void loadAppData();
        return;
      }

      const { data } = await (supabase!.from("users") as any)
        .select("id,handle,display_name,bio,avatar_url,total_distance_m,is_private,experience_points,level,current_streak,longest_streak,onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (!data?.onboarding_completed) {
        router.replace("/onboarding");
        return;
      }

      setProfile(data as Profile);
      setAuthLoading(false);
      await (supabase as any).rpc("finalize_crew_monthly_season");
      void loadAppData(user.id);
    }

    void supabase.auth.getSession().then(({ data }) => syncSession(data.session?.user ?? null));
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadAppData, router, supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel("rungether-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => void loadAppData(authUser?.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => void loadAppData(authUser?.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows" },
        () => void loadAppData(authUser?.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_locations" },
        () => void loadAppData(authUser?.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crew_members" },
        () => void loadAppData(authUser?.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crew_guest_passes" },
        () => void loadAppData(authUser?.id)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crew_xp_events" },
        () => void loadAppData(authUser?.id)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authUser?.id, loadAppData, supabase]);

  useEffect(() => {
    if (!isRunning || isPaused) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPaused, isRunning]);

  useEffect(() => {
    if (
      authLoading ||
      !authUser ||
      !profile ||
      locationRequestedRef.current
    ) {
      return;
    }

    locationRequestedRef.current = true;
    void requestCurrentLocation(true);
  }, [authLoading, authUser, profile, requestCurrentLocation]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    sharingLocationRef.current = sharingLocation;
    locationShareScopeRef.current = locationShareScope;
    selectedLocationUsersRef.current = selectedLocationUsers;
    selectedLocationCrewsRef.current = selectedLocationCrews;
  }, [
    locationShareScope,
    selectedLocationCrews,
    selectedLocationUsers,
    sharingLocation
  ]);

  function requireLogin() {
    if (!authUser || !profile) {
      showToast("이 기능은 카카오 로그인 후 사용할 수 있습니다.");
      return false;
    }
    return true;
  }

  async function saveLiveLocation(point: MapPoint) {
    if (!supabase || !authUser) {
      return;
    }

    await (supabase.from("live_locations") as any).upsert({
      user_id: authUser.id,
      latitude: point.latitude,
      longitude: point.longitude,
      visibility_scope: locationShareScopeRef.current,
      selected_user_ids: selectedLocationUsersRef.current,
      crew_ids: selectedLocationCrewsRef.current,
      sharing_until: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  function clearPositionWatch() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  function watchRunPosition() {
    clearPositionWatch();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: MapPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          recordedAt: new Date(position.timestamp).toISOString(),
          speedMps: position.coords.speed
        };

        setCurrentPosition(point);
        setLocationStatus("ready");

        if (position.coords.accuracy > 80) {
          return;
        }

        const previous = lastRecordedPointRef.current;
        if (!previous) {
          lastRecordedPointRef.current = point;
          setRoutePoints([point]);
          return;
        }

        const addition = distanceBetween(previous, point);
        const previousTime = previous.recordedAt
          ? new Date(previous.recordedAt).getTime()
          : position.timestamp - 1000;
        const elapsed = Math.max(1, (position.timestamp - previousTime) / 1000);
        const calculatedSpeed = addition / elapsed;
        const noiseThreshold = Math.max(
          3,
          Math.min(previous.accuracy ?? 10, position.coords.accuracy) * 0.35
        );

        if (addition > 250 || calculatedSpeed > 12) {
          return;
        }

        lastRecordedPointRef.current = point;
        setRoutePoints((current) => [...current, point]);

        if (addition >= noiseThreshold) {
          setDistanceM((value) => value + addition);
        }

        if (sharingLocationRef.current) {
          void saveLiveLocation(point);
        }
      },
      (error) => {
        setLocationStatus(
          error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"
        );
        showToast(
          error.code === error.PERMISSION_DENIED
            ? "정확한 기록을 위해 위치 권한을 허용해 주세요."
            : "GPS 신호를 가져오지 못했습니다."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000
      }
    );
  }

  async function startRun() {
    if (!requireLogin() || countdown !== null || isRunning) {
      return;
    }

    const startPoint = currentPosition ?? (await requestCurrentLocation(true));
    if (!startPoint) {
      return;
    }

    for (const value of [3, 2, 1]) {
      setCountdown(value);
      await new Promise((resolve) => window.setTimeout(resolve, 850));
    }
    setCountdown(null);
    setDistanceM(0);
    setElapsedSeconds(0);
    setRoutePoints([startPoint]);
    lastRecordedPointRef.current = startPoint;
    setRunStartedAt(Date.now());
    setIsPaused(false);
    setIsRunning(true);
    watchRunPosition();
    showToast("GPS 러닝 기록을 시작했습니다.");
  }

  function pauseRun() {
    clearPositionWatch();
    setIsPaused(true);
    showToast("러닝 기록을 일시정지했습니다.");
  }

  function resumeRun() {
    setIsPaused(false);
    lastRecordedPointRef.current = currentPosition;
    watchRunPosition();
    showToast("러닝 기록을 다시 시작했습니다.");
  }

  async function stopRun() {
    if (!supabase || !authUser || !runStartedAt) {
      return;
    }

    clearPositionWatch();

    setIsRunning(false);
    setIsPaused(false);
    const endedAt = Date.now();
    const duration = Math.max(1, elapsedSeconds);
    const averagePace =
      distanceM > 0 ? Math.round(duration / (distanceM / 1000)) : null;
    const calories = Math.round((distanceM / 1000) * 62);
    let routeImageUrl: string | null = null;
    const routeImage = await createRouteShareImage(
      routePoints,
      distanceM,
      duration,
      averagePace
    );
    if (routeImage) {
      const routeImagePath = `${authUser.id}/runs/${Date.now()}.png`;
      const { error: routeImageError } = await supabase.storage
        .from("social-media")
        .upload(routeImagePath, routeImage, {
          cacheControl: "3600",
          contentType: "image/png",
          upsert: false
        });
      if (!routeImageError) {
        routeImageUrl = supabase.storage
          .from("social-media")
          .getPublicUrl(routeImagePath).data.publicUrl;
      }
    }
    const { data, error } = await (supabase.from("runs") as any)
      .insert({
        user_id: authUser.id,
        title: "오늘의 러닝",
        started_at: new Date(runStartedAt).toISOString(),
        ended_at: new Date(endedAt).toISOString(),
        distance_m: Math.round(distanceM),
        duration_s: duration,
        average_pace_s: averagePace,
        calories,
        crew_id: runCrewId || null,
        route_image_url: routeImageUrl,
        visibility: "friends"
      })
      .select("id,user_id,crew_id,title,distance_m,duration_s,average_pace_s,route_image_url,started_at,visibility,xp_earned,streak_day")
      .single();

    if (error) {
      showToast("러닝 저장에 실패했습니다. Supabase SQL 정책을 확인해 주세요.");
      return;
    }

    if (routePoints.length) {
      await (supabase.from("run_tracks") as any).insert(
        routePoints.map((point) => ({
          run_id: data.id,
          latitude: point.latitude,
          longitude: point.longitude,
          recorded_at: point.recordedAt ?? new Date().toISOString(),
          speed_mps: point.speedMps
        }))
      );
    }

    setRuns((current) => [data as RunRecord, ...current]);
    const { data: updatedProfile } = await (supabase.from("users") as any)
      .select("id,handle,display_name,bio,avatar_url,total_distance_m,is_private,experience_points,level,current_streak,longest_streak,onboarding_completed")
      .eq("id", authUser.id)
      .single();
    if (updatedProfile) {
      setProfile(updatedProfile as Profile);
    }
    showToast(
      `러닝 저장 완료 · +${Number(data.xp_earned ?? 0)} XP · ${Number(data.streak_day ?? 1)}일 연속`
    );
  }

  async function stopLocationSharing() {
    if (!requireLogin() || !supabase || !authUser) {
      return;
    }

    sharingLocationRef.current = false;
    setSharingLocation(false);
    await (supabase.from("live_locations") as any)
      .delete()
      .eq("user_id", authUser.id);
    showToast("실시간 위치 공유를 종료했습니다.");
  }

  async function startLocationSharing() {
    if (!requireLogin() || !supabase || !authUser) {
      return;
    }

    sharingLocationRef.current = true;
    locationShareScopeRef.current = locationShareScope;
    selectedLocationUsersRef.current = selectedLocationUsers;
    selectedLocationCrewsRef.current = selectedLocationCrews;
    const current = currentPosition ?? routePoints.at(-1);
    if (current) {
      await saveLiveLocation(current);
    }
    setSharingLocation(true);
    setShareSettingsOpen(false);
    showToast("선택한 대상에게 실시간 위치를 공유합니다.");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setActiveView("home");
    showToast("로그아웃했습니다.");
  }

  async function sendEmergencyReport() {
    if (!requireLogin() || !supabase || !authUser) {
      return;
    }

    const location = currentPosition ?? routePoints.at(-1);
    const { error } = await (supabase.from("emergency_reports") as any).insert({
      user_id: authUser.id,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      reason: "사용자 수동 SOS",
      notified_guardian: false
    });

    showToast(
      error
        ? "SOS 기록을 저장하지 못했습니다."
        : "SOS 요청을 기록했습니다. 긴급 상황이면 112 또는 119에 직접 연락하세요."
    );
  }

  function handleLocationShare() {
    if (sharingLocation) {
      void stopLocationSharing();
      return;
    }
    setShareSettingsOpen(true);
  }

  async function updateRunVisibility(runId: string, visibility: Visibility) {
    if (!supabase || !authUser) {
      return;
    }
    const { error } = await (supabase.from("runs") as any)
      .update({ visibility })
      .eq("id", runId)
      .eq("user_id", authUser.id);
    if (error) {
      showToast("러닝 공개 범위를 변경하지 못했습니다.");
      return;
    }
    setRuns((current) =>
      current.map((run) => (run.id === runId ? { ...run, visibility } : run))
    );
    showToast("러닝 공개 범위를 변경했습니다.");
  }

  async function togglePostLike(post: FeedPost) {
    if (!authUser || !supabase || post.id.startsWith("sample")) {
      showToast("실제 게시물의 좋아요는 로그인 후 사용할 수 있습니다.");
      return;
    }
    const liked = post.likes.includes(authUser.id);
    const query = supabase.from("likes") as any;
    const { error } = liked
      ? await query.delete().eq("post_id", post.id).eq("user_id", authUser.id)
      : await query.insert({ post_id: post.id, user_id: authUser.id });
    if (error) {
      showToast("좋아요를 반영하지 못했습니다.");
      return;
    }
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              likes: liked
                ? item.likes.filter((id) => id !== authUser.id)
                : [...item.likes, authUser.id]
            }
          : item
      )
    );
  }

  function shareRun(runId: string) {
    setShareRunId(runId);
    setActiveView("feed");
  }

  const currentPace =
    distanceM > 0 ? Math.round(elapsedSeconds / (distanceM / 1000)) : 0;
  const mapPoints = routePoints.length
    ? routePoints
    : currentPosition
      ? [currentPosition]
      : [];
  const sharedMapLocations: SharedMapLocation[] = liveLocations
    .filter((location) => location.user_id !== authUser?.id)
    .map((location) => {
      const owner = profiles.find((item) => item.id === location.user_id);
      return {
        avatarUrl: owner?.avatar_url,
        handle: owner?.handle ?? "runner",
        latitude: location.latitude,
        longitude: location.longitude,
        userId: location.user_id
      };
    });
  const currentTime = Date.now();
  const primaryCrewIds = new Set(
    crewMembers
      .filter((member) => member.user_id === authUser?.id)
      .map((member) => member.crew_id)
  );
  const activeGuestCrewIds = new Set(
    crewGuestPasses
      .filter(
        (pass) =>
          pass.user_id === authUser?.id &&
          pass.status === "accepted" &&
          new Date(pass.starts_at).getTime() <= currentTime &&
          new Date(pass.ends_at).getTime() > currentTime
      )
      .map((pass) => pass.crew_id)
  );
  const availableContributionCrews = crews.filter(
    (crew) => primaryCrewIds.has(crew.id) || activeGuestCrewIds.has(crew.id)
  );

  return (
    <main className="min-h-screen bg-surface pb-20 text-ink lg:pb-0">
      <AppHeader
        authLoading={authLoading}
        profile={profile}
        onChat={() => setActiveView("chat")}
        onProfile={() => setActiveView("profile")}
      />

      <div className="mx-auto grid w-full max-w-[1480px] gap-5 px-3 py-4 sm:px-5 lg:grid-cols-[72px_minmax(0,1fr)_330px] lg:px-6 lg:py-6">
        <DesktopNav activeView={activeView} onChange={setActiveView} />

        <div className="min-w-0">
          {activeView === "home" ? (
            <HomeView
              authUser={authUser}
              comments={comments}
              currentPace={currentPace}
              distanceM={distanceM}
              elapsedSeconds={elapsedSeconds}
              isPaused={isPaused}
              isRunning={isRunning}
              locationStatus={locationStatus}
              follows={follows}
              posts={posts}
              profiles={profiles}
              stories={stories}
              routePoints={mapPoints}
              sharedLocations={sharedMapLocations}
              runs={runs.filter((run) => run.user_id === authUser?.id)}
              sharingLocation={sharingLocation}
              availableCrews={availableContributionCrews}
              selectedCrewId={runCrewId}
              onCrewChange={setRunCrewId}
              onChangeView={setActiveView}
              onCommentsChange={setComments}
              onLocate={() => void requestCurrentLocation(true)}
              onLike={togglePostLike}
              onPause={pauseRun}
              onResume={resumeRun}
              onShare={handleLocationShare}
              onStart={startRun}
              onStop={stopRun}
              onStoriesChange={setStories}
              onToast={showToast}
            />
          ) : null}
          {activeView === "run" ? (
            <RunView
              currentPace={currentPace}
              distanceM={distanceM}
              elapsedSeconds={elapsedSeconds}
              isPaused={isPaused}
              isRunning={isRunning}
              locationStatus={locationStatus}
              routePoints={mapPoints}
              sharedLocations={sharedMapLocations}
              runs={runs.filter((run) => run.user_id === authUser?.id)}
              sharingLocation={sharingLocation}
              availableCrews={availableContributionCrews}
              selectedCrewId={runCrewId}
              onCrewChange={setRunCrewId}
              onLocate={() => void requestCurrentLocation(true)}
              onPause={pauseRun}
              onResume={resumeRun}
              onShare={handleLocationShare}
              onStart={startRun}
              onStop={stopRun}
              onShareRun={shareRun}
              onVisibilityChange={updateRunVisibility}
            />
          ) : null}
          {activeView === "feed" ? (
            <FeedView
              authUser={authUser}
              posts={posts}
              profiles={profiles}
              runs={runs}
              comments={comments}
              follows={follows}
              initialRunId={shareRunId}
              onCommentsChange={setComments}
              onPostsChange={setPosts}
              onLike={togglePostLike}
              onRunSelected={() => setShareRunId("")}
              onToast={showToast}
            />
          ) : null}
          {activeView === "friends" ? (
            <FollowView
              authUser={authUser}
              follows={follows}
              profiles={profiles}
              onFollowsChange={setFollows}
              onToast={showToast}
            />
          ) : null}
          {activeView === "crew" ? (
            <CrewView
              authUser={authUser}
              crewBlocks={crewBlocks}
              crewMembers={crewMembers}
              crewContributions={crewContributions}
              crewGuestPasses={crewGuestPasses}
              crewGuestRequests={crewGuestRequests}
              crewMonthlyBenefits={crewMonthlyBenefits}
              crewXpEvents={crewXpEvents}
              crews={crews}
              groupRuns={groupRuns}
              profiles={profiles}
              onCrewMembersChange={setCrewMembers}
              onCrewBlocksChange={setCrewBlocks}
              onCrewGuestPassesChange={setCrewGuestPasses}
              onCrewGuestRequestsChange={setCrewGuestRequests}
              onCrewsChange={setCrews}
              onGroupRunsChange={setGroupRuns}
              onOpenCrewChat={(crewId) => {
                setOpenCrewChatId(crewId);
                setActiveView("chat");
              }}
              onOpenRequestChat={(chatId) => {
                setOpenDirectChatId(chatId);
                setActiveView("chat");
              }}
              onToast={showToast}
            />
          ) : null}
          {activeView === "chat" ? (
            <ChatView
              authUser={authUser}
              crewBlocks={crewBlocks}
              crewMembers={crewMembers}
              crewGuestPasses={crewGuestPasses}
              crewGuestRequests={crewGuestRequests}
              crews={crews}
              initialCrewId={openCrewChatId}
              initialChatId={openDirectChatId}
              profiles={profiles}
              onCrewMembersChange={setCrewMembers}
              onCrewBlocksChange={setCrewBlocks}
              onCrewGuestPassesChange={setCrewGuestPasses}
              onCrewGuestRequestsChange={setCrewGuestRequests}
              onInitialCrewOpened={() => setOpenCrewChatId("")}
              onInitialChatOpened={() => setOpenDirectChatId("")}
              onToast={showToast}
            />
          ) : null}
          {activeView === "profile" ? (
            <ProfileView
              authUser={authUser}
              crewMembers={crewMembers}
              crews={crews}
              profiles={profiles}
              posts={posts}
              profile={profile}
              runs={runs.filter((run) => run.user_id === authUser?.id)}
              follows={follows}
              onEdit={() => router.push("/profile/edit")}
              onFollowers={() => setActiveView("friends")}
              onShareRun={shareRun}
              onSignOut={signOut}
              onVisibilityChange={updateRunVisibility}
            />
          ) : null}
        </div>

        <DesktopAside
          authUser={authUser}
          isRunning={isRunning}
          profile={profile}
          sharingLocation={sharingLocation}
          onChangeView={setActiveView}
          onEmergency={sendEmergencyReport}
          onShare={handleLocationShare}
        />
      </div>

      <MobileNav
        activeView={activeView}
        profile={profile}
        onChange={setActiveView}
      />

      {countdown !== null || isRunning ? (
        <ActiveRunScreen
          countdown={countdown}
          currentPace={currentPace}
          distanceM={distanceM}
          elapsedSeconds={elapsedSeconds}
          isPaused={isPaused}
          locationStatus={locationStatus}
          routePoints={mapPoints}
          sharedLocations={sharedMapLocations}
          sharingLocation={sharingLocation}
          availableCrews={availableContributionCrews}
          selectedCrewId={runCrewId}
          onCrewChange={setRunCrewId}
          onLocate={() => void requestCurrentLocation(true)}
          onPause={pauseRun}
          onResume={resumeRun}
          onShare={handleLocationShare}
          onStop={stopRun}
        />
      ) : null}

      {shareSettingsOpen ? (
        <LocationShareModal
          authUser={authUser}
          crewMembers={crewMembers}
          crews={crews}
          follows={follows}
          profiles={profiles}
          scope={locationShareScope}
          selectedCrews={selectedLocationCrews}
          selectedUsers={selectedLocationUsers}
          onClose={() => setShareSettingsOpen(false)}
          onConfirm={() => void startLocationSharing()}
          onScopeChange={setLocationShareScope}
          onSelectedCrewsChange={setSelectedLocationCrews}
          onSelectedUsersChange={setSelectedLocationUsers}
        />
      ) : null}

      {toast ? (
        <div
          className="fixed bottom-24 left-1/2 z-[100] w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 rounded-md bg-ink px-4 py-3 text-center text-sm font-bold text-white shadow-2xl lg:bottom-8"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function AppHeader({
  authLoading,
  profile,
  onChat,
  onProfile
}: {
  authLoading: boolean;
  profile: Profile | null;
  onChat: () => void;
  onProfile: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-3 px-4 sm:px-6">
        <div className="flex size-10 items-center justify-center rounded-md bg-ink text-white">
          <Route size={21} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black">RUNGETHER</h1>
          <p className="hidden text-xs font-bold text-muted sm:block">
            함께 달리고, 안전하게 연결되세요
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {profile ? (
            <Button
              aria-label="메시지"
              onClick={onChat}
              size="icon"
              title="메시지"
              variant="ghost"
            >
              <Send size={20} />
            </Button>
          ) : null}
          {authLoading ? (
            <div className="h-10 w-24 animate-pulse rounded-md bg-zinc-100" />
          ) : profile ? (
            <button
              className="flex h-10 items-center gap-2 rounded-md border border-border bg-white px-2.5 text-left hover:bg-zinc-50"
              onClick={onProfile}
              type="button"
            >
              <Avatar profile={profile} size="small" />
              <span className="hidden max-w-[150px] truncate text-sm font-black sm:block">
                @{profile.handle}
              </span>
            </button>
          ) : (
            <KakaoLoginButton compact />
          )}
        </div>
      </div>
    </header>
  );
}

function DesktopNav({
  activeView,
  onChange
}: {
  activeView: View;
  onChange: (view: View) => void;
}) {
  return (
    <nav className="hidden h-fit gap-2 rounded-md border border-border bg-white p-2 shadow-soft lg:grid">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            aria-label={item.label}
            className={cn(
              "grid size-12 place-items-center rounded-md transition",
              activeView === item.id
                ? "bg-ink text-white"
                : "text-muted hover:bg-zinc-100 hover:text-ink"
            )}
            key={item.id}
            onClick={() => onChange(item.id)}
            title={item.label}
            type="button"
          >
            <Icon size={21} />
          </button>
        );
      })}
    </nav>
  );
}

function MobileNav({
  activeView,
  profile,
  onChange
}: {
  activeView: View;
  profile: Profile | null;
  onChange: (view: View) => void;
}) {
  const mobileItems = navItems.filter((item) =>
    ["home", "feed", "run", "crew", "profile"].includes(item.id)
  );

  return (
    <nav className="fixed inset-x-0 bottom-3 z-50 px-4 pb-[max(0px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto grid h-[72px] max-w-[520px] grid-cols-5 items-center rounded-[34px] border border-white/10 bg-[#11161a]/95 p-1.5 shadow-2xl backdrop-blur">
        {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                aria-label={item.label}
                className={cn(
                  "grid h-[58px] place-items-center rounded-[27px] text-white transition-colors",
                  active ? "bg-white/20" : "text-zinc-300"
                )}
                key={item.id}
                onClick={() => onChange(item.id)}
                title={item.label}
                type="button"
              >
                {item.id === "profile" && profile ? (
                  <span className="rounded-full border-2 border-white/80">
                    <Avatar profile={profile} size="small" />
                  </span>
                ) : (
                  <Icon
                    fill={item.id === "home" && active ? "currentColor" : "none"}
                    size={25}
                    strokeWidth={2.25}
                  />
                )}
              </button>
            );
          })}
      </div>
    </nav>
  );
}

type RunConsoleProps = {
  availableCrews: Crew[];
  currentPace: number;
  distanceM: number;
  elapsedSeconds: number;
  isPaused: boolean;
  isRunning: boolean;
  locationStatus: LocationStatus;
  routePoints: MapPoint[];
  sharedLocations: SharedMapLocation[];
  sharingLocation: boolean;
  selectedCrewId: string;
  onCrewChange: (crewId: string) => void;
  onLocate: () => void;
  onPause: () => void;
  onResume: () => void;
  onShare: () => void;
  onStart: () => void;
  onStop: () => void;
};

function HomeView({
  authUser,
  comments,
  follows,
  posts,
  profiles,
  runs,
  stories,
  onChangeView,
  onCommentsChange,
  onLike,
  onStoriesChange,
  onToast,
  ...runProps
}: RunConsoleProps & {
  authUser: User | null;
  comments: PostComment[];
  follows: FollowEdge[];
  posts: FeedPost[];
  profiles: Profile[];
  runs: RunRecord[];
  stories: Story[];
  onChangeView: (view: View) => void;
  onCommentsChange: (comments: PostComment[]) => void;
  onLike: (post: FeedPost) => void;
  onStoriesChange: (stories: Story[]) => void;
  onToast: (message: string) => void;
}) {
  return (
    <div className="grid gap-5">
      {!authUser ? (
        <section className="border-y border-border bg-white px-5 py-5 sm:rounded-md sm:border">
          <Badge tone="green">RUNGETHER 시작하기</Badge>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">내 러닝을 기록하고 친구와 함께 달려요</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                로그인하면 GPS 기록, 피드, 친구, 채팅 데이터가 같은 계정으로 동기화됩니다.
              </p>
            </div>
            <KakaoLoginButton />
          </div>
        </section>
      ) : null}

      <StoryRail
        authUser={authUser}
        onStoriesChange={onStoriesChange}
        onToast={onToast}
        profiles={profiles}
        stories={stories}
      />

      <RunConsole {...runProps} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <FeedList
          authUser={authUser}
          comments={comments}
          follows={follows}
          posts={posts.slice(0, 3)}
          profiles={profiles}
          title="최근 러닝 피드"
          onCommentsChange={onCommentsChange}
          onLike={onLike}
          onMore={() => onChangeView("feed")}
          onToast={onToast}
        />
        <Card>
          <CardHeader>
            <div>
              <Badge tone="blue">이번 주</Badge>
              <CardTitle className="mt-3">러닝 리포트</CardTitle>
            </div>
            <BarChart3 className="text-primary" size={21} />
          </CardHeader>
          <CardContent className="grid gap-3">
            <StatRow
              icon={Route}
              label="누적 거리"
              value={`${formatDistance(runs.reduce((sum, run) => sum + Number(run.distance_m), 0))} km`}
            />
            <StatRow
              icon={Clock3}
              label="러닝 시간"
              value={formatDuration(
                runs.reduce((sum, run) => sum + Number(run.duration_s), 0)
              )}
            />
            <StatRow icon={Trophy} label="연속 기록" value={`${Math.min(runs.length, 7)}일`} />
          </CardContent>
        </Card>
      </div>

      <JourneyPanel />
    </div>
  );
}

function RunView(
  props: RunConsoleProps & {
    runs: RunRecord[];
    onShareRun: (runId: string) => void;
    onVisibilityChange: (runId: string, visibility: Visibility) => void;
  }
) {
  return (
    <div className="grid gap-5">
      <RunConsole {...props} />
      <Card>
        <CardHeader>
          <div>
            <Badge tone="neutral">기록</Badge>
            <CardTitle className="mt-3">최근 러닝</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {props.runs.length ? (
            props.runs.map((run) => (
              <RunRecordCard
                key={run.id}
                run={run}
                onShare={() => props.onShareRun(run.id)}
                onVisibilityChange={(visibility) =>
                  props.onVisibilityChange(run.id, visibility)
                }
              />
            ))
          ) : (
            <EmptyState
              icon={Activity}
              title="아직 저장된 러닝이 없습니다"
              description="러닝을 시작하고 종료하면 경로와 기록이 이곳에 저장됩니다."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StoryRail({
  authUser,
  onStoriesChange,
  onToast,
  profiles,
  stories
}: {
  authUser: User | null;
  onStoriesChange: (stories: Story[]) => void;
  onToast: (message: string) => void;
  profiles: Profile[];
  stories: Story[];
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadStory(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!authUser || !supabase || !file) {
      return;
    }

    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      onToast("스토리는 10MB 이하 이미지로 올려 주세요.");
      return;
    }

    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${authUser.id}/stories/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("social-media")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      setUploading(false);
      onToast("스토리 업로드에 실패했습니다. 최신 Supabase SQL을 실행해 주세요.");
      return;
    }

    const mediaUrl = supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl;
    const { data, error } = await (supabase.from("stories") as any)
      .insert({
        author_id: authUser.id,
        media_url: mediaUrl
      })
      .select("id,author_id,media_url,caption,created_at,expires_at")
      .single();
    setUploading(false);

    if (error) {
      onToast("스토리를 저장하지 못했습니다.");
      return;
    }

    onStoriesChange([data as Story, ...stories]);
    onToast("24시간 스토리를 공유했습니다.");
  }

  return (
    <>
      <section className="overflow-x-auto border-y border-border bg-white px-4 py-4 sm:rounded-md sm:border">
        <div className="flex min-w-max gap-4">
          <label className="grid w-16 cursor-pointer justify-items-center gap-2">
            <span className="relative grid size-14 place-items-center rounded-full border border-dashed border-primary bg-emerald-50 text-primary">
              {uploading ? <Activity className="animate-pulse" size={20} /> : <Camera size={20} />}
              <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-primary text-white ring-2 ring-white">
                <Plus size={13} />
              </span>
            </span>
            <span className="w-16 truncate text-center text-[11px] font-bold">
              내 스토리
            </span>
            <input
              accept="image/*"
              className="sr-only"
              disabled={!authUser || uploading}
              onChange={(event) => void uploadStory(event)}
              type="file"
            />
          </label>

          {stories.map((story) => {
            const author = profiles.find((item) => item.id === story.author_id);
            return (
              <button
                className="grid w-16 justify-items-center gap-2"
                key={story.id}
                onClick={() => setSelectedStory(story)}
                type="button"
              >
                <span className="rounded-full bg-gradient-to-br from-amber-400 via-rose-500 to-primary p-0.5">
                  <img
                    alt={`${author?.handle ?? "러너"} 스토리`}
                    className="size-[54px] rounded-full border-2 border-white object-cover"
                    src={story.media_url}
                  />
                </span>
                <span className="w-16 truncate text-center text-[11px] font-bold">
                  {author ? `@${author.handle}` : "러너"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedStory ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/95 p-4"
          role="dialog"
        >
          <button
            aria-label="스토리 닫기"
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white"
            onClick={() => setSelectedStory(null)}
            type="button"
          >
            <X size={22} />
          </button>
          <img
            alt="RUNGETHER 스토리"
            className="max-h-[88vh] max-w-full rounded-md object-contain"
            src={selectedStory.media_url}
          />
        </div>
      ) : null}
    </>
  );
}

function RunConsole({
  availableCrews,
  currentPace,
  distanceM,
  elapsedSeconds,
  isPaused,
  isRunning,
  locationStatus,
  routePoints,
  sharedLocations,
  sharingLocation,
  selectedCrewId,
  onCrewChange,
  onLocate,
  onPause,
  onResume,
  onShare,
  onStart,
  onStop
}: RunConsoleProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div>
          <Badge tone={isRunning ? (isPaused ? "orange" : "rose") : "green"}>
            {isPaused ? "일시정지" : isRunning ? "GPS 기록 중" : "러닝 준비"}
          </Badge>
          <CardTitle className="mt-3 text-xl">
            {isPaused
              ? "호흡을 정리하고 다시 시작하세요"
              : isRunning
                ? "지금의 페이스를 유지해 보세요"
                : "오늘의 러닝"}
          </CardTitle>
        </div>
        <Button onClick={onShare} size="sm" variant="secondary">
          <Send size={17} />
          {sharingLocation ? "공유 중" : "위치 공유"}
        </Button>
      </CardHeader>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <KakaoMap
          className="min-h-[52vh] rounded-none border-0 lg:min-h-[520px]"
          isPaused={isPaused}
          isRunning={isRunning}
          locationStatus={locationStatus}
          onLocate={onLocate}
          points={routePoints}
          sharedLocations={sharedLocations}
        />
        <div className="grid content-between gap-6 border-t border-black bg-ink p-5 text-white lg:border-l lg:border-t-0">
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            <Metric dark label="거리" value={formatDistance(distanceM)} unit="km" />
            <Metric dark label="시간" value={formatDuration(elapsedSeconds)} unit="" />
            <Metric
              dark
              label="평균 페이스"
              value={currentPace ? formatDuration(currentPace) : "--:--"}
              unit="/km"
            />
          </div>
          <div className="grid gap-3">
            {!isRunning && availableCrews.length ? (
              <label className="grid gap-1.5 text-xs font-bold text-zinc-300">
                경험치를 기여할 크루
                <select
                  className="h-11 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-bold text-white outline-none"
                  onChange={(event) => onCrewChange(event.target.value)}
                  value={selectedCrewId}
                >
                  <option className="text-ink" value="">
                    개인 러닝
                  </option>
                  {availableCrews.map((crew) => (
                    <option className="text-ink" key={crew.id} value={crew.id}>
                      {crew.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-3 text-sm font-bold text-zinc-200">
              <ShieldCheck size={18} />
              {sharingLocation
                ? "선택한 대상에게 현재 위치 공유 중"
                : "위치 공유는 선택 사항입니다"}
            </div>
            {isRunning ? (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button
                  className="h-14 text-base"
                  onClick={isPaused ? onResume : onPause}
                  variant="primary"
                >
                  {isPaused ? <Play size={21} /> : <Pause size={21} />}
                  {isPaused ? "계속 달리기" : "일시정지"}
                </Button>
                <Button
                  aria-label="러닝 종료 및 저장"
                  className="size-14 p-0"
                  onClick={onStop}
                  title="러닝 종료 및 저장"
                  variant="danger"
                >
                  <CircleStop size={22} />
                </Button>
              </div>
            ) : (
              <Button className="h-14 text-base" onClick={onStart} variant="primary">
                <Play size={21} />
                러닝 시작
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ActiveRunScreen({
  availableCrews,
  countdown,
  currentPace,
  distanceM,
  elapsedSeconds,
  isPaused,
  locationStatus,
  routePoints,
  sharedLocations,
  sharingLocation,
  selectedCrewId,
  onLocate,
  onPause,
  onResume,
  onShare,
  onStop
}: Omit<RunConsoleProps, "isRunning" | "onStart"> & {
  countdown: number | null;
}) {
  return (
    <section className="fixed inset-0 z-[160] bg-ink text-white">
      <KakaoMap
        className="absolute inset-0 min-h-screen rounded-none border-0"
        isPaused={isPaused}
        isRunning
        locationStatus={locationStatus}
        onLocate={onLocate}
        points={routePoints}
        sharedLocations={sharedLocations}
      />

      {countdown !== null ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/70">
          <div className="text-center">
            <p className="text-sm font-black tracking-[0.24em] text-emerald-300">
              READY
            </p>
            <p className="mt-2 text-[120px] font-black leading-none">{countdown}</p>
          </div>
        </div>
      ) : null}

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 pt-[max(16px,env(safe-area-inset-top))]">
        <span className="rounded-md bg-black/70 px-3 py-2 text-xs font-black backdrop-blur">
          {isPaused ? "일시정지" : "GPS 기록 중"}
          {" · "}
          {availableCrews.find((crew) => crew.id === selectedCrewId)?.name ??
            "개인 러닝"}
        </span>
        <Button
          className="border-white/20 bg-black/70 text-white"
          onClick={onShare}
          size="sm"
          variant="secondary"
        >
          <Send size={17} />
          {sharingLocation ? "공유 중" : "위치 공유"}
        </Button>
      </header>

      <div className="absolute inset-x-3 bottom-3 z-10 rounded-md bg-[#11161a]/96 p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur sm:left-1/2 sm:max-w-[680px] sm:-translate-x-1/2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <RunOverlayMetric label="거리" value={formatDistance(distanceM)} unit="km" />
          <RunOverlayMetric label="시간" value={formatDuration(elapsedSeconds)} />
          <RunOverlayMetric
            label="평균 페이스"
            value={currentPace ? formatDuration(currentPace) : "--:--"}
            unit="/km"
          />
        </div>
        <div className="mt-4 grid grid-cols-[1fr_64px] gap-3">
          <Button
            className="h-14 text-base"
            onClick={isPaused ? onResume : onPause}
          >
            {isPaused ? <Play size={22} /> : <Pause size={22} />}
            {isPaused ? "계속 달리기" : "일시정지"}
          </Button>
          <Button
            aria-label="러닝 종료"
            className="h-14 p-0"
            onClick={onStop}
            title="러닝 종료"
            variant="danger"
          >
            <CircleStop size={23} />
          </Button>
        </div>
      </div>
    </section>
  );
}

function RunOverlayMetric({
  label,
  unit,
  value
}: {
  label: string;
  unit?: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-zinc-400">{label}</p>
      <p className="mt-1 truncate text-xl font-black sm:text-2xl">
        {value}
        {unit ? <span className="ml-1 text-[11px] text-zinc-400">{unit}</span> : null}
      </p>
    </div>
  );
}

function LocationShareModal({
  authUser,
  crewMembers,
  crews,
  follows,
  profiles,
  scope,
  selectedCrews,
  selectedUsers,
  onClose,
  onConfirm,
  onScopeChange,
  onSelectedCrewsChange,
  onSelectedUsersChange
}: {
  authUser: User | null;
  crewMembers: CrewMember[];
  crews: Crew[];
  follows: FollowEdge[];
  profiles: Profile[];
  scope: LocationShareScope;
  selectedCrews: string[];
  selectedUsers: string[];
  onClose: () => void;
  onConfirm: () => void;
  onScopeChange: (scope: LocationShareScope) => void;
  onSelectedCrewsChange: (ids: string[]) => void;
  onSelectedUsersChange: (ids: string[]) => void;
}) {
  const relatedUserIds = new Set(
    follows
      .filter((follow) => follow.status === "accepted")
      .flatMap((follow) => [follow.follower_id, follow.following_id])
      .filter((id) => id !== authUser?.id)
  );
  const availableUsers = profiles.filter((candidate) =>
    relatedUserIds.has(candidate.id)
  );
  const myCrewIds = new Set(
    crewMembers
      .filter((member) => member.user_id === authUser?.id)
      .map((member) => member.crew_id)
  );
  const myCrews = crews.filter((crew) => myCrewIds.has(crew.id));

  function toggleUser(id: string) {
    onSelectedUsersChange(
      selectedUsers.includes(id)
        ? selectedUsers.filter((item) => item !== id)
        : [...selectedUsers, id]
    );
  }

  function toggleCrew(id: string) {
    onSelectedCrewsChange(
      selectedCrews.includes(id)
        ? selectedCrews.filter((item) => item !== id)
        : [...selectedCrews, id]
    );
  }

  const canConfirm =
    scope === "everyone" ||
    scope === "followers" ||
    (scope === "selected" && selectedUsers.length > 0) ||
    (scope === "crew" && selectedCrews.length > 0);

  return (
    <div className="fixed inset-0 z-[190] flex items-end bg-black/60 sm:items-center sm:justify-center">
      <button
        aria-label="위치 공유 설정 닫기"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-[520px] sm:rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-black">위치 공유 대상</p>
            <p className="mt-1 text-xs font-semibold text-muted">
              공유는 2시간 뒤 자동으로 종료됩니다.
            </p>
          </div>
          <Button
            aria-label="닫기"
            onClick={onClose}
            size="icon"
            title="닫기"
            variant="ghost"
          >
            <X size={20} />
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {([
            ["followers", "친구", "서로 팔로우 중인 사람"],
            ["selected", "특정 친구", "직접 선택한 사람"],
            ["crew", "러닝크루원", "선택한 크루의 멤버"],
            ["everyone", "모두에게", "로그인한 모든 러너"]
          ] as const).map(([value, label, description]) => (
            <button
              className={cn(
                "min-h-20 rounded-md border p-3 text-left",
                scope === value
                  ? "border-primary bg-emerald-50"
                  : "border-border bg-white"
              )}
              key={value}
              onClick={() => onScopeChange(value)}
              type="button"
            >
              <p className="text-sm font-black">{label}</p>
              <p className="mt-1 text-[11px] font-semibold leading-4 text-muted">
                {description}
              </p>
            </button>
          ))}
        </div>

        {scope === "selected" ? (
          <div className="mt-4 grid max-h-56 gap-1 overflow-y-auto border-t border-border pt-3">
            {availableUsers.map((candidate) => (
              <label
                className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-zinc-50"
                key={candidate.id}
              >
                <input
                  checked={selectedUsers.includes(candidate.id)}
                  onChange={() => toggleUser(candidate.id)}
                  type="checkbox"
                />
                <Avatar profile={candidate} size="small" />
                <span className="text-sm font-black">@{candidate.handle}</span>
              </label>
            ))}
          </div>
        ) : null}

        {scope === "crew" ? (
          <div className="mt-4 grid gap-1 border-t border-border pt-3">
            {myCrews.map((crew) => (
              <label
                className="flex cursor-pointer items-center gap-3 rounded-md p-3 hover:bg-zinc-50"
                key={crew.id}
              >
                <input
                  checked={selectedCrews.includes(crew.id)}
                  onChange={() => toggleCrew(crew.id)}
                  type="checkbox"
                />
                <Building2 className="text-primary" size={19} />
                <span className="text-sm font-black">{crew.name}</span>
              </label>
            ))}
          </div>
        ) : null}

        <Button
          className="mt-5 w-full"
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          <Navigation size={18} />
          이 대상으로 위치 공유
        </Button>
      </section>
    </div>
  );
}

function FeedView({
  authUser,
  comments,
  follows,
  initialRunId,
  posts,
  profiles,
  runs,
  onCommentsChange,
  onLike,
  onPostsChange,
  onRunSelected,
  onToast
}: {
  authUser: User | null;
  comments: PostComment[];
  follows: FollowEdge[];
  initialRunId: string;
  posts: FeedPost[];
  profiles: Profile[];
  runs: RunRecord[];
  onCommentsChange: (comments: PostComment[]) => void;
  onLike: (post: FeedPost) => void;
  onPostsChange: (posts: FeedPost[]) => void;
  onRunSelected: () => void;
  onToast: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [body, setBody] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("friends");
  const [submitting, setSubmitting] = useState(false);
  const myRuns = runs.filter((run) => run.user_id === authUser?.id);
  const followingIds = new Set(
    follows
      .filter(
        (follow) =>
          follow.follower_id === authUser?.id && follow.status === "accepted"
      )
      .map((follow) => follow.following_id)
  );
  const followingRuns = runs.filter(
    (run) => run.user_id !== authUser?.id && followingIds.has(run.user_id)
  );
  const selectedRun = myRuns.find((run) => run.id === selectedRunId);

  useEffect(() => {
    if (initialRunId) {
      setSelectedRunId(initialRunId);
      onRunSelected();
    }
  }, [initialRunId, onRunSelected]);

  useEffect(() => {
    return () => {
      if (mediaPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);

  function selectPostImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      onToast("게시물 사진은 10MB 이하 이미지로 선택해 주세요.");
      return;
    }

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authUser) {
      onToast("게시물 작성은 로그인 후 사용할 수 있습니다.");
      return;
    }

    const normalized = body.trim();
    if ((!normalized && !selectedRunId && !mediaFile) || !supabase) {
      return;
    }

    setSubmitting(true);
    let mediaUrls: string[] = [];

    if (mediaFile) {
      const extension = mediaFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${authUser.id}/posts/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("social-media")
        .upload(path, mediaFile, {
          cacheControl: "3600",
          contentType: mediaFile.type,
          upsert: false
        });

      if (uploadError) {
        setSubmitting(false);
        onToast("사진 업로드에 실패했습니다. 최신 Supabase SQL을 실행해 주세요.");
        return;
      }

      mediaUrls = [
        supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl
      ];
    }

    const { data, error } = await (supabase.from("posts") as any)
      .insert({
        author_id: authUser.id,
        body: normalized || (selectedRunId ? "오늘의 러닝을 완료했습니다." : ""),
        media_urls: mediaUrls,
        run_id: selectedRunId || null,
        visibility
      })
      .select("id,author_id,body,created_at,media_urls,run_id,visibility,runs(id,user_id,title,distance_m,duration_s,average_pace_s,route_image_url,visibility)")
      .single();
    setSubmitting(false);

    if (error) {
      onToast("게시물 저장에 실패했습니다. Supabase SQL을 다시 실행해 주세요.");
      return;
    }

    onPostsChange([{ ...data, likes: [] } as FeedPost, ...posts]);
    setBody("");
    setMediaFile(null);
    setMediaPreview(null);
    setSelectedRunId("");
    onToast("러닝 피드에 게시했습니다.");
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div>
            <Badge tone="orange">새 게시물</Badge>
            <CardTitle className="mt-3">오늘의 러닝을 공유하세요</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={createPost}>
            {mediaPreview ? (
              <div className="relative overflow-hidden rounded-md bg-zinc-100">
                <img
                  alt="게시물 사진 미리보기"
                  className="max-h-[520px] w-full object-cover"
                  src={mediaPreview}
                />
                <button
                  aria-label="선택한 사진 삭제"
                  className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/65 text-white"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                  }}
                  title="선택한 사진 삭제"
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="h-11 rounded-md border border-border bg-white px-3 text-sm font-bold outline-none focus:border-primary"
                onChange={(event) => setSelectedRunId(event.target.value)}
                value={selectedRunId}
              >
                <option value="">러닝 기록 첨부 안 함</option>
                {myRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {formatDistance(run.distance_m)}km · {formatDuration(run.duration_s)}
                  </option>
                ))}
              </select>
              <select
                aria-label="게시물 공개 범위"
                className="h-11 rounded-md border border-border bg-white px-3 text-sm font-bold outline-none focus:border-primary"
                onChange={(event) =>
                  setVisibility(event.target.value as Visibility)
                }
                value={visibility}
              >
                <option value="public">전체 공개</option>
                <option value="friends">팔로워 공개</option>
                <option value="private">나만 보기</option>
              </select>
            </div>
            {selectedRun?.route_image_url ? (
              <div className="overflow-hidden rounded-md border border-border bg-ink">
                <img
                  alt="선택한 러닝 경로"
                  className="max-h-[480px] w-full object-cover"
                  src={selectedRun.route_image_url}
                />
              </div>
            ) : null}
            <textarea
              className="min-h-28 w-full resize-y rounded-md border border-border bg-white p-3 text-sm font-semibold outline-none focus:border-primary"
              maxLength={500}
              onChange={(event) => setBody(event.target.value)}
              placeholder="러닝 기록, 크루 모집, 코스 후기를 남겨보세요."
              value={body}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="grid size-10 cursor-pointer place-items-center rounded-md border border-border bg-white text-ink hover:bg-zinc-50">
                  <Camera size={19} />
                  <span className="sr-only">게시물 사진 선택</span>
                  <input
                    accept="image/*"
                    className="sr-only"
                    disabled={submitting}
                    onChange={selectPostImage}
                    type="file"
                  />
                </label>
                <span className="text-xs font-semibold text-muted">{body.length}/500</span>
              </div>
              <Button
                disabled={submitting || (!body.trim() && !selectedRunId && !mediaFile)}
                type="submit"
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <Send size={17} />
                )}
                게시하기
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <FeedList
        authUser={authUser}
        comments={comments}
        follows={follows}
        posts={posts}
        profiles={profiles}
        title="러닝 피드"
        onCommentsChange={onCommentsChange}
        onLike={onLike}
        onToast={onToast}
      />

      {followingRuns.length ? (
        <Card>
          <CardHeader>
            <div>
              <Badge tone="green">팔로잉 러닝</Badge>
              <CardTitle className="mt-3">팔로잉한 러너의 최근 기록</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {followingRuns.slice(0, 12).map((run) => (
              <CommunityRunCard
                key={run.id}
                profile={profiles.find((item) => item.id === run.user_id)}
                run={run}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function CommunityRunCard({
  profile,
  run
}: {
  profile?: Profile;
  run: RunRecord;
}) {
  return (
    <article className="border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex items-center gap-3">
        <Avatar profile={profile} size="small" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">
            @{profile?.handle ?? "runner"}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {formatKoreanDateTime(run.started_at)}
          </p>
        </div>
        <Badge tone="neutral">
          {run.visibility === "public" ? "전체 공개" : "팔로워 공개"}
        </Badge>
      </div>
      {run.route_image_url ? (
        <img
          alt={`${profile?.handle ?? "러너"}님의 러닝 경로`}
          className="mt-3 max-h-[520px] w-full rounded-md bg-ink object-cover"
          src={run.route_image_url}
        />
      ) : null}
      <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
        <RunPostMetric
          label="거리"
          value={`${formatDistance(run.distance_m)} km`}
        />
        <RunPostMetric label="시간" value={formatDuration(run.duration_s)} />
        <RunPostMetric
          label="연속 러닝"
          value={`${Number(run.streak_day || 1)}일`}
        />
      </div>
    </article>
  );
}

function FeedList({
  authUser,
  comments = [],
  follows = [],
  posts,
  profiles,
  title,
  onCommentsChange,
  onLike,
  onMore,
  onToast
}: {
  authUser?: User | null;
  comments?: PostComment[];
  follows?: FollowEdge[];
  posts: FeedPost[];
  profiles: Profile[];
  title: string;
  onCommentsChange?: (comments: PostComment[]) => void;
  onLike?: (post: FeedPost) => void;
  onMore?: () => void;
  onToast?: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [commentBody, setCommentBody] = useState("");

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authUser || !selectedPost || !supabase || !commentBody.trim()) {
      return;
    }

    const { data, error } = await (supabase.from("comments") as any)
      .insert({
        author_id: authUser.id,
        body: commentBody.trim(),
        post_id: selectedPost.id
      })
      .select("id,post_id,author_id,body,created_at")
      .single();
    if (error) {
      onToast?.("댓글을 등록하지 못했습니다.");
      return;
    }
    onCommentsChange?.([...comments, data as PostComment]);
    setCommentBody("");
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <Badge tone="orange">SNS</Badge>
            <CardTitle className="mt-3">{title}</CardTitle>
          </div>
          {onMore ? (
            <Button onClick={onMore} size="sm" variant="ghost">
              더 보기
              <ChevronRight size={17} />
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3">
        {posts.map((post) => {
          const author =
            profiles.find((item) => item.id === post.author_id) ?? sampleProfiles[0];
          const liked = authUser ? post.likes.includes(authUser.id) : false;
          const postComments = comments.filter(
            (comment) => comment.post_id === post.id
          );
          const following = follows.some(
            (follow) =>
              follow.follower_id === authUser?.id &&
              follow.following_id === author.id &&
              follow.status === "accepted"
          );

          return (
            <article
              className="border-b border-border py-4 first:pt-0 last:border-0 last:pb-0"
              key={post.id}
            >
              <div className="flex items-center gap-3">
                <Avatar profile={author} size="small" />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-black">
                    @{author.handle}
                    {following ? (
                      <span className="text-[10px] font-bold text-primary">팔로잉</span>
                    ) : null}
                    {author.is_private ? <Lock size={12} /> : null}
                  </p>
                  <p className="text-xs font-semibold text-muted">
                    {formatKoreanDateTime(post.created_at)}
                  </p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6">
                {post.body}
              </p>
              {post.media_urls?.length ? (
                <div className="mt-3 overflow-hidden rounded-md bg-zinc-100">
                  <img
                    alt={`${author.handle}님의 게시물`}
                    className="max-h-[720px] w-full object-cover"
                    src={post.media_urls[0]}
                  />
                </div>
              ) : null}
              {post.runs?.route_image_url ? (
                <div className="mt-3 overflow-hidden rounded-md bg-ink">
                  <img
                    alt={`${author.handle}님의 러닝 경로`}
                    className="max-h-[720px] w-full object-cover"
                    src={post.runs.route_image_url}
                  />
                </div>
              ) : null}
              {post.runs ? (
                <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
                  <RunPostMetric
                    label="거리"
                    value={`${formatDistance(post.runs.distance_m)} km`}
                  />
                  <RunPostMetric
                    label="시간"
                    value={formatDuration(post.runs.duration_s)}
                  />
                  <RunPostMetric
                    label="페이스"
                    value={
                      post.runs.average_pace_s
                        ? `${formatDuration(post.runs.average_pace_s)} /km`
                        : "--:--"
                    }
                  />
                </div>
              ) : null}
              <div className="mt-3 flex items-center gap-1">
                <button
                  aria-label="좋아요"
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-bold",
                    liked ? "text-rose-600" : "text-muted"
                  )}
                  onClick={() => onLike?.(post)}
                  type="button"
                >
                  <Heart fill={liked ? "currentColor" : "none"} size={21} />
                  {post.likes.length}
                </button>
                <button
                  aria-label="댓글"
                  className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-bold text-muted"
                  onClick={() => setSelectedPost(post)}
                  type="button"
                >
                  <MessageCircle size={21} />
                  {postComments.length}
                </button>
                <button
                  aria-label="메시지로 공유"
                  className="grid size-10 place-items-center rounded-md text-muted"
                  onClick={() => onToast?.("DM에서 게시물을 공유할 대화를 선택해 주세요.")}
                  type="button"
                >
                  <Send size={21} />
                </button>
                {post.visibility !== "public" ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-muted">
                    <Lock size={13} />
                    {post.visibility === "private" ? "나만 보기" : "팔로워"}
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}
        </CardContent>
      </Card>

      {selectedPost ? (
        <div className="fixed inset-0 z-[180] flex items-end bg-black/55 sm:items-center sm:justify-center">
          <button
            aria-label="댓글 닫기"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedPost(null)}
            type="button"
          />
          <section className="relative z-10 flex max-h-[82vh] w-full flex-col rounded-t-2xl bg-[#11161a] text-white sm:max-w-[560px] sm:rounded-md">
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-zinc-500" />
            <header className="border-b border-white/10 px-5 py-4 text-center text-base font-black">
              댓글
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {comments
                .filter((comment) => comment.post_id === selectedPost.id)
                .map((comment) => {
                  const author = profiles.find(
                    (candidate) => candidate.id === comment.author_id
                  );
                  return (
                    <div className="flex gap-3 py-3" key={comment.id}>
                      <Avatar profile={author} size="small" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black">
                          @{author?.handle ?? "runner"}
                          <span className="ml-2 text-xs font-semibold text-zinc-500">
                            {formatKoreanDateTime(comment.created_at)}
                          </span>
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-zinc-200">
                          {comment.body}
                        </p>
                      </div>
                      <Heart className="mt-1 text-zinc-500" size={17} />
                    </div>
                  );
                })}
              {!comments.some((comment) => comment.post_id === selectedPost.id) ? (
                <p className="py-12 text-center text-sm font-bold text-zinc-500">
                  첫 댓글을 남겨보세요.
                </p>
              ) : null}
            </div>
            <form
              className="grid grid-cols-[1fr_auto] gap-2 border-t border-white/10 p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
              onSubmit={addComment}
            >
              <input
                className="h-12 min-w-0 rounded-full border border-white/15 bg-transparent px-4 text-sm font-semibold outline-none focus:border-white/40"
                maxLength={300}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="댓글 추가..."
                value={commentBody}
              />
              <Button
                aria-label="댓글 게시"
                disabled={!commentBody.trim()}
                size="icon"
                title="댓글 게시"
                type="submit"
              >
                <Send size={18} />
              </Button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function RunPostMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-zinc-50 p-3 text-center">
      <p className="text-[11px] font-bold text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function FriendsView({
  authUser,
  friends,
  groupRuns,
  profiles,
  onFriendsChange,
  onGroupRunsChange,
  onToast
}: {
  authUser: User | null;
  friends: FriendEdge[];
  groupRuns: GroupRun[];
  profiles: Profile[];
  onFriendsChange: (friends: FriendEdge[]) => void;
  onGroupRunsChange: (groupRuns: GroupRun[]) => void;
  onToast: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [query, setQuery] = useState("");
  const [showGroupRunForm, setShowGroupRunForm] = useState(false);
  const [groupRunTitle, setGroupRunTitle] = useState("");
  const [meetingPlace, setMeetingPlace] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [maxMembers, setMaxMembers] = useState(10);
  const [groupRunSubmitting, setGroupRunSubmitting] = useState(false);
  const results = query.trim()
    ? profiles
        .filter(
          (item) =>
            item.id !== authUser?.id &&
            item.handle.toLowerCase().includes(query.trim().toLowerCase())
        )
        .slice(0, 8)
    : [];

  async function createGroupRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authUser || !supabase) {
      onToast("함께 달리기를 만들려면 로그인이 필요합니다.");
      return;
    }

    if (!groupRunTitle.trim() || !meetingPlace.trim() || !startsAt) {
      onToast("러닝 이름, 만날 장소, 시작 시간을 모두 입력해 주세요.");
      return;
    }

    setGroupRunSubmitting(true);
    const { data, error } = await (supabase.from("group_runs") as any)
      .insert({
        host_id: authUser.id,
        title: groupRunTitle.trim(),
        meeting_place: meetingPlace.trim(),
        starts_at: new Date(startsAt).toISOString(),
        max_members: maxMembers
      })
      .select("id,host_id,title,meeting_place,starts_at,max_members")
      .single();

    if (error) {
      setGroupRunSubmitting(false);
      onToast("함께 달리기를 만들지 못했습니다. 최신 Supabase SQL을 실행해 주세요.");
      return;
    }

    const { error: memberError } = await (supabase.from("group_run_members") as any)
      .insert({ group_run_id: data.id, user_id: authUser.id });
    setGroupRunSubmitting(false);

    if (memberError) {
      await (supabase.from("group_runs") as any).delete().eq("id", data.id);
      onToast("참가자 등록에 실패했습니다.");
      return;
    }

    onGroupRunsChange([
      { ...(data as Omit<GroupRun, "members">), members: [authUser.id] },
      ...groupRuns
    ]);
    setGroupRunTitle("");
    setMeetingPlace("");
    setStartsAt("");
    setMaxMembers(10);
    setShowGroupRunForm(false);
    onToast("함께 달리기를 만들었습니다.");
  }

  async function toggleGroupRunMembership(groupRun: GroupRun) {
    if (!authUser || !supabase) {
      onToast("참가하려면 로그인이 필요합니다.");
      return;
    }

    const joined = groupRun.members.includes(authUser.id);
    if (!joined && groupRun.members.length >= groupRun.max_members) {
      onToast("모집 인원이 모두 찼습니다.");
      return;
    }

    const query = supabase.from("group_run_members") as any;
    const { error } = joined
      ? await query
          .delete()
          .eq("group_run_id", groupRun.id)
          .eq("user_id", authUser.id)
      : await query.insert({
          group_run_id: groupRun.id,
          user_id: authUser.id
        });

    if (error) {
      onToast(joined ? "참가 취소에 실패했습니다." : "참가 신청에 실패했습니다.");
      return;
    }

    onGroupRunsChange(
      groupRuns.map((item) =>
        item.id === groupRun.id
          ? {
              ...item,
              members: joined
                ? item.members.filter((id) => id !== authUser.id)
                : [...item.members, authUser.id]
            }
          : item
      )
    );
    onToast(joined ? "참가를 취소했습니다." : "함께 달리기에 참가했습니다.");
  }

  async function deleteGroupRun(groupRun: GroupRun) {
    if (!authUser || !supabase || groupRun.host_id !== authUser.id) {
      return;
    }

    const { error } = await (supabase.from("group_runs") as any)
      .delete()
      .eq("id", groupRun.id);

    if (error) {
      onToast("함께 달리기를 삭제하지 못했습니다.");
      return;
    }

    onGroupRunsChange(groupRuns.filter((item) => item.id !== groupRun.id));
    onToast("함께 달리기를 삭제했습니다.");
  }

  async function requestFriend(target: Profile) {
    if (!authUser || !supabase || target.id.startsWith("sample")) {
      onToast("실제 회원 검색과 친구 추가는 로그인 후 사용할 수 있습니다.");
      return;
    }

    if (
      friends.some(
        (item) =>
          item.requester_id === target.id || item.addressee_id === target.id
      )
    ) {
      onToast("이미 친구 요청 또는 연결이 있습니다.");
      return;
    }

    const { data, error } = await (supabase.from("friends") as any)
      .insert({
        requester_id: authUser.id,
        addressee_id: target.id,
        status: "pending"
      })
      .select("id,requester_id,addressee_id,status")
      .single();

    if (error) {
      onToast("친구 요청을 보내지 못했습니다.");
      return;
    }

    onFriendsChange([data as FriendEdge, ...friends]);
    onToast(`@${target.handle}님에게 친구 요청을 보냈습니다.`);
  }

  async function acceptFriend(edge: FriendEdge) {
    if (!authUser || !supabase || edge.addressee_id !== authUser.id) {
      return;
    }

    const { error } = await (supabase.from("friends") as any)
      .update({ status: "accepted" })
      .eq("id", edge.id);

    if (!error) {
      onFriendsChange(
        friends.map((item) =>
          item.id === edge.id ? { ...item, status: "accepted" } : item
        )
      );
      onToast("친구 요청을 수락했습니다.");
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div>
            <Badge tone="green">함께 달리기</Badge>
            <CardTitle className="mt-3">가까운 러너와 약속을 잡아보세요</CardTitle>
          </div>
          <Button
            aria-label="함께 달리기 만들기"
            onClick={() => setShowGroupRunForm((value) => !value)}
            size="icon"
            title="함께 달리기 만들기"
            variant={showGroupRunForm ? "ghost" : "primary"}
          >
            {showGroupRunForm ? <X size={19} /> : <Plus size={19} />}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          {showGroupRunForm ? (
            <form
              className="grid gap-3 rounded-md border border-border bg-zinc-50 p-4"
              onSubmit={createGroupRun}
            >
              <input
                className="h-11 rounded-md border border-border bg-white px-3 text-sm font-bold outline-none focus:border-primary"
                maxLength={60}
                onChange={(event) => setGroupRunTitle(event.target.value)}
                placeholder="예: 토요일 한강 5km"
                value={groupRunTitle}
              />
              <label className="flex h-11 items-center gap-2 rounded-md border border-border bg-white px-3">
                <MapPin className="shrink-0 text-muted" size={18} />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                  maxLength={100}
                  onChange={(event) => setMeetingPlace(event.target.value)}
                  placeholder="만날 장소"
                  value={meetingPlace}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <label className="flex h-11 items-center gap-2 rounded-md border border-border bg-white px-3">
                  <CalendarDays className="shrink-0 text-muted" size={18} />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(event) => setStartsAt(event.target.value)}
                    type="datetime-local"
                    value={startsAt}
                  />
                </label>
                <label className="flex h-11 items-center gap-2 rounded-md border border-border bg-white px-3">
                  <Users className="shrink-0 text-muted" size={18} />
                  <input
                    aria-label="최대 참가 인원"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                    max={100}
                    min={2}
                    onChange={(event) => setMaxMembers(Number(event.target.value))}
                    type="number"
                    value={maxMembers}
                  />
                </label>
              </div>
              <Button disabled={groupRunSubmitting} type="submit">
                {groupRunSubmitting ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Plus size={18} />
                )}
                모집 시작
              </Button>
            </form>
          ) : null}

          {groupRuns.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {groupRuns.map((groupRun) => {
                const host = profiles.find((item) => item.id === groupRun.host_id);
                const joined = Boolean(
                  authUser && groupRun.members.includes(authUser.id)
                );
                const full = groupRun.members.length >= groupRun.max_members;

                return (
                  <article
                    className="grid content-between gap-4 rounded-md border border-border p-4"
                    key={groupRun.id}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-black">{groupRun.title}</p>
                          <p className="mt-1 text-xs font-bold text-muted">
                            @{host?.handle ?? "runner"} 주최
                          </p>
                        </div>
                        {groupRun.host_id === authUser?.id ? (
                          <Button
                            aria-label="함께 달리기 삭제"
                            onClick={() => deleteGroupRun(groupRun)}
                            size="icon"
                            title="함께 달리기 삭제"
                            variant="ghost"
                          >
                            <X size={17} />
                          </Button>
                        ) : null}
                      </div>
                      <div className="mt-4 grid gap-2 text-sm font-semibold">
                        <p className="flex items-center gap-2">
                          <CalendarDays className="text-primary" size={17} />
                          {formatKoreanDateTime(groupRun.starts_at)}
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin className="text-primary" size={17} />
                          <span className="truncate">{groupRun.meeting_place}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Users className="text-primary" size={17} />
                          {groupRun.members.length}/{groupRun.max_members}명 참가
                        </p>
                      </div>
                    </div>
                    <Button
                      disabled={groupRun.host_id === authUser?.id || (!joined && full)}
                      onClick={() => toggleGroupRunMembership(groupRun)}
                      variant={joined ? "secondary" : "primary"}
                    >
                      {groupRun.host_id === authUser?.id
                        ? "내가 만든 러닝"
                        : joined
                          ? "참가 취소"
                          : full
                            ? "모집 완료"
                            : "참가하기"}
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              description="첫 러닝 약속을 만들고 가까운 러너를 초대해 보세요."
              icon={Users}
              title="모집 중인 함께 달리기가 없습니다"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <Badge tone="blue">친구 찾기</Badge>
            <CardTitle className="mt-3">RUNGETHER 아이디로 검색</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <label className="flex h-12 items-center gap-2 rounded-md border border-border px-3">
            <Search className="text-muted" size={19} />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="예: seoul.runner"
              value={query}
            />
          </label>
          {results.length ? (
            <div className="mt-3 grid gap-2">
              {results.map((result) => (
                <div
                  className="flex items-center gap-3 rounded-md bg-zinc-50 p-3"
                  key={result.id}
                >
                  <Avatar profile={result} size="small" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">@{result.handle}</p>
                    <p className="truncate text-xs font-semibold text-muted">
                      {result.display_name}
                    </p>
                  </div>
                  <Button
                    aria-label={`${result.handle} 친구 추가`}
                    onClick={() => requestFriend(result)}
                    size="icon"
                    title="친구 추가"
                    variant="secondary"
                  >
                    <UserPlus size={18} />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <Badge tone="green">내 네트워크</Badge>
            <CardTitle className="mt-3">친구와 받은 요청</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {friends.length ? (
            <div className="grid gap-2">
              {friends.map((edge) => {
                const otherId =
                  edge.requester_id === authUser?.id
                    ? edge.addressee_id
                    : edge.requester_id;
                const other = profiles.find((item) => item.id === otherId);

                return (
                  <div
                    className="flex items-center gap-3 border-b border-border py-3 last:border-0"
                    key={edge.id}
                  >
                    <Avatar profile={other} size="small" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">
                        @{other?.handle ?? "runner"}
                      </p>
                      <p className="text-xs font-semibold text-muted">
                        {edge.status === "accepted" ? "친구" : "요청 대기 중"}
                      </p>
                    </div>
                    {edge.status === "pending" &&
                    edge.addressee_id === authUser?.id ? (
                      <Button onClick={() => acceptFriend(edge)} size="sm">
                        <Check size={16} />
                        수락
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="아직 연결된 친구가 없습니다"
              description="RUNGETHER 아이디를 검색해 함께 달릴 친구를 추가하세요."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FollowView({
  authUser,
  follows,
  profiles,
  onFollowsChange,
  onToast
}: {
  authUser: User | null;
  follows: FollowEdge[];
  profiles: Profile[];
  onFollowsChange: (follows: FollowEdge[]) => void;
  onToast: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"discover" | "followers" | "following" | "requests">(
    "discover"
  );
  const normalizedQuery = query.trim().toLowerCase();
  const discoverProfiles = profiles.filter(
    (candidate) =>
      candidate.id !== authUser?.id &&
      !candidate.id.startsWith("sample") &&
      (!normalizedQuery ||
        candidate.handle.toLowerCase().includes(normalizedQuery) ||
        candidate.display_name.toLowerCase().includes(normalizedQuery))
  );
  const followerIds = new Set(
    follows
      .filter(
        (follow) =>
          follow.following_id === authUser?.id && follow.status === "accepted"
      )
      .map((follow) => follow.follower_id)
  );
  const followingIds = new Set(
    follows
      .filter(
        (follow) =>
          follow.follower_id === authUser?.id && follow.status === "accepted"
      )
      .map((follow) => follow.following_id)
  );
  const requests = follows.filter(
    (follow) =>
      follow.following_id === authUser?.id && follow.status === "pending"
  );

  async function followProfile(target: Profile) {
    if (!authUser || !supabase) {
      return;
    }
    const existing = follows.find(
      (follow) =>
        follow.follower_id === authUser.id &&
        follow.following_id === target.id
    );
    if (existing) {
      const { error } = await (supabase.from("follows") as any)
        .delete()
        .eq("follower_id", authUser.id)
        .eq("following_id", target.id);
      if (!error) {
        onFollowsChange(follows.filter((follow) => follow !== existing));
        onToast("팔로우를 취소했습니다.");
      }
      return;
    }

    const next: FollowEdge = {
      follower_id: authUser.id,
      following_id: target.id,
      status: target.is_private ? "pending" : "accepted"
    };
    const { error } = await (supabase.from("follows") as any).insert(next);
    if (error) {
      onToast("팔로우 요청을 처리하지 못했습니다.");
      return;
    }
    onFollowsChange([next, ...follows]);
    onToast(target.is_private ? "팔로우 요청을 보냈습니다." : "팔로우했습니다.");
  }

  async function acceptRequest(request: FollowEdge) {
    if (!authUser || !supabase) {
      return;
    }
    const { error } = await (supabase.from("follows") as any)
      .update({ status: "accepted" })
      .eq("follower_id", request.follower_id)
      .eq("following_id", authUser.id);
    if (!error) {
      onFollowsChange(
        follows.map((follow) =>
          follow === request ? { ...follow, status: "accepted" } : follow
        )
      );
      onToast("팔로우 요청을 수락했습니다.");
    }
  }

  const visibleProfiles =
    tab === "followers"
      ? profiles.filter((candidate) => followerIds.has(candidate.id))
      : tab === "following"
        ? profiles.filter((candidate) => followingIds.has(candidate.id))
        : discoverProfiles;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div>
          <Badge tone="blue">사람 찾기</Badge>
          <CardTitle className="mt-3">러너와 연결하세요</CardTitle>
        </div>
        <UserPlus className="text-primary" size={22} />
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 sm:p-5">
          <label className="flex h-12 items-center gap-2 rounded-md bg-zinc-100 px-3">
            <Search className="text-muted" size={19} />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="사용자 이름 검색"
              value={query}
            />
          </label>
        </div>
        <div className="grid grid-cols-4 border-y border-border">
          {([
            ["discover", "추천"],
            ["followers", `팔로워 ${followerIds.size}`],
            ["following", `팔로잉 ${followingIds.size}`],
            ["requests", `요청 ${requests.length}`]
          ] as const).map(([value, label]) => (
            <button
              className={cn(
                "h-12 text-xs font-black",
                tab === value ? "border-b-2 border-ink text-ink" : "text-muted"
              )}
              key={value}
              onClick={() => setTab(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="divide-y divide-border px-4 sm:px-5">
          {tab === "requests"
            ? requests.map((request) => {
                const requester = profiles.find(
                  (candidate) => candidate.id === request.follower_id
                );
                return (
                  <div className="flex items-center gap-3 py-4" key={request.follower_id}>
                    <Avatar profile={requester} size="small" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">
                        @{requester?.handle ?? "runner"}
                      </p>
                      <p className="text-xs font-semibold text-muted">
                        회원님을 팔로우하려고 합니다.
                      </p>
                    </div>
                    <Button onClick={() => acceptRequest(request)} size="sm">
                      수락
                    </Button>
                  </div>
                );
              })
            : visibleProfiles.map((candidate) => {
                const relation = follows.find(
                  (follow) =>
                    follow.follower_id === authUser?.id &&
                    follow.following_id === candidate.id
                );
                return (
                  <div className="flex items-center gap-3 py-4" key={candidate.id}>
                    <Avatar profile={candidate} size="small" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-sm font-black">
                        @{candidate.handle}
                        {candidate.is_private ? <Lock size={13} /> : null}
                      </p>
                      <p className="truncate text-xs font-semibold text-muted">
                        {candidate.display_name}
                      </p>
                    </div>
                    {candidate.id !== authUser?.id ? (
                      <Button
                        onClick={() => followProfile(candidate)}
                        size="sm"
                        variant={relation ? "secondary" : "primary"}
                      >
                        {relation?.status === "pending"
                          ? "요청됨"
                          : relation
                            ? "팔로잉"
                            : "팔로우"}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
        </div>
      </CardContent>
    </Card>
  );
}

function CrewView({
  authUser,
  crewBlocks,
  crewContributions,
  crewGuestPasses,
  crewGuestRequests,
  crewMembers,
  crewMonthlyBenefits,
  crewXpEvents,
  crews,
  groupRuns,
  profiles,
  onCrewGuestPassesChange,
  onCrewGuestRequestsChange,
  onCrewBlocksChange,
  onCrewMembersChange,
  onCrewsChange,
  onGroupRunsChange,
  onOpenCrewChat,
  onOpenRequestChat,
  onToast
}: {
  authUser: User | null;
  crewBlocks: CrewBlock[];
  crewContributions: CrewContribution[];
  crewGuestPasses: CrewGuestPass[];
  crewGuestRequests: CrewGuestRequest[];
  crewMembers: CrewMember[];
  crewMonthlyBenefits: CrewMonthlyBenefit[];
  crewXpEvents: CrewXpEvent[];
  crews: Crew[];
  groupRuns: GroupRun[];
  profiles: Profile[];
  onCrewGuestPassesChange: (passes: CrewGuestPass[]) => void;
  onCrewGuestRequestsChange: (requests: CrewGuestRequest[]) => void;
  onCrewBlocksChange: (blocks: CrewBlock[]) => void;
  onCrewMembersChange: (members: CrewMember[]) => void;
  onCrewsChange: (crews: Crew[]) => void;
  onGroupRunsChange: (runs: GroupRun[]) => void;
  onOpenCrewChat: (crewId: string) => void;
  onOpenRequestChat: (chatId: string) => void;
  onToast: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [crewSearch, setCrewSearch] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [meetingPlace, setMeetingPlace] = useState("");
  const [privateCrew, setPrivateCrew] = useState(false);
  const [runCrewId, setRunCrewId] = useState("");
  const [runTitle, setRunTitle] = useState("");
  const [runPlace, setRunPlace] = useState("");
  const [runStartsAt, setRunStartsAt] = useState("");
  const [managingCrewId, setManagingCrewId] = useState("");
  const [rankingPeriod, setRankingPeriod] = useState<
    "day" | "week" | "month" | "all"
  >("month");
  const rankingMonths = useMemo(() => recentKoreanMonthOptions(), []);
  const [rankingDate, setRankingDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
      new Date()
    )
  );
  const [guestStartsAt, setGuestStartsAt] = useState<Record<string, string>>({});
  const [guestEndsAt, setGuestEndsAt] = useState<Record<string, string>>({});
  const [rankingCrewId, setRankingCrewId] = useState("");
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>(
    {}
  );
  const myMemberships = crewMembers.filter(
    (member) => member.user_id === authUser?.id
  );
  const myCrewIds = new Set(myMemberships.map((member) => member.crew_id));
  const myCrews = crews.filter((crew) => myCrewIds.has(crew.id));
  const ownedCrews = crews.filter((crew) => crew.owner_id === authUser?.id);
  const hasPrimaryCrew = myCrews.length > 0 || ownedCrews.length > 0;
  const normalizedCrewSearch = crewSearch.trim().toLocaleLowerCase("ko-KR");
  const visibleCrews = crews.filter((crew) => {
    if (!normalizedCrewSearch) {
      return true;
    }
    const owner = profiles.find((profile) => profile.id === crew.owner_id);
    return [
      crew.name,
      crew.description,
      crew.meeting_place,
      owner?.handle,
      owner?.display_name
    ].some((value) =>
      value?.toLocaleLowerCase("ko-KR").includes(normalizedCrewSearch)
    );
  });
  const now = Date.now();
  const activeGuestPasses = crewGuestPasses.filter(
    (pass) =>
      pass.status === "accepted" &&
      new Date(pass.starts_at).getTime() <= now &&
      new Date(pass.ends_at).getTime() > now
  );
  const myActiveGuestPasses = activeGuestPasses.filter(
    (pass) => pass.user_id === authUser?.id
  );
  const accessibleCrewIds = new Set([
    ...myCrewIds,
    ...myActiveGuestPasses.map((pass) => pass.crew_id)
  ]);
  const periodBounds =
    rankingPeriod === "all"
      ? null
      : koreanPeriodBounds(rankingPeriod, rankingDate);
  const periodEvents =
    rankingPeriod === "all"
      ? crewXpEvents
      : crewXpEvents.filter((event) => {
          const earnedAt = new Date(event.earned_at).getTime();
          return (
            periodBounds !== null &&
            earnedAt >= periodBounds.start &&
            earnedAt < periodBounds.end
          );
        });
  const selectedPeriodCrewXp = new Map<string, number>();
  periodEvents.forEach((event) => {
    selectedPeriodCrewXp.set(
      event.crew_id,
      (selectedPeriodCrewXp.get(event.crew_id) ?? 0) + Number(event.xp)
    );
  });
  const periodCrewRanking = [...crews]
    .map((crew) => ({
      crew,
      xp:
        rankingPeriod === "all"
          ? Number(crew.experience_points)
          : selectedPeriodCrewXp.get(crew.id) ?? 0
    }))
    .sort((a, b) => b.xp - a.xp || a.crew.name.localeCompare(b.crew.name));
  const cumulativeUserRanking = profiles
    .filter((item) => !item.id.startsWith("sample"))
    .sort(
      (a, b) =>
        Number(b.experience_points) - Number(a.experience_points) ||
        a.handle.localeCompare(b.handle)
    )
    .slice(0, 100);
  const cumulativeCrewRanking = [...crews]
    .sort(
      (a, b) =>
        Number(b.experience_points) - Number(a.experience_points) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 10);
  const rankingCrew =
    crews.find((crew) => crew.id === rankingCrewId) ??
    crews.find((crew) => accessibleCrewIds.has(crew.id)) ??
    null;
  const periodMemberXp = new Map<string, number>();
  if (rankingCrew) {
    const currentMemberIds = new Set(
      crewMembers
        .filter((member) => member.crew_id === rankingCrew.id)
        .map((member) => member.user_id)
    );
    if (rankingPeriod === "all") {
      crewContributions
        .filter(
          (item) =>
            item.crew_id === rankingCrew.id &&
            currentMemberIds.has(item.user_id)
        )
        .forEach((item) => {
          periodMemberXp.set(
            item.user_id,
            (periodMemberXp.get(item.user_id) ?? 0) +
              Number(item.contribution_xp)
          );
        });
    } else {
      periodEvents
        .filter(
          (event) =>
            event.crew_id === rankingCrew.id &&
            event.user_id !== null &&
            currentMemberIds.has(event.user_id)
        )
        .forEach((event) => {
          if (!event.user_id) {
            return;
          }
          periodMemberXp.set(
            event.user_id,
            (periodMemberXp.get(event.user_id) ?? 0) + Number(event.xp)
          );
        });
    }
  }
  const crewMemberRanking = [...periodMemberXp.entries()]
    .map(([userId, xp]) => ({
      profile: profiles.find((item) => item.id === userId),
      userId,
      xp
    }))
    .sort(
      (a, b) =>
        b.xp - a.xp ||
        (a.profile?.handle ?? a.userId).localeCompare(
          b.profile?.handle ?? b.userId
        )
    );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul"
  }).format(new Date());
  const activeBenefits = new Map(
    crewMonthlyBenefits
      .filter(
        (benefit) =>
          benefit.valid_from <= today && benefit.valid_until >= today
      )
      .map((benefit) => [benefit.crew_id, benefit])
  );

  async function createCrew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authUser || !supabase || !name.trim() || hasPrimaryCrew) {
      onToast(
        hasPrimaryCrew
          ? "소속 크루는 하나만 선택할 수 있습니다."
          : "크루 이름을 입력해 주세요."
      );
      return;
    }
    const { data, error } = await (supabase.from("crews") as any)
      .insert({
        description: description.trim() || null,
        is_private: privateCrew,
        meeting_place: meetingPlace.trim() || null,
        name: name.trim(),
        owner_id: authUser.id
      })
      .select("id,owner_id,name,description,is_private,meeting_place,image_url,experience_points,guest_recruiting,guest_default_hours")
      .single();
    if (error) {
      onToast("크루를 만들지 못했습니다.");
      return;
    }
    const member: CrewMember = {
      crew_id: data.id,
      joined_at: new Date().toISOString(),
      role: "owner",
      user_id: authUser.id
    };
    const { error: memberError } = await (supabase.from("crew_members") as any)
      .insert(member);
    if (memberError) {
      await (supabase.from("crews") as any).delete().eq("id", data.id);
      onToast("크루 멤버 등록에 실패했습니다.");
      return;
    }
    onCrewsChange([data as Crew, ...crews]);
    onCrewMembersChange([member, ...crewMembers]);
    setName("");
    setDescription("");
    setMeetingPlace("");
    setShowCreate(false);
    onToast("새 러닝크루를 만들었습니다.");
  }

  async function toggleCrew(crew: Crew) {
    if (!authUser || !supabase) {
      return;
    }
    const membership = myMemberships.find((member) => member.crew_id === crew.id);
    if (membership?.role === "owner") {
      setManagingCrewId(crew.id);
      onToast("다른 크루원에게 크루장을 넘기거나 크루를 삭제한 뒤 탈퇴할 수 있습니다.");
      return;
    }
    if (!membership && myCrews.length >= 1) {
      onToast("다른 크루에 가입하려면 현재 소속 크루에서 먼저 탈퇴해야 합니다.");
      return;
    }
    const memberCount = crewMembers.filter(
      (member) => member.crew_id === crew.id
    ).length;
    if (!membership && memberCount >= 50) {
      onToast("이 크루는 정원 50명이 모두 찼습니다.");
      return;
    }
    const query = supabase.from("crew_members") as any;
    const { error } = membership
      ? await query.delete().eq("crew_id", crew.id).eq("user_id", authUser.id)
      : await query.insert({ crew_id: crew.id, user_id: authUser.id, role: "member" });
    if (error) {
      onToast(
        error.message?.includes("thirty days")
          ? "이 크루에서 탈퇴한 뒤 30일이 지나야 다시 가입할 수 있습니다."
          : error.message?.includes("blocked")
            ? "이 크루에서 차단되어 가입하거나 게스트로 참여할 수 없습니다."
            : crew.is_private
              ? "비공개 크루 가입은 크루장의 승인이 필요합니다."
              : "크루 가입 상태를 변경하지 못했습니다."
      );
      return;
    }
    onCrewMembersChange(
      membership
        ? crewMembers.filter(
            (member) =>
              !(member.crew_id === crew.id && member.user_id === authUser.id)
          )
        : [
            {
              crew_id: crew.id,
              joined_at: new Date().toISOString(),
              role: "member",
              user_id: authUser.id
            },
            ...crewMembers
          ]
    );
    onToast(
      membership
        ? `${crew.name}에서 탈퇴했습니다. 크루 DM에서도 나갔습니다.`
        : `${crew.name}에 가입했습니다. 크루 DM이 자동으로 추가되었습니다.`
    );
  }

  async function manageCrewMember(
    member: CrewMember,
    action: "block" | "remove" | "toggle-manager"
  ) {
    if (!authUser || !supabase) {
      return;
    }
    const crew = crews.find((item) => item.id === member.crew_id);
    if (crew?.owner_id !== authUser.id || member.role === "owner") {
      return;
    }

    if (action === "block") {
      const { error } = await (supabase as any).rpc("block_crew_runner", {
        block_reason: null,
        target_crew_id: member.crew_id,
        target_user_id: member.user_id
      });
      if (error) {
        onToast("크루에서 사용자를 차단하지 못했습니다.");
        return;
      }
      onCrewMembersChange(
        crewMembers.filter(
          (item) =>
            !(item.crew_id === member.crew_id && item.user_id === member.user_id)
        )
      );
      onCrewBlocksChange([
        {
          blocked_by: authUser.id,
          created_at: new Date().toISOString(),
          crew_id: member.crew_id,
          reason: null,
          user_id: member.user_id
        },
        ...crewBlocks.filter(
          (item) =>
            !(item.crew_id === member.crew_id && item.user_id === member.user_id)
        )
      ]);
      onToast("사용자를 차단했습니다. 이 크루와 관련된 모든 참여가 제한됩니다.");
      return;
    }

    if (action === "remove") {
      const { error } = await (supabase.from("crew_members") as any)
        .delete()
        .eq("crew_id", member.crew_id)
        .eq("user_id", member.user_id);
      if (error) {
        onToast("크루원을 내보내지 못했습니다.");
        return;
      }
      onCrewMembersChange(
        crewMembers.filter(
          (item) =>
            !(item.crew_id === member.crew_id && item.user_id === member.user_id)
        )
      );
      onToast("크루원과 크루 DM 참여를 함께 해제했습니다.");
      return;
    }

    const nextRole = member.role === "manager" ? "member" : "manager";
    const { error } = await (supabase.from("crew_members") as any)
      .update({ role: nextRole })
      .eq("crew_id", member.crew_id)
      .eq("user_id", member.user_id);
    if (error) {
      onToast("크루원 역할을 변경하지 못했습니다.");
      return;
    }
    onCrewMembersChange(
      crewMembers.map((item) =>
        item.crew_id === member.crew_id && item.user_id === member.user_id
          ? { ...item, role: nextRole }
          : item
      )
    );
  }

  async function unblockCrewRunner(block: CrewBlock) {
    if (!supabase || !canManageCrew(block.crew_id)) {
      return;
    }
    const { error } = await (supabase as any).rpc("unblock_crew_runner", {
      target_crew_id: block.crew_id,
      target_user_id: block.user_id
    });
    if (error) {
      onToast("차단을 해제하지 못했습니다.");
      return;
    }
    onCrewBlocksChange(
      crewBlocks.filter(
        (item) =>
          !(item.crew_id === block.crew_id && item.user_id === block.user_id)
      )
    );
    onToast("크루 차단을 해제했습니다. 재가입 30일 제한은 별도로 유지됩니다.");
  }

  async function deleteCrew(crew: Crew) {
    if (
      !supabase ||
      crew.owner_id !== authUser?.id ||
      !window.confirm(
        `${crew.name} 크루를 영구 삭제할까요?\n크루 DM, 일정, 멤버, 게스트, 랭킹 기록이 모두 삭제됩니다.`
      )
    ) {
      return;
    }
    const { error } = await (supabase.from("crews") as any)
      .delete()
      .eq("id", crew.id)
      .eq("owner_id", authUser.id);
    if (error) {
      onToast("크루를 삭제하지 못했습니다.");
      return;
    }
    onCrewsChange(crews.filter((item) => item.id !== crew.id));
    onCrewMembersChange(
      crewMembers.filter((member) => member.crew_id !== crew.id)
    );
    onCrewGuestPassesChange(
      crewGuestPasses.filter((pass) => pass.crew_id !== crew.id)
    );
    onCrewGuestRequestsChange(
      crewGuestRequests.filter((request) => request.crew_id !== crew.id)
    );
    onCrewBlocksChange(crewBlocks.filter((block) => block.crew_id !== crew.id));
    onGroupRunsChange(groupRuns.filter((run) => run.crew_id !== crew.id));
    onToast("크루와 관련 데이터를 영구 삭제했습니다.");
  }

  async function transferCrewOwnership(crew: Crew, leaveAfterTransfer: boolean) {
    const targetUserId = transferTargets[crew.id];
    if (!supabase || crew.owner_id !== authUser?.id || !targetUserId) {
      onToast("크루장을 넘겨받을 크루원을 선택해 주세요.");
      return;
    }
    const targetProfile = profiles.find((item) => item.id === targetUserId);
    if (
      !window.confirm(
        `@${targetProfile?.handle ?? "runner"}님에게 ${crew.name} 크루장을 넘길까요?${
          leaveAfterTransfer ? "\n이전 직후 현재 계정은 크루에서 탈퇴합니다." : ""
        }`
      )
    ) {
      return;
    }
    const { error } = await (supabase as any).rpc("transfer_crew_ownership", {
      leave_after_transfer: leaveAfterTransfer,
      target_crew_id: crew.id,
      target_user_id: targetUserId
    });
    if (error) {
      onToast("크루장 권한을 이전하지 못했습니다.");
      return;
    }
    onCrewsChange(
      crews.map((item) =>
        item.id === crew.id ? { ...item, owner_id: targetUserId } : item
      )
    );
    onCrewMembersChange(
      crewMembers
        .map((member) =>
          member.crew_id !== crew.id
            ? member
            : member.user_id === targetUserId
              ? { ...member, role: "owner" }
              : member.user_id === authUser.id
                ? { ...member, role: "member" }
                : member
        )
        .filter(
          (member) =>
            !(
              leaveAfterTransfer &&
              member.crew_id === crew.id &&
              member.user_id === authUser.id
            )
        )
    );
    setManagingCrewId("");
    onToast(
      leaveAfterTransfer
        ? "크루장을 이전하고 크루에서 탈퇴했습니다."
        : "크루장 권한을 이전했습니다."
    );
  }

  function canManageCrew(crewId: string) {
    const crew = crews.find((item) => item.id === crewId);
    return (
      crew?.owner_id === authUser?.id ||
      myMemberships.some(
        (member) => member.crew_id === crewId && member.role === "manager"
      )
    );
  }

  async function toggleGuestRecruiting(crew: Crew) {
    if (!supabase || !canManageCrew(crew.id)) {
      return;
    }
    const nextValue = !crew.guest_recruiting;
    const { error } = await (supabase.from("crews") as any)
      .update({ guest_recruiting: nextValue })
      .eq("id", crew.id);
    if (error) {
      onToast("게스트 러너 모집 상태를 변경하지 못했습니다.");
      return;
    }
    onCrewsChange(
      crews.map((item) =>
        item.id === crew.id ? { ...item, guest_recruiting: nextValue } : item
      )
    );
    onToast(nextValue ? "게스트 러너 모집을 시작했습니다." : "게스트 러너 모집을 마감했습니다.");
  }

  async function requestGuestAccess(crew: Crew) {
    if (!authUser || !supabase) {
      return;
    }
    const { data, error } = await (supabase as any).rpc(
      "request_crew_guest_access",
      { target_crew_id: crew.id }
    );
    if (error) {
      onToast(
        error.message?.includes("closed")
          ? "현재 게스트 러너를 모집하지 않는 크루입니다."
          : "게스트 러너 참가 요청을 보내지 못했습니다."
      );
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    const request: CrewGuestRequest = {
      crew_id: crew.id,
      decided_at: null,
      ends_at: null,
      id: result?.request_id,
      request_chat_id: result?.chat_id,
      requested_at: new Date().toISOString(),
      requester_id: authUser.id,
      starts_at: null,
      status: "pending"
    };
    onCrewGuestRequestsChange([
      request,
      ...crewGuestRequests.filter((item) => item.id !== request.id)
    ]);
    onToast("크루장에게 참가 요청 DM을 보냈습니다.");
    if (result?.chat_id) {
      onOpenRequestChat(result.chat_id);
    }
  }

  function scheduleStart(requestId: string, fallback?: string) {
    return guestStartsAt[requestId] ?? fallback ?? nextKoreanHour();
  }

  function scheduleEnd(requestId: string, fallback?: string) {
    const start = scheduleStart(requestId);
    return guestEndsAt[requestId] ?? fallback ?? maximumGuestEnd(start);
  }

  async function decideGuestRequest(
    request: CrewGuestRequest,
    decision: "accepted" | "rejected"
  ) {
    if (!supabase || !canManageCrew(request.crew_id)) {
      return;
    }
    const startsAt = scheduleStart(request.id);
    const endsAt = scheduleEnd(request.id);
    const { data, error } = await (supabase as any).rpc(
      "decide_crew_guest_request",
      {
        access_ends_at:
          decision === "accepted" ? koreanLocalToIso(endsAt) : null,
        access_starts_at:
          decision === "accepted" ? koreanLocalToIso(startsAt) : null,
        decision,
        target_request_id: request.id
      }
    );
    if (error) {
      onToast(
        error.message?.includes("ten")
          ? "동시에 활동할 수 있는 게스트 러너 10명이 모두 찼습니다."
          : "참가 요청을 처리하지 못했습니다. 종료 시각과 3일 제한을 확인해 주세요."
      );
      return;
    }
    const decidedAt = new Date().toISOString();
    onCrewGuestRequestsChange(
      crewGuestRequests.map((item) =>
        item.id === request.id
          ? {
              ...item,
              decided_at: decidedAt,
              ends_at:
                decision === "accepted" ? koreanLocalToIso(endsAt) : null,
              starts_at:
                decision === "accepted" ? koreanLocalToIso(startsAt) : null,
              status: decision
            }
          : item
      )
    );
    if (decision === "accepted") {
      const nextPass: CrewGuestPass = {
        contribution_xp: 0,
        crew_id: request.crew_id,
        ends_at: koreanLocalToIso(endsAt),
        group_run_id: null,
        id: String(data),
        request_id: request.id,
        starts_at: koreanLocalToIso(startsAt),
        status: "accepted",
        user_id: request.requester_id
      };
      onCrewGuestPassesChange([
        nextPass,
        ...crewGuestPasses.filter((pass) => pass.request_id !== request.id)
      ]);
    }
    onToast(decision === "accepted" ? "게스트 러너 참가를 수락했습니다." : "게스트 러너 참가를 거절했습니다.");
  }

  async function manageGuestPass(
    pass: CrewGuestPass,
    action: "update" | "end"
  ) {
    if (!supabase || !canManageCrew(pass.crew_id)) {
      return;
    }
    const startsAt = scheduleStart(pass.id, toKoreanDateTimeLocal(pass.starts_at));
    const endsAt = scheduleEnd(pass.id, toKoreanDateTimeLocal(pass.ends_at));
    const { error } = await (supabase as any).rpc("manage_crew_guest_pass", {
      access_ends_at: action === "update" ? koreanLocalToIso(endsAt) : null,
      access_starts_at: action === "update" ? koreanLocalToIso(startsAt) : null,
      action,
      target_pass_id: pass.id
    });
    if (error) {
      onToast("게스트 활동 시간을 변경하지 못했습니다. 시간 단위와 3일 제한을 확인해 주세요.");
      return;
    }
    onCrewGuestPassesChange(
      crewGuestPasses.map((item) =>
        item.id === pass.id
          ? action === "end"
            ? { ...item, ends_at: new Date().toISOString(), status: "cancelled" }
            : {
                ...item,
                ends_at: koreanLocalToIso(endsAt),
                starts_at: koreanLocalToIso(startsAt),
                status: "accepted"
              }
          : item
      )
    );
    onToast(action === "end" ? "게스트 활동을 바로 종료했습니다." : "게스트 활동 시간을 변경했습니다.");
  }

  async function createCrewRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !authUser ||
      !supabase ||
      !runCrewId ||
      !runTitle.trim() ||
      !runPlace.trim() ||
      !runStartsAt
    ) {
      onToast("크루, 러닝 이름, 장소, 시작 시간을 입력해 주세요.");
      return;
    }
    const { data, error } = await (supabase.from("group_runs") as any)
      .insert({
        crew_id: runCrewId,
        host_id: authUser.id,
        max_members: 30,
        meeting_place: runPlace.trim(),
        starts_at: new Date(runStartsAt).toISOString(),
        title: runTitle.trim()
      })
      .select("id,crew_id,host_id,title,meeting_place,starts_at,max_members")
      .single();
    if (error) {
      onToast("크루 러닝을 만들지 못했습니다.");
      return;
    }
    await (supabase.from("group_run_members") as any).insert({
      group_run_id: data.id,
      user_id: authUser.id
    });
    onGroupRunsChange([
      { ...(data as Omit<GroupRun, "members">), members: [authUser.id] },
      ...groupRuns
    ]);
    setRunTitle("");
    setRunPlace("");
    setRunStartsAt("");
    onToast("크루 러닝 모집을 시작했습니다.");
  }

  async function joinGroupRun(run: GroupRun) {
    if (!authUser || !supabase) {
      return;
    }
    const joined = run.members.includes(authUser.id);
    const query = supabase.from("group_run_members") as any;
    const { error } = joined
      ? await query.delete().eq("group_run_id", run.id).eq("user_id", authUser.id)
      : await query.insert({ group_run_id: run.id, user_id: authUser.id });
    if (!error) {
      onGroupRunsChange(
        groupRuns.map((item) =>
          item.id === run.id
            ? {
                ...item,
                members: joined
                  ? item.members.filter((id) => id !== authUser.id)
                  : [...item.members, authUser.id]
              }
            : item
        )
      );
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div>
            <Badge tone="green">러닝크루</Badge>
            <CardTitle className="mt-3">함께 달릴 팀을 만나세요</CardTitle>
          </div>
          {!hasPrimaryCrew ? (
            <Button
              aria-label="새 크루 만들기"
              onClick={() => setShowCreate((value) => !value)}
              size="icon"
              title="새 크루 만들기"
            >
              <Plus size={19} />
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between rounded-md bg-emerald-50 p-3">
            <span className="text-sm font-bold text-emerald-900">내 크루</span>
            <span className="text-sm font-black text-primary">
              {hasPrimaryCrew ? 1 : 0}/1
            </span>
          </div>
          {!hasPrimaryCrew && showCreate ? (
            <form className="mb-5 grid gap-3 border-b border-border pb-5" onSubmit={createCrew}>
              <input
                className="h-11 rounded-md border border-border px-3 text-sm font-bold outline-none focus:border-primary"
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                placeholder="크루 이름"
                value={name}
              />
              <input
                className="h-11 rounded-md border border-border px-3 text-sm font-semibold outline-none focus:border-primary"
                maxLength={100}
                onChange={(event) => setMeetingPlace(event.target.value)}
                placeholder="주요 활동 장소"
                value={meetingPlace}
              />
              <textarea
                className="min-h-20 rounded-md border border-border p-3 text-sm font-semibold outline-none focus:border-primary"
                maxLength={200}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="크루 소개"
                value={description}
              />
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  checked={privateCrew}
                  onChange={(event) => setPrivateCrew(event.target.checked)}
                  type="checkbox"
                />
                비공개 크루
              </label>
              <Button type="submit">크루 만들기</Button>
            </form>
          ) : null}
          <label className="mb-4 flex h-11 items-center gap-2 rounded-md border border-border px-3 focus-within:border-primary">
            <Search className="shrink-0 text-muted" size={18} />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              onChange={(event) => setCrewSearch(event.target.value)}
              placeholder="크루 이름, 지역, 크루장 검색"
              type="search"
              value={crewSearch}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleCrews.map((crew) => {
              const membership = myMemberships.find(
                (member) => member.crew_id === crew.id
              );
              const memberCount = crewMembers.filter(
                (member) => member.crew_id === crew.id
              ).length;
              const crewGuests = activeGuestPasses.filter(
                (pass) => pass.crew_id === crew.id
              );
              const myGuestPass = myActiveGuestPasses.find(
                (pass) => pass.crew_id === crew.id
              );
              const pendingRequest = crewGuestRequests.find(
                (request) =>
                  request.crew_id === crew.id &&
                  request.requester_id === authUser?.id &&
                  request.status === "pending"
              );
              const manager = canManageCrew(crew.id);
              const owner = profiles.find((profile) => profile.id === crew.owner_id);
              const monthlyBenefit = activeBenefits.get(crew.id);
              return (
                <article className="rounded-md border border-border p-4" key={crew.id}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-white">
                      <Users size={21} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-base font-black">
                        {crew.name}
                        {crew.is_private ? <Lock size={14} /> : null}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted">
                        크루원 {memberCount}/50 · 게스트 {crewGuests.length}/10 · @{owner?.handle ?? "runner"}
                      </p>
                      {monthlyBenefit ? (
                        <p className="mt-1 text-xs font-black text-amber-600">
                          지난달 TOP {monthlyBenefit.rank} 혜택 적용 중
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6">
                    {crew.description || "함께 즐겁게 달리는 러닝크루입니다."}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-bold text-muted">
                    <MapPin size={14} />
                    {crew.meeting_place || "활동 장소 미정"}
                  </p>
                  {membership ? (
                    <Button
                      className="mt-4 w-full"
                      onClick={() => toggleCrew(crew)}
                      size="sm"
                      variant="secondary"
                    >
                      {membership.role === "owner" ? "내가 만든 크루" : "크루 탈퇴"}
                    </Button>
                  ) : !hasPrimaryCrew ? (
                    <Button
                      className="mt-4 w-full"
                      disabled={memberCount >= 50}
                      onClick={() => toggleCrew(crew)}
                      size="sm"
                    >
                      {memberCount >= 50 ? "크루 정원 마감" : "크루 가입"}
                    </Button>
                  ) : null}
                  {membership || myGuestPass ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => onOpenCrewChat(crew.id)}
                        size="sm"
                        variant="secondary"
                      >
                        <MessageCircle size={16} />
                        크루 DM
                      </Button>
                      {manager ? (
                        <Button
                          onClick={() =>
                            setManagingCrewId((current) =>
                              current === crew.id ? "" : crew.id
                            )
                          }
                          size="sm"
                          variant="secondary"
                        >
                          <Settings size={16} />
                          크루원 관리
                        </Button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ) : null}
                  {!membership && !myGuestPass ? (
                    <Button
                      className="mt-2 w-full"
                      disabled={!crew.guest_recruiting || Boolean(pendingRequest)}
                      onClick={() => void requestGuestAccess(crew)}
                      size="sm"
                      variant="secondary"
                    >
                      <UserPlus size={16} />
                      {pendingRequest
                        ? "게스트 참가 요청 중"
                        : crew.guest_recruiting
                          ? "게스트 러너 참가 요청"
                          : "게스트 모집 마감"}
                    </Button>
                  ) : null}
                  {myGuestPass ? (
                    <p className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                      게스트 활동: {formatKoreanDateTime(myGuestPass.starts_at)} ~{" "}
                      {formatKoreanDateTime(myGuestPass.ends_at)}
                    </p>
                  ) : null}
                  {manager ? (
                    <div className="mt-3 rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black">게스트 러너 모집</p>
                          <p className="mt-1 text-[11px] font-semibold text-muted">
                            크루원 50명과 별도로 동시 최대 10명
                          </p>
                        </div>
                        <Button
                          onClick={() => void toggleGuestRecruiting(crew)}
                          size="sm"
                          variant={crew.guest_recruiting ? "primary" : "secondary"}
                        >
                          {crew.guest_recruiting ? "모집 중" : "모집 시작"}
                        </Button>
                      </div>
                      {crewGuestRequests
                        .filter(
                          (request) =>
                            request.crew_id === crew.id &&
                            request.status === "pending"
                        )
                        .map((request) => {
                          const requester = profiles.find(
                            (item) => item.id === request.requester_id
                          );
                          const start = scheduleStart(request.id);
                          const end = scheduleEnd(request.id);
                          return (
                            <div
                              className="mt-3 grid gap-2 border-t border-border pt-3"
                              key={request.id}
                            >
                              <div className="flex items-center gap-2">
                                <Avatar profile={requester} size="small" />
                                <p className="min-w-0 flex-1 truncate text-xs font-black">
                                  @{requester?.handle ?? "runner"}의 참가 요청
                                </p>
                                {request.request_chat_id ? (
                                  <Button
                                    aria-label="요청 DM 열기"
                                    onClick={() =>
                                      onOpenRequestChat(request.request_chat_id!)
                                    }
                                    size="icon"
                                    title="요청 DM 열기"
                                    variant="ghost"
                                  >
                                    <MessageCircle size={16} />
                                  </Button>
                                ) : null}
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="grid gap-1 text-[11px] font-bold">
                                  시작
                                  <input
                                    className="h-10 rounded-md border border-border px-2 text-xs"
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setGuestStartsAt((current) => ({
                                        ...current,
                                        [request.id]: value
                                      }));
                                      setGuestEndsAt((current) => ({
                                        ...current,
                                        [request.id]: maximumGuestEnd(value)
                                      }));
                                    }}
                                    step={3600}
                                    type="datetime-local"
                                    value={start}
                                  />
                                </label>
                                <label className="grid gap-1 text-[11px] font-bold">
                                  종료
                                  <input
                                    className="h-10 rounded-md border border-border px-2 text-xs"
                                    max={maximumGuestEnd(start)}
                                    min={start}
                                    onChange={(event) =>
                                      setGuestEndsAt((current) => ({
                                        ...current,
                                        [request.id]: event.target.value
                                      }))
                                    }
                                    step={3600}
                                    type="datetime-local"
                                    value={end}
                                  />
                                </label>
                              </div>
                              <p className="text-[11px] font-semibold text-muted">
                                최대 종료: {formatKoreanDateTime(koreanLocalToIso(maximumGuestEnd(start)))}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  onClick={() =>
                                    void decideGuestRequest(request, "rejected")
                                  }
                                  size="sm"
                                  variant="secondary"
                                >
                                  거절
                                </Button>
                                <Button
                                  onClick={() =>
                                    void decideGuestRequest(request, "accepted")
                                  }
                                  size="sm"
                                >
                                  수락
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      {crewGuestPasses
                        .filter(
                          (pass) =>
                            pass.crew_id === crew.id &&
                            pass.status === "accepted" &&
                            new Date(pass.ends_at).getTime() > now
                        )
                        .map((pass) => {
                          const guest = profiles.find(
                            (item) => item.id === pass.user_id
                          );
                          const start =
                            guestStartsAt[pass.id] ??
                            toKoreanDateTimeLocal(pass.starts_at);
                          const end =
                            guestEndsAt[pass.id] ??
                            toKoreanDateTimeLocal(pass.ends_at);
                          return (
                            <div
                              className="mt-3 grid gap-2 border-t border-border pt-3"
                              key={pass.id}
                            >
                              <div className="flex items-center gap-2">
                                <Avatar profile={guest} size="small" />
                                <p className="min-w-0 flex-1 truncate text-xs font-black">
                                  @{guest?.handle ?? "runner"} · 게스트 활동 중
                                </p>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input
                                  className="h-10 rounded-md border border-border px-2 text-xs"
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setGuestStartsAt((current) => ({
                                      ...current,
                                      [pass.id]: value
                                    }));
                                    setGuestEndsAt((current) => ({
                                      ...current,
                                      [pass.id]: maximumGuestEnd(value)
                                    }));
                                  }}
                                  step={3600}
                                  type="datetime-local"
                                  value={start}
                                />
                                <input
                                  className="h-10 rounded-md border border-border px-2 text-xs"
                                  max={maximumGuestEnd(start)}
                                  min={start}
                                  onChange={(event) =>
                                    setGuestEndsAt((current) => ({
                                      ...current,
                                      [pass.id]: event.target.value
                                    }))
                                  }
                                  step={3600}
                                  type="datetime-local"
                                  value={end}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  onClick={() =>
                                    void manageGuestPass(pass, "end")
                                  }
                                  size="sm"
                                  variant="danger"
                                >
                                  바로 종료
                                </Button>
                                <Button
                                  onClick={() =>
                                    void manageGuestPass(pass, "update")
                                  }
                                  size="sm"
                                >
                                  시간 변경
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : null}
                  {managingCrewId === crew.id ? (
                    <>
                      <CrewMemberManager
                        blockedUsers={crewBlocks.filter(
                          (block) => block.crew_id === crew.id
                        )}
                        crew={crew}
                        members={crewMembers.filter(
                          (member) => member.crew_id === crew.id
                        )}
                        onManage={manageCrewMember}
                        onUnblock={unblockCrewRunner}
                        profiles={profiles}
                      />
                      {crew.owner_id === authUser?.id ? (
                        <div className="mt-3 grid gap-2 border-t border-border pt-3">
                          <p className="text-xs font-black">크루장 이전 및 탈퇴</p>
                          <select
                            className="h-10 rounded-md border border-border px-3 text-xs font-bold"
                            onChange={(event) =>
                              setTransferTargets((current) => ({
                                ...current,
                                [crew.id]: event.target.value
                              }))
                            }
                            value={transferTargets[crew.id] ?? ""}
                          >
                            <option value="">새 크루장 선택</option>
                            {crewMembers
                              .filter(
                                (member) =>
                                  member.crew_id === crew.id &&
                                  member.user_id !== authUser.id
                              )
                              .map((member) => {
                                const candidate = profiles.find(
                                  (item) => item.id === member.user_id
                                );
                                return (
                                  <option key={member.user_id} value={member.user_id}>
                                    @{candidate?.handle ?? "runner"}
                                  </option>
                                );
                              })}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              disabled={!transferTargets[crew.id]}
                              onClick={() =>
                                void transferCrewOwnership(crew, false)
                              }
                              size="sm"
                              variant="secondary"
                            >
                              크루장만 이전
                            </Button>
                            <Button
                              disabled={!transferTargets[crew.id]}
                              onClick={() =>
                                void transferCrewOwnership(crew, true)
                              }
                              size="sm"
                            >
                              이전 후 탈퇴
                            </Button>
                          </div>
                          <Button
                            className="w-full"
                            onClick={() => void deleteCrew(crew)}
                            size="sm"
                            variant="danger"
                          >
                            <Trash2 size={16} />
                            크루 삭제 후 탈퇴
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </article>
              );
            })}
            {!visibleCrews.length ? (
              <p className="py-8 text-center text-sm font-semibold text-muted sm:col-span-2">
                검색 결과가 없습니다.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <Badge tone="orange">랭킹</Badge>
            <CardTitle className="mt-3">기간별 크루 경쟁</CardTitle>
          </div>
          <Trophy className="text-amber-500" size={22} />
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid grid-cols-4 gap-1 rounded-md bg-zinc-100 p-1">
            {(
              [
                ["day", "일"],
                ["week", "주"],
                ["month", "월"],
                ["all", "총"]
              ] as const
            ).map(([value, label]) => (
              <button
                className={cn(
                  "h-10 rounded-md text-sm font-black",
                  rankingPeriod === value
                    ? "bg-white text-ink shadow-sm"
                    : "text-muted"
                )}
                key={value}
                onClick={() => setRankingPeriod(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {rankingPeriod !== "all" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold">
                조회 월
                <select
                  className="h-11 rounded-md border border-border px-3 text-sm font-bold"
                  onChange={(event) =>
                    setRankingDate(`${event.target.value}-01`)
                  }
                  value={rankingDate.slice(0, 7)}
                >
                  {rankingMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
              {rankingPeriod !== "month" ? (
                <label className="grid gap-1 text-xs font-bold">
                  기준 날짜
                  <input
                    className="h-11 rounded-md border border-border px-3 text-sm font-bold"
                    max={today}
                    min={`${rankingMonths.at(-1)!.value}-01`}
                    onChange={(event) => setRankingDate(event.target.value)}
                    type="date"
                    value={rankingDate}
                  />
                </label>
              ) : (
                <div className="flex items-end">
                  <p className="w-full rounded-md bg-zinc-50 px-3 py-3 text-xs font-semibold text-muted">
                    실제 달의 1일 00:00부터 다음 달 1일 00:00 전까지 집계
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-md bg-zinc-50 px-3 py-3 text-xs font-semibold text-muted">
              레벨과 관계없이 지금까지 적립한 누적 경험치로 집계합니다.
            </p>
          )}

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-black">
                  {rankingPeriod === "all" ? "크루 총 랭킹 TOP 10" : "크루 기간 랭킹"}
                </p>
                <span className="text-xs font-bold text-muted">적립 XP 기준</span>
              </div>
              <div className="grid max-h-80 gap-1 overflow-y-auto">
                {(rankingPeriod === "all"
                  ? cumulativeCrewRanking.map((crew) => ({
                      crew,
                      xp: Number(crew.experience_points)
                    }))
                  : periodCrewRanking
                ).map(({ crew, xp }, index) => (
                  <div
                    className="flex items-center gap-3 rounded-md bg-zinc-50 px-3 py-2.5"
                    key={crew.id}
                  >
                    <span className="w-7 text-center text-sm font-black">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-black">
                      {crew.name}
                    </span>
                    <span className="text-sm font-black text-primary">
                      {xp.toLocaleString()} XP
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-black">유저 총 랭킹 TOP 100</p>
                <span className="text-xs font-bold text-muted">개인 누적 XP</span>
              </div>
              <div className="grid max-h-80 gap-1 overflow-y-auto">
                {cumulativeUserRanking.map((runner, index) => (
                  <div
                    className="flex items-center gap-3 rounded-md bg-zinc-50 px-3 py-2.5"
                    key={runner.id}
                  >
                    <span className="w-7 text-center text-sm font-black">
                      {index + 1}
                    </span>
                    <Avatar profile={runner} size="small" />
                    <span className="min-w-0 flex-1 truncate text-sm font-black">
                      @{runner.handle}
                    </span>
                    <span className="text-sm font-black text-primary">
                      {Number(runner.experience_points).toLocaleString()} XP
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {accessibleCrewIds.size ? (
            <section className="border-t border-border pt-5">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <label className="grid min-w-[220px] gap-1 text-xs font-bold">
                  크루원 랭킹
                  <select
                    className="h-11 rounded-md border border-border px-3 text-sm font-bold"
                    onChange={(event) => setRankingCrewId(event.target.value)}
                    value={rankingCrew?.id ?? ""}
                  >
                    {crews
                      .filter((crew) => accessibleCrewIds.has(crew.id))
                      .map((crew) => (
                        <option key={crew.id} value={crew.id}>
                          {crew.name}
                        </option>
                      ))}
                  </select>
                </label>
                <span className="text-xs font-semibold text-muted">
                  총 랭킹에는 탈퇴한 크루원의 과거 기여 XP도 유지됩니다.
                </span>
              </div>
              <div className="grid max-h-80 gap-1 overflow-y-auto">
                {crewMemberRanking.map((runner, index) => (
                  <div
                    className="flex items-center gap-3 rounded-md bg-zinc-50 px-3 py-2.5"
                    key={runner.userId}
                  >
                    <span className="w-7 text-center text-sm font-black">
                      {index + 1}
                    </span>
                    <Avatar profile={runner.profile} size="small" />
                    <span className="min-w-0 flex-1 truncate text-sm font-black">
                      @{runner.profile?.handle ?? "runner"}
                    </span>
                    <span className="text-sm font-black text-primary">
                      {runner.xp.toLocaleString()} XP
                    </span>
                  </div>
                ))}
                {!crewMemberRanking.length ? (
                  <p className="rounded-md bg-zinc-50 p-4 text-center text-sm font-semibold text-muted">
                    선택한 기간에 적립된 크루 경험치가 없습니다.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}
        </CardContent>
      </Card>

      {accessibleCrewIds.size ? (
        <Card>
          <CardHeader>
            <div>
              <Badge tone="blue">함께 달리기</Badge>
              <CardTitle className="mt-3">크루 러닝 일정</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {myCrews.length ? (
            <form className="grid gap-3 border-b border-border pb-5" onSubmit={createCrewRun}>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="h-11 rounded-md border border-border px-3 text-sm font-bold"
                  onChange={(event) => setRunCrewId(event.target.value)}
                  value={runCrewId}
                >
                  <option value="">크루 선택</option>
                  {myCrews.map((crew) => (
                    <option key={crew.id} value={crew.id}>{crew.name}</option>
                  ))}
                </select>
                <input
                  className="h-11 rounded-md border border-border px-3 text-sm font-bold"
                  onChange={(event) => setRunTitle(event.target.value)}
                  placeholder="러닝 이름"
                  value={runTitle}
                />
                <input
                  className="h-11 rounded-md border border-border px-3 text-sm font-semibold"
                  onChange={(event) => setRunPlace(event.target.value)}
                  placeholder="만날 장소"
                  value={runPlace}
                />
                <input
                  className="h-11 rounded-md border border-border px-3 text-sm font-semibold"
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(event) => setRunStartsAt(event.target.value)}
                  type="datetime-local"
                  value={runStartsAt}
                />
              </div>
              <Button type="submit">크루 러닝 모집</Button>
            </form>
            ) : (
              <p className="border-b border-border pb-5 text-sm font-semibold text-muted">
                게스트 러너는 크루장이 만든 러닝 일정에 참가할 수 있습니다.
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {groupRuns
                .filter(
                  (run) => run.crew_id && accessibleCrewIds.has(run.crew_id)
                )
                .map((run) => {
                  const crew = crews.find((item) => item.id === run.crew_id);
                  const joined = Boolean(authUser && run.members.includes(authUser.id));
                  return (
                    <article className="rounded-md border border-border p-4" key={run.id}>
                      <p className="text-xs font-black text-primary">{crew?.name}</p>
                      <p className="mt-2 text-base font-black">{run.title}</p>
                      <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
                        <CalendarDays size={16} />
                        {formatKoreanDateTime(run.starts_at)}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
                        <MapPin size={16} />
                        {run.meeting_place}
                      </p>
                      <Button
                        className="mt-4 w-full"
                        onClick={() => joinGroupRun(run)}
                        size="sm"
                        variant={joined ? "secondary" : "primary"}
                      >
                        {joined ? "참가 취소" : "참가하기"} · {run.members.length}명
                      </Button>
                    </article>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function CrewMemberManager({
  blockedUsers = [],
  crew,
  members,
  onManage,
  onUnblock,
  profiles
}: {
  blockedUsers?: CrewBlock[];
  crew: Crew;
  members: CrewMember[];
  onManage: (
    member: CrewMember,
    action: "block" | "remove" | "toggle-manager"
  ) => void;
  onUnblock?: (block: CrewBlock) => void;
  profiles: Profile[];
}) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-xs font-black text-muted">
        크루원 {members.length}명
      </p>
      <div className="grid max-h-64 gap-2 overflow-y-auto">
        {members.map((member) => {
          const memberProfile = profiles.find(
            (profile) => profile.id === member.user_id
          );
          const isOwner = member.user_id === crew.owner_id || member.role === "owner";
          return (
            <div
              className="flex min-w-0 items-center gap-2 rounded-md bg-zinc-50 p-2"
              key={member.user_id}
            >
              <Avatar profile={memberProfile} size="small" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black">
                  @{memberProfile?.handle ?? "runner"}
                </p>
                <p className="text-[11px] font-bold text-muted">
                  {isOwner
                    ? "크루장"
                    : member.role === "manager"
                      ? "운영진"
                      : "크루원"}
                </p>
              </div>
              {!isOwner ? (
                <>
                  <Button
                    aria-label={
                      member.role === "manager" ? "운영진 해제" : "운영진 지정"
                    }
                    onClick={() => onManage(member, "toggle-manager")}
                    size="icon"
                    title={
                      member.role === "manager" ? "운영진 해제" : "운영진 지정"
                    }
                    variant="ghost"
                  >
                    <ShieldCheck size={16} />
                  </Button>
                  <Button
                    aria-label="크루에서 차단"
                    onClick={() => onManage(member, "block")}
                    size="icon"
                    title="크루에서 차단"
                    variant="ghost"
                  >
                    <Lock size={16} />
                  </Button>
                  <Button
                    aria-label="크루원 내보내기"
                    onClick={() => onManage(member, "remove")}
                    size="icon"
                    title="크루원 내보내기"
                    variant="ghost"
                  >
                    <X size={16} />
                  </Button>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      {blockedUsers.length ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-black text-muted">
            차단한 사용자 {blockedUsers.length}명
          </p>
          <div className="grid gap-2">
            {blockedUsers.map((block) => {
              const blockedProfile = profiles.find(
                (profile) => profile.id === block.user_id
              );
              return (
                <div
                  className="flex items-center gap-2 rounded-md bg-rose-50 p-2"
                  key={block.user_id}
                >
                  <Avatar profile={blockedProfile} size="small" />
                  <p className="min-w-0 flex-1 truncate text-xs font-black">
                    @{blockedProfile?.handle ?? "runner"}
                  </p>
                  {onUnblock ? (
                    <Button
                      onClick={() => onUnblock(block)}
                      size="sm"
                      variant="secondary"
                    >
                      차단 해제
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GuestRequestDmPanel({
  canManage,
  crew,
  guestPass,
  guestPasses,
  guestRequest,
  guestRequests,
  onGuestPassesChange,
  onGuestRequestsChange,
  onToast,
  requester
}: {
  canManage: boolean;
  crew: Crew | undefined;
  guestPass: CrewGuestPass | undefined;
  guestPasses: CrewGuestPass[];
  guestRequest: CrewGuestRequest;
  guestRequests: CrewGuestRequest[];
  onGuestPassesChange: (passes: CrewGuestPass[]) => void;
  onGuestRequestsChange: (requests: CrewGuestRequest[]) => void;
  onToast: (message: string) => void;
  requester: Profile | undefined;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const defaultStart = guestPass?.starts_at
    ? toKoreanDateTimeLocal(guestPass.starts_at)
    : nextKoreanHour();
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(
    guestPass?.ends_at
      ? toKoreanDateTimeLocal(guestPass.ends_at)
      : maximumGuestEnd(defaultStart)
  );

  async function decide(decision: "accepted" | "rejected") {
    if (!supabase || !canManage) {
      return;
    }
    const { data, error } = await (supabase as any).rpc(
      "decide_crew_guest_request",
      {
        access_ends_at:
          decision === "accepted" ? koreanLocalToIso(endsAt) : null,
        access_starts_at:
          decision === "accepted" ? koreanLocalToIso(startsAt) : null,
        decision,
        target_request_id: guestRequest.id
      }
    );
    if (error) {
      onToast("참가 요청을 처리하지 못했습니다. 정원과 최대 3일 제한을 확인해 주세요.");
      return;
    }
    onGuestRequestsChange(
      guestRequests.map((item) =>
        item.id === guestRequest.id
          ? {
              ...item,
              decided_at: new Date().toISOString(),
              ends_at:
                decision === "accepted" ? koreanLocalToIso(endsAt) : null,
              starts_at:
                decision === "accepted" ? koreanLocalToIso(startsAt) : null,
              status: decision
            }
          : item
      )
    );
    if (decision === "accepted") {
      const nextPass: CrewGuestPass = {
        contribution_xp: 0,
        crew_id: guestRequest.crew_id,
        ends_at: koreanLocalToIso(endsAt),
        group_run_id: null,
        id: String(data),
        request_id: guestRequest.id,
        starts_at: koreanLocalToIso(startsAt),
        status: "accepted",
        user_id: guestRequest.requester_id
      };
      onGuestPassesChange([
        nextPass,
        ...guestPasses.filter((pass) => pass.request_id !== guestRequest.id)
      ]);
    }
    onToast(decision === "accepted" ? "게스트 러너 참가를 수락했습니다." : "게스트 러너 참가를 거절했습니다.");
  }

  async function manage(action: "update" | "end") {
    if (!supabase || !canManage || !guestPass) {
      return;
    }
    const { error } = await (supabase as any).rpc("manage_crew_guest_pass", {
      access_ends_at: action === "update" ? koreanLocalToIso(endsAt) : null,
      access_starts_at: action === "update" ? koreanLocalToIso(startsAt) : null,
      action,
      target_pass_id: guestPass.id
    });
    if (error) {
      onToast("게스트 활동 시간을 변경하지 못했습니다.");
      return;
    }
    onGuestPassesChange(
      guestPasses.map((pass) =>
        pass.id === guestPass.id
          ? action === "end"
            ? { ...pass, ends_at: new Date().toISOString(), status: "cancelled" }
            : {
                ...pass,
                ends_at: koreanLocalToIso(endsAt),
                starts_at: koreanLocalToIso(startsAt)
              }
          : pass
      )
    );
    onToast(action === "end" ? "게스트 활동을 바로 종료했습니다." : "게스트 활동 시간을 변경했습니다.");
  }

  return (
    <div className="border-b border-border bg-amber-50 p-4">
      <div className="flex items-center gap-3">
        <Avatar profile={requester} size="small" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">
            {crew?.name ?? "크루"} 게스트 러너 요청
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            @{requester?.handle ?? "runner"} ·{" "}
            {guestRequest.status === "pending"
              ? "검토 대기"
              : guestRequest.status === "accepted"
                ? "수락됨"
                : "거절됨"}
          </p>
        </div>
      </div>
      {canManage &&
      (guestRequest.status === "pending" ||
        (guestRequest.status === "accepted" &&
          guestPass?.status === "accepted")) ? (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold">
              시작
              <input
                className="h-10 rounded-md border border-border px-2 text-xs"
                onChange={(event) => {
                  setStartsAt(event.target.value);
                  setEndsAt(maximumGuestEnd(event.target.value));
                }}
                step={3600}
                type="datetime-local"
                value={startsAt}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold">
              종료
              <input
                className="h-10 rounded-md border border-border px-2 text-xs"
                max={maximumGuestEnd(startsAt)}
                min={startsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                step={3600}
                type="datetime-local"
                value={endsAt}
              />
            </label>
          </div>
          <p className="text-[11px] font-semibold text-muted">
            최대 종료:{" "}
            {formatKoreanDateTime(
              koreanLocalToIso(maximumGuestEnd(startsAt))
            )}
          </p>
          {guestRequest.status === "pending" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => void decide("rejected")} variant="secondary">
                거절
              </Button>
              <Button onClick={() => void decide("accepted")}>수락</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => void manage("end")} variant="danger">
                바로 종료
              </Button>
              <Button onClick={() => void manage("update")}>시간 변경</Button>
            </div>
          )}
        </div>
      ) : guestPass?.status === "accepted" ? (
        <p className="mt-3 rounded-md bg-white/70 px-3 py-2 text-xs font-bold">
          활동 시간: {formatKoreanDateTime(guestPass.starts_at)} ~{" "}
          {formatKoreanDateTime(guestPass.ends_at)}
        </p>
      ) : null}
    </div>
  );
}

function ChatView({
  authUser,
  crewBlocks,
  crewGuestPasses,
  crewGuestRequests,
  crewMembers,
  crews,
  initialChatId,
  initialCrewId,
  profiles,
  onCrewGuestPassesChange,
  onCrewGuestRequestsChange,
  onCrewBlocksChange,
  onCrewMembersChange,
  onInitialChatOpened,
  onInitialCrewOpened,
  onToast
}: {
  authUser: User | null;
  crewBlocks: CrewBlock[];
  crewGuestPasses: CrewGuestPass[];
  crewGuestRequests: CrewGuestRequest[];
  crewMembers: CrewMember[];
  crews: Crew[];
  initialChatId: string;
  initialCrewId: string;
  profiles: Profile[];
  onCrewGuestPassesChange: (passes: CrewGuestPass[]) => void;
  onCrewGuestRequestsChange: (requests: CrewGuestRequest[]) => void;
  onCrewBlocksChange: (blocks: CrewBlock[]) => void;
  onCrewMembersChange: (members: CrewMember[]) => void;
  onInitialChatOpened: () => void;
  onInitialCrewOpened: () => void;
  onToast: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [body, setBody] = useState("");
  const [activeChatId, setActiveChatId] = useState("");
  const [directChats, setDirectChats] = useState<DirectChat[]>([]);
  const [directMessages, setDirectMessages] = useState<ChatMessage[]>([]);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [loadingDirectChat, setLoadingDirectChat] = useState(false);
  const [chatSearch, setChatSearch] = useState("");

  const loadDirectChats = useCallback(async () => {
    if (!authUser || !supabase) {
      setDirectChats([]);
      return;
    }

    const { data: ownMemberships } = await (supabase.from("chat_members") as any)
      .select("chat_id")
      .eq("user_id", authUser.id);
    const chatIds = (ownMemberships ?? []).map(
      (membership: { chat_id: string }) => membership.chat_id
    );

    if (!chatIds.length) {
      setDirectChats([]);
      return;
    }

    const [{ data: chats }, { data: memberships }] = await Promise.all([
      (supabase.from("chats") as any)
        .select("id,crew_id,title")
        .in("id", chatIds),
      (supabase.from("chat_members") as any)
        .select("chat_id,user_id")
        .in("chat_id", chatIds)
    ]);
    setDirectChats(
      ((chats ?? []) as Array<{
        crew_id: string | null;
        id: string;
        title: string | null;
      }>).map((chat) => ({
        crewId: chat.crew_id,
        id: chat.id,
        memberIds: (memberships ?? [])
          .filter(
            (membership: { chat_id: string; user_id: string }) =>
              membership.chat_id === chat.id
          )
          .map(
            (membership: { chat_id: string; user_id: string }) =>
              membership.user_id
          ),
        title: chat.title
      }))
    );
  }, [authUser, supabase]);

  useEffect(() => {
    void loadDirectChats();
  }, [loadDirectChats]);

  useEffect(() => {
    async function loadMessages() {
      if (!supabase || !activeChatId) {
        setDirectMessages([]);
        return;
      }

      const { data } = await (supabase.from("messages") as any)
        .select("id,chat_id,sender_id,body,created_at")
        .eq("chat_id", activeChatId)
        .order("created_at", { ascending: true })
        .limit(100);
      setDirectMessages((data ?? []) as ChatMessage[]);
    }

    void loadMessages();
  }, [activeChatId, supabase]);

  useEffect(() => {
    if (!supabase || !authUser) {
      return;
    }

    const channel = supabase
      .channel(`dm-${authUser.id}-${activeChatId || "inbox"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          ...(activeChatId ? { filter: `chat_id=eq.${activeChatId}` } : {})
        },
        (payload) => {
          if (!activeChatId || payload.new.chat_id !== activeChatId) {
            return;
          }
          const incoming = payload.new as ChatMessage;
          setDirectMessages((current) =>
            current.some((message) => message.id === incoming.id)
              ? current
              : [...current, incoming]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_members" },
        () => void loadDirectChats()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeChatId, authUser, loadDirectChats, supabase]);

  useEffect(() => {
    if (!initialCrewId || !directChats.length) {
      return;
    }
    const crewChat = directChats.find((chat) => chat.crewId === initialCrewId);
    if (crewChat) {
      setActiveChatId(crewChat.id);
      setShowChatInfo(false);
      onInitialCrewOpened();
    }
  }, [directChats, initialCrewId, onInitialCrewOpened]);

  useEffect(() => {
    if (!initialChatId || !directChats.some((chat) => chat.id === initialChatId)) {
      return;
    }
    setActiveChatId(initialChatId);
    setShowChatInfo(false);
    onInitialChatOpened();
  }, [directChats, initialChatId, onInitialChatOpened]);

  async function startDirectChat(target: Profile) {
    if (!authUser || !supabase || target.id.startsWith("sample")) {
      onToast("실제 RUNGETHER 회원에게 메시지를 보낼 수 있습니다.");
      return;
    }

    const existing = directChats.find(
      (chat) => !chat.crewId && chat.memberIds.includes(target.id)
    );
    if (existing) {
      setActiveChatId(existing.id);
      setShowNewMessage(false);
      return;
    }

    setLoadingDirectChat(true);
    const directKey = [authUser.id, target.id].sort().join(":");
    let { data: chat } = await (supabase.from("chats") as any)
      .select("id")
      .eq("direct_key", directKey)
      .maybeSingle();

    if (!chat) {
      const { data, error } = await (supabase.from("chats") as any)
        .insert({
          created_by: authUser.id,
          direct_key: directKey,
          is_public: false
        })
        .select("id")
        .single();

      if (error || !data) {
        setLoadingDirectChat(false);
        onToast("새 메시지를 시작하지 못했습니다. 최신 Supabase SQL을 실행해 주세요.");
        return;
      }
      chat = data;

      const { error: memberError } = await (supabase.from("chat_members") as any)
        .insert([
          { chat_id: chat.id, user_id: authUser.id },
          { chat_id: chat.id, user_id: target.id }
        ]);

      if (memberError) {
        setLoadingDirectChat(false);
        onToast("대화 참여자를 등록하지 못했습니다.");
        return;
      }
    }

    const nextChat: DirectChat = {
      crewId: null,
      id: chat.id,
      memberIds: [authUser.id, target.id],
      title: null
    };
    setDirectChats((current) => [
      nextChat,
      ...current.filter((item) => item.id !== nextChat.id)
    ]);
    setActiveChatId(chat.id);
    setShowNewMessage(false);
    setLoadingDirectChat(false);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = body.trim();

    if (!authUser || !supabase) {
      onToast("채팅은 로그인 후 사용할 수 있습니다.");
      return;
    }
    if (!normalized) {
      return;
    }

    const { data, error } = await (supabase.from("messages") as any)
      .insert({
        chat_id: activeChatId,
        sender_id: authUser.id,
        body: normalized
      })
      .select("id,chat_id,sender_id,body,created_at")
      .single();

    if (error) {
      onToast("메시지를 보내지 못했습니다. 최신 Supabase SQL을 실행해 주세요.");
      return;
    }

    setDirectMessages((current) => [...current, data as ChatMessage]);
    setBody("");
  }

  const activeDirectChat = directChats.find((chat) => chat.id === activeChatId);
  const activeCrew = crews.find((crew) => crew.id === activeDirectChat?.crewId);
  const activeTarget = profiles.find(
    (profile) =>
      !activeDirectChat?.crewId &&
      profile.id !== authUser?.id &&
      activeDirectChat?.memberIds.includes(profile.id)
  );
  const activeMessages = directMessages;
  const activeCrewMembers = crewMembers.filter(
    (member) => member.crew_id === activeCrew?.id
  );
  const canManageActiveCrew =
    activeCrew?.owner_id === authUser?.id ||
    crewMembers.some(
      (member) =>
        member.crew_id === activeCrew?.id &&
        member.user_id === authUser?.id &&
        member.role === "manager"
    );
  const activeGuestRequest = crewGuestRequests.find(
    (request) => request.request_chat_id === activeChatId
  );
  const activeRequestCrew = crews.find(
    (crew) => crew.id === activeGuestRequest?.crew_id
  );
  const canManageActiveRequest =
    activeRequestCrew?.owner_id === authUser?.id ||
    crewMembers.some(
      (member) =>
        member.crew_id === activeRequestCrew?.id &&
        member.user_id === authUser?.id &&
        member.role === "manager"
    );
  const activeGuestPass = crewGuestPasses.find(
    (pass) => pass.request_id === activeGuestRequest?.id
  );

  async function manageActiveCrewMember(
    member: CrewMember,
    action: "block" | "remove" | "toggle-manager"
  ) {
    if (!supabase || !activeCrew || !canManageActiveCrew || member.role === "owner") {
      return;
    }
    if (action === "block") {
      const { error } = await (supabase as any).rpc("block_crew_runner", {
        block_reason: null,
        target_crew_id: activeCrew.id,
        target_user_id: member.user_id
      });
      if (error) {
        onToast("크루에서 사용자를 차단하지 못했습니다.");
        return;
      }
      onCrewMembersChange(
        crewMembers.filter(
          (item) =>
            !(item.crew_id === activeCrew.id && item.user_id === member.user_id)
        )
      );
      onCrewBlocksChange([
        {
          blocked_by: authUser!.id,
          created_at: new Date().toISOString(),
          crew_id: activeCrew.id,
          reason: null,
          user_id: member.user_id
        },
        ...crewBlocks.filter(
          (item) =>
            !(item.crew_id === activeCrew.id && item.user_id === member.user_id)
        )
      ]);
      setDirectChats((current) =>
        current.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                memberIds: chat.memberIds.filter((id) => id !== member.user_id)
              }
            : chat
        )
      );
      onToast("사용자를 크루에서 차단했습니다.");
      return;
    }

    if (action === "remove") {
      const { error } = await (supabase.from("crew_members") as any)
        .delete()
        .eq("crew_id", activeCrew.id)
        .eq("user_id", member.user_id);
      if (error) {
        onToast("크루원을 내보내지 못했습니다.");
        return;
      }
      onCrewMembersChange(
        crewMembers.filter(
          (item) =>
            !(item.crew_id === activeCrew.id && item.user_id === member.user_id)
        )
      );
      setDirectChats((current) =>
        current.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                memberIds: chat.memberIds.filter((id) => id !== member.user_id)
              }
            : chat
        )
      );
      onToast("크루원과 크루 DM 참여를 함께 해제했습니다.");
      return;
    }

    const nextRole = member.role === "manager" ? "member" : "manager";
    const { error } = await (supabase.from("crew_members") as any)
      .update({ role: nextRole })
      .eq("crew_id", activeCrew.id)
      .eq("user_id", member.user_id);
    if (error) {
      onToast("크루원 역할을 변경하지 못했습니다.");
      return;
    }
    onCrewMembersChange(
      crewMembers.map((item) =>
        item.crew_id === activeCrew.id && item.user_id === member.user_id
          ? { ...item, role: nextRole }
          : item
      )
    );
  }

  async function unblockActiveCrewRunner(block: CrewBlock) {
    if (!supabase || !activeCrew || !canManageActiveCrew) {
      return;
    }
    const { error } = await (supabase as any).rpc("unblock_crew_runner", {
      target_crew_id: activeCrew.id,
      target_user_id: block.user_id
    });
    if (error) {
      onToast("차단을 해제하지 못했습니다.");
      return;
    }
    onCrewBlocksChange(
      crewBlocks.filter(
        (item) =>
          !(item.crew_id === activeCrew.id && item.user_id === block.user_id)
      )
    );
    onToast("크루 차단을 해제했습니다.");
  }

  if (!activeChatId) {
    const normalizedSearch = chatSearch.trim().toLowerCase();
    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border">
          <div>
            <Badge tone="blue">DM</Badge>
            <CardTitle className="mt-3">메시지</CardTitle>
          </div>
          <Button
            aria-label="새 메시지"
            onClick={() => setShowNewMessage((value) => !value)}
            size="icon"
            title="새 메시지"
            variant="ghost"
          >
            {showNewMessage ? <X size={20} /> : <Plus size={20} />}
          </Button>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <div className="p-4">
            <label className="flex h-12 items-center gap-2 rounded-md bg-zinc-100 px-3">
              <Search className="text-muted" size={20} />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                onChange={(event) => setChatSearch(event.target.value)}
                placeholder="검색"
                value={chatSearch}
              />
            </label>
          </div>

          {showNewMessage ? (
            <div className="border-y border-border px-4 py-2">
              <p className="py-2 text-sm font-black">새 메시지</p>
              {profiles
                .filter(
                  (candidate) =>
                    candidate.id !== authUser?.id &&
                    !candidate.id.startsWith("sample") &&
                    (!normalizedSearch ||
                      candidate.handle.toLowerCase().includes(normalizedSearch))
                )
                .map((candidate) => (
                  <button
                    className="flex w-full items-center gap-3 rounded-md py-3 text-left hover:bg-zinc-50"
                    disabled={loadingDirectChat}
                    key={candidate.id}
                    onClick={() => void startDirectChat(candidate)}
                    type="button"
                  >
                    <Avatar profile={candidate} size="small" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black">
                        @{candidate.handle}
                      </span>
                      <span className="block truncate text-xs font-semibold text-muted">
                        {candidate.display_name}
                      </span>
                    </span>
                    <ChevronRight className="text-muted" size={18} />
                  </button>
                ))}
            </div>
          ) : null}

          <div className="divide-y divide-border px-4">
            {directChats.map((chat) => {
              const crew = crews.find((item) => item.id === chat.crewId);
              const target = profiles.find(
                (candidate) =>
                  !chat.crewId &&
                  candidate.id !== authUser?.id &&
                  chat.memberIds.includes(candidate.id)
              );
              if (
                normalizedSearch &&
                !target?.handle.toLowerCase().includes(normalizedSearch) &&
                !crew?.name.toLowerCase().includes(normalizedSearch)
              ) {
                return null;
              }
              return (
                <button
                  className="flex w-full items-center gap-3 py-4 text-left"
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  type="button"
                >
                  {crew ? (
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-white">
                      <Users size={20} />
                    </span>
                  ) : (
                    <Avatar profile={target} size="small" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">
                      {crew ? crew.name : `@${target?.handle ?? "runner"}`}
                    </span>
                    <span className="mt-1 block truncate text-xs font-semibold text-muted">
                      {crew
                        ? `크루 DM · ${chat.memberIds.length}명`
                        : "메시지를 확인하세요"}
                    </span>
                  </span>
                  <ChevronRight className="text-muted" size={18} />
                </button>
              );
            })}
            {!directChats.length ? (
              <EmptyState
                description="크루에 가입하면 크루 DM이 자동으로 생깁니다. 개인 DM은 새 메시지 버튼에서 시작할 수 있습니다."
                icon={MessageCircle}
                title="아직 대화가 없습니다"
              />
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            aria-label="메시지 목록으로"
            onClick={() => {
              setActiveChatId("");
              setShowChatInfo(false);
            }}
            size="icon"
            title="메시지 목록으로"
            variant="ghost"
          >
            <ChevronRight className="rotate-180" size={21} />
          </Button>
          <div>
            <CardTitle>
              {activeCrew?.name ?? `@${activeTarget?.handle ?? "runner"}`}
            </CardTitle>
            <p className="mt-1 text-xs font-semibold text-muted">
              {activeCrew
                ? `크루 DM · ${activeDirectChat?.memberIds.length ?? 0}명`
                : "1:1 메시지"}
            </p>
          </div>
        </div>
        {activeCrew ? (
          <Button
            aria-label="크루 DM 정보"
            onClick={() => setShowChatInfo((value) => !value)}
            size="icon"
            title="크루 DM 정보"
            variant="ghost"
          >
            {showChatInfo ? <X size={20} /> : <Users size={20} />}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        {activeGuestRequest ? (
          <GuestRequestDmPanel
            canManage={Boolean(canManageActiveRequest)}
            crew={activeRequestCrew}
            guestPass={activeGuestPass}
            guestPasses={crewGuestPasses}
            guestRequest={activeGuestRequest}
            guestRequests={crewGuestRequests}
            onGuestPassesChange={onCrewGuestPassesChange}
            onGuestRequestsChange={onCrewGuestRequestsChange}
            onToast={onToast}
            requester={profiles.find(
              (item) => item.id === activeGuestRequest.requester_id
            )}
          />
        ) : null}
        {showChatInfo && activeCrew ? (
          <div className="border-b border-border bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-14 place-items-center rounded-full bg-ink text-white">
                <Users size={22} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-black">{activeCrew.name}</p>
                <p className="mt-1 text-xs font-semibold text-muted">
                  {activeCrewMembers.length}명 · 크루 가입과 자동 동기화
                </p>
              </div>
            </div>
            {canManageActiveCrew ? (
              <CrewMemberManager
                blockedUsers={crewBlocks.filter(
                  (block) => block.crew_id === activeCrew.id
                )}
                crew={activeCrew}
                members={activeCrewMembers}
                onManage={manageActiveCrewMember}
                onUnblock={unblockActiveCrewRunner}
                profiles={profiles}
              />
            ) : (
              <div className="mt-4 grid gap-2">
                {activeCrewMembers.map((member) => {
                  const memberProfile = profiles.find(
                    (profile) => profile.id === member.user_id
                  );
                  return (
                    <div
                      className="flex items-center gap-2 rounded-md bg-zinc-50 p-2"
                      key={member.user_id}
                    >
                      <Avatar profile={memberProfile} size="small" />
                      <p className="min-w-0 flex-1 truncate text-xs font-black">
                        @{memberProfile?.handle ?? "runner"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        <div className="grid min-h-[430px] content-end gap-3 bg-zinc-50 p-4">
          {activeMessages.length ? (
            activeMessages.map((message) => {
              const sender = profiles.find((item) => item.id === message.sender_id);
              const mine = message.sender_id === authUser?.id;

              return (
                <div
                  className={cn(
                    "max-w-[82%]",
                    mine ? "ml-auto text-right" : "mr-auto"
                  )}
                  key={message.id}
                >
                  <p className="mb-1 text-[11px] font-bold text-muted">
                    {mine ? "나" : `@${sender?.handle ?? "runner"}`}
                  </p>
                  <p
                    className={cn(
                      "rounded-md px-3 py-2 text-left text-sm font-semibold leading-6",
                      mine ? "bg-primary text-white" : "border border-border bg-white"
                    )}
                  >
                    {message.body}
                  </p>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="첫 메시지를 남겨보세요"
              description={
                activeCrew
                  ? "크루원 모두가 보는 단체 메시지를 보내보세요."
                  : "둘만 볼 수 있는 메시지를 보내보세요."
              }
            />
          )}
        </div>
        <form
          className="grid grid-cols-[1fr_auto] gap-2 border-t border-border bg-white p-3"
          onSubmit={sendMessage}
        >
          <input
            className="min-w-0 rounded-md border border-border px-3 text-sm font-semibold outline-none focus:border-primary"
            maxLength={300}
            onChange={(event) => setBody(event.target.value)}
            placeholder="메시지 입력"
            value={body}
          />
          <Button aria-label="메시지 보내기" size="icon" title="메시지 보내기" type="submit">
            <Send size={18} />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileView({
  authUser,
  crewMembers,
  crews,
  follows,
  posts,
  profile,
  profiles,
  runs,
  onEdit,
  onFollowers,
  onShareRun,
  onSignOut
  ,
  onVisibilityChange
}: {
  authUser: User | null;
  crewMembers: CrewMember[];
  crews: Crew[];
  follows: FollowEdge[];
  posts: FeedPost[];
  profile: Profile | null;
  profiles: Profile[];
  runs: RunRecord[];
  onEdit: () => void;
  onFollowers: () => void;
  onShareRun: (runId: string) => void;
  onSignOut: () => void;
  onVisibilityChange: (runId: string, visibility: Visibility) => void;
}) {
  const [tab, setTab] = useState<"posts" | "runs">("posts");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [crewDepartureChoices, setCrewDepartureChoices] = useState<
    Record<string, string>
  >({});
  const supabase = useMemo(() => getSupabaseClient(), []);
  const router = useRouter();

  if (!authUser || !profile) {
    return (
      <Card>
        <CardContent className="p-6 sm:p-8">
          <EmptyState
            icon={UserRound}
            title="로그인이 필요합니다"
            description="카카오 로그인 후 RUNGETHER 아이디와 러닝 프로필을 관리할 수 있습니다."
          />
          <div className="mt-5 flex justify-center">
            <KakaoLoginButton />
          </div>
        </CardContent>
      </Card>
    );
  }

  const myPosts = posts.filter((post) => post.author_id === authUser.id);
  const ownedCrews = crews.filter((crew) => crew.owner_id === authUser.id);
  const profileHandle = profile.handle;
  const followerCount = follows.filter(
    (follow) =>
      follow.following_id === authUser.id && follow.status === "accepted"
  ).length;
  const followingCount = follows.filter(
    (follow) =>
      follow.follower_id === authUser.id && follow.status === "accepted"
  ).length;
  const level = Math.max(1, Math.min(100, Number(profile.level || 1)));
  const experience = Number(profile.experience_points || 0);
  const levelStartExperience = experienceAtLevel(level);
  const nextLevelExperience =
    level >= 100 ? levelStartExperience : experienceAtLevel(level + 1);
  const levelProgress =
    level >= 100
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((experience - levelStartExperience) /
              (nextLevelExperience - levelStartExperience)) *
              100
          )
        );

  async function deleteAccount() {
    if (
      !supabase ||
      deletingAccount ||
      deleteConfirmation.trim().toLowerCase() !== profileHandle.toLowerCase()
    ) {
      return;
    }
    setDeletingAccount(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const providerToken = sessionData.session?.provider_token;
    const { error } = await (supabase as any).rpc("delete_my_account", {
      crew_transfers: Object.fromEntries(
        ownedCrews.map((crew) => [
          crew.id,
          crewDepartureChoices[crew.id] ?? "__delete__"
        ])
      ),
      handle_confirmation: deleteConfirmation.trim()
    });
    if (error) {
      setDeletingAccount(false);
      window.alert(
        "계정을 삭제하지 못했습니다. 최신 supabase/schema.sql을 실행한 뒤 다시 시도해 주세요."
      );
      return;
    }
    if (providerToken) {
      await fetch("/api/auth/cancel-signup", {
        body: JSON.stringify({ providerToken }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }).catch(() => undefined);
    }
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    router.replace("/");
    router.refresh();
  }

  if (settingsOpen) {
    const settingsSections = [
      {
        title: "내 계정",
        items: [
          {
            description: "아이디, 이름, 소개, 프로필 사진",
            icon: UserRound,
            label: "프로필 편집",
            onClick: onEdit
          },
          {
            description: profile.is_private
              ? "현재 비공개 계정"
              : "현재 공개 계정",
            icon: Lock,
            label: "계정 공개 범위",
            onClick: onEdit
          },
          {
            description: "팔로워, 팔로잉 및 요청 관리",
            icon: UserPlus,
            label: "팔로우 관리",
            onClick: onFollowers
          }
        ]
      },
      {
        title: "정보 및 지원",
        items: [
          {
            description: "RUNGETHER 이용 안내",
            icon: CircleHelp,
            label: "도움말",
            onClick: () =>
              window.alert("도움말과 고객지원 기능은 다음 업데이트에서 연결됩니다.")
          },
          {
            description: "서비스 및 버전 정보",
            icon: Info,
            label: "정보",
            onClick: () => window.alert("RUNGETHER 0.1.0")
          }
        ]
      }
    ];

    return (
      <section className="fixed inset-0 z-[140] overflow-y-auto bg-[#0b1014] text-white">
        <div className="mx-auto min-h-screen max-w-[760px]">
          <header className="sticky top-0 z-10 grid h-16 grid-cols-[48px_1fr_48px] items-center border-b border-white/10 bg-[#0b1014]/95 px-3 backdrop-blur">
            <button
              aria-label="설정 닫기"
              className="grid size-11 place-items-center"
              onClick={() => setSettingsOpen(false)}
              type="button"
            >
              <ChevronRight className="rotate-180" size={27} />
            </button>
            <h2 className="text-center text-lg font-black">설정 및 활동</h2>
            <span />
          </header>

          <div className="p-4">
            <label className="flex h-12 items-center gap-3 rounded-md bg-white/10 px-4 text-zinc-400">
              <Search size={21} />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none"
                placeholder="검색"
              />
            </label>
          </div>

          {settingsSections.map((section) => (
            <section className="border-b-8 border-white/10 py-3" key={section.title}>
              <h3 className="px-5 py-3 text-sm font-black text-zinc-400">
                {section.title}
              </h3>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/5"
                    key={item.label}
                    onClick={item.onClick}
                    type="button"
                  >
                    <Icon className="shrink-0" size={25} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold">{item.label}</span>
                      <span className="mt-1 block truncate text-xs font-semibold text-zinc-500">
                        {item.description}
                      </span>
                    </span>
                    <ChevronRight className="text-zinc-500" size={20} />
                  </button>
                );
              })}
            </section>
          ))}

          <section className="grid gap-1 px-5 py-7">
            <button
              className="flex min-h-12 items-center gap-3 text-left text-blue-400"
              onClick={onSignOut}
              type="button"
            >
              <LogOut size={22} />
              <span className="font-bold">로그아웃</span>
            </button>
            <button
              className="flex min-h-12 items-center gap-3 text-left text-rose-400"
              onClick={() => setDeleteOpen(true)}
              type="button"
            >
              <Trash2 size={22} />
              <span className="font-bold">계정 영구 삭제</span>
            </button>
            <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">
              계정을 삭제하면 게시물, 러닝 기록, 팔로우, DM, 크루 소속과 모든
              개인 랭킹 기록이 복구할 수 없게 삭제됩니다. 크루에 기여한 XP는
              익명 기록으로 남아 크루 XP가 내려가지 않습니다.
            </p>
          </section>
        </div>

        {deleteOpen ? (
          <div className="fixed inset-0 z-20 grid place-items-center bg-black/75 p-4">
            <div className="w-full max-w-[440px] rounded-md bg-white p-5 text-ink shadow-2xl">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
                  <Trash2 size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-black">계정을 영구 삭제할까요?</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                    확인을 위해 아래에 <strong>@{profile.handle}</strong>의
                    아이디를 입력하세요.
                  </p>
                </div>
              </div>
              {ownedCrews.length ? (
                <div className="mt-4 grid max-h-56 gap-3 overflow-y-auto rounded-md border border-border bg-zinc-50 p-3">
                  <p className="text-xs font-black text-muted">
                    소유한 크루 처리
                  </p>
                  {ownedCrews.map((crew) => {
                    const candidates = crewMembers
                      .filter(
                        (member) =>
                          member.crew_id === crew.id &&
                          member.user_id !== authUser.id
                      )
                      .map((member) =>
                        profiles.find(
                          (candidate) => candidate.id === member.user_id
                        )
                      )
                      .filter((candidate): candidate is Profile =>
                        Boolean(candidate)
                      );
                    return (
                      <label className="grid gap-1.5" key={crew.id}>
                        <span className="text-sm font-black">{crew.name}</span>
                        <select
                          className="h-11 rounded-md border border-border bg-white px-3 text-sm font-bold"
                          onChange={(event) =>
                            setCrewDepartureChoices((current) => ({
                              ...current,
                              [crew.id]: event.target.value
                            }))
                          }
                          value={
                            crewDepartureChoices[crew.id] ?? "__delete__"
                          }
                        >
                          <option value="__delete__">
                            크루와 모든 크루 데이터 삭제
                          </option>
                          {candidates.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              @{candidate.handle}에게 크루장 이전
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
              ) : null}
              <input
                autoComplete="off"
                className="mt-4 h-12 w-full rounded-md border border-border px-3 text-sm font-bold outline-none focus:border-rose-500"
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={profile.handle}
                value={deleteConfirmation}
              />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  disabled={deletingAccount}
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteConfirmation("");
                  }}
                  variant="secondary"
                >
                  취소
                </Button>
                <Button
                  disabled={
                    deletingAccount ||
                    deleteConfirmation.trim().toLowerCase() !==
                      profile.handle.toLowerCase()
                  }
                  onClick={() => void deleteAccount()}
                  variant="danger"
                >
                  {deletingAccount ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Trash2 size={18} />
                  )}
                  영구 삭제
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="px-5 py-6 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-xl font-black">@{profile.handle}</p>
            <Button
              aria-label="설정 및 활동"
              onClick={() => setSettingsOpen(true)}
              size="icon"
              title="설정 및 활동"
              variant="ghost"
            >
              <Menu size={22} />
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-[auto_1fr] items-center gap-6">
            <Avatar profile={profile} size="large" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <ProfileStat label="게시물" value={myPosts.length} />
              <button onClick={onFollowers} type="button">
                <ProfileStat label="팔로워" value={followerCount} />
              </button>
              <button onClick={onFollowers} type="button">
                <ProfileStat label="팔로잉" value={followingCount} />
              </button>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-black">{profile.display_name}</p>
            <p className="mt-1 text-sm font-semibold leading-6">
              {profile.bio || "러닝 목표와 좋아하는 코스를 소개해 보세요."}
            </p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-muted">
              {profile.is_private ? <Lock size={14} /> : <Sparkles size={14} />}
              {profile.is_private ? "비공개 계정" : "공개 계정"}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
            <Button onClick={onEdit} variant="secondary">
              <Settings size={17} />
              프로필 편집
            </Button>
            <Button
              aria-label="팔로우 관리"
              onClick={onFollowers}
              size="icon"
              title="팔로우 관리"
              variant="secondary"
            >
              <UserPlus size={18} />
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-md bg-zinc-50 p-3 text-center">
            <ProfileStat label="러닝" value={runs.length} />
            <ProfileStat
              label="누적 거리"
              value={`${formatDistance(Number(profile.total_distance_m))}km`}
            />
            <ProfileStat
              label="평균 거리"
              value={`${formatDistance(
                runs.length
                  ? runs.reduce((sum, run) => sum + Number(run.distance_m), 0) /
                      runs.length
                  : 0
              )}km`}
            />
          </div>

          <div className="mt-3 rounded-md bg-ink p-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white/60">러너 레벨</p>
                <p className="mt-1 text-xl font-black">LV.{level}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black">
                  {Number(profile.current_streak || 0)}일 연속
                </p>
                <p className="mt-1 text-xs font-semibold text-white/60">
                  최장 {Number(profile.longest_streak || 0)}일
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-bold text-white/60">
              <span>{experience.toLocaleString()} XP</span>
              <span>
                {level >= 100
                  ? "최대 레벨"
                  : `다음 레벨까지 ${Math.max(0, nextLevelExperience - experience).toLocaleString()} XP`}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 border-y border-border">
          <button
            className={cn(
              "h-12 text-sm font-black",
              tab === "posts" ? "border-b-2 border-ink text-ink" : "text-muted"
            )}
            onClick={() => setTab("posts")}
            type="button"
          >
            게시물
          </button>
          <button
            className={cn(
              "h-12 text-sm font-black",
              tab === "runs" ? "border-b-2 border-ink text-ink" : "text-muted"
            )}
            onClick={() => setTab("runs")}
            type="button"
          >
            러닝 기록
          </button>
        </div>

        {tab === "posts" ? (
          myPosts.length ? (
            <div className="grid grid-cols-3 gap-px bg-border">
              {myPosts.map((post) => (
                <article
                  className="relative grid aspect-square min-w-0 content-end overflow-hidden bg-white"
                  key={post.id}
                >
                  {post.media_urls?.[0] || post.runs?.route_image_url ? (
                    <img
                      alt={post.body || "러닝 게시물"}
                      className="absolute inset-0 size-full object-cover"
                      src={post.media_urls?.[0] || post.runs?.route_image_url || ""}
                    />
                  ) : (
                    <div className="p-3">
                      <Route className="mb-2 text-primary" size={18} />
                      <p className="line-clamp-3 text-xs font-bold leading-5">
                        {post.body}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              description="러닝을 기록하고 첫 게시물을 공유해 보세요."
              icon={Route}
              title="아직 게시물이 없습니다"
            />
          )
        ) : runs.length ? (
          <div className="divide-y divide-border px-5 sm:px-8">
            {runs.map((run) => (
              <RunRecordCard
                key={run.id}
                run={run}
                onShare={() => onShareRun(run.id)}
                onVisibilityChange={(visibility) =>
                  onVisibilityChange(run.id, visibility)
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            description="러닝을 종료하면 거리와 시간이 여기에 쌓입니다."
            icon={Activity}
            title="아직 러닝 기록이 없습니다"
          />
        )}
      </CardContent>
    </Card>
  );
}

function ProfileStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-base font-black sm:text-lg">{value}</p>
      <p className="mt-1 truncate text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

function RunRecordCard({
  run,
  onShare,
  onVisibilityChange
}: {
  run: RunRecord;
  onShare: () => void;
  onVisibilityChange: (visibility: Visibility) => void;
}) {
  return (
    <article className="grid gap-3 py-4">
      {run.route_image_url ? (
        <img
          alt="러닝 경로"
          className="max-h-[420px] w-full rounded-md bg-ink object-cover"
          src={run.route_image_url}
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{run.title || "러닝 기록"}</p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {formatKoreanDateTime(run.started_at)}
          </p>
        </div>
        <Button onClick={onShare} size="sm">
          <Send size={16} />
          게시물로 공유
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
        <RunPostMetric label="거리" value={`${formatDistance(run.distance_m)} km`} />
        <RunPostMetric label="시간" value={formatDuration(run.duration_s)} />
        <RunPostMetric
          label="페이스"
          value={
            run.average_pace_s
              ? `${formatDuration(run.average_pace_s)} /km`
              : "--:--"
          }
        />
      </div>
      <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900">
        <span>거리 + 연속 러닝 보상</span>
        <span>
          +{Number(run.xp_earned || 0)} XP · {Number(run.streak_day || 1)}일 연속
        </span>
      </div>
      <label className="flex items-center justify-between gap-3 text-xs font-bold text-muted">
        공개 범위
        <select
          className="h-9 rounded-md border border-border bg-white px-3 text-xs font-bold text-ink"
          onChange={(event) =>
            onVisibilityChange(event.target.value as Visibility)
          }
          value={run.visibility}
        >
          <option value="public">전체 공개</option>
          <option value="friends">팔로워 공개</option>
          <option value="private">나만 보기</option>
        </select>
      </label>
    </article>
  );
}

function DesktopAside({
  authUser,
  isRunning,
  profile,
  sharingLocation,
  onChangeView,
  onEmergency,
  onShare
}: {
  authUser: User | null;
  isRunning: boolean;
  profile: Profile | null;
  sharingLocation: boolean;
  onChangeView: (view: View) => void;
  onEmergency: () => void;
  onShare: () => void;
}) {
  return (
    <aside className="hidden content-start gap-5 lg:grid">
      <Card>
        <CardHeader>
          <div>
            <Badge tone={authUser ? "green" : "neutral"}>
              {authUser ? "로그인됨" : "게스트"}
            </Badge>
            <CardTitle className="mt-3">
              {profile ? `@${profile.handle}` : "RUNGETHER 계정"}
            </CardTitle>
          </div>
          <Bell className="text-muted" size={20} />
        </CardHeader>
        <CardContent>
          <p className="text-sm font-semibold leading-6 text-muted">
            {profile
              ? "모바일에서 기록한 러닝을 데스크톱에서 분석하고 소셜 기능을 관리할 수 있습니다."
              : "로그인하면 모바일과 데스크톱에서 같은 기록과 팔로우를 확인할 수 있습니다."}
          </p>
          {!profile ? (
            <div className="mt-4">
              <KakaoLoginButton className="w-full" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>빠른 작업</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <QuickButton
            icon={Send}
            label={sharingLocation ? "위치 공유 종료" : "위치 공유 시작"}
            onClick={onShare}
          />
          <QuickButton
            icon={MessageCircle}
            label="DM 열기"
            onClick={() => onChangeView("chat")}
          />
          <QuickButton
            icon={UserPlus}
            label="러너 찾기"
            onClick={() => onChangeView("friends")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <Badge tone="rose">안전</Badge>
            <CardTitle className="mt-3">러닝 안전 상태</CardTitle>
          </div>
          <ShieldCheck className="text-primary" size={22} />
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between rounded-md bg-zinc-50 p-3">
            <span className="text-sm font-bold text-muted">GPS 기록</span>
            <span className="text-sm font-black text-primary">
              {isRunning ? "작동 중" : "대기"}
            </span>
          </div>
          <Button onClick={onEmergency} variant="danger">
            <AlertTriangle size={18} />
            SOS 기록
          </Button>
          <p className="text-xs font-semibold leading-5 text-muted">
            실제 긴급 상황에는 앱 기록과 별도로 112 또는 119에 직접 연락해야 합니다.
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}

function JourneyPanel() {
  const [checkedIn, setCheckedIn] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div>
          <Badge tone="blue">국토대장정</Badge>
          <CardTitle className="mt-3">서울 광화문 → 부산 해운대</CardTitle>
        </div>
        <Navigation className="text-accent" size={22} />
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>178 km 완료</span>
              <span className="text-accent">43%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full w-[43%] rounded-full bg-accent" />
            </div>
            <p className="mt-3 text-xs font-semibold text-muted">
              다음 체크포인트까지 12.4 km · 예상 도착 17:30
            </p>
          </div>
          <Button
            onClick={() => setCheckedIn((value) => !value)}
            variant={checkedIn ? "primary" : "secondary"}
          >
            <Check size={18} />
            {checkedIn ? "오늘 체크인 완료" : "체크인"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Avatar({
  profile,
  size
}: {
  profile?: Profile | null;
  size: "small" | "large";
}) {
  const label = (profile?.display_name || profile?.handle || "R").slice(0, 1).toUpperCase();

  if (profile?.avatar_url) {
    return (
      <img
        alt={`${profile.display_name} 프로필`}
        className={cn(
          "shrink-0 object-cover",
          size === "small" ? "size-9 rounded-md" : "size-20 rounded-full sm:size-24"
        )}
        src={profile.avatar_url}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-ink font-black text-white",
        size === "small"
          ? "size-9 text-sm"
          : "size-20 rounded-full text-2xl sm:size-24"
      )}
    >
      {label}
    </div>
  );
}

function Metric({
  dark = false,
  label,
  value,
  unit
}: {
  dark?: boolean;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border p-3",
        dark ? "border-white/15 bg-white/5" : "border-border bg-white"
      )}
    >
      <p className={cn("truncate text-xs font-bold", dark ? "text-zinc-400" : "text-muted")}>
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-black sm:text-2xl">
        {value}
        {unit ? (
          <span className={cn("ml-1 text-xs font-bold", dark ? "text-zinc-400" : "text-muted")}>
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Route;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md bg-zinc-50 p-3">
      <Icon className="text-primary" size={18} />
      <span className="text-sm font-bold text-muted">{label}</span>
      <span className="text-sm font-black">{value}</span>
    </div>
  );
}

function QuickButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: typeof Send;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-zinc-50"
      onClick={onClick}
      type="button"
    >
      <Icon className="text-primary" size={18} />
      <span className="text-sm font-bold">{label}</span>
      <ChevronRight className="text-muted" size={17} />
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description
}: {
  icon: typeof Activity;
  title: string;
  description: string;
}) {
  return (
    <div className="py-8 text-center">
      <Icon className="mx-auto text-muted" size={28} />
      <p className="mt-3 text-sm font-black">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-xs font-semibold leading-5 text-muted">
        {description}
      </p>
    </div>
  );
}
