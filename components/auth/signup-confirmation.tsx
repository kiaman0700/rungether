"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, LogOut, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  AuthMode,
  getAuthFlowMode,
  hasConfirmedAuthFlow
} from "@/lib/auth-flow";
import { cancelIncompleteKakaoSignup } from "@/lib/kakao-auth";
import { getSupabaseClient } from "@/lib/supabase";

export function SignupConfirmation() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<AuthMode>("signup");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadAccount() {
      if (!hasConfirmedAuthFlow() || !supabase) {
        router.replace("/");
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/");
        return;
      }

      const { data: profile } = await (supabase.from("users") as any)
        .select("onboarding_completed")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.onboarding_completed) {
        router.replace("/");
        return;
      }

      setMode(getAuthFlowMode());
      setEmail(data.user.email ?? "");
      setIsReady(true);
    }

    void loadAccount();
  }, [router, supabase]);

  async function cancelSignup() {
    if (!supabase) {
      return;
    }

    setIsCancelling(true);
    await cancelIncompleteKakaoSignup(supabase);
    router.replace("/");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4 py-8">
      <section className="w-full max-w-[480px] overflow-hidden rounded-md border border-border bg-white shadow-soft">
        <div className="border-b border-border px-6 py-7">
          <div className="grid size-11 place-items-center rounded-md bg-primary text-white">
            <Check size={22} />
          </div>
          <p className="mt-6 text-xs font-black text-primary">카카오 인증 완료</p>
          <h1 className="mt-2 text-2xl font-black">
            {mode === "login" ? "RUNGETHER 가입이 필요합니다" : "RUNGETHER 회원가입"}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">
            카카오 계정이 확인되었습니다. RUNGETHER에서 사용할 아이디를 만들면 회원가입이 완료됩니다.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-6">
          <div className="flex items-start gap-3 rounded-md border border-border p-4">
            <Mail className="mt-0.5 shrink-0 text-primary" size={19} />
            <div className="min-w-0">
              <p className="text-sm font-black">카카오 계정</p>
              <p className="mt-1 truncate text-sm font-semibold text-muted">
                {email || "카카오에서 확인된 계정"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md bg-emerald-50 p-4 text-emerald-900">
            <ShieldCheck className="mt-0.5 shrink-0" size={19} />
            <p className="text-xs font-bold leading-5">
              카카오 계정은 로그인 식별에 사용합니다. RUNGETHER 아이디는 다음 단계에서 별도로 만듭니다.
            </p>
          </div>

          <Button
            disabled={!isReady}
            onClick={() => router.push("/onboarding")}
          >
            아이디 만들고 가입 완료하기
            <ArrowRight size={18} />
          </Button>
          <Button
            disabled={!isReady || isCancelling}
            onClick={() => void cancelSignup()}
            variant="ghost"
          >
            <LogOut size={17} />
            {isCancelling ? "카카오 연결 해제 중" : "회원가입 취소"}
          </Button>
        </div>
      </section>
    </main>
  );
}
