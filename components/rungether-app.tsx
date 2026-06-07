"use client";

import type { User } from "@supabase/supabase-js";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  CircleStop,
  Clock3,
  Heart,
  Home,
  LogOut,
  MessageCircle,
  Navigation,
  Play,
  Route,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trophy,
  UserPlus,
  UserRound,
  Users
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { KakaoLoginButton } from "@/components/auth/kakao-login-button";
import { KakaoMap, type MapPoint } from "@/components/kakao-map";
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
};

type RunRecord = {
  id: string;
  title: string | null;
  distance_m: number;
  duration_s: number;
  started_at: string;
};

type FriendEdge = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
};

type ChatMessage = {
  id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
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
    likes: []
  },
  {
    id: "sample-2",
    author_id: "sample-crew",
    body: "이번 일요일 오전 8시 여의나루역 2번 출구에서 초보자 환영 러닝을 진행합니다.",
    created_at: "2026-06-07T02:00:00.000Z",
    likes: []
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
  const [authLoading, setAuthLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [routePoints, setRoutePoints] = useState<MapPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadAppData = useCallback(
    async (userId?: string) => {
      if (!supabase) {
        return;
      }

      const [profilesResult, postsResult, likesResult, runsResult, friendsResult, messagesResult] =
        await Promise.all([
          (supabase.from("users") as any)
            .select("id,handle,display_name,bio,avatar_url,total_distance_m,onboarding_completed")
            .limit(60),
          (supabase.from("posts") as any)
            .select("id,author_id,body,created_at")
            .order("created_at", { ascending: false })
            .limit(30),
          (supabase.from("likes") as any).select("post_id,user_id").limit(500),
          userId
            ? (supabase.from("runs") as any)
                .select("id,title,distance_m,duration_s,started_at")
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
            .select("id,sender_id,body,created_at")
            .eq("chat_id", LOUNGE_CHAT_ID)
            .order("created_at", { ascending: true })
            .limit(100)
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
    if (!isRunning || !runStartedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - runStartedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, runStartedAt]);

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

  function startRun() {
    if (!requireLogin()) {
      return;
    }

    if (!navigator.geolocation) {
      showToast("이 기기에서는 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setDistanceM(0);
    setElapsedSeconds(0);
    setRoutePoints([]);
    setRunStartedAt(Date.now());
    setIsRunning(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };

        setRoutePoints((current) => {
          const previous = current.at(-1);
          const addition = previous ? distanceBetween(previous, point) : 0;

          if (addition > 0 && addition < 250) {
            setDistanceM((value) => value + addition);
          }

          return [...current, point];
        });

        if (sharingLocation) {
          void saveLiveLocation(point);
        }
      },
      (error) => {
        showToast(
          error.code === error.PERMISSION_DENIED
            ? "정확한 기록을 위해 위치 권한을 허용해 주세요."
            : "현재 위치를 가져오지 못했습니다."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 12000
      }
    );
  }

  async function stopRun() {
    if (!supabase || !authUser || !runStartedAt) {
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsRunning(false);
    const endedAt = Date.now();
    const duration = Math.max(1, Math.floor((endedAt - runStartedAt) / 1000));
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
      .select("id,title,distance_m,duration_s,started_at")
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
          longitude: point.longitude
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

    const current = routePoints.at(-1);
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

    const location = routePoints.at(-1);
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
              isRunning={isRunning}
              posts={posts}
              profiles={profiles}
              routePoints={routePoints}
              runs={runs}
              sharingLocation={sharingLocation}
              onChangeView={setActiveView}
              onShare={toggleLocationSharing}
              onStart={startRun}
              onStop={stopRun}
            />
          ) : null}
          {activeView === "run" ? (
            <RunView
              currentPace={currentPace}
              distanceM={distanceM}
              elapsedSeconds={elapsedSeconds}
              isRunning={isRunning}
              routePoints={routePoints}
              runs={runs}
              sharingLocation={sharingLocation}
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
              onPostsChange={setPosts}
              onToast={showToast}
            />
          ) : null}
          {activeView === "friends" ? (
            <FriendsView
              authUser={authUser}
              friends={friends}
              profiles={profiles}
              onFriendsChange={setFriends}
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
  isRunning: boolean;
  routePoints: MapPoint[];
  sharingLocation: boolean;
  onShare: () => void;
  onStart: () => void;
  onStop: () => void;
};

function HomeView({
  authUser,
  posts,
  profiles,
  runs,
  onChangeView,
  ...runProps
}: RunConsoleProps & {
  authUser: User | null;
  posts: FeedPost[];
  profiles: Profile[];
  runs: RunRecord[];
  onChangeView: (view: View) => void;
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

function RunConsole({
  currentPace,
  distanceM,
  elapsedSeconds,
  isRunning,
  routePoints,
  sharingLocation,
  onShare,
  onStart,
  onStop
}: RunConsoleProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div>
          <Badge tone={isRunning ? "rose" : "green"}>
            {isRunning ? "GPS 기록 중" : "러닝 준비"}
          </Badge>
          <CardTitle className="mt-3 text-xl">
            {isRunning ? "지금의 페이스를 유지해 보세요" : "오늘의 러닝"}
          </CardTitle>
        </div>
        <Button onClick={onShare} size="sm" variant="secondary">
          <Send size={17} />
          {sharingLocation ? "공유 중" : "위치 공유"}
        </Button>
      </CardHeader>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <KakaoMap
          className="min-h-[350px] rounded-none border-0 lg:min-h-[440px]"
          points={routePoints}
        />
        <div className="grid content-between gap-5 border-t border-border p-5 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            <Metric label="거리" value={formatDistance(distanceM)} unit="km" />
            <Metric label="시간" value={formatDuration(elapsedSeconds)} unit="" />
            <Metric
              label="평균 페이스"
              value={currentPace ? formatDuration(currentPace) : "--:--"}
              unit="/km"
            />
          </div>
          <div className="grid gap-3">
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-800">
              <ShieldCheck size={18} />
              {sharingLocation ? "친구에게 현재 위치 공유 중" : "위치 공유는 선택 사항입니다"}
            </div>
            <Button
              className="h-14 text-base"
              onClick={isRunning ? onStop : onStart}
              variant={isRunning ? "danger" : "primary"}
            >
              {isRunning ? <CircleStop size={21} /> : <Play size={21} />}
              {isRunning ? "러닝 종료 및 저장" : "러닝 시작"}
            </Button>
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
  onPostsChange,
  onToast
}: {
  authUser: User | null;
  posts: FeedPost[];
  profiles: Profile[];
  onPostsChange: (posts: FeedPost[]) => void;
  onToast: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authUser) {
      onToast("게시물 작성은 로그인 후 사용할 수 있습니다.");
      return;
    }

    const normalized = body.trim();
    if (!normalized || !supabase) {
      return;
    }

    setSubmitting(true);
    const { data, error } = await (supabase.from("posts") as any)
      .insert({
        author_id: authUser.id,
        body: normalized,
        visibility: "public"
      })
      .select("id,author_id,body,created_at")
      .single();
    setSubmitting(false);

    if (error) {
      onToast("게시물 저장에 실패했습니다. Supabase SQL을 다시 실행해 주세요.");
      return;
    }

    onPostsChange([{ ...data, likes: [] } as FeedPost, ...posts]);
    setBody("");
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
            <textarea
              className="min-h-28 w-full resize-y rounded-md border border-border bg-white p-3 text-sm font-semibold outline-none focus:border-primary"
              maxLength={500}
              onChange={(event) => setBody(event.target.value)}
              placeholder="러닝 기록, 크루 모집, 코스 후기를 남겨보세요."
              value={body}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-muted">{body.length}/500</span>
              <Button disabled={submitting || !body.trim()} type="submit">
                <Send size={17} />
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

function FriendsView({
  authUser,
  friends,
  profiles,
  onFriendsChange,
  onToast
}: {
  authUser: User | null;
  friends: FriendEdge[];
  profiles: Profile[];
  onFriendsChange: (friends: FriendEdge[]) => void;
  onToast: (message: string) => void;
}) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [query, setQuery] = useState("");
  const results = query.trim()
    ? profiles
        .filter(
          (item) =>
            item.id !== authUser?.id &&
            item.handle.toLowerCase().includes(query.trim().toLowerCase())
        )
        .slice(0, 8)
    : [];

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
        chat_id: LOUNGE_CHAT_ID,
        sender_id: authUser.id,
        body: normalized
      })
      .select("id,sender_id,body,created_at")
      .single();

    if (error) {
      onToast("메시지를 보내지 못했습니다. 최신 Supabase SQL을 실행해 주세요.");
      return;
    }

    onMessagesChange([...messages, data as ChatMessage]);
    setBody("");
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div>
          <Badge tone="blue">공개 채팅</Badge>
          <CardTitle className="mt-3">RUNGETHER 라운지</CardTitle>
        </div>
        <MessageCircle className="text-primary" size={22} />
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        <div className="grid min-h-[430px] content-end gap-3 bg-zinc-50 p-4">
          {messages.length ? (
            messages.map((message) => {
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
              description="로그인한 러너가 함께 사용하는 공개 라운지입니다."
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
  profile,
  runs,
  onEdit,
  onSignOut
}: {
  authUser: User | null;
  profile: Profile | null;
  runs: RunRecord[];
  onEdit: () => void;
  onSignOut: () => void;
}) {
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

  return (
    <div className="grid gap-5">
      <Card>
        <CardContent className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar profile={profile} size="large" />
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-black">@{profile.handle}</p>
              <p className="mt-1 text-sm font-semibold text-muted">
                {profile.display_name}
              </p>
              {profile.bio ? (
                <p className="mt-2 text-sm font-semibold leading-6">{profile.bio}</p>
              ) : null}
            </div>
            <Button onClick={onEdit} variant="secondary">
              <Settings size={18} />
              프로필 편집
            </Button>
            <Button onClick={onSignOut} variant="secondary">
              <LogOut size={18} />
              로그아웃
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric
          label="누적 거리"
          value={formatDistance(Number(profile.total_distance_m))}
          unit="km"
        />
        <Metric label="저장된 러닝" value={String(runs.length)} unit="회" />
        <Metric
          label="이번 달"
          value={formatDistance(
            runs.reduce((sum, run) => sum + Number(run.distance_m), 0)
          )}
          unit="km"
        />
      </div>
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
          "shrink-0 rounded-md object-cover",
          size === "small" ? "size-9" : "size-16"
        )}
        src={profile.avatar_url}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-ink font-black text-white",
        size === "small" ? "size-9 text-sm" : "size-16 text-xl"
      )}
    >
      {label}
    </div>
  );
}

function Metric({
  label,
  value,
  unit
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-white p-3">
      <p className="truncate text-xs font-bold text-muted">{label}</p>
      <p className="mt-2 truncate text-xl font-black">
        {value}
        {unit ? <span className="ml-1 text-xs font-bold text-muted">{unit}</span> : null}
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
