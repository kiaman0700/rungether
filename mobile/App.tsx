import "./src/tasks/locationTask";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  Compass,
  Home,
  Lock,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  Play,
  Plus,
  Route,
  Search,
  Settings,
  Sun,
  Trophy,
  Users
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { CertificationStudio } from "./src/components/CertificationStudio";
import { RunMap } from "./src/components/RunMap";
import { RunnerScreen } from "./src/components/RunnerScreen";
import {
  getLevel2Regions,
  KOREAN_REGIONS
} from "./src/data/koreanRegions";
import { getSupabase } from "./src/lib/supabase";
import { initializeDatabase } from "./src/lib/database";
import { createPalette, spacing } from "./src/theme";
import {
  AppTab,
  HomeMode,
  RunRecord,
  ThemeMode,
  UserProfile
} from "./src/types";

WebBrowser.maybeCompleteAuthSession();

const profileFields =
  "id,handle,display_name,bio,avatar_url,total_distance_m,is_private,experience_points,level,current_streak,longest_streak,onboarding_completed,theme_mode,default_home,weight_kg,voice_enabled,voice_mix_mode,voice_distance_interval_m,voice_time_interval_min,voice_read_distance,voice_read_split_pace,voice_read_total_time,voice_read_goal_progress,voice_volume,voice_rate";

export default function App() {
  return (
    <SafeAreaProvider>
      <RungetherMobile />
    </SafeAreaProvider>
  );
}

function RungetherMobile() {
  const systemScheme = useColorScheme();
  const supabase = useMemo(() => getSupabase(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AppTab>("home");
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [studioRun, setStudioRun] = useState<RunRecord | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentCrew, setCurrentCrew] = useState<{
    id: string;
    name: string;
    imageUrl: string | null;
    experiencePoints: number;
    meetingPlace: string | null;
    regionLevel1: string | null;
    regionLevel2: string | null;
    role: string;
    chatId: string | null;
  } | null>(null);

  const themeMode = profile?.theme_mode ?? "system";
  const resolvedScheme: "light" | "dark" =
    themeMode === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : themeMode;
  const palette = useMemo(() => createPalette(resolvedScheme), [resolvedScheme]);

  const loadData = useCallback(
    async (userId: string) => {
      if (!supabase) return;
      const [profileResult, runsResult, postsResult, crewResult] =
        await Promise.all([
        (supabase.from("users") as any)
          .select(profileFields)
          .eq("id", userId)
          .maybeSingle(),
        (supabase.from("runs") as any)
          .select(
            "id,user_id,title,started_at,ended_at,distance_m,duration_s,moving_duration_s,paused_duration_s,average_pace_s,visibility,xp_earned,streak_day,route_image_url,goal_type,goal_value,gps_quality,verified,route_visible,run_splits(split_index,distance_m,duration_s,pace_s)"
          )
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(30),
        (supabase.from("posts") as any)
          .select(
            "id,author_id,body,media_urls,created_at,run_id,users(handle,display_name,avatar_url),runs(distance_m,duration_s,average_pace_s,route_image_url)"
          )
          .order("created_at", { ascending: false })
          .limit(30),
        (supabase.from("crew_members") as any)
          .select(
            "role,crew_id,crews(id,name,image_url,experience_points,meeting_place,region_level1,region_level2)"
          )
          .eq("user_id", userId)
          .maybeSingle()
      ]);
      const loadedProfile = profileResult.data as UserProfile | null;
      setProfile(loadedProfile);
      setRuns((runsResult.data ?? []) as RunRecord[]);
      setPosts(postsResult.data ?? []);
      const crew = crewResult.data?.crews;
      if (crew) {
        const { data: crewChat } = await (supabase.from("chats") as any)
          .select("id")
          .eq("crew_id", crew.id)
          .maybeSingle();
        setCurrentCrew({
          id: crew.id,
          name: crew.name,
          imageUrl: crew.image_url,
          experiencePoints: Number(crew.experience_points ?? 0),
          meetingPlace: crew.meeting_place,
          regionLevel1: crew.region_level1,
          regionLevel2: crew.region_level2,
          role: crewResult.data.role,
          chatId: crewChat?.id ?? null
        });
      } else {
        setCurrentCrew(null);
      }
      if (loadedProfile?.default_home === "feed") setTab("feed");
    },
    [supabase]
  );

  useEffect(() => {
    void initializeDatabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadData(data.session.user.id);
      setLoading(false);
    });
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void loadData(nextSession.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, [loadData, supabase]);

  useEffect(() => {
    StatusBar.setBarStyle(resolvedScheme === "dark" ? "light-content" : "dark-content");
  }, [resolvedScheme]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  if (!supabase) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={[styles.title, { color: palette.text }]}>환경 설정이 필요합니다</Text>
        <Text style={[styles.body, { color: palette.muted }]}>
          `mobile/.env`에 Supabase URL과 anon key를 입력해 주세요.
        </Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen palette={palette} />;
  }

  if (!profile?.onboarding_completed) {
    return (
      <OnboardingScreen
        palette={palette}
        userId={session.user.id}
        onComplete={(nextProfile) => {
          setProfile(nextProfile);
          setTab(nextProfile.default_home === "feed" ? "feed" : "home");
        }}
      />
    );
  }

  if (runnerOpen) {
    return (
      <RunnerScreen
        currentCrew={currentCrew}
        palette={palette}
        profile={profile}
        onClose={() => setRunnerOpen(false)}
        onCompleted={(run) => {
          setRunnerOpen(false);
          setRuns((current) => [run, ...current]);
          setStudioRun(run);
          void loadData(session.user.id);
        }}
      />
    );
  }

  if (studioRun) {
    return (
      <CertificationStudio
        palette={palette}
        profile={profile}
        run={studioRun}
        onClose={() => setStudioRun(null)}
        onPublished={() => {
          setStudioRun(null);
          setTab("feed");
          void loadData(session.user.id);
        }}
      />
    );
  }

  if (settingsOpen) {
    return (
      <SettingsScreen
        palette={palette}
        profile={profile}
        onBack={() => setSettingsOpen(false)}
        onProfileChange={setProfile}
      />
    );
  }

  const content =
    tab === "home" ? (
      <RunningHome
        palette={palette}
        profile={profile}
        runs={runs}
        onRun={() => setRunnerOpen(true)}
        onStudio={setStudioRun}
      />
    ) : tab === "feed" ? (
      <FeedScreen palette={palette} posts={posts} />
    ) : tab === "run" ? (
      <RunLaunchScreen palette={palette} onRun={() => setRunnerOpen(true)} />
    ) : tab === "crew" ? (
      <CrewScreen
        currentCrew={currentCrew}
        onChanged={() => void loadData(session.user.id)}
        palette={palette}
        userId={session.user.id}
      />
    ) : (
      <ProfileScreen
        currentCrew={currentCrew}
        palette={palette}
        profile={profile}
        runs={runs}
        onSettings={() => setSettingsOpen(true)}
        onStudio={setStudioRun}
      />
    );

  return (
    <SafeAreaView style={[styles.app, { backgroundColor: palette.background }]}>
      <AppHeader palette={palette} tab={tab} />
      <View style={styles.content}>{content}</View>
      <BottomTabs
        active={tab}
        palette={palette}
        profile={profile}
        onChange={(next) => {
          if (next === "run") setRunnerOpen(true);
          else setTab(next);
        }}
      />
    </SafeAreaView>
  );
}

function AuthScreen({ palette }: { palette: ReturnType<typeof createPalette> }) {
  const supabase = getSupabase();
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!supabase || busy) return;
    setBusy(true);
    const redirectTo = Linking.createURL("auth/callback");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: "login" }
      }
    });
    if (error || !data.url) {
      Alert.alert("카카오 로그인", error?.message ?? "로그인 주소를 만들지 못했습니다.");
      setBusy(false);
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === "success") {
      const code = new URL(result.url).searchParams.get("code");
      if (code) {
        const exchange = await supabase.auth.exchangeCodeForSession(code);
        if (exchange.error) Alert.alert("카카오 로그인", exchange.error.message);
      }
    }
    setBusy(false);
  }

  return (
    <SafeAreaView style={[styles.authPage, { backgroundColor: palette.background }]}>
      <View style={styles.authBrand}>
        <View style={[styles.logo, { backgroundColor: palette.text }]}>
          <Route color={palette.background} size={30} strokeWidth={2.6} />
        </View>
        <Text style={[styles.brandName, { color: palette.text }]}>RUNGETHER</Text>
        <Text style={[styles.authHeadline, { color: palette.text }]}>
          달린 순간을 기록하고{"\n"}함께 나누세요
        </Text>
        <Text style={[styles.body, { color: palette.muted }]}>
          카카오 계정 하나로 러닝 기록, 피드, 크루를 연결합니다.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={signIn}
        style={[styles.kakaoButton, { opacity: busy ? 0.65 : 1 }]}
      >
        {busy ? <ActivityIndicator color="#191600" /> : <Text style={styles.kakaoK}>K</Text>}
        <Text style={styles.kakaoText}>카카오로 시작하기</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function OnboardingScreen({
  palette,
  userId,
  onComplete
}: {
  palette: ReturnType<typeof createPalette>;
  userId: string;
  onComplete: (profile: UserProfile) => void;
}) {
  const supabase = getSupabase();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [defaultHome, setDefaultHome] = useState<HomeMode>("running");
  const [busy, setBusy] = useState(false);

  async function selectPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85
    });
    if (!result.canceled) setAvatarUrl(result.assets[0].uri);
  }

  async function save() {
    const normalized = handle.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,20}$/.test(normalized) || !supabase) {
      Alert.alert("아이디 확인", "영문 소문자, 숫자, 점, 밑줄로 3~20자를 입력해 주세요.");
      return;
    }
    setBusy(true);
    let uploadedAvatar: string | null = null;
    if (avatarUrl?.startsWith("file:")) {
      const response = await fetch(avatarUrl);
      const blob = await response.blob();
      const path = `${userId}/mobile-${Date.now()}.jpg`;
      const upload = await supabase.storage.from("avatars").upload(path, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: true
      });
      if (!upload.error) {
        uploadedAvatar = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
    }
    const payload = {
      id: userId,
      handle: normalized,
      display_name: displayName.trim() || normalized,
      bio: bio.trim() || null,
      avatar_url: uploadedAvatar,
      onboarding_completed: true,
      default_home: defaultHome,
      theme_mode: "system",
      updated_at: new Date().toISOString()
    };
    const { error } = await (supabase.from("users") as any).upsert(payload);
    if (error) {
      Alert.alert("프로필 저장", error.message);
      setBusy(false);
      return;
    }
    const { data } = await (supabase.from("users") as any)
      .select(profileFields)
      .eq("id", userId)
      .single();
    setBusy(false);
    onComplete(data as UserProfile);
  }

  return (
    <SafeAreaView style={[styles.app, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.onboarding}>
        <Text style={[styles.eyebrow, { color: palette.primary }]}>프로필 설정</Text>
        <Text style={[styles.title, { color: palette.text }]}>RUNGETHER에서 사용할{"\n"}아이디를 정하세요</Text>
        <Pressable onPress={selectPhoto} style={styles.avatarEditor}>
          <View style={[styles.avatarLarge, { backgroundColor: palette.surface2 }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.fill} />
            ) : (
              <Camera color={palette.muted} size={30} />
            )}
          </View>
          <Text style={[styles.link, { color: palette.primary }]}>사진 선택</Text>
        </Pressable>
        <Field
          label="아이디 필수"
          palette={palette}
          placeholder="rungether.id"
          value={handle}
          onChangeText={setHandle}
          autoCapitalize="none"
        />
        <Field
          label="표시 이름"
          palette={palette}
          placeholder="친구들에게 보일 이름"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <Field
          label="소개"
          palette={palette}
          placeholder="러닝 목표나 좋아하는 코스"
          value={bio}
          onChangeText={setBio}
          multiline
        />
        <Text style={[styles.label, { color: palette.text }]}>앱을 열었을 때</Text>
        <Segmented
          options={[
            { label: "러닝 홈", value: "running" },
            { label: "SNS 피드", value: "feed" }
          ]}
          palette={palette}
          value={defaultHome}
          onChange={(value) => setDefaultHome(value as HomeMode)}
        />
        <Pressable
          disabled={busy}
          onPress={save}
          style={[styles.primaryButton, { backgroundColor: palette.primary }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>저장하고 시작</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function AppHeader({
  palette,
  tab
}: {
  palette: ReturnType<typeof createPalette>;
  tab: AppTab;
}) {
  const titles: Record<AppTab, string> = {
    home: "RUNGETHER",
    feed: "피드",
    run: "러닝",
    crew: "크루",
    profile: "프로필"
  };
  return (
    <View style={[styles.header, { borderBottomColor: palette.border }]}>
      <Text style={[styles.headerTitle, { color: palette.text }]}>{titles[tab]}</Text>
      <View style={styles.headerActions}>
        <Bell color={palette.text} size={23} />
        <MessageCircle color={palette.text} size={23} />
      </View>
    </View>
  );
}

function RunningHome({
  palette,
  profile,
  runs,
  onRun,
  onStudio
}: {
  palette: ReturnType<typeof createPalette>;
  profile: UserProfile;
  runs: RunRecord[];
  onRun: () => void;
  onStudio: (run: RunRecord) => void;
}) {
  const recent = runs[0];
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View>
        <Text style={[styles.eyebrow, { color: palette.primary }]}>
          {profile.current_streak > 0 ? `${profile.current_streak}일 연속 러닝` : "오늘의 러닝"}
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          오늘도 내 페이스로{"\n"}시작해 볼까요?
        </Text>
      </View>
      <View style={[styles.mapCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <RunMap palette={palette} points={[]} />
        <Pressable onPress={onRun} style={[styles.runFab, { backgroundColor: palette.primary }]}>
          <Play color="#fff" fill="#fff" size={26} />
        </Pressable>
      </View>
      <View style={styles.metricRow}>
        <Metric palette={palette} label="누적 거리" value={`${(Number(profile.total_distance_m) / 1000).toFixed(1)} km`} />
        <Metric palette={palette} label="레벨" value={`LV.${profile.level}`} />
        <Metric palette={palette} label="총 XP" value={profile.experience_points.toLocaleString()} />
      </View>
      {recent ? (
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.cardTitle, { color: palette.text }]}>최근 러닝</Text>
              <Text style={[styles.caption, { color: palette.muted }]}>
                {new Date(recent.started_at).toLocaleDateString("ko-KR")}
              </Text>
            </View>
            <Pressable onPress={() => onStudio(recent)}>
              <Text style={[styles.link, { color: palette.primary }]}>인증 만들기</Text>
            </Pressable>
          </View>
          <View style={styles.metricRow}>
            <Metric palette={palette} label="거리" value={`${(Number(recent.distance_m) / 1000).toFixed(2)} km`} />
            <Metric palette={palette} label="시간" value={formatDuration(recent.duration_s)} />
            <Metric palette={palette} label="평균 페이스" value={formatPace(recent.average_pace_s)} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function RunLaunchScreen({
  palette,
  onRun
}: {
  palette: ReturnType<typeof createPalette>;
  onRun: () => void;
}) {
  return (
    <View style={[styles.center, { padding: spacing.lg }]}>
      <View style={[styles.bigCircle, { backgroundColor: palette.primarySoft }]}>
        <Route color={palette.primary} size={58} />
      </View>
      <Text style={[styles.title, { color: palette.text }]}>러닝 준비</Text>
      <Text style={[styles.body, { color: palette.muted }]}>
        자유 달리기, 거리 목표, 시간 목표를 선택하고 실제 GPS 러닝을 기록합니다.
      </Text>
      <Pressable onPress={onRun} style={[styles.primaryButton, { backgroundColor: palette.primary }]}>
        <Play color="#fff" fill="#fff" size={20} />
        <Text style={styles.primaryButtonText}>러닝 시작</Text>
      </Pressable>
    </View>
  );
}

function FeedScreen({
  palette,
  posts
}: {
  palette: ReturnType<typeof createPalette>;
  posts: any[];
}) {
  return (
    <ScrollView contentContainerStyle={styles.feedPage}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
        {["내 스토리", "새벽러너", "pace.keeper", "run.seoul"].map((name, index) => (
          <View style={styles.story} key={name}>
            <View style={[styles.storyRing, { borderColor: index ? palette.coral : palette.primary }]}>
              <CircleUserRound color={palette.muted} size={34} />
            </View>
            <Text numberOfLines={1} style={[styles.storyLabel, { color: palette.text }]}>{name}</Text>
          </View>
        ))}
      </ScrollView>
      {posts.length ? (
        posts.map((post) => (
          <View style={[styles.feedPost, { borderColor: palette.border }]} key={post.id}>
            <View style={styles.postHeader}>
              <View style={[styles.avatarSmall, { backgroundColor: palette.surface2 }]}>
                {post.users?.avatar_url ? <Image source={{ uri: post.users.avatar_url }} style={styles.fill} /> : <CircleUserRound color={palette.muted} size={22} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.postHandle, { color: palette.text }]}>@{post.users?.handle ?? "runner"}</Text>
                <Text style={[styles.caption, { color: palette.muted }]}>
                  {new Date(post.created_at).toLocaleDateString("ko-KR")}
                </Text>
              </View>
              <Menu color={palette.text} size={20} />
            </View>
            {post.media_urls?.[0] || post.runs?.route_image_url ? (
              <Image
                source={{ uri: post.media_urls?.[0] || post.runs?.route_image_url }}
                style={styles.postImage}
              />
            ) : null}
            <Text style={[styles.postBody, { color: palette.text }]}>{post.body}</Text>
          </View>
        ))
      ) : (
        <Empty palette={palette} icon={Compass} title="아직 피드가 비어 있습니다" body="러닝을 마치고 첫 인증 게시물을 만들어 보세요." />
      )}
    </ScrollView>
  );
}

type MobileCrew = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  meeting_place: string | null;
  image_url: string | null;
  experience_points: number;
  region_level1: string | null;
  region_level2: string | null;
};

function CrewScreen({
  currentCrew,
  onChanged,
  palette,
  userId
}: {
  currentCrew: {
    id: string;
    name: string;
    imageUrl: string | null;
    experiencePoints: number;
    meetingPlace: string | null;
    regionLevel1: string | null;
    regionLevel2: string | null;
    role: string;
    chatId: string | null;
  } | null;
  onChanged: () => void;
  palette: ReturnType<typeof createPalette>;
  userId: string;
}) {
  const supabase = useMemo(() => getSupabase(), []);
  const [crews, setCrews] = useState<MobileCrew[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterLevel1, setFilterLevel1] = useState("");
  const [filterLevel2, setFilterLevel2] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [meetingPlace, setMeetingPlace] = useState("");
  const [regionLevel1, setRegionLevel1] = useState("");
  const [regionLevel2, setRegionLevel2] = useState("");
  const [privateCrew, setPrivateCrew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadCrews = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [crewResult, memberResult] = await Promise.all([
      (supabase.from("crews") as any)
        .select(
          "id,owner_id,name,description,is_private,meeting_place,image_url,experience_points,region_level1,region_level2"
        )
        .order("experience_points", { ascending: false })
        .limit(300),
      (supabase.from("crew_members") as any).select("crew_id")
    ]);
    if (crewResult.error) {
      Alert.alert("크루를 불러오지 못했습니다", crewResult.error.message);
    } else {
      setCrews((crewResult.data ?? []) as MobileCrew[]);
    }
    const counts = (memberResult.data ?? []).reduce(
      (result: Record<string, number>, member: { crew_id: string }) => {
        result[member.crew_id] = (result[member.crew_id] ?? 0) + 1;
        return result;
      },
      {}
    );
    setMemberCounts(counts);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadCrews();
  }, [loadCrews]);

  const visibleCrews = crews.filter((crew) => {
    if (filterLevel1 && crew.region_level1 !== filterLevel1) return false;
    if (filterLevel2 && crew.region_level2 !== filterLevel2) return false;
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    if (!normalized) return true;
    return [
      crew.name,
      crew.description,
      crew.meeting_place,
      crew.region_level1,
      crew.region_level2
    ].some((value) =>
      value?.toLocaleLowerCase("ko-KR").includes(normalized)
    );
  });

  async function createCrew() {
    if (
      !supabase ||
      currentCrew ||
      !name.trim() ||
      !regionLevel1 ||
      !regionLevel2
    ) {
      Alert.alert(
        "필수 정보를 확인해 주세요",
        "크루 이름과 광역·세부 활동 지역을 모두 선택해야 합니다."
      );
      return;
    }
    setSubmitting(true);
    const { data, error } = await (supabase.from("crews") as any)
      .insert({
        owner_id: userId,
        name: name.trim(),
        description: description.trim() || null,
        is_private: privateCrew,
        meeting_place: meetingPlace.trim() || null,
        region_level1: regionLevel1,
        region_level2: regionLevel2
      })
      .select(
        "id,owner_id,name,description,is_private,meeting_place,image_url,experience_points,region_level1,region_level2"
      )
      .single();
    if (error) {
      setSubmitting(false);
      Alert.alert("크루를 만들지 못했습니다", error.message);
      return;
    }
    const { error: memberError } = await (supabase.from("crew_members") as any)
      .insert({ crew_id: data.id, user_id: userId, role: "owner" });
    if (memberError) {
      await (supabase.from("crews") as any).delete().eq("id", data.id);
      setSubmitting(false);
      Alert.alert("크루를 만들지 못했습니다", memberError.message);
      return;
    }
    setSubmitting(false);
    setCreateOpen(false);
    setName("");
    setDescription("");
    setMeetingPlace("");
    setRegionLevel1("");
    setRegionLevel2("");
    setPrivateCrew(false);
    await loadCrews();
    onChanged();
  }

  async function joinCrew(crew: MobileCrew) {
    if (!supabase || currentCrew) return;
    if (crew.is_private) {
      Alert.alert(
        "비공개 크루",
        "비공개 크루 가입 요청 기능은 크루 상세 화면에서 이용할 수 있습니다."
      );
      return;
    }
    if ((memberCounts[crew.id] ?? 0) >= 50) {
      Alert.alert("크루 정원이 모두 찼습니다");
      return;
    }
    const { error } = await (supabase.from("crew_members") as any).insert({
      crew_id: crew.id,
      user_id: userId,
      role: "member"
    });
    if (error) {
      const message = error.message.includes("thirty days")
        ? "이 크루에서 탈퇴한 뒤 30일이 지나야 다시 가입할 수 있습니다."
        : error.message.includes("blocked")
          ? "이 크루에서 차단되어 가입할 수 없습니다."
          : error.message;
      Alert.alert("크루에 가입하지 못했습니다", message);
      return;
    }
    await loadCrews();
    onChanged();
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>
            함께 달릴 크루
          </Text>
          <Text style={[styles.body, { color: palette.muted }]}>
            광역 지역부터 시·군·구까지 원하는 활동 지역으로 찾아보세요.
          </Text>
        </View>
        {!currentCrew ? (
          <Pressable
            accessibilityLabel="새 크루 만들기"
            onPress={() => setCreateOpen((value) => !value)}
            style={[styles.squareButton, { backgroundColor: palette.primary }]}
          >
            <Plus color="#fff" size={22} />
          </Pressable>
        ) : null}
      </View>

      {currentCrew ? (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.primarySoft, borderColor: palette.primary }
          ]}
        >
          <Text style={[styles.eyebrow, { color: palette.primary }]}>내 크루</Text>
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            {currentCrew.name}
          </Text>
          <Text style={[styles.caption, { color: palette.muted }]}>
            {[currentCrew.regionLevel1, currentCrew.regionLevel2]
              .filter(Boolean)
              .join(" ")}
            {currentCrew.meetingPlace ? ` · ${currentCrew.meetingPlace}` : ""}
          </Text>
        </View>
      ) : null}

      {!currentCrew && createOpen ? (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.border }
          ]}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            새 크루 만들기
          </Text>
          <Field
            label="크루 이름"
            onChangeText={setName}
            palette={palette}
            placeholder="크루 이름"
            value={name}
          />
          <Text style={[styles.label, { color: palette.text }]}>광역 활동 지역</Text>
          <RegionChips
            options={KOREAN_REGIONS.map((region) => region.level1)}
            palette={palette}
            value={regionLevel1}
            onChange={(value) => {
              setRegionLevel1(value);
              setRegionLevel2("");
            }}
          />
          <Text style={[styles.label, { color: palette.text }]}>세부 활동 지역</Text>
          <RegionChips
            disabled={!regionLevel1}
            options={getLevel2Regions(regionLevel1)}
            palette={palette}
            value={regionLevel2}
            onChange={setRegionLevel2}
          />
          <Field
            label="주요 만남 장소"
            onChangeText={setMeetingPlace}
            palette={palette}
            placeholder="예: 두류공원 야외음악당"
            value={meetingPlace}
          />
          <Field
            label="크루 소개"
            multiline
            onChangeText={setDescription}
            palette={palette}
            placeholder="함께 달릴 사람들에게 크루를 소개해 주세요."
            value={description}
          />
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: palette.text }]}>
                비공개 크루
              </Text>
              <Text style={[styles.caption, { color: palette.muted }]}>
                가입하려면 크루장의 승인이 필요합니다.
              </Text>
            </View>
            <Switch
              onValueChange={setPrivateCrew}
              trackColor={{ false: palette.surface2, true: palette.primary }}
              value={privateCrew}
            />
          </View>
          <Pressable
            disabled={submitting}
            onPress={() => void createCrew()}
            style={[styles.primaryButton, { backgroundColor: palette.primary }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Check color="#fff" size={20} />
                <Text style={styles.primaryButtonText}>크루 만들기</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.searchBox,
          { backgroundColor: palette.surface, borderColor: palette.border }
        ]}
      >
        <Search color={palette.muted} size={19} />
        <TextInput
          onChangeText={setQuery}
          placeholder="크루 이름, 지역, 활동 장소 검색"
          placeholderTextColor={palette.muted}
          style={[styles.searchInput, { color: palette.text }]}
          value={query}
        />
      </View>

      <Text style={[styles.label, { color: palette.text }]}>광역 지역</Text>
      <RegionChips
        includeAll
        options={KOREAN_REGIONS.map((region) => region.level1)}
        palette={palette}
        value={filterLevel1}
        onChange={(value) => {
          setFilterLevel1(value);
          setFilterLevel2("");
        }}
      />
      <Text style={[styles.label, { color: palette.text }]}>시·군·구</Text>
      <RegionChips
        disabled={!filterLevel1}
        includeAll
        options={getLevel2Regions(filterLevel1)}
        palette={palette}
        value={filterLevel2}
        onChange={setFilterLevel2}
      />

      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : visibleCrews.length ? (
        visibleCrews.map((crew) => {
          const isMine = currentCrew?.id === crew.id;
          return (
            <View
              key={crew.id}
              style={[
                styles.card,
                { backgroundColor: palette.surface, borderColor: palette.border }
              ]}
            >
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <View style={styles.inlineRow}>
                    <Text style={[styles.cardTitle, { color: palette.text }]}>
                      {crew.name}
                    </Text>
                    {crew.is_private ? (
                      <Lock color={palette.muted} size={15} />
                    ) : null}
                  </View>
                  <Text style={[styles.caption, { color: palette.primary }]}>
                    {[crew.region_level1, crew.region_level2]
                      .filter(Boolean)
                      .join(" ") || "활동 지역 미등록"}
                  </Text>
                </View>
                <Text style={[styles.caption, { color: palette.muted }]}>
                  {memberCounts[crew.id] ?? 0}/50
                </Text>
              </View>
              <Text style={[styles.body, { color: palette.text }]}>
                {crew.description || "함께 즐겁게 달리는 러닝크루입니다."}
              </Text>
              {crew.meeting_place ? (
                <View style={styles.inlineRow}>
                  <MapPin color={palette.muted} size={15} />
                  <Text style={[styles.caption, { color: palette.muted }]}>
                    {crew.meeting_place}
                  </Text>
                </View>
              ) : null}
              {!currentCrew ? (
                <Pressable
                  onPress={() => void joinCrew(crew)}
                  style={[
                    styles.secondaryButton,
                    { borderColor: palette.border }
                  ]}
                >
                  <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
                    {crew.is_private ? "가입 요청" : "크루 가입"}
                  </Text>
                </Pressable>
              ) : isMine ? (
                <View style={styles.inlineRow}>
                  <Check color={palette.primary} size={17} />
                  <Text style={[styles.caption, { color: palette.primary }]}>
                    현재 소속 크루
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })
      ) : (
        <Empty
          body="검색 범위를 넓히거나 다른 지역을 선택해 보세요."
          icon={MapPin}
          palette={palette}
          title="조건에 맞는 크루가 없습니다"
        />
      )}
    </ScrollView>
  );
}

function RegionChips({
  disabled,
  includeAll,
  onChange,
  options,
  palette,
  value
}: {
  disabled?: boolean;
  includeAll?: boolean;
  onChange: (value: string) => void;
  options: readonly string[];
  palette: ReturnType<typeof createPalette>;
  value: string;
}) {
  const values = includeAll ? ["", ...options] : [...options];
  return (
    <ScrollView
      contentContainerStyle={styles.chipRow}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {values.length ? (
        values.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              disabled={disabled}
              key={option || "all"}
              onPress={() => onChange(option)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected
                    ? palette.primary
                    : palette.surface,
                  borderColor: selected ? palette.primary : palette.border,
                  opacity: disabled ? 0.45 : 1
                }
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? "#fff" : palette.text }
                ]}
              >
                {option || "전체"}
              </Text>
            </Pressable>
          );
        })
      ) : (
        <Text style={[styles.caption, { color: palette.muted }]}>
          먼저 광역 지역을 선택하세요.
        </Text>
      )}
    </ScrollView>
  );
}

function ProfileScreen({
  currentCrew,
  palette,
  profile,
  runs,
  onSettings,
  onStudio
}: {
  currentCrew: {
    id: string;
    name: string;
    imageUrl: string | null;
    experiencePoints: number;
    meetingPlace: string | null;
    regionLevel1: string | null;
    regionLevel2: string | null;
    role: string;
    chatId: string | null;
  } | null;
  palette: ReturnType<typeof createPalette>;
  profile: UserProfile;
  runs: RunRecord[];
  onSettings: () => void;
  onStudio: (run: RunRecord) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.rowBetween}>
        <Text style={[styles.headerTitle, { color: palette.text }]}>@{profile.handle}</Text>
        <Pressable onPress={onSettings} style={styles.iconButton}>
          <Menu color={palette.text} size={25} />
        </Pressable>
      </View>
      <View style={styles.profileTop}>
        <View style={[styles.avatarLarge, { backgroundColor: palette.surface2 }]}>
          {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.fill} /> : <CircleUserRound color={palette.muted} size={50} />}
        </View>
        <View style={styles.profileStats}>
          <Metric palette={palette} label="러닝" value={runs.length.toString()} />
          <Metric palette={palette} label="거리" value={`${(Number(profile.total_distance_m) / 1000).toFixed(1)}km`} />
          <Metric palette={palette} label="레벨" value={profile.level.toString()} />
        </View>
      </View>
      <Text style={[styles.cardTitle, { color: palette.text }]}>{profile.display_name}</Text>
      {profile.bio ? <Text style={[styles.body, { color: palette.text }]}>{profile.bio}</Text> : null}
      <View style={[styles.levelCard, { backgroundColor: palette.text }]}>
        <Text style={[styles.caption, { color: palette.background }]}>RUNNER LEVEL</Text>
        <Text style={[styles.levelText, { color: palette.background }]}>LV.{profile.level}</Text>
        <Text style={[styles.caption, { color: palette.background }]}>
          {profile.experience_points.toLocaleString()} XP · {profile.current_streak}일 연속
        </Text>
      </View>
      {currentCrew ? (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.border }
          ]}
        >
          <View style={styles.rowBetween}>
            <View
              style={[
                styles.bigCircleSmall,
                { backgroundColor: palette.primarySoft }
              ]}
            >
              <Users color={palette.primary} size={24} />
            </View>
            <Text style={[styles.eyebrow, { color: palette.primary }]}>
              {currentCrew.role === "owner"
                ? "크루장"
                : currentCrew.role === "manager"
                  ? "운영진"
                  : "크루원"}
            </Text>
          </View>
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            {currentCrew.name}
          </Text>
          <Text style={[styles.caption, { color: palette.muted }]}>
            누적 {currentCrew.experiencePoints.toLocaleString()} XP
            {[currentCrew.regionLevel1, currentCrew.regionLevel2].some(Boolean)
              ? ` · ${[currentCrew.regionLevel1, currentCrew.regionLevel2]
                  .filter(Boolean)
                  .join(" ")}`
              : ""}
            {currentCrew.meetingPlace ? ` · ${currentCrew.meetingPlace}` : ""}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.sectionTitle, { color: palette.text }]}>러닝 기록</Text>
      {runs.map((run) => (
        <Pressable
          key={run.id}
          onPress={() => onStudio(run)}
          style={[styles.runRow, { borderColor: palette.border }]}
        >
          <View>
            <Text style={[styles.postHandle, { color: palette.text }]}>
              {(Number(run.distance_m) / 1000).toFixed(2)} km
            </Text>
            <Text style={[styles.caption, { color: palette.muted }]}>
              {formatDuration(run.duration_s)} · {formatPace(run.average_pace_s)}
            </Text>
          </View>
          <ChevronRight color={palette.muted} size={20} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SettingsScreen({
  palette,
  profile,
  onBack,
  onProfileChange
}: {
  palette: ReturnType<typeof createPalette>;
  profile: UserProfile;
  onBack: () => void;
  onProfileChange: (profile: UserProfile) => void;
}) {
  const supabase = getSupabase();
  const [draft, setDraft] = useState(profile);

  async function patch(values: Partial<UserProfile>) {
    const next = { ...draft, ...values };
    setDraft(next);
    onProfileChange(next);
    await AsyncStorage.setItem("rungether:settings", JSON.stringify(values));
    if (supabase) {
      await (supabase.from("users") as any)
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
  }

  return (
    <SafeAreaView style={[styles.app, { backgroundColor: palette.background }]}>
      <View style={[styles.settingsHeader, { borderBottomColor: palette.border }]}>
        <Pressable onPress={onBack}><ChevronRight color={palette.text} size={27} style={{ transform: [{ rotate: "180deg" }] }} /></Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>설정 및 활동</Text>
        <View style={{ width: 27 }} />
      </View>
      <ScrollView contentContainerStyle={styles.settingsPage}>
        <SettingsGroup palette={palette} title="앱 환경">
          <Text style={[styles.label, { color: palette.text }]}>화면 테마</Text>
          <Segmented
            options={[
              { label: "시스템", value: "system" },
              { label: "라이트", value: "light" },
              { label: "다크", value: "dark" }
            ]}
            palette={palette}
            value={draft.theme_mode}
            onChange={(value) => void patch({ theme_mode: value as ThemeMode })}
          />
          <Text style={[styles.label, { color: palette.text }]}>기본 첫 화면</Text>
          <Segmented
            options={[
              { label: "러닝 홈", value: "running" },
              { label: "SNS 피드", value: "feed" }
            ]}
            palette={palette}
            value={draft.default_home}
            onChange={(value) => void patch({ default_home: value as HomeMode })}
          />
        </SettingsGroup>
        <SettingsGroup palette={palette} title="음성 안내">
          <SettingSwitch
            label="러닝 음성 안내"
            palette={palette}
            value={draft.voice_enabled}
            onChange={(value: boolean) => void patch({ voice_enabled: value })}
          />
          <Text style={[styles.label, { color: palette.text }]}>다른 앱 소리</Text>
          <Segmented
            options={[
              { label: "잠깐 낮추기", value: "duck" },
              { label: "그대로 겹치기", value: "mix" }
            ]}
            palette={palette}
            value={draft.voice_mix_mode}
            onChange={(value) => void patch({ voice_mix_mode: value as "duck" | "mix" })}
          />
          <Text style={[styles.label, { color: palette.text }]}>거리 안내</Text>
          <Segmented
            options={[
              { label: "0.5km", value: "500" },
              { label: "1km", value: "1000" },
              { label: "2km", value: "2000" }
            ]}
            palette={palette}
            value={String(draft.voice_distance_interval_m)}
            onChange={(value) => void patch({ voice_distance_interval_m: Number(value) })}
          />
          <Text style={[styles.label, { color: palette.text }]}>시간 안내</Text>
          <Segmented
            options={[
              { label: "끔", value: "0" },
              { label: "5분", value: "5" },
              { label: "10분", value: "10" },
              { label: "15분", value: "15" }
            ]}
            palette={palette}
            value={String(draft.voice_time_interval_min)}
            onChange={(value) => void patch({ voice_time_interval_min: Number(value) })}
          />
          <SettingSwitch label="거리 읽기" palette={palette} value={draft.voice_read_distance} onChange={(value: boolean) => void patch({ voice_read_distance: value })} />
          <SettingSwitch label="구간 페이스 읽기" palette={palette} value={draft.voice_read_split_pace} onChange={(value: boolean) => void patch({ voice_read_split_pace: value })} />
          <SettingSwitch label="총 시간 읽기" palette={palette} value={draft.voice_read_total_time} onChange={(value: boolean) => void patch({ voice_read_total_time: value })} />
          <SettingSwitch label="목표 진행률 읽기" palette={palette} value={draft.voice_read_goal_progress} onChange={(value: boolean) => void patch({ voice_read_goal_progress: value })} />
        </SettingsGroup>
        <SettingsGroup palette={palette} title="계정">
          <Pressable onPress={signOut} style={styles.settingRow}>
            <LogOut color={palette.coral} size={22} />
            <Text style={[styles.settingDanger, { color: palette.coral }]}>로그아웃</Text>
          </Pressable>
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

function BottomTabs({
  active,
  palette,
  profile,
  onChange
}: {
  active: AppTab;
  palette: ReturnType<typeof createPalette>;
  profile: UserProfile;
  onChange: (tab: AppTab) => void;
}) {
  const tabs: Array<{ id: AppTab; label: string; icon: typeof Home }> = [
    { id: "home", label: "홈", icon: Home },
    { id: "feed", label: "피드", icon: Compass },
    { id: "run", label: "러닝", icon: Play },
    { id: "crew", label: "크루", icon: Users },
    { id: "profile", label: "프로필", icon: CircleUserRound }
  ];
  return (
    <View style={[styles.bottomBar, { backgroundColor: palette.nav, borderColor: palette.navBorder }]}>
      {tabs.map((item) => {
        const Icon = item.icon;
        const selected = active === item.id;
        const isRun = item.id === "run";
        return (
          <Pressable
            accessibilityLabel={item.label}
            key={item.id}
            onPress={() => onChange(item.id)}
            style={[
              styles.tabButton,
              isRun && { backgroundColor: palette.primary },
              selected && !isRun && { backgroundColor: palette.navActive }
            ]}
          >
            {item.id === "profile" && profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.tabAvatar} />
            ) : (
              <Icon
                color={isRun ? "#fff" : selected ? palette.navText : palette.navMuted}
                fill={item.id === "home" && selected ? palette.navText : "transparent"}
                size={isRun ? 26 : 23}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({
  label,
  palette,
  multiline,
  ...props
}: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={palette.muted}
        style={[
          styles.field,
          multiline && styles.textarea,
          { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border }
        ]}
      />
    </View>
  );
}

function Segmented({
  options,
  palette,
  value,
  onChange
}: {
  options: Array<{ label: string; value: string }>;
  palette: ReturnType<typeof createPalette>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: palette.surface2 }]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[
            styles.segment,
            value === option.value && { backgroundColor: palette.surface }
          ]}
        >
          <Text style={[styles.segmentText, { color: value === option.value ? palette.text : palette.muted }]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SettingsGroup({ palette, title, children }: any) {
  return (
    <View style={[styles.settingsGroup, { borderColor: palette.border }]}>
      <Text style={[styles.settingsGroupTitle, { color: palette.muted }]}>{title}</Text>
      {children}
    </View>
  );
}

function SettingSwitch({ label, palette, value, onChange }: any) {
  return (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { color: palette.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: palette.surface2, true: palette.primary }}
      />
    </View>
  );
}

function Metric({ palette, label, value }: any) {
  return (
    <View style={styles.metric}>
      <Text numberOfLines={1} style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
      <Text numberOfLines={1} style={[styles.caption, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

function Empty({ palette, icon: Icon, title, body }: any) {
  return (
    <View style={styles.empty}>
      <Icon color={palette.muted} size={38} />
      <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.body, { color: palette.muted }]}>{body}</Text>
    </View>
  );
}

function formatDuration(seconds?: number | null) {
  const value = Math.max(0, Number(seconds ?? 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remain = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

function formatPace(seconds?: number | null) {
  if (!seconds) return "--:-- /km";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} /km`;
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  content: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  authPage: { flex: 1, justifyContent: "space-between", padding: 28 },
  authBrand: { paddingTop: 64, gap: 18 },
  logo: { width: 62, height: 62, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  brandName: { fontSize: 16, fontWeight: "900" },
  authHeadline: { fontSize: 36, lineHeight: 44, fontWeight: "900", letterSpacing: 0 },
  title: { fontSize: 27, lineHeight: 34, fontWeight: "900", letterSpacing: 0 },
  heroTitle: { fontSize: 32, lineHeight: 40, fontWeight: "900", letterSpacing: 0, marginTop: 8 },
  body: { fontSize: 14, lineHeight: 22, fontWeight: "600", letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: "600", letterSpacing: 0 },
  kakaoButton: { height: 56, borderRadius: 8, backgroundColor: "#FEE500", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  kakaoK: { width: 22, height: 22, borderRadius: 4, backgroundColor: "#191600", color: "#FEE500", textAlign: "center", lineHeight: 22, fontWeight: "900" },
  kakaoText: { color: "#191600", fontSize: 15, fontWeight: "800" },
  onboarding: { padding: 24, gap: 18, paddingBottom: 48 },
  eyebrow: { fontSize: 13, fontWeight: "900", letterSpacing: 0 },
  avatarEditor: { alignItems: "center", gap: 10, marginVertical: 8 },
  avatarLarge: { width: 92, height: 92, borderRadius: 46, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  fill: { width: "100%", height: "100%" },
  link: { fontSize: 13, fontWeight: "800" },
  fieldWrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: "800", marginTop: 4 },
  field: { minHeight: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, fontSize: 14, fontWeight: "600" },
  textarea: { minHeight: 100, paddingTop: 14, textAlignVertical: "top" },
  segmented: { minHeight: 46, borderRadius: 8, flexDirection: "row", padding: 4 },
  segment: { flex: 1, borderRadius: 6, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  segmentText: { fontSize: 12, fontWeight: "800" },
  primaryButton: { minHeight: 54, borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 10 },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  header: { height: 58, borderBottomWidth: 1, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 20, fontWeight: "900" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  page: { padding: 18, gap: 18, paddingBottom: 118 },
  feedPage: { paddingBottom: 118 },
  mapCard: { height: 290, borderWidth: 1, borderRadius: 8, overflow: "hidden", position: "relative" },
  runFab: { width: 68, height: 68, borderRadius: 34, position: "absolute", bottom: 18, alignSelf: "center", left: "50%", marginLeft: -34, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  metricRow: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, minWidth: 0 },
  metricValue: { fontSize: 18, fontWeight: "900", letterSpacing: 0 },
  card: { borderRadius: 8, borderWidth: 1, padding: 16, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  squareButton: { width: 46, height: 46, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  searchBox: { minHeight: 50, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700" },
  chipRow: { gap: 8, paddingRight: 18 },
  chip: { minHeight: 38, borderRadius: 19, borderWidth: 1, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  chipText: { fontSize: 12, fontWeight: "800" },
  secondaryButton: { minHeight: 46, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  secondaryButtonText: { fontSize: 14, fontWeight: "900" },
  bigCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  bigCircleSmall: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  storyRow: { gap: 14, padding: 16 },
  story: { width: 72, alignItems: "center", gap: 6 },
  storyRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  storyLabel: { width: 70, textAlign: "center", fontSize: 11, fontWeight: "700" },
  feedPost: { borderTopWidth: 1, borderBottomWidth: 1, paddingBottom: 16 },
  postHeader: { height: 62, paddingHorizontal: 16, flexDirection: "row", gap: 10, alignItems: "center" },
  postHandle: { fontSize: 14, fontWeight: "900" },
  postImage: { width: "100%", aspectRatio: 4 / 5, backgroundColor: "#d9dfdc" },
  postBody: { paddingHorizontal: 16, paddingTop: 12, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  empty: { alignItems: "center", gap: 10, padding: 44 },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 24 },
  profileStats: { flex: 1, flexDirection: "row", gap: 8 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  levelCard: { borderRadius: 8, padding: 18, gap: 4 },
  levelText: { fontSize: 30, fontWeight: "900" },
  sectionTitle: { fontSize: 18, fontWeight: "900", marginTop: 8 },
  runRow: { minHeight: 68, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingsHeader: { height: 60, borderBottomWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingsPage: { paddingBottom: 48 },
  settingsGroup: { borderBottomWidth: 8, padding: 20, gap: 14 },
  settingsGroupTitle: { fontSize: 13, fontWeight: "900", marginBottom: 4 },
  settingRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  settingLabel: { fontSize: 15, fontWeight: "700", flex: 1 },
  settingDanger: { fontSize: 15, fontWeight: "800", flex: 1 },
  bottomBar: { position: "absolute", left: 16, right: 16, bottom: Platform.OS === "ios" ? 10 : 14, height: 70, borderRadius: 35, borderWidth: 1, padding: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-around", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  tabButton: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  tabAvatar: { width: 29, height: 29, borderRadius: 15 }
});
