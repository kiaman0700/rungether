"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { markAuthFlowConfirmed, markAuthFlowStarted } from "@/lib/auth-flow";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type KakaoLoginButtonProps = {
  appearance?: "kakao" | "outline";
  className?: string;
  compact?: boolean;
  label?: string;
};

export function KakaoLoginButton({
  appearance = "kakao",
  className,
  compact = false,
  label = "카카오로 시작하기"
}: KakaoLoginButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleLogin() {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setMessage("Supabase 환경 변수를 먼저 설정해 주세요.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      markAuthFlowConfirmed();
      router.push("/onboarding");
      return;
    }

    markAuthFlowStarted();
    const redirectTo = new URL("/auth/callback", window.location.origin).toString();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo
      }
    });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("min-w-0", className)}>
      <Button
        className={cn(
          appearance === "kakao"
            ? "border border-[#eadf3f] hover:brightness-95"
            : "border border-border bg-white text-ink hover:bg-zinc-50",
          compact && "size-10 justify-center p-0"
        )}
        disabled={isLoading}
        onClick={handleLogin}
        title={label}
        variant="secondary"
        style={
          appearance === "kakao"
            ? { backgroundColor: "#FEE500", borderColor: "#eadf3f", color: "#191600" }
            : undefined
        }
      >
        <span className="flex size-5 items-center justify-center rounded-sm bg-[#191600] text-xs font-black text-[#FEE500]">
          K
        </span>
        {compact ? null : isLoading ? "이동 중" : label}
      </Button>
      {message ? <p className="mt-2 text-xs font-bold leading-5 text-danger">{message}</p> : null}
    </div>
  );
}
