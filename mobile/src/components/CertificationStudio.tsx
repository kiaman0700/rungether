import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Copy,
  ImageIcon,
  Map,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Send,
  Square,
  Trash2,
  Type,
  Undo2
} from "lucide-react-native";
import { createRef, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { SafeAreaView } from "react-native-safe-area-context";

import { loadStudioDraft, saveStudioDraft } from "../lib/database";
import { getSupabase } from "../lib/supabase";
import { createPalette } from "../theme";
import { RunRecord, StudioLayer, UserProfile } from "../types";
import { RoutePoster } from "./RunMap";

type Ratio = "9:16" | "4:5" | "1:1";
type BackgroundType = "camera" | "gallery" | "map" | "solid";

export function CertificationStudio({
  palette,
  profile,
  run,
  onClose,
  onPublished
}: {
  palette: ReturnType<typeof createPalette>;
  profile: UserProfile;
  run: RunRecord;
  onClose: () => void;
  onPublished: () => void;
}) {
  const supabase = useMemo(() => getSupabase(), []);
  const canvasRef = createRef<View>();
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("map");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [layers, setLayers] = useState<StudioLayer[]>(() => initialLayers(run, profile));
  const [selectedId, setSelectedId] = useState(layers[0]?.id ?? "");
  const [history, setHistory] = useState<StudioLayer[][]>([]);
  const [future, setFuture] = useState<StudioLayer[][]>([]);
  const [caption, setCaption] = useState("오늘의 러닝");

  useEffect(() => {
    void loadStudioDraft(run.id).then((draft) => {
      if (!draft) return;
      setRatio(draft.ratio);
      setBackgroundType(draft.backgroundType);
      setBackgroundUrl(draft.backgroundUrl);
      setLayers(draft.layers);
    });
  }, [run.id]);

  useEffect(() => {
    const timer = setTimeout(
      () =>
        void saveStudioDraft(run.id, {
          ratio,
          backgroundType,
          backgroundUrl,
          layers
        }),
      500
    );
    return () => clearTimeout(timer);
  }, [backgroundType, backgroundUrl, layers, ratio, run.id]);

  const selected = layers.find((layer) => layer.id === selectedId) ?? null;
  const canvasAspect = ratio === "9:16" ? 9 / 16 : ratio === "4:5" ? 4 / 5 : 1;

  function commit(next: StudioLayer[]) {
    setHistory((current) => [...current.slice(-29), layers]);
    setFuture([]);
    setLayers(next);
  }

  function updateSelected(patch: Partial<StudioLayer>, track = true) {
    const next = layers.map((layer) =>
      layer.id === selectedId ? { ...layer, ...patch } : layer
    );
    if (track) commit(next);
    else setLayers(next);
  }

  async function chooseBackground(source: "camera" | "gallery") {
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.9
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.9
          });
    if (!result.canceled) {
      setBackgroundType(source);
      setBackgroundUrl(result.assets[0].uri);
    }
  }

  function addLayer(kind: StudioLayer["kind"]) {
    const text =
      kind === "metric"
        ? `${(Number(run.distance_m) / 1000).toFixed(2)} KM`
        : kind === "sticker"
          ? "RUN"
          : "나만의 문구";
    const layer = makeLayer(kind, text, 50, 45 + layers.length * 4);
    commit([...layers, layer]);
    setSelectedId(layer.id);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((current) => [layers, ...current]);
    setLayers(previous);
    setHistory((current) => current.slice(0, -1));
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setHistory((current) => [...current, layers]);
    setLayers(next);
    setFuture((current) => current.slice(1));
  }

  async function render() {
    return captureRef(canvasRef, {
      format: "png",
      quality: 1,
      result: "tmpfile"
    });
  }

  async function saveToPhotos() {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("사진 권한", "완성 이미지를 저장하려면 사진 추가 권한이 필요합니다.");
      return;
    }
    const uri = await render();
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert("저장 완료", "러닝 인증 이미지를 사진 앱에 저장했습니다.");
  }

  async function publish(target: "feed" | "story") {
    if (!supabase) return;
    const uri = await render();
    const blob = await (await fetch(uri)).blob();
    const path = `${profile.id}/certifications/${Date.now()}.png`;
    const upload = await supabase.storage.from("social-media").upload(path, blob, {
      contentType: "image/png",
      upsert: false
    });
    if (upload.error) {
      Alert.alert("업로드 실패", upload.error.message);
      return;
    }
    const publicUrl = supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl;
    const project = await (supabase.from("run_share_projects") as any)
      .insert({
        user_id: profile.id,
        run_id: run.id,
        aspect_ratio: ratio,
        background_type: backgroundType,
        background_url: backgroundUrl,
        layers,
        rendered_url: publicUrl,
        status: "completed"
      })
      .select("id")
      .single();
    if (project.error) {
      Alert.alert("인증 저장 실패", project.error.message);
      return;
    }
    const result =
      target === "feed"
        ? await (supabase.from("posts") as any).insert({
            author_id: profile.id,
            run_id: run.id,
            body: caption.trim() || "오늘의 러닝",
            media_urls: [publicUrl],
            visibility: "friends"
          })
        : await (supabase.from("stories") as any).insert({
            author_id: profile.id,
            media_url: publicUrl,
            caption: caption.trim() || null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          });
    if (result.error) {
      Alert.alert("게시 실패", result.error.message);
      return;
    }
    onPublished();
  }

  return (
    <SafeAreaView style={[styles.app, { backgroundColor: palette.background }]}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={onClose} style={styles.iconButton}>
          <ArrowLeft color={palette.text} size={24} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>러닝 인증 스튜디오</Text>
        <Pressable onPress={saveToPhotos} style={styles.iconButton}>
          <Save color={palette.text} size={22} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        <View
          ref={canvasRef}
          collapsable={false}
          style={[
            styles.canvas,
            {
              aspectRatio: canvasAspect,
              backgroundColor: palette.dark ? "#17201D" : "#E7EEEA"
            }
          ]}
        >
          {backgroundUrl ? (
            <Image source={{ uri: backgroundUrl }} style={styles.backgroundImage} />
          ) : backgroundType === "map" ? (
            <RoutePoster palette={palette} points={[]} />
          ) : null}
          <View pointerEvents="none" style={styles.scrim} />
          {layers.map((layer) => (
            <MovableLayer
              key={layer.id}
              layer={layer}
              selected={layer.id === selectedId}
              onSelect={() => setSelectedId(layer.id)}
              onMove={(x, y) =>
                setLayers((current) =>
                  current.map((item) =>
                    item.id === layer.id ? { ...item, x, y } : item
                  )
                )
              }
              onMoveEnd={() => setHistory((current) => [...current.slice(-29), layers])}
            />
          ))}
        </View>

        <View style={styles.toolbar}>
          <Tool icon={Undo2} label="실행 취소" disabled={!history.length} palette={palette} onPress={undo} />
          <Tool icon={Redo2} label="다시 실행" disabled={!future.length} palette={palette} onPress={redo} />
          <Tool icon={Type} label="텍스트" palette={palette} onPress={() => addLayer("text")} />
          <Tool icon={Plus} label="기록" palette={palette} onPress={() => addLayer("metric")} />
          <Tool icon={Square} label="스티커" palette={palette} onPress={() => addLayer("sticker")} />
        </View>

        <Text style={[styles.label, { color: palette.text }]}>출력 비율</Text>
        <View style={[styles.segmented, { backgroundColor: palette.surface2 }]}>
          {(["9:16", "4:5", "1:1"] as Ratio[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => setRatio(item)}
              style={[styles.segment, ratio === item && { backgroundColor: palette.surface }]}
            >
              <Text style={[styles.segmentText, { color: ratio === item ? palette.text : palette.muted }]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: palette.text }]}>배경</Text>
        <View style={styles.backgroundTools}>
          <Tool icon={Camera} label="촬영" palette={palette} onPress={() => void chooseBackground("camera")} />
          <Tool icon={ImageIcon} label="갤러리" palette={palette} onPress={() => void chooseBackground("gallery")} />
          <Tool icon={Map} label="러닝 지도" palette={palette} onPress={() => { setBackgroundType("map"); setBackgroundUrl(null); }} />
          <Tool icon={Square} label="단색" palette={palette} onPress={() => { setBackgroundType("solid"); setBackgroundUrl(null); }} />
        </View>

        {selected ? (
          <View style={[styles.editor, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <TextInput
              value={selected.text}
              onChangeText={(text) => updateSelected({ text }, false)}
              onEndEditing={() => setHistory((current) => [...current.slice(-29), layers])}
              style={[styles.textInput, { color: palette.text, borderColor: palette.border }]}
              placeholderTextColor={palette.muted}
            />
            <View style={styles.editorTools}>
              <Tool icon={Plus} label="확대" palette={palette} onPress={() => updateSelected({ scale: Math.min(2.5, selected.scale + 0.1) })} />
              <Tool icon={RotateCw} label="회전" palette={palette} onPress={() => updateSelected({ rotation: selected.rotation + 15 })} />
              <Tool icon={Copy} label="복제" palette={palette} onPress={() => {
                const copy = { ...selected, id: `${Date.now()}`, x: selected.x + 5, y: selected.y + 5 };
                commit([...layers, copy]);
                setSelectedId(copy.id);
              }} />
              <Tool icon={ArrowUp} label="앞으로" palette={palette} onPress={() => {
                const rest = layers.filter((layer) => layer.id !== selected.id);
                commit([...rest, selected]);
              }} />
              <Tool icon={ArrowDown} label="뒤로" palette={palette} onPress={() => {
                const rest = layers.filter((layer) => layer.id !== selected.id);
                commit([selected, ...rest]);
              }} />
              <Tool icon={Trash2} label="삭제" danger palette={palette} onPress={() => {
                commit(layers.filter((layer) => layer.id !== selected.id));
                setSelectedId("");
              }} />
            </View>
          </View>
        ) : null}

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="게시물 문구"
          placeholderTextColor={palette.muted}
          style={[styles.captionInput, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border }]}
        />
        <View style={styles.publishRow}>
          <Pressable onPress={() => void publish("story")} style={[styles.secondaryButton, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Send color={palette.text} size={18} />
            <Text style={[styles.buttonText, { color: palette.text }]}>스토리</Text>
          </Pressable>
          <Pressable onPress={() => void publish("feed")} style={[styles.primaryButton, { backgroundColor: palette.primary }]}>
            <Send color="#fff" size={18} />
            <Text style={[styles.buttonText, { color: "#fff" }]}>피드에 게시</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MovableLayer({
  layer,
  selected,
  onSelect,
  onMove,
  onMoveEnd
}: {
  layer: StudioLayer;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onMoveEnd: () => void;
}) {
  const start = useRef({ x: layer.x, y: layer.y });
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = { x: layer.x, y: layer.y };
          onSelect();
        },
        onPanResponderMove: (_event, gesture) => {
          onMove(
            Math.max(0, Math.min(100, start.current.x + gesture.dx / 3)),
            Math.max(0, Math.min(100, start.current.y + gesture.dy / 4))
          );
        },
        onPanResponderRelease: onMoveEnd
      }),
    [layer.x, layer.y, onMove, onMoveEnd, onSelect]
  );
  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.layer,
        {
          left: `${layer.x}%`,
          top: `${layer.y}%`,
          opacity: layer.opacity,
          transform: [
            { translateX: -70 },
            { translateY: -28 },
            { scale: layer.scale },
            { rotate: `${layer.rotation}deg` }
          ],
          borderColor: selected ? "#2BC58B" : "transparent",
          backgroundColor: layer.backgroundColor
        }
      ]}
    >
      <Text
        style={[
          styles.layerText,
          {
            color: layer.color,
            fontSize: layer.fontSize,
            textAlign: layer.align,
            textShadowColor: layer.shadow ? "rgba(0,0,0,.55)" : "transparent",
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: layer.shadow ? 5 : 0
          }
        ]}
      >
        {layer.text}
      </Text>
    </View>
  );
}

function Tool({ icon: Icon, label, palette, onPress, disabled, danger }: any) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.tool, { opacity: disabled ? 0.35 : 1 }]}>
      <Icon color={danger ? palette.coral : palette.text} size={20} />
      <Text style={[styles.toolLabel, { color: danger ? palette.coral : palette.muted }]}>{label}</Text>
    </Pressable>
  );
}

function initialLayers(run: RunRecord, profile: UserProfile) {
  return [
    makeLayer("metric", `${(Number(run.distance_m) / 1000).toFixed(2)} KM`, 50, 18, 34),
    makeLayer("metric", `${formatClock(run.duration_s)}  ·  ${formatPace(run.average_pace_s)} /KM`, 50, 30, 16),
    makeLayer("text", `@${profile.handle}`, 50, 82, 15),
    makeLayer("sticker", "RUNGETHER", 50, 90, 12)
  ];
}

function makeLayer(
  kind: StudioLayer["kind"],
  text: string,
  x: number,
  y: number,
  fontSize = kind === "metric" ? 26 : 18
): StudioLayer {
  return {
    id: `${Date.now()}-${Math.random()}`,
    kind,
    text,
    x,
    y,
    scale: 1,
    rotation: 0,
    color: "#FFFFFF",
    backgroundColor: "transparent",
    opacity: 1,
    fontSize,
    align: "center",
    shadow: true,
    border: false
  };
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatPace(seconds: number | null) {
  if (!seconds) return "--:--";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  header: { height: 58, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  iconButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  page: { padding: 16, gap: 14, paddingBottom: 44 },
  canvas: { width: "100%", overflow: "hidden", borderRadius: 8, position: "relative" },
  backgroundImage: { position: "absolute", inset: 0, width: "100%", height: "100%" },
  scrim: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,.12)" },
  layer: { position: "absolute", width: 140, minHeight: 56, alignItems: "center", justifyContent: "center", borderWidth: 1, padding: 4 },
  layerText: { width: "100%", fontWeight: "900", letterSpacing: 0 },
  toolbar: { flexDirection: "row", justifyContent: "space-between" },
  tool: { minWidth: 48, alignItems: "center", gap: 4, paddingVertical: 7 },
  toolLabel: { fontSize: 10, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "900", marginTop: 4 },
  segmented: { minHeight: 46, borderRadius: 8, flexDirection: "row", padding: 4 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  segmentText: { fontSize: 12, fontWeight: "900" },
  backgroundTools: { flexDirection: "row", justifyContent: "space-around" },
  editor: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 10 },
  textInput: { minHeight: 44, borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, fontSize: 14, fontWeight: "700" },
  editorTools: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap" },
  captionInput: { minHeight: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13, fontSize: 14, fontWeight: "600" },
  publishRow: { flexDirection: "row", gap: 8 },
  secondaryButton: { flex: 1, minHeight: 52, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButton: { flex: 1, minHeight: 52, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { fontSize: 14, fontWeight: "900" }
});
