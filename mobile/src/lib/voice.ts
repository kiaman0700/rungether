import { setAudioModeAsync } from "expo-audio";
import * as Speech from "expo-speech";

import { UserProfile } from "../types";

export async function configureVoice(profile: UserProfile) {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    shouldRouteThroughEarpiece: false,
    interruptionMode:
      profile.voice_mix_mode === "duck" ? "duckOthers" : "mixWithOthers"
  });
}

export function speak(message: string, profile: UserProfile) {
  if (!profile.voice_enabled) return;
  Speech.stop();
  Speech.speak(message, {
    language: "ko-KR",
    pitch: 1,
    rate: profile.voice_rate,
    volume: profile.voice_volume
  });
}

export function stopVoice() {
  Speech.stop();
}
