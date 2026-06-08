"use client";

import { useEffect, useState } from "react";

import {
  KakaoMap,
  type MapPoint,
  type SharedMapLocation
} from "@/components/kakao-map";

type RouteMessage = {
  type: "RUNGETHER_ROUTE";
  points?: MapPoint[];
  sharedLocations?: Array<{
    user_id: string;
    latitude: number;
    longitude: number;
    handle?: string;
    avatar_url?: string | null;
  }>;
};

export function MobileMapBridge() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [sharedLocations, setSharedLocations] = useState<SharedMapLocation[]>([]);

  useEffect(() => {
    function receiveMessage(event: MessageEvent<string>) {
      try {
        const payload = JSON.parse(event.data) as RouteMessage;
        if (payload.type === "RUNGETHER_ROUTE" && Array.isArray(payload.points)) {
          setPoints(payload.points);
          setSharedLocations(
            (payload.sharedLocations ?? []).map((location) => ({
              userId: location.user_id,
              latitude: location.latitude,
              longitude: location.longitude,
              handle: location.handle ?? "runner",
              avatarUrl: location.avatar_url
            }))
          );
        }
      } catch {
        // Ignore messages from unrelated scripts in the embedded browser.
      }
    }

    window.addEventListener("message", receiveMessage);
    document.addEventListener("message", receiveMessage as EventListener);
    return () => {
      window.removeEventListener("message", receiveMessage);
      document.removeEventListener("message", receiveMessage as EventListener);
    };
  }, []);

  return (
    <main className="h-dvh w-full overflow-hidden bg-surface">
      <KakaoMap
        className="h-full min-h-0 rounded-none border-0"
        isRunning={points.length > 1}
        locationStatus={points.length ? "ready" : "idle"}
        points={points}
        sharedLocations={sharedLocations}
      />
    </main>
  );
}
