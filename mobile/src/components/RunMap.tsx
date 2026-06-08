import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { WebView } from "react-native-webview";

import { createPalette } from "../theme";
import { RunPoint, TogetherLocation } from "../types";

export function RunMap({
  palette,
  points,
  interactive = false,
  sharedLocations = []
}: {
  palette: ReturnType<typeof createPalette>;
  points: RunPoint[];
  interactive?: boolean;
  sharedLocations?: TogetherLocation[];
}) {
  const webRef = useRef<WebView>(null);
  const webUrl =
    process.env.EXPO_PUBLIC_WEB_URL ?? "https://rungether.vercel.app";
  const message = useMemo(
    () =>
      JSON.stringify({
        type: "RUNGETHER_ROUTE",
        points,
        sharedLocations,
        interactive
      }),
    [interactive, points, sharedLocations]
  );

  useEffect(() => {
    webRef.current?.postMessage(message);
  }, [message]);

  if (!interactive || !webUrl) {
    return <RoutePoster palette={palette} points={points} />;
  }

  return (
    <WebView
      ref={webRef}
      source={{ uri: `${webUrl}/mobile-map?embedded=1` }}
      onLoadEnd={() => webRef.current?.postMessage(message)}
      javaScriptEnabled
      domStorageEnabled
      geolocationEnabled={false}
      originWhitelist={["*"]}
      style={styles.web}
    />
  );
}

export function RoutePoster({
  palette,
  points
}: {
  palette: ReturnType<typeof createPalette>;
  points: RunPoint[];
}) {
  const projected = useMemo(() => project(points), [points]);
  return (
    <View style={[styles.poster, { backgroundColor: palette.dark ? "#111816" : "#E7EEEA" }]}>
      <Svg height="100%" viewBox="0 0 320 320" width="100%">
        {projected.length > 1 ? (
          <Polyline
            fill="none"
            points={projected.map((point) => `${point.x},${point.y}`).join(" ")}
            stroke={palette.primary}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="8"
          />
        ) : (
          <>
            <Circle cx="160" cy="160" fill={palette.primarySoft} r="42" />
            <Circle cx="160" cy="160" fill={palette.primary} r="12" />
          </>
        )}
        {projected[0] ? <Circle cx={projected[0].x} cy={projected[0].y} fill="#FFFFFF" r="7" stroke={palette.primary} strokeWidth="4" /> : null}
        {projected.at(-1) ? <Circle cx={projected.at(-1)!.x} cy={projected.at(-1)!.y} fill={palette.coral} r="8" stroke="#FFFFFF" strokeWidth="3" /> : null}
      </Svg>
    </View>
  );
}

function project(points: RunPoint[]) {
  if (!points.length) return [];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.0001);
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.0001);
  return points.map((point) => ({
    x: 28 + ((point.longitude - minLongitude) / longitudeSpan) * 264,
    y: 292 - ((point.latitude - minLatitude) / latitudeSpan) * 264
  }));
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "transparent" },
  poster: { flex: 1, width: "100%", height: "100%" }
});
