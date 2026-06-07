"use client";

import { useEffect, useMemo, useState } from "react";
import { Route } from "lucide-react";

import { KakaoLoginButton } from "@/components/auth/kakao-login-button";
import { RungetherApp } from "@/components/rungether-app";
import { cancelIncompleteKakaoSignup } from "@/lib/kakao-auth";
import { getSupabaseClient } from "@/lib/supabase";

type GateState = "loading" | "signed-out" | "ready";

export function AuthGate() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    if (!supabase) {
      setState("signed-out");
      return;
    }

    let mounted = true;

    async function checkUser(userId?: string) {
      if (!mounted) {
        return;
      }

      if (!userId) {
        setState("signed-out");
        return;
      }

      const { data: profile, error } = await (supabase!.from("users") as any)
        .select("onboarding_completed")
        .eq("id", userId)
        .maybeSingle();

      if (!error && !profile?.onboarding_completed) {
        await cancelIncompleteKakaoSignup(supabase!);
        setState("signed-out");
        return;
      }

      setState("ready");
    }

    void supabase.auth.getSession().then(({ data }) => {
      void checkUser(data.session?.user.id);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void checkUser(session?.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (state === "loading") {
    return <AuthLoading />;
  }

  if (state === "signed-out") {
    return <AuthLanding />;
  }

  return <RungetherApp />;
}

function AuthLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-5">
      <div className="text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-md bg-ink text-white">
          <Route size={23} />
        </div>
        <p className="mt-4 text-sm font-bold text-muted">계정을 확인하고 있습니다.</p>
      </div>
    </main>
  );
}

function AuthLanding() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4 py-8">
      <section className="w-full max-w-[440px] overflow-hidden rounded-md border border-border bg-white shadow-soft">
        <div className="border-b border-border px-6 py-7">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md bg-ink text-white">
              <Route size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black">RUNGETHER</h1>
              <p className="text-xs font-bold text-muted">함께 달리는 러닝 SNS</p>
            </div>
          </div>

          <h2 className="mt-8 text-2xl font-black leading-tight">
            러닝 기록과 사람들을
            <br />
            하나의 계정으로 연결하세요
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">
            카카오 계정으로 로그인하거나 새로 가입한 뒤 RUNGETHER 아이디를 만들 수 있습니다.
          </p>
        </div>

        <div className="px-6 py-6">
          <KakaoLoginButton
            className="[&>button]:w-full"
            label="카카오톡으로 회원가입"
            mode="signup"
          />
          <div className="my-4 flex items-center gap-3 text-[11px] font-bold text-muted">
            <span className="h-px flex-1 bg-border" />
            또는
            <span className="h-px flex-1 bg-border" />
          </div>
          <KakaoLoginButton
            appearance="outline"
            className="[&>button]:w-full"
            label="카카오톡으로 로그인"
            mode="login"
          />
          <p className="mt-4 text-center text-[11px] font-semibold leading-5 text-muted">
            계속하면 서비스 이용을 위한 카카오 인증과 계정 생성을 진행합니다.
          </p>
        </div>
      </section>
    </main>
  );
}
