"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPinned, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MapPoint = {
  latitude: number;
  longitude: number;
};

type KakaoMapProps = {
  className?: string;
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

export function KakaoMap({ className, points = [] }: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "missing">("loading");
  const [errorMessage, setErrorMessage] = useState("");
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
          latitude: 37.5283,
          longitude: 126.9328
        };
        try {
          const map = new kakao.maps.Map(containerRef.current, {
            center: new kakao.maps.LatLng(initial.latitude, initial.longitude),
            level: 5
          });

          map.addControl(
            new kakao.maps.MapTypeControl(),
            kakao.maps.ControlPosition.TOPRIGHT
          );
          map.addControl(
            new kakao.maps.ZoomControl(),
            kakao.maps.ControlPosition.RIGHT
          );
          mapRef.current = map;
          markerRef.current = new kakao.maps.Marker({
            map,
            position: new kakao.maps.LatLng(initial.latitude, initial.longitude)
          });
          polylineRef.current = new kakao.maps.Polyline({
            map,
            path: [],
            strokeColor: "#0f8a5f",
            strokeOpacity: 0.92,
            strokeStyle: "solid",
            strokeWeight: 7
          });
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

    markerRef.current?.setPosition(currentPosition);
    polylineRef.current?.setPath(path);

    if (path.length === 1) {
      mapRef.current.setCenter(currentPosition);
      return;
    }

    const bounds = new kakao.maps.LatLngBounds();
    path.forEach((position) => bounds.extend(position));
    mapRef.current.setBounds(bounds, 48, 48, 48, 48);
  }, [points, status]);

  return (
    <div
      className={cn(
        "relative min-h-[280px] overflow-hidden rounded-md border border-border bg-[#e8efe9]",
        className
      )}
    >
      <div className="absolute inset-0" ref={containerRef} />
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
                    markerRef.current = null;
                    polylineRef.current = null;
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
