import {
  Copy,
  Link,
  Loader2,
  Play,
  Unlink,
  UserPlus,
  Users
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { getSupabase } from "../lib/supabase";
import { createPalette } from "../theme";
import { TogetherRun, UserProfile } from "../types";

export function TogetherRunPanel({
  palette,
  profile,
  currentCrew,
  session,
  onSessionChange,
  onSynchronizedStart
}: {
  palette: ReturnType<typeof createPalette>;
  profile: UserProfile;
  currentCrew?: {
    id: string;
    name: string;
    chatId: string | null;
  } | null;
  session: TogetherRun | null;
  onSessionChange: (session: TogetherRun | null) => void;
  onSynchronizedStart: (session: TogetherRun) => void;
}) {
  const supabase = useMemo(() => getSupabase(), []);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [memberCount, setMemberCount] = useState(session?.members?.length ?? 0);

  useEffect(() => {
    if (!supabase || !session) return;
    let mounted = true;

    async function refresh() {
      const [runResult, membersResult] = await Promise.all([
        (supabase!.from("group_runs") as any)
          .select(
            "id,host_id,title,session_code,max_members,status,synchronized_start_at"
          )
          .eq("id", session!.id)
          .maybeSingle(),
        (supabase!.from("group_run_members") as any)
          .select("user_id")
          .eq("group_run_id", session!.id)
      ]);
      if (!mounted) return;
      if (runResult.data) {
        const next = {
          ...(runResult.data as TogetherRun),
          members: (membersResult.data ?? []).map(
            (member: { user_id: string }) => member.user_id
          )
        };
        setMemberCount(next.members.length);
        onSessionChange(next);
        if (next.status === "running" && next.synchronized_start_at) {
          onSynchronizedStart(next);
        }
      }
    }

    void refresh();
    const channel = supabase
      .channel(`together-run-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_runs",
          filter: `id=eq.${session.id}`
        },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_run_members",
          filter: `group_run_id=eq.${session.id}`
        },
        () => void refresh()
      )
      .subscribe();
    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [onSessionChange, onSynchronizedStart, session?.id, supabase]);

  async function createSession(shareWithCrew = false) {
    if (!supabase || busy) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc(
      "create_together_run",
      {
        p_title: "지금 함께 달리기",
        p_max_members: 10
      }
    );
    setBusy(false);
    if (error) {
      Alert.alert("함께 러닝", error.message);
      return;
    }
    const created = (Array.isArray(data) ? data[0] : data) as TogetherRun;
    if (shareWithCrew && currentCrew?.chatId) {
      await (supabase.from("group_runs") as any)
        .update({ recruitment_chat_id: currentCrew.chatId })
        .eq("id", created.id);
      await (supabase.from("messages") as any).insert({
        chat_id: currentCrew.chatId,
        sender_id: profile.id,
        body: `${currentCrew.name} 크루원과 지금 함께 달려요.`,
        message_type: "run_recruitment",
        payload: {
          group_run_id: created.id,
          meeting_place: "현장 합류",
          course_summary: "호스트와 실시간 위치를 보며 함께 달립니다.",
          starts_at: created.synchronized_start_at,
          max_members: created.max_members,
          join_policy: "first_come",
          host_id: profile.id,
          session_code: created.session_code
        }
      });
    }
    onSessionChange({ ...created, members: [profile.id] });
  }

  async function joinSession() {
    if (!supabase || busy || joinCode.trim().length < 6) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("join_together_run", {
      p_session_code: joinCode.trim().toUpperCase()
    });
    setBusy(false);
    if (error) {
      Alert.alert("코드 참가", "코드가 잘못되었거나 이미 시작한 러닝입니다.");
      return;
    }
    const joined = (Array.isArray(data) ? data[0] : data) as TogetherRun;
    onSessionChange({ ...joined, members: [profile.id] });
    setJoinCode("");
  }

  async function shareCode() {
    if (!session) return;
    await Share.share({
      message: `RUNGETHER 함께 러닝 코드: ${session.session_code}\n앱의 러닝 준비 화면에서 코드를 입력하세요.`
    });
  }

  async function leaveSession() {
    if (!supabase || !session) return;
    if (session.host_id === profile.id) {
      await (supabase.from("group_runs") as any)
        .delete()
        .eq("id", session.id);
    } else {
      await (supabase.from("group_run_members") as any)
        .delete()
        .eq("group_run_id", session.id)
        .eq("user_id", profile.id);
    }
    onSessionChange(null);
  }

  async function startSession() {
    if (!supabase || !session || session.host_id !== profile.id || busy) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc(
      "start_together_run",
      { p_group_run_id: session.id }
    );
    setBusy(false);
    if (error) {
      Alert.alert("함께 시작", error.message);
      return;
    }
    const started = (Array.isArray(data) ? data[0] : data) as TogetherRun;
    onSessionChange({ ...started, members: session.members });
    onSynchronizedStart(started);
  }

  if (session) {
    const isHost = session.host_id === profile.id;
    return (
      <View
        style={[
          styles.panel,
          { backgroundColor: palette.surface, borderColor: palette.border }
        ]}
      >
        <View style={styles.titleRow}>
          <View style={[styles.iconCircle, { backgroundColor: palette.primarySoft }]}>
            <Users color={palette.primary} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>함께 러닝 준비 중</Text>
            <Text style={[styles.caption, { color: palette.muted }]}>
              친구나 현장에서 만난 러너가 코드로 참가할 수 있습니다.
            </Text>
          </View>
        </View>
        <View style={[styles.codeBox, { backgroundColor: palette.surface2 }]}>
          <View>
            <Text style={[styles.codeLabel, { color: palette.muted }]}>참가 코드</Text>
            <Text style={[styles.code, { color: palette.text }]}>
              {session.session_code}
            </Text>
          </View>
          <Pressable onPress={shareCode} style={styles.smallButton}>
            <Copy color={palette.text} size={19} />
          </Pressable>
        </View>
        <View style={styles.memberRow}>
          <Text style={[styles.memberText, { color: palette.text }]}>
            {memberCount || session.members?.length || 1}/{session.max_members}명
          </Text>
          <Text style={[styles.caption, { color: palette.muted }]}>
            개인 기록과 XP는 각자 저장됩니다.
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={leaveSession}
            style={[styles.secondaryButton, { borderColor: palette.border }]}
          >
            <Unlink color={palette.muted} size={18} />
            <Text style={[styles.secondaryText, { color: palette.text }]}>
              {isHost ? "방 닫기" : "나가기"}
            </Text>
          </Pressable>
          {isHost ? (
            <Pressable
              disabled={busy}
              onPress={startSession}
              style={[styles.primaryButton, { backgroundColor: palette.primary }]}
            >
              {busy ? (
                <Loader2 color="#fff" size={18} />
              ) : (
                <Play color="#fff" fill="#fff" size={18} />
              )}
              <Text style={styles.primaryText}>모두 함께 시작</Text>
            </Pressable>
          ) : (
            <View style={[styles.waiting, { backgroundColor: palette.primarySoft }]}>
              <Text style={[styles.waitingText, { color: palette.primary }]}>
                호스트 시작 대기
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: palette.surface, borderColor: palette.border }
      ]}
    >
      <View style={styles.titleRow}>
        <View style={[styles.iconCircle, { backgroundColor: palette.primarySoft }]}>
          <UserPlus color={palette.primary} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>함께 러닝</Text>
          <Text style={[styles.caption, { color: palette.muted }]}>
            크루가 아니어도 임시 방을 만들어 동시에 출발합니다.
          </Text>
        </View>
      </View>
      <Pressable
        disabled={busy}
        onPress={() => void createSession(false)}
        style={[styles.createButton, { borderColor: palette.primary }]}
      >
        <Link color={palette.primary} size={18} />
        <Text style={[styles.createText, { color: palette.primary }]}>
          새 참가 코드 만들기
        </Text>
      </Pressable>
      {currentCrew?.chatId ? (
        <Pressable
          disabled={busy}
          onPress={() => void createSession(true)}
          style={[
            styles.createButton,
            {
              borderColor: palette.border,
              backgroundColor: palette.primarySoft
            }
          ]}
        >
          <Users color={palette.primary} size={18} />
          <Text style={[styles.createText, { color: palette.primary }]}>
            {currentCrew.name} 크루 DM에 모집
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.joinRow}>
        <TextInput
          autoCapitalize="characters"
          maxLength={6}
          onChangeText={setJoinCode}
          placeholder="6자리 코드"
          placeholderTextColor={palette.muted}
          style={[
            styles.codeInput,
            {
              color: palette.text,
              borderColor: palette.border,
              backgroundColor: palette.background
            }
          ]}
          value={joinCode}
        />
        <Pressable
          disabled={busy || joinCode.trim().length < 6}
          onPress={joinSession}
          style={[
            styles.joinButton,
            {
              backgroundColor:
                joinCode.trim().length < 6 ? palette.surface2 : palette.text
            }
          ]}
        >
          <Text style={[styles.joinText, { color: palette.background }]}>참가</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 13 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "900" },
  caption: { fontSize: 11, lineHeight: 17, fontWeight: "600", marginTop: 2 },
  createButton: { minHeight: 46, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  createText: { fontSize: 13, fontWeight: "900" },
  joinRow: { flexDirection: "row", gap: 8 },
  codeInput: { flex: 1, height: 46, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, fontWeight: "900", letterSpacing: 0 },
  joinButton: { width: 74, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  joinText: { fontSize: 13, fontWeight: "900" },
  codeBox: { minHeight: 70, borderRadius: 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeLabel: { fontSize: 10, fontWeight: "800" },
  code: { fontSize: 28, fontWeight: "900", letterSpacing: 0, marginTop: 2 },
  smallButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  memberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  memberText: { fontSize: 14, fontWeight: "900" },
  actions: { flexDirection: "row", gap: 8 },
  secondaryButton: { flex: 1, minHeight: 46, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secondaryText: { fontSize: 12, fontWeight: "900" },
  primaryButton: { flex: 1.4, minHeight: 46, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  waiting: { flex: 1.4, minHeight: 46, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  waitingText: { fontSize: 12, fontWeight: "900" }
});
