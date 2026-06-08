import { RunPoint } from "../types";

const earthRadiusM = 6371000;

export function haversineMeters(a: RunPoint, b: RunPoint) {
  const latitudeDelta = ((b.latitude - a.latitude) * Math.PI) / 180;
  const longitudeDelta = ((b.longitude - a.longitude) * Math.PI) / 180;
  const latitudeA = (a.latitude * Math.PI) / 180;
  const latitudeB = (b.latitude * Math.PI) / 180;
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(value));
}

export function validatePoint(point: RunPoint, previous?: RunPoint) {
  if (point.is_mocked) return { accepted: false, distanceM: 0 };
  if ((point.accuracy_m ?? 999) > 80) return { accepted: false, distanceM: 0 };
  if (!previous) return { accepted: true, distanceM: 0 };
  const distanceM = haversineMeters(previous, point);
  const seconds = Math.max(
    1,
    (new Date(point.recorded_at).getTime() -
      new Date(previous.recorded_at).getTime()) /
      1000
  );
  const computedSpeed = distanceM / seconds;
  if (distanceM > 250 || computedSpeed > 12 || (point.speed_mps ?? 0) > 12) {
    return { accepted: false, distanceM: 0 };
  }
  const noiseFloor = Math.max(3, Math.min(12, ((point.accuracy_m ?? 10) + (previous.accuracy_m ?? 10)) * 0.2));
  return {
    accepted: true,
    distanceM: distanceM >= noiseFloor ? distanceM : 0
  };
}

export function formatClock(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

export function formatPace(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds)) return "--:--";
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}
