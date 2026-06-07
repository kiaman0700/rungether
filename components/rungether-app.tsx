"use client";

import type { User } from "@supabase/supabase-js";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleStop,
  Clock3,
  Heart,
  Home,
  Loader2,
  LogOut,
  MapPin,
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
  Trophy,
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
  type MapPoint
} from "@/components/kakao-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type View = "home" | "run" | "feed" | "friends" | "chat" | "profile";

type Profile = {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  total_distance_m: number;
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
  runs?: {
    average_pace_s: number | null;
    distance_m: number;
    duration_s: number;
    id: string;
    title: string | null;
  } | null;
};

type RunRecord = {
  id: string;
  title: string | null;
  distance_m: number;
  duration_s: number;
  average_pace_s?: number | null;
  started_at: string;
};

type FriendEdge = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
};

type ChatMessage = {
  chat_id: string;
  id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
};

type DirectChat = {
  id: string;
  memberIds: string[];
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
  host_id: string;
  id: string;
  max_members: number;
  meeting_place: string;
  members: string[];
  starts_at: string;
  title: string;
};

const LOUNGE_CHAT_ID = "00000000-0000-0000-0000-000000000001";
const sampleProfiles: Profile[] = [
  {
    id: "sample-runner",
    handle: "seoul.runner",
    display_name: "서울러너",
    bio: "한강을 달리는 저녁 러너",
    avatar_url: null,
    total_distance_m: 348200,
    onboarding_completed: true
  },
  {
    id: "sample-crew",
    handle: "run.together",
    display_name: "런투게더 크루",
    bio: "누구나 함께 달릴 수 있는 러닝 크루",
    avatar_url: null,
    total_distance_m: 1204000,
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
    run_id: null
  },
  {
    id: "sample-2",
    author_id: "sample-crew",
    body: "이번 일요일 오전 8시 여의나루역 2번 출구에서 초보자 환영 러닝을 진행합니다.",
    created_at: "2026-06-07T02:00:00.000Z",
    likes: [],
    media_urls: [],
    run_id: null
  }
];
const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "home", label: "홈", icon: Home },
  { id: "run", label: "러닝", icon: Activity },
  { id: "feed", label: "피드", icon: Heart },
  { id: "friends", label: "친구", icon: Users },
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [groupRuns, setGroupRuns] = useState<GroupRun[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<MapPoint | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [routePoints, setRoutePoints] = useState<MapPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const locationRequestedRef = useRef(false);
  const lastRecordedPointRef = useRef<MapPoint | null>(null);

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
        messagesResult,
        storiesResult,
        groupRunsResult,
        groupRunMembersResult
      ] =
        await Promise.all([
          (supabase.from("users") as any)
            .select("id,handle,display_name,bio,avatar_url,total_distance_m,onboarding_completed")
            .limit(60),
          (supabase.from("posts") as any)
            .select("id,author_id,body,created_at,media_urls,run_id,runs(id,title,distance_m,duration_s,average_pace_s)")
            .order("created_at", { ascending: false })
            .limit(30),
          (supabase.from("likes") as any).select("post_id,user_id").limit(500),
          userId
            ? (supabase.from("runs") as any)
                .select("id,title,distance_m,duration_s,average_pace_s,started_at")
                .eq("user_id", userId)
                .order("started_at", { ascending: false })
                .limit(20)
            : Promise.resolve({ data: [] }),
          userId
            ? (supabase.from("friends") as any)
                .select("id,requester_id,addressee_id,status")
                .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
            : Promise.resolve({ data: [] }),
          (supabase.from("messages") as any)
            .select("id,chat_id,sender_id,body,created_at")
            .eq("chat_id", LOUNGE_CHAT_ID)
            .order("created_at", { ascending: true })
            .limit(100),
          (supabase.from("stories") as any)
            .select("id,author_id,media_url,caption,created_at,expires_at")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(60),
          (supabase.from("group_runs") as any)
            .select("id,host_id,title,meeting_place,starts_at,max_members")
            .gte("starts_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
            .order("starts_at", { ascending: true })
            .limit(30),
          (supabase.from("group_run_members") as any)
            .select("group_run_id,user_id")
            .limit(300)
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
      setMessages((messagesResult.data ?? []) as ChatMessage[]);
      setStories((storiesResult.data ?? []) as Story[]);
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
        .select("id,handle,display_name,bio,avatar_url,total_distance_m,onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (!data?.onboarding_completed) {
        router.replace("/onboarding");
        return;
      }

      setProfile(data as Profile);
      setAuthLoading(false);
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
        { event: "*", schema: "public", table: "messages" },
        () => void loadAppData(authUser?.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
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

        if (sharingLocation) {
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
    if (!requireLogin()) {
      return;
    }

    const startPoint = currentPosition ?? (await requestCurrentLocation(true));
    if (!startPoint) {
      return;
    }

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
    const { data, error } = await (supabase.from("runs") as any)
      .insert({
        user_id: authUser.id,
        title: "오늘의 러닝",
        started_at: new Date(runStartedAt).toISOString(),
        ended_at: new Date(endedAt).toISOString(),
        distance_m: Math.round(distanceM),
        duration_s: duration,
        average_pace_s: averagePace,
        calories
      })
      .select("id,title,distance_m,duration_s,average_pace_s,started_at")
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

    const nextDistance = Number(profile?.total_distance_m ?? 0) + distanceM;
    await (supabase.from("users") as any)
      .update({ total_distance_m: Math.round(nextDistance) })
      .eq("id", authUser.id);

    setRuns((current) => [data as RunRecord, ...current]);
    setProfile((current) =>
      current ? { ...current, total_distance_m: nextDistance } : current
    );
    showToast("러닝 기록과 경로를 저장했습니다.");
  }

  async function toggleLocationSharing() {
    if (!requireLogin() || !supabase || !authUser) {
      return;
    }

    const nextValue = !sharingLocation;
    setSharingLocation(nextValue);

    if (!nextValue) {
      await (supabase.from("live_locations") as any)
        .delete()
        .eq("user_id", authUser.id);
      showToast("실시간 위치 공유를 종료했습니다.");
      return;
    }

    const current = currentPosition ?? routePoints.at(-1);
    if (current) {
      await saveLiveLocation(current);
    }
    showToast("러닝 중 위치를 친구에게 공유합니다.");
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

  const currentPace =
    distanceM > 0 ? Math.round(elapsedSeconds / (distanceM / 1000)) : 0;
  const mapPoints = routePoints.length
    ? routePoints
    : currentPosition
      ? [currentPosition]
      : [];

  return (
    <main className="min-h-screen bg-surface pb-20 text-ink lg:pb-0">
      <AppHeader
        authLoading={authLoading}
        profile={profile}
        onProfile={() => setActiveView("profile")}
      />

      <div className="mx-auto grid w-full max-w-[1480px] gap-5 px-3 py-4 sm:px-5 lg:grid-cols-[72px_minmax(0,1fr)_330px] lg:px-6 lg:py-6">
        <DesktopNav activeView={activeView} onChange={setActiveView} />

        <div className="min-w-0">
          {activeView === "home" ? (
            <HomeView
              authUser={authUser}
              currentPace={currentPace}
              distanceM={distanceM}
              elapsedSeconds={elapsedSeconds}
              isPaused={isPaused}
              isRunning={isRunning}
              locationStatus={locationStatus}
              posts={posts}
              profiles={profiles}
              stories={stories}
              routePoints={mapPoints}
              runs={runs}
              sharingLocation={sharingLocation}
              onChangeView={setActiveView}
              onLocate={() => void requestCurrentLocation(true)}
              onPause={pauseRun}
              onResume={resumeRun}
              onShare={toggleLocationSharing}
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
              runs={runs}
              sharingLocation={sharingLocation}
              onLocate={() => void requestCurrentLocation(true)}
              onPause={pauseRun}
              onResume={resumeRun}
              onShare={toggleLocationSharing}
              onStart={startRun}
              onStop={stopRun}
            />
          ) : null}
          {activeView === "feed" ? (
            <FeedView
              authUser={authUser}
              posts={posts}
              profiles={profiles}
              runs={runs}
              onPostsChange={setPosts}
              onToast={showToast}
            />
          ) : null}
          {activeView === "friends" ? (
            <FriendsView
              authUser={authUser}
              friends={friends}
              groupRuns={groupRuns}
              profiles={profiles}
              onFriendsChange={setFriends}
              onGroupRunsChange={setGroupRuns}
              onToast={showToast}
            />
          ) : null}
          {activeView === "chat" ? (
            <ChatView
              authUser={authUser}
              messages={messages}
              profiles={profiles}
              onMessagesChange={setMessages}
              onToast={showToast}
            />
          ) : null}
          {activeView === "profile" ? (
            <ProfileView
              authUser={authUser}
              posts={posts}
              profile={profile}
              runs={runs}
              onEdit={() => router.push("/profile/edit")}
              onSignOut={signOut}
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
          onShare={toggleLocationSharing}
        />
      </div>

      <MobileNav activeView={activeView} onChange={setActiveView} />

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
  onProfile
}: {
  authLoading: boolean;
  profile: Profile | null;
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
        <div className="ml-auto">
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
  onChange
}: {
  activeView: View;
  onChange: (view: View) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-[520px] grid-cols-5">
        {navItems
          .filter((item) => item.id !== "profile")
          .map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-bold",
                  activeView === item.id
                    ? "bg-emerald-50 text-primary"
                    : "text-muted"
                )}
                key={item.id}
                onClick={() => onChange(item.id)}
                type="button"
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
      </div>
    </nav>
  );
}

type RunConsoleProps = {
  currentPace: number;
  distanceM: number;
  elapsedSeconds: number;
  isPaused: boolean;
  isRunning: boolean;
  locationStatus: LocationStatus;
  routePoints: MapPoint[];
  sharingLocation: boolean;
  onLocate: () => void;
  onPause: () => void;
  onResume: () => void;
  onShare: () => void;
  onStart: () => void;
  onStop: () => void;
};

function HomeView({
  authUser,
  posts,
  profiles,
  runs,
  stories,
  onChangeView,
  onStoriesChange,
  onToast,
  ...runProps
}: RunConsoleProps & {
  authUser: User | null;
  posts: FeedPost[];
  profiles: Profile[];
  runs: RunRecord[];
  stories: Story[];
  onChangeView: (view: View) => void;
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
          posts={posts.slice(0, 3)}
          profiles={profiles}
          title="최근 러닝 피드"
          onMore={() => onChangeView("feed")}
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

function RunView(props: RunConsoleProps & { runs: RunRecord[] }) {
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
              <div
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border py-3 last:border-0"
                key={run.id}
              >
                <div>
                  <p className="text-sm font-black">{run.title || "러닝 기록"}</p>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {new Date(run.started_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black">{formatDistance(run.distance_m)} km</p>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {formatDuration(run.duration_s)}
                  </p>
                </div>
              </div>
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
  currentPace,
  distanceM,
  elapsedSeconds,
  isPaused,
  isRunning,
  locationStatus,
  routePoints,
  sharingLocation,
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
            <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-3 text-sm font-bold text-zinc-200">
              <ShieldCheck size={18} />
              {sharingLocation ? "친구에게 현재 위치 공유 중" : "위치 공유는 선택 사항입니다"}
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

function FeedView({
  authUser,
  posts,
  profiles,
  runs,
  onPostsChange,
  onToast
}: {
  authUser: User | null;
  posts: FeedPost[];
  profiles: Profile[];
  runs: RunRecord[];
  onPostsChange: (posts: FeedPost[]) => void;
  onToast: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [body, setBody] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        visibility: "public"
      })
      .select("id,author_id,body,created_at,media_urls,run_id,runs(id,title,distance_m,duration_s,average_pace_s)")
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

  async function toggleLike(post: FeedPost) {
    if (!authUser || !supabase || post.id.startsWith("sample")) {
      onToast("실제 게시물의 좋아요는 로그인 후 사용할 수 있습니다.");
      return;
    }

    const liked = post.likes.includes(authUser.id);
    const query = supabase.from("likes") as any;
    const { error } = liked
      ? await query.delete().eq("post_id", post.id).eq("user_id", authUser.id)
      : await query.insert({ post_id: post.id, user_id: authUser.id });

    if (error) {
      onToast("좋아요를 반영하지 못했습니다.");
      return;
    }

    onPostsChange(
      posts.map((item) =>
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
            <select
              className="h-11 rounded-md border border-border bg-white px-3 text-sm font-bold outline-none focus:border-primary"
              onChange={(event) => setSelectedRunId(event.target.value)}
              value={selectedRunId}
            >
              <option value="">러닝 기록 첨부 안 함</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {formatDistance(run.distance_m)}km · {formatDuration(run.duration_s)}
                </option>
              ))}
            </select>
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
        posts={posts}
        profiles={profiles}
        title="러닝 피드"
        onLike={toggleLike}
      />
    </div>
  );
}

function FeedList({
  authUser,
  posts,
  profiles,
  title,
  onLike,
  onMore
}: {
  authUser?: User | null;
  posts: FeedPost[];
  profiles: Profile[];
  title: string;
  onLike?: (post: FeedPost) => void;
  onMore?: () => void;
}) {
  return (
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

          return (
            <article
              className="border-b border-border py-4 first:pt-0 last:border-0 last:pb-0"
              key={post.id}
            >
              <div className="flex items-center gap-3">
                <Avatar profile={author} size="small" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">@{author.handle}</p>
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
              <button
                className={cn(
                  "mt-3 inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-bold",
                  liked ? "bg-rose-50 text-rose-600" : "bg-zinc-50 text-muted"
                )}
                onClick={() => onLike?.(post)}
                type="button"
              >
                <Heart fill={liked ? "currentColor" : "none"} size={16} />
                {post.likes.length}
              </button>
            </article>
          );
        })}
      </CardContent>
    </Card>
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

function ChatView({
  authUser,
  messages,
  profiles,
  onMessagesChange,
  onToast
}: {
  authUser: User | null;
  messages: ChatMessage[];
  profiles: Profile[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  onToast: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [body, setBody] = useState("");
  const [activeChatId, setActiveChatId] = useState(LOUNGE_CHAT_ID);
  const [directChats, setDirectChats] = useState<DirectChat[]>([]);
  const [directMessages, setDirectMessages] = useState<ChatMessage[]>([]);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [loadingDirectChat, setLoadingDirectChat] = useState(false);

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
        .select("id")
        .in("id", chatIds)
        .eq("is_public", false),
      (supabase.from("chat_members") as any)
        .select("chat_id,user_id")
        .in("chat_id", chatIds)
    ]);
    const availableIds = new Set<string>(
      (chats ?? []).map((chat: { id: string }) => chat.id)
    );

    setDirectChats(
      [...availableIds].map((id) => ({
        id,
        memberIds: (memberships ?? [])
          .filter(
            (membership: { chat_id: string; user_id: string }) =>
              membership.chat_id === id
          )
          .map(
            (membership: { chat_id: string; user_id: string }) =>
              membership.user_id
          )
      }))
    );
  }, [authUser, supabase]);

  useEffect(() => {
    void loadDirectChats();
  }, [loadDirectChats]);

  useEffect(() => {
    async function loadMessages() {
      if (!supabase || activeChatId === LOUNGE_CHAT_ID) {
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

  async function startDirectChat(target: Profile) {
    if (!authUser || !supabase || target.id.startsWith("sample")) {
      onToast("실제 RUNGETHER 회원에게 메시지를 보낼 수 있습니다.");
      return;
    }

    const existing = directChats.find((chat) => chat.memberIds.includes(target.id));
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
      id: chat.id,
      memberIds: [authUser.id, target.id]
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

    if (activeChatId === LOUNGE_CHAT_ID) {
      onMessagesChange([...messages, data as ChatMessage]);
    } else {
      setDirectMessages((current) => [...current, data as ChatMessage]);
    }
    setBody("");
  }

  const activeDirectChat = directChats.find((chat) => chat.id === activeChatId);
  const activeTarget = profiles.find(
    (profile) =>
      profile.id !== authUser?.id && activeDirectChat?.memberIds.includes(profile.id)
  );
  const activeMessages =
    activeChatId === LOUNGE_CHAT_ID ? messages : directMessages;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div>
          <Badge tone="blue">
            {activeChatId === LOUNGE_CHAT_ID ? "공개 채팅" : "1:1 메시지"}
          </Badge>
          <CardTitle className="mt-3">
            {activeChatId === LOUNGE_CHAT_ID
              ? "RUNGETHER 라운지"
              : `@${activeTarget?.handle ?? "runner"}`}
          </CardTitle>
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
        <div className="flex gap-2 overflow-x-auto border-b border-border bg-white p-3">
          <button
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-xs font-black",
              activeChatId === LOUNGE_CHAT_ID
                ? "bg-ink text-white"
                : "bg-zinc-100 text-muted"
            )}
            onClick={() => setActiveChatId(LOUNGE_CHAT_ID)}
            type="button"
          >
            라운지
          </button>
          {directChats.map((chat) => {
            const target = profiles.find(
              (profile) =>
                profile.id !== authUser?.id && chat.memberIds.includes(profile.id)
            );
            return (
              <button
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs font-black",
                  activeChatId === chat.id
                    ? "bg-ink text-white"
                    : "bg-zinc-100 text-ink"
                )}
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                type="button"
              >
                <Avatar profile={target} size="small" />
                @{target?.handle ?? "runner"}
              </button>
            );
          })}
        </div>

        {showNewMessage ? (
          <div className="border-b border-border bg-white p-4">
            <p className="mb-3 text-sm font-black">새 메시지</p>
            <div className="grid max-h-56 gap-1 overflow-y-auto">
              {profiles
                .filter(
                  (candidate) =>
                    candidate.id !== authUser?.id &&
                    !candidate.id.startsWith("sample")
                )
                .map((candidate) => (
                  <button
                    className="flex items-center gap-3 rounded-md p-2 text-left hover:bg-zinc-50"
                    disabled={loadingDirectChat}
                    key={candidate.id}
                    onClick={() => void startDirectChat(candidate)}
                    type="button"
                  >
                    <Avatar profile={candidate} size="small" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">
                        @{candidate.handle}
                      </span>
                      <span className="block truncate text-xs font-semibold text-muted">
                        {candidate.display_name}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
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
                activeChatId === LOUNGE_CHAT_ID
                  ? "로그인한 러너가 함께 사용하는 공개 라운지입니다."
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
  posts,
  profile,
  runs,
  onEdit,
  onSignOut
}: {
  authUser: User | null;
  posts: FeedPost[];
  profile: Profile | null;
  runs: RunRecord[];
  onEdit: () => void;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState<"posts" | "runs">("posts");

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

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="px-5 py-6 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-xl font-black">@{profile.handle}</p>
            <Button
              aria-label="로그아웃"
              onClick={onSignOut}
              size="icon"
              title="로그아웃"
              variant="ghost"
            >
              <LogOut size={19} />
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-[auto_1fr] items-center gap-6">
            <Avatar profile={profile} size="large" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <ProfileStat label="게시물" value={myPosts.length} />
              <ProfileStat label="러닝" value={runs.length} />
              <ProfileStat
                label="거리"
                value={`${formatDistance(Number(profile.total_distance_m))}km`}
              />
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-black">{profile.display_name}</p>
            <p className="mt-1 text-sm font-semibold leading-6">
              {profile.bio || "러닝 목표와 좋아하는 코스를 소개해 보세요."}
            </p>
          </div>

          <Button className="mt-5 w-full" onClick={onEdit} variant="secondary">
            <Settings size={17} />
            프로필 편집
          </Button>
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
                  {post.media_urls?.[0] ? (
                    <img
                      alt={post.body || "러닝 게시물"}
                      className="absolute inset-0 size-full object-cover"
                      src={post.media_urls[0]}
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
              <div className="grid grid-cols-[1fr_auto] gap-3 py-4" key={run.id}>
                <div>
                  <p className="text-sm font-black">{run.title || "러닝 기록"}</p>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {formatKoreanDateTime(run.started_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black">{formatDistance(run.distance_m)} km</p>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {formatDuration(run.duration_s)}
                  </p>
                </div>
              </div>
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
              : "로그인하면 모바일과 데스크톱에서 같은 기록과 친구를 확인할 수 있습니다."}
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
            label="라운지 채팅 열기"
            onClick={() => onChangeView("chat")}
          />
          <QuickButton
            icon={UserPlus}
            label="친구 찾기"
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
