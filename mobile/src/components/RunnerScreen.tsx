import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import {
  ChevronLeft,
  CircleStop,
  LocateFixed,
  Mic2,
  MicOff,
  Pause,
  Play,
  RotateCcw
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  appendRunPoint,
  clearActiveRun,
  loadActiveRun,
  loadRunPoints,
  saveActiveRun
} from "../lib/database";
import { formatClock, formatPace, validatePoint } from "../lib/runMath";
import { getSupabase } from "../lib/supabase";
import { configureVoice, speak, stopVoice } from "../lib/voice";
import { createPalette } from "../theme";
import {
  ActiveRun,
  RunGoalType,
  RunPoint,
  RunRecord,
  RunSplit,
  TogetherLocation,
  TogetherRun,
  UserProfile
} from "../types";
import { RUN_LOCATION_TASK } from "../tasks/locationTask";
import { RunMap } from "./RunMap";
import { TogetherRunPanel } from "./TogetherRunPanel";

type Stage = "prepare" | "countdown" | "running" | "finishing";

export function RunnerScreen({
  palette,
  profile,
  currentCrew,
  onClose,
  onCompleted
}: {
  palette: ReturnType<typeof createPalette>;
  profile: UserProfile;
  currentCrew?: {
    id: string;
    name: string;
    chatId: string | null;
  } | null;
  onClose: () => void;
  onCompleted: (run: RunRecord) => void;
}) {
  const supabase = useMemo(() => getSupabase(), []);
  const [stage, setStage] = useState<Stage>("prepare");
  const [goalType, setGoalType] = useState<RunGoalType>("open");
  const [goalValue, setGoalValue] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [active, setActive] = useState<ActiveRun | null>(null);
  const [points, setPoints] = useState<RunPoint[]>([]);
  const [acceptedPoints, setAcceptedPoints] = useState<RunPoint[]>([]);
  const [permissionStatus, setPermissionStatus] = useState("GPS 권한 확인 중");
  const [gpsQuality, setGpsQuality] = useState(0);
  const [togetherRun, setTogetherRun] = useState<TogetherRun | null>(null);
  const [togetherLocations, setTogetherLocations] = useState<TogetherLocation[]>([]);
  const fallbackSubscription = useRef<Location.LocationSubscription | null>(null);
  const lowSpeedSince = useRef<number | null>(null);
  const announcedGoal = useRef(false);
  const synchronizedStartHandled = useRef(false);

  const processPoints = useCallback((raw: RunPoint[]) => {
    const next: RunPoint[] = [];
    let distanceM = 0;
    raw.forEach((point) => {
      const previous = next.at(-1);
      const result = validatePoint(point, previous);
      if (!result.accepted) return;
      next.push(point);
      distanceM += result.distanceM;
    });
    setPoints(raw);
    setAcceptedPoints(next);
    const qualitySamples = next
      .map((point) => point.accuracy_m)
      .filter((value): value is number => typeof value === "number");
    setGpsQuality(
      qualitySamples.length
        ? qualitySamples.reduce((sum, value) => sum + value, 0) /
            qualitySamples.length
        : 0
    );
    return distanceM;
  }, []);

  const refreshPoints = useCallback(
    async (run: ActiveRun) => {
      const raw = await loadRunPoints(run.id);
      const distanceM = processPoints(raw);
      setActive((current) =>
        current ? { ...current, distanceM } : current
      );
    },
    [processPoints]
  );

  useEffect(() => {
    void Location.requestForegroundPermissionsAsync().then(async (foreground) => {
      if (foreground.status !== "granted") {
        setPermissionStatus("위치 권한이 필요합니다");
        return;
      }
      setPermissionStatus("GPS 준비됨");
      const restored = await loadActiveRun();
      if (restored) {
        setActive(restored);
        setGoalType(restored.goalType);
        setGoalValue(restored.goalValue);
        setStage("running");
        await refreshPoints(restored);
      }
    });
  }, [refreshPoints]);

  useEffect(() => {
    if (!active || stage !== "running") return;
    const timer = setInterval(() => {
      setActive((current) => {
        if (!current) return current;
        const paused = current.manualPaused || current.autoPaused;
        const next = {
          ...current,
          movingSeconds: current.movingSeconds + (paused ? 0 : 1),
          pausedSeconds: current.pausedSeconds + (paused ? 1 : 0)
        };
        void saveActiveRun(next);
        return next;
      });
    }, 1000);
    const pointTimer = setInterval(() => void refreshPoints(active), 1800);
    return () => {
      clearInterval(timer);
      clearInterval(pointTimer);
    };
  }, [active?.id, refreshPoints, stage]);

  useEffect(() => {
    if (
      !supabase ||
      !active?.groupRunId ||
      stage !== "running" ||
      !acceptedPoints.at(-1)
    ) {
      return;
    }

    const sync = async () => {
      const latest = acceptedPoints.at(-1)!;
      await (supabase.from("group_run_live_locations") as any).upsert({
        group_run_id: active.groupRunId,
        user_id: profile.id,
        latitude: latest.latitude,
        longitude: latest.longitude,
        distance_m: Math.round(active.distanceM),
        elapsed_s: active.movingSeconds,
        updated_at: new Date().toISOString()
      });
      const { data } = await (supabase.from("group_run_live_locations") as any)
        .select(
          "group_run_id,user_id,latitude,longitude,distance_m,elapsed_s,updated_at,users(handle,avatar_url)"
        )
        .eq("group_run_id", active.groupRunId)
        .neq("user_id", profile.id)
        .gt("updated_at", new Date(Date.now() - 60_000).toISOString());
      setTogetherLocations(
        (data ?? []).map((location: any) => ({
          ...location,
          handle: location.users?.handle,
          avatar_url: location.users?.avatar_url
        }))
      );
    };

    void sync();
    const timer = setInterval(() => void sync(), 3000);
    return () => clearInterval(timer);
  }, [
    acceptedPoints,
    active?.distanceM,
    active?.groupRunId,
    active?.movingSeconds,
    profile.id,
    stage,
    supabase
  ]);

  useEffect(() => {
    if (!active || stage !== "running") return;
    const latest = acceptedPoints.at(-1);
    if (!latest || active.manualPaused) return;
    const speed = latest.speed_mps ?? 0;
    if (speed < 0.8) {
      lowSpeedSince.current ??= Date.now();
      if (Date.now() - lowSpeedSince.current > 10000 && !active.autoPaused) {
        const next = { ...active, autoPaused: true };
        setActive(next);
        void saveActiveRun(next);
        speak("움직임이 멈춰 자동으로 일시정지합니다.", {
          ...profile,
          voice_enabled: active.voiceEnabled
        });
      }
    } else if (speed > 1.2) {
      lowSpeedSince.current = null;
      if (active.autoPaused) {
        const next = { ...active, autoPaused: false };
        setActive(next);
        void saveActiveRun(next);
        speak("움직임을 감지해 러닝을 다시 시작합니다.", {
          ...profile,
          voice_enabled: active.voiceEnabled
        });
      }
    }
  }, [acceptedPoints, active, profile, stage]);

  useEffect(() => {
    if (!active || stage !== "running" || !active.voiceEnabled) return;
    const distanceInterval = profile.voice_distance_interval_m;
    if (
      distanceInterval > 0 &&
      active.distanceM - active.lastVoiceDistanceM >= distanceInterval
    ) {
      const pace =
        active.distanceM > 0
          ? Math.round(active.movingSeconds / (active.distanceM / 1000))
          : null;
      const parts = [];
      if (profile.voice_read_distance) {
        parts.push(`${(active.distanceM / 1000).toFixed(1)} 킬로미터`);
      }
      if (profile.voice_read_split_pace && pace) {
        parts.push(`평균 페이스 ${formatPace(pace)}`);
      }
      if (profile.voice_read_total_time) {
        parts.push(`총 시간 ${Math.floor(active.movingSeconds / 60)}분`);
      }
      const next = { ...active, lastVoiceDistanceM: active.distanceM };
      setActive(next);
      void saveActiveRun(next);
      if (parts.length) speak(parts.join(", "), profile);
    }

    const minute = Math.floor(active.movingSeconds / 60);
    if (
      profile.voice_time_interval_min > 0 &&
      minute > 0 &&
      minute % profile.voice_time_interval_min === 0 &&
      minute !== active.lastVoiceMinute
    ) {
      const next = { ...active, lastVoiceMinute: minute };
      setActive(next);
      void saveActiveRun(next);
      speak(`${minute}분 러닝 중입니다.`, profile);
    }

    const reached =
      (active.goalType === "distance" &&
        active.goalValue &&
        active.distanceM >= active.goalValue) ||
      (active.goalType === "time" &&
        active.goalValue &&
        active.movingSeconds >= active.goalValue);
    if (reached && !announcedGoal.current) {
      announcedGoal.current = true;
      speak("목표를 달성했습니다. 멋진 러닝입니다.", profile);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [active, profile, stage]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && active) void refreshPoints(active);
    });
    return () => subscription.remove();
  }, [active, refreshPoints]);

  async function startLocation(run: ActiveRun) {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== "granted") {
      Alert.alert("위치 권한", "러닝 기록을 위해 정확한 위치 권한을 허용해 주세요.");
      return false;
    }
    let backgroundStatus = "denied";
    try {
      const background = await Location.requestBackgroundPermissionsAsync();
      backgroundStatus = background.status;
    } catch {
      backgroundStatus = "unavailable";
    }
    try {
      await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        activityType: Location.ActivityType.Fitness,
        distanceInterval: 3,
        timeInterval: 1000,
        deferredUpdatesDistance: 5,
        deferredUpdatesInterval: 3000,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: "RUNGETHER 러닝 기록 중",
          notificationBody: "화면이 꺼져도 GPS 경로를 기록하고 있습니다.",
          notificationColor: "#0D9B6A"
        }
      });
      setPermissionStatus(
        backgroundStatus === "granted"
          ? "백그라운드 GPS 기록 중"
          : "앱 사용 중 GPS 기록"
      );
    } catch {
      fallbackSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 3,
          timeInterval: 1000
        },
        (location) => {
          const point = locationToPoint(location);
          void appendRunPoint(run.id, point);
          void refreshPoints(run);
        }
      );
      setPermissionStatus("포그라운드 GPS 기록 중");
    }
    return true;
  }

  async function startRun(synchronizedSession?: TogetherRun) {
    if (permissionStatus === "위치 권한이 필요합니다") {
      Alert.alert("위치 권한", "설정에서 RUNGETHER 위치 권한을 허용해 주세요.");
      return;
    }
    setStage("countdown");
    await configureVoice(profile);
    if (synchronizedSession?.synchronized_start_at) {
      const countdownStartsAt =
        new Date(synchronizedSession.synchronized_start_at).getTime() - 3000;
      const waitMs = Math.max(0, countdownStartsAt - Date.now());
      if (waitMs) await delay(waitMs);
    }
    for (const value of [3, 2, 1]) {
      setCountdown(value);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await delay(850);
    }
    const run: ActiveRun = {
      id: uuid(),
      startedAt:
        synchronizedSession?.synchronized_start_at ?? new Date().toISOString(),
      goalType,
      goalValue,
      distanceM: 0,
      movingSeconds: 0,
      pausedSeconds: 0,
      manualPaused: false,
      autoPaused: false,
      voiceEnabled: profile.voice_enabled,
      lastVoiceDistanceM: 0,
      lastVoiceMinute: 0,
      splitStartDistanceM: 0,
      splitStartMovingSeconds: 0,
      groupRunId: synchronizedSession?.id ?? togetherRun?.id ?? null
    };
    await saveActiveRun(run);
    const started = await startLocation(run);
    if (!started) {
      await clearActiveRun(run.id);
      setStage("prepare");
      return;
    }
    setActive(run);
    setStage("running");
    speak("러닝을 시작합니다.", profile);
  }

  const handleSynchronizedStart = useCallback(
    (session: TogetherRun) => {
      if (stage !== "prepare" || synchronizedStartHandled.current) return;
      synchronizedStartHandled.current = true;
      setTogetherRun(session);
      void startRun(session);
    },
    [stage]
  );

  function togglePause() {
    if (!active) return;
    const next = {
      ...active,
      manualPaused: !active.manualPaused,
      autoPaused: false
    };
    setActive(next);
    void saveActiveRun(next);
    speak(next.manualPaused ? "러닝을 일시정지합니다." : "러닝을 다시 시작합니다.", {
      ...profile,
      voice_enabled: next.voiceEnabled
    });
  }

  function toggleVoice() {
    if (!active) return;
    const next = { ...active, voiceEnabled: !active.voiceEnabled };
    setActive(next);
    void saveActiveRun(next);
    if (next.voiceEnabled) speak("음성 안내를 켰습니다.", { ...profile, voice_enabled: true });
    else stopVoice();
  }

  async function finishRun() {
    if (!active || !supabase) return;
    if (active.distanceM < 100) {
      Alert.alert("러닝 종료", "100m 미만 기록은 XP 러닝으로 저장할 수 없습니다.", [
        { text: "계속 달리기", style: "cancel" },
        {
          text: "기록 삭제",
          style: "destructive",
          onPress: () => void discardRun()
        }
      ]);
      return;
    }
    setStage("finishing");
    stopVoice();
    fallbackSubscription.current?.remove();
    fallbackSubscription.current = null;
    if (await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
    }
    const rawPoints = await loadRunPoints(active.id);
    const validPoints = filterAccepted(rawPoints);
    const splits = buildSplits(validPoints);
    const endedAt = new Date().toISOString();
    const totalSeconds = active.movingSeconds + active.pausedSeconds;
    const averagePace =
      active.distanceM > 0
        ? Math.round(active.movingSeconds / (active.distanceM / 1000))
        : null;
    const { data, error } = await (supabase as any).rpc("complete_gps_run", {
      p_started_at: active.startedAt,
      p_ended_at: endedAt,
      p_distance_m: active.distanceM,
      p_duration_s: totalSeconds,
      p_moving_duration_s: active.movingSeconds,
      p_paused_duration_s: active.pausedSeconds,
      p_average_pace_s: averagePace,
      p_title: "오늘의 러닝",
      p_visibility: "friends",
      p_crew_id: null,
      p_goal_type: active.goalType,
      p_goal_value: active.goalValue,
      p_gps_quality: gpsQuality,
      p_platform: `${Platform.OS}-expo`,
      p_route_visible: true,
      p_completion_key: active.id,
      p_tracks: validPoints,
      p_splits: splits,
      p_route_image_url: null
    });
    if (error) {
      Alert.alert(
        "러닝 저장 실패",
        `${error.message}\n\n기록은 기기에 남아 있습니다. 네트워크를 확인한 뒤 다시 종료해 주세요.`
      );
      setStage("running");
      return;
    }
    await clearActiveRun(active.id);
    if (active.groupRunId) {
      await (supabase.from("group_run_live_locations") as any)
        .delete()
        .eq("group_run_id", active.groupRunId)
        .eq("user_id", profile.id);
    }
    const completed = (Array.isArray(data) ? data[0] : data) as RunRecord;
    completed.run_splits = splits;
    speak("러닝을 종료합니다. 수고하셨습니다.", profile);
    onCompleted(completed);
  }

  async function discardRun() {
    if (!active) {
      onClose();
      return;
    }
    fallbackSubscription.current?.remove();
    if (await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
    }
    await clearActiveRun(active.id);
    setActive(null);
    onClose();
  }

  const pace =
    active && active.distanceM > 0
      ? Math.round(active.movingSeconds / (active.distanceM / 1000))
      : null;
  const gpsLabel =
    gpsQuality > 0
      ? gpsQuality < 15
        ? "GPS 매우 좋음"
        : gpsQuality < 35
          ? "GPS 좋음"
          : "GPS 보통"
      : permissionStatus;

  if (stage === "prepare") {
    return (
      <SafeAreaView style={[styles.app, { backgroundColor: palette.background }]}>
        <View style={styles.prepareHeader}>
          <Pressable onPress={onClose} style={styles.iconButton}>
            <ChevronLeft color={palette.text} size={28} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>러닝 준비</Text>
          <View style={styles.iconButton} />
        </View>
        <ScrollView contentContainerStyle={styles.preparePage}>
          <View style={[styles.mapPreview, { borderColor: palette.border }]}>
            <RunMap palette={palette} points={points} interactive />
            <View style={[styles.gpsBadge, { backgroundColor: palette.surface }]}>
              <LocateFixed color={palette.primary} size={16} />
              <Text style={[styles.gpsText, { color: palette.text }]}>{permissionStatus}</Text>
            </View>
          </View>
          <Text style={[styles.label, { color: palette.text }]}>러닝 유형</Text>
          <View style={[styles.segmented, { backgroundColor: palette.surface2 }]}>
            {([
              ["open", "자유 달리기"],
              ["distance", "거리 목표"],
              ["time", "시간 목표"]
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => {
                  setGoalType(value);
                  setGoalValue(
                    value === "distance" ? 5000 : value === "time" ? 1800 : null
                  );
                }}
                style={[
                  styles.segment,
                  goalType === value && { backgroundColor: palette.surface }
                ]}
              >
                <Text style={[styles.segmentText, { color: goalType === value ? palette.text : palette.muted }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {goalType !== "open" ? (
            <View style={styles.goalChoices}>
              {(goalType === "distance"
                ? [
                    [3000, "3 km"],
                    [5000, "5 km"],
                    [10000, "10 km"]
                  ]
                : [
                    [1200, "20분"],
                    [1800, "30분"],
                    [3600, "60분"]
                  ]
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setGoalValue(value as number)}
                  style={[
                    styles.goalButton,
                    {
                      borderColor:
                        goalValue === value ? palette.primary : palette.border,
                      backgroundColor:
                        goalValue === value ? palette.primarySoft : palette.surface
                    }
                  ]}
                >
                  <Text style={[styles.goalText, { color: palette.text }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={[styles.voiceRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {profile.voice_enabled ? <Mic2 color={palette.primary} size={22} /> : <MicOff color={palette.muted} size={22} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>음성 안내</Text>
              <Text style={[styles.caption, { color: palette.muted }]}>
                다른 음악과 함께 재생 · {profile.voice_mix_mode === "duck" ? "안내 중 잠깐 낮추기" : "그대로 겹치기"}
              </Text>
            </View>
          </View>
          <TogetherRunPanel
            currentCrew={currentCrew}
            onSessionChange={setTogetherRun}
            onSynchronizedStart={handleSynchronizedStart}
            palette={palette}
            profile={profile}
            session={togetherRun}
          />
          <Pressable onPress={() => void startRun()} style={[styles.startButton, { backgroundColor: palette.primary }]}>
            <Play color="#fff" fill="#fff" size={23} />
            <Text style={styles.startText}>러닝 시작</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (stage === "countdown") {
    return (
      <View style={[styles.countdown, { backgroundColor: palette.text }]}>
        <Text style={[styles.countdownNumber, { color: palette.background }]}>{countdown}</Text>
        <Text style={[styles.countdownLabel, { color: palette.background }]}>READY</Text>
      </View>
    );
  }

  if (!active) return null;
  const paused = active.manualPaused || active.autoPaused;

  return (
    <SafeAreaView style={[styles.activeApp, { backgroundColor: "#0D1110" }]}>
      <View style={styles.activeMap}>
        <RunMap
          palette={createPalette("dark")}
          points={acceptedPoints}
          interactive
          sharedLocations={togetherLocations}
        />
        <View style={styles.activeTop}>
          <View style={styles.darkBadge}>
            <View style={[styles.signal, { backgroundColor: gpsQuality < 35 ? "#2BC58B" : "#F2B84B" }]} />
            <Text style={styles.darkBadgeText}>{gpsLabel}</Text>
          </View>
          <Pressable onPress={toggleVoice} style={styles.roundDarkButton}>
            {active.voiceEnabled ? <Mic2 color="#fff" size={21} /> : <MicOff color="#fff" size={21} />}
          </Pressable>
        </View>
      </View>
        <View style={styles.statsPanel}>
        {togetherLocations.length ? (
          <View style={styles.togetherStrip}>
            {togetherLocations.slice(0, 4).map((runner) => (
              <View style={styles.togetherRunner} key={runner.user_id}>
                <Text style={styles.togetherHandle}>@{runner.handle ?? "runner"}</Text>
                <Text style={styles.togetherDistance}>
                  {(Number(runner.distance_m) / 1000).toFixed(2)} km
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {active.autoPaused ? <Text style={styles.autoPause}>움직임이 멈춰 자동 일시정지됨</Text> : null}
        <Text style={styles.distance}>{(active.distanceM / 1000).toFixed(2)}</Text>
        <Text style={styles.unit}>KILOMETERS</Text>
        <View style={styles.runMetrics}>
          <DarkMetric label="시간" value={formatClock(active.movingSeconds)} />
          <DarkMetric label="평균 페이스" value={`${formatPace(pace)} /km`} />
          <DarkMetric label="일시정지" value={formatClock(active.pausedSeconds)} />
        </View>
        <View style={styles.controls}>
          <Pressable onPress={togglePause} style={styles.pauseButton}>
            {paused ? <Play color="#101513" fill="#101513" size={28} /> : <Pause color="#101513" fill="#101513" size={28} />}
          </Pressable>
          <Pressable
            onLongPress={finishRun}
            delayLongPress={650}
            style={styles.stopButton}
          >
            {stage === "finishing" ? <ActivityIndicator color="#fff" /> : <CircleStop color="#fff" size={31} />}
          </Pressable>
        </View>
        <Text style={styles.stopHint}>종료 버튼을 길게 누르세요</Text>
      </View>
    </SafeAreaView>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.darkMetric}>
      <Text style={styles.darkMetricValue}>{value}</Text>
      <Text style={styles.darkMetricLabel}>{label}</Text>
    </View>
  );
}

function locationToPoint(location: Location.LocationObject): RunPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude_m: location.coords.altitude,
    accuracy_m: location.coords.accuracy,
    speed_mps: location.coords.speed,
    heading_deg: location.coords.heading,
    recorded_at: new Date(location.timestamp).toISOString(),
    is_mocked: Boolean(location.mocked)
  };
}

function filterAccepted(points: RunPoint[]) {
  const accepted: RunPoint[] = [];
  points.forEach((point) => {
    if (validatePoint(point, accepted.at(-1)).accepted) accepted.push(point);
  });
  return accepted;
}

function buildSplits(points: RunPoint[]): RunSplit[] {
  if (points.length < 2) return [];
  const splits: RunSplit[] = [];
  let totalDistance = 0;
  let splitDistance = 0;
  let splitStartedAt = new Date(points[0].recorded_at).getTime();
  let splitIndex = 1;
  for (let index = 1; index < points.length; index += 1) {
    const result = validatePoint(points[index], points[index - 1]);
    totalDistance += result.distanceM;
    splitDistance += result.distanceM;
    if (splitDistance >= 1000) {
      const endedAt = new Date(points[index].recorded_at).getTime();
      const duration = Math.max(1, Math.round((endedAt - splitStartedAt) / 1000));
      splits.push({
        split_index: splitIndex,
        distance_m: 1000,
        duration_s: duration,
        pace_s: duration
      });
      splitIndex += 1;
      splitDistance -= 1000;
      splitStartedAt = endedAt;
    }
  }
  if (splitDistance >= 100 && points.at(-1)) {
    const endedAt = new Date(points.at(-1)!.recorded_at).getTime();
    const duration = Math.max(1, Math.round((endedAt - splitStartedAt) / 1000));
    splits.push({
      split_index: splitIndex,
      distance_m: Math.round(splitDistance),
      duration_s: duration,
      pace_s: Math.round(duration / (splitDistance / 1000))
    });
  }
  return splits;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  prepareHeader: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 19, fontWeight: "900" },
  preparePage: { padding: 18, gap: 16, paddingBottom: 42 },
  mapPreview: { height: 300, borderRadius: 8, borderWidth: 1, overflow: "hidden", position: "relative" },
  gpsBadge: { position: "absolute", top: 14, left: 14, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 7 },
  gpsText: { fontSize: 12, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "900" },
  segmented: { minHeight: 48, borderRadius: 8, flexDirection: "row", padding: 4 },
  segment: { flex: 1, borderRadius: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  segmentText: { fontSize: 12, fontWeight: "800" },
  goalChoices: { flexDirection: "row", gap: 8 },
  goalButton: { flex: 1, height: 48, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  goalText: { fontSize: 13, fontWeight: "900" },
  voiceRow: { borderRadius: 8, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "900" },
  caption: { fontSize: 11, lineHeight: 17, fontWeight: "600", marginTop: 3 },
  startButton: { minHeight: 58, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  startText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  countdown: { flex: 1, alignItems: "center", justifyContent: "center" },
  countdownNumber: { fontSize: 150, fontWeight: "900", lineHeight: 170 },
  countdownLabel: { fontSize: 16, fontWeight: "900", letterSpacing: 0 },
  activeApp: { flex: 1 },
  activeMap: { flex: 1.15, position: "relative" },
  activeTop: { position: "absolute", left: 16, right: 16, top: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  darkBadge: { height: 38, borderRadius: 19, paddingHorizontal: 13, backgroundColor: "rgba(13,17,16,.88)", flexDirection: "row", alignItems: "center", gap: 8 },
  signal: { width: 8, height: 8, borderRadius: 4 },
  darkBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  roundDarkButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(13,17,16,.88)", alignItems: "center", justifyContent: "center" },
  statsPanel: { flex: 0.85, backgroundColor: "#0D1110", paddingHorizontal: 22, paddingTop: 20, alignItems: "center" },
  autoPause: { color: "#F2B84B", fontSize: 12, fontWeight: "900", marginBottom: 4 },
  distance: { color: "#FFFFFF", fontSize: 72, lineHeight: 78, fontWeight: "900" },
  unit: { color: "#87938E", fontSize: 11, fontWeight: "900" },
  runMetrics: { width: "100%", flexDirection: "row", marginTop: 20 },
  darkMetric: { flex: 1, alignItems: "center" },
  darkMetricValue: { color: "#fff", fontSize: 19, fontWeight: "900" },
  darkMetricLabel: { color: "#87938E", fontSize: 11, fontWeight: "700", marginTop: 5 },
  controls: { flexDirection: "row", alignItems: "center", gap: 36, marginTop: 22 },
  pauseButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  stopButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#F06B62", alignItems: "center", justifyContent: "center" },
  stopHint: { color: "#87938E", fontSize: 11, fontWeight: "700", marginTop: 10 }
  ,
  togetherStrip: { width: "100%", flexDirection: "row", gap: 6, marginBottom: 8 },
  togetherRunner: { flex: 1, minWidth: 0, borderRadius: 6, backgroundColor: "#18201D", paddingHorizontal: 8, paddingVertical: 6 },
  togetherHandle: { color: "#9AA59F", fontSize: 9, fontWeight: "800" },
  togetherDistance: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", marginTop: 2 }
});
