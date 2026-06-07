"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, LocateFixed, MapPinned, Pause, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MapPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt?: string;
  speedMps?: number | null;
};

export type LocationStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable";

type KakaoMapProps = {
  className?: string;
  isPaused?: boolean;
  isRunning?: boolean;
  locationStatus?: LocationStatus;
  onLocate?: () => void;
  points?: MapPoint[];
};

type KakaoWindow = Window & {
  kakao?: {
    maps: any;
  };
};

let kakaoLoader: Promise<any> | null = null;

function loadKakaoMaps(appKey: string) {
  if (kakaoLoader) {
    return kakaoLoader;
  }

  kakaoLoader = new Promise((resolve, reject) => {
    const kakaoWindow = window as KakaoWindow;

    if (kakaoWindow.kakao?.maps) {
      kakaoWindow.kakao.maps.load(() => resolve(kakaoWindow.kakao));
      return;
    }

    const previousScript = document.getElementById("kakao-map-sdk");
    if (previousScript) {
      previousScript.remove();
    }

    const script = document.createElement("script");
    script.id = "kakao-map-sdk";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    const timeout = window.setTimeout(() => {
      kakaoLoader = null;
      reject(new Error("지도 SDK 응답 시간이 초과되었습니다."));
    }, 12000);

    script.onload = () => {
      window.clearTimeout(timeout);
      const kakao = (window as KakaoWindow).kakao;

      if (!kakao?.maps) {
        kakaoLoader = null;
        reject(new Error("카카오 지도 SDK를 불러오지 못했습니다."));
        return;
      }

      kakao.maps.load(() => resolve(kakao));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      kakaoLoader = null;
      reject(new Error("카카오 지도 SDK 요청이 거절되었습니다."));
    };
    document.head.appendChild(script);
  });

  return kakaoLoader;
}

export function KakaoMap({
  className,
  isPaused = false,
  isRunning = false,
  locationStatus = "idle",
  onLocate,
  points = []
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const currentMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const centeredOnceRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "missing">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [following, setFollowing] = useState(true);
  const [origin, setOrigin] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
    setOrigin(window.location.origin);
    setErrorMessage("");
    setStatus("loading");

    if (!appKey) {
      setStatus("missing");
      return;
    }

    let cancelled = false;

    void loadKakaoMaps(appKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current || mapRef.current) {
          return;
        }

        const initial = points.at(-1) ?? {
          latitude: 37.5665,
          longitude: 126.978
        };
        try {
          const map = new kakao.maps.Map(containerRef.current, {
            center: new kakao.maps.LatLng(initial.latitude, initial.longitude),
            level: points.length ? 4 : 7
          });

          map.addControl(
            new kakao.maps.ZoomControl(),
            kakao.maps.ControlPosition.RIGHT
          );
          kakao.maps.event.addListener(map, "dragstart", () => setFollowing(false));
          mapRef.current = map;
          polylineRef.current = new kakao.maps.Polyline({
            map,
            path: [],
            strokeColor: "#0f8a5f",
            strokeOpacity: 0.92,
            strokeStyle: "solid",
            strokeWeight: 7
          });
          window.setTimeout(() => map.relayout(), 0);
          setStatus("ready");
        } catch (error) {
          throw new Error(
            error instanceof Error ? error.message : "지도 생성에 실패했습니다."
          );
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current) {
      return;
    }

    const kakao = (window as KakaoWindow).kakao;
    const lastPoint = points.at(-1);

    if (!kakao?.maps || !lastPoint) {
      return;
    }

    const path = points.map(
      (point) => new kakao.maps.LatLng(point.latitude, point.longitude)
    );
    const currentPosition = path.at(-1);

    if (!currentMarkerRef.current) {
      const marker = document.createElement("div");
      marker.setAttribute("aria-label", "현재 위치");
      marker.style.width = isRunning ? "22px" : "18px";
      marker.style.height = isRunning ? "22px" : "18px";
      marker.style.border = "4px solid white";
      marker.style.borderRadius = "9999px";
      marker.style.background = "#10b981";
      marker.style.boxShadow = isRunning
        ? "0 0 0 8px rgba(16,185,129,.22), 0 3px 12px rgba(0,0,0,.28)"
        : "0 0 0 5px rgba(16,185,129,.18), 0 3px 10px rgba(0,0,0,.24)";
      currentMarkerRef.current = new kakao.maps.CustomOverlay({
        content: marker,
        map: mapRef.current,
        position: currentPosition,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 5
      });
    } else {
      currentMarkerRef.current.setPosition(currentPosition);
      currentMarkerRef.current.setMap(mapRef.current);
    }

    const currentPoint = points.at(-1);
    if (currentPoint?.accuracy) {
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = new kakao.maps.Circle({
          center: currentPosition,
          radius: Math.min(currentPoint.accuracy, 100),
          strokeWeight: 1,
          strokeColor: "#10b981",
          strokeOpacity: 0.35,
          fillColor: "#10b981",
          fillOpacity: 0.08
        });
        accuracyCircleRef.current.setMap(mapRef.current);
      } else {
        accuracyCircleRef.current.setPosition(currentPosition);
        accuracyCircleRef.current.setRadius(Math.min(currentPoint.accuracy, 100));
      }
    }

    polylineRef.current?.setPath(path);

    if (!centeredOnceRef.current) {
      centeredOnceRef.current = true;
      mapRef.current.setCenter(currentPosition);
      mapRef.current.setLevel(4);
      return;
    }

    if (following) {
      mapRef.current.panTo(currentPosition);
    }
  }, [following, isRunning, points, status]);

  const latestPoint = points.at(-1);
  const runStatus = isPaused ? "일시정지" : isRunning ? "GPS 기록 중" : "현재 위치";

  return (
    <div
      className={cn(
        "relative min-h-[280px] overflow-hidden rounded-md border border-border bg-[#e8efe9]",
        className
      )}
    >
      <div className="absolute inset-0" ref={containerRef} />
      {status === "ready" ? (
        <>
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md bg-white/95 px-3 py-2 text-xs font-black shadow-soft backdrop-blur">
            {isPaused ? (
              <Pause className="text-amber-600" size={15} />
            ) : isRunning ? (
              <Activity className="text-primary" size={15} />
            ) : (
              <LocateFixed className="text-primary" size={15} />
            )}
            {locationStatus === "requesting" ? "GPS 연결 중" : runStatus}
          </div>
          <Button
            aria-label="내 위치로 이동"
            className="absolute bottom-4 right-4 z-10 size-11 rounded-full bg-white p-0 text-ink shadow-soft"
            onClick={() => {
              setFollowing(true);
              if (latestPoint && mapRef.current) {
                const kakao = (window as KakaoWindow).kakao;
                mapRef.current.panTo(
                  new kakao!.maps.LatLng(latestPoint.latitude, latestPoint.longitude)
                );
              }
              onLocate?.();
            }}
            title="내 위치로 이동"
            variant="secondary"
          >
            <LocateFixed className={following ? "text-primary" : "text-muted"} size={20} />
          </Button>
          {locationStatus === "denied" ? (
            <div className="absolute inset-x-4 bottom-4 z-10 mr-14 rounded-md bg-white/95 px-3 py-2 text-xs font-bold text-danger shadow-soft">
              위치 권한을 허용하면 현위치와 러닝 경로를 기록할 수 있습니다.
            </div>
          ) : null}
        </>
      ) : null}
      {status !== "ready" ? (
        <div className="absolute inset-0 grid place-items-center bg-[#e8efe9] px-8 text-center">
          <div>
            {status === "loading" ? (
              <LocateFixed className="mx-auto animate-pulse text-primary" size={30} />
            ) : (
              <MapPinned className="mx-auto text-muted" size={30} />
            )}
            <p className="mt-3 text-sm font-bold text-ink">
              {status === "loading" && "카카오 지도를 불러오는 중입니다."}
              {status === "missing" && "카카오 지도 JavaScript 키가 필요합니다."}
              {status === "error" && "카카오 지도 연결을 확인해 주세요."}
            </p>
            {status === "error" ? (
              <>
                <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                  {errorMessage || "Kakao Developers의 JavaScript 키 설정을 확인하세요."}
                </p>
                {origin ? (
                  <p className="mt-1 text-xs font-semibold leading-5 text-muted">
                    SDK 도메인에 등록할 주소: <strong>{origin}</strong>
                  </p>
                ) : null}
                <Button
                  className="mt-4"
                  onClick={() => {
                    mapRef.current = null;
                    currentMarkerRef.current = null;
                    accuracyCircleRef.current = null;
                    polylineRef.current = null;
                    centeredOnceRef.current = false;
                    kakaoLoader = null;
                    setAttempt((value) => value + 1);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  <RefreshCw size={16} />
                  다시 시도
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
