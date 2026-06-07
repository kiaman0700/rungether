"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clearAuthFlow,
  hasStartedAuthFlow,
  markAuthFlowConfirmed
} from "@/lib/auth-flow";
import { getSupabaseClient } from "@/lib/supabase";

export function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("카카오 로그인 세션을 확인하고 있습니다.");

  useEffect(() => {
    async function finishLogin() {
      const supabase = getSupabaseClient();
      const code = searchParams.get("code");
      const errorDescription = searchParams.get("error_description");

      if (errorDescription) {
        setStatus(decodeURIComponent(errorDescription));
        return;
      }

      if (!supabase) {
        setStatus("Supabase 환경 변수가 설정되지 않았습니다.");
        return;
      }

      if (!hasStartedAuthFlow()) {
        clearAuthFlow();
        router.replace("/");
        return;
      }

      if (!code) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const hashError = hashParams.get("error_description");

        if (hashError) {
          setStatus(decodeURIComponent(hashError));
          return;
        }

        let session = null;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const { data } = await supabase.auth.getSession();
          session = data.session;
          if (session) {
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 200));
        }

        if (session) {
          const { data: profile } = await (supabase.from("users") as any)
            .select("onboarding_completed")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profile?.onboarding_completed) {
            clearAuthFlow();
            setStatus("로그인이 완료되었습니다.");
            router.replace("/");
            return;
          }

          markAuthFlowConfirmed();
          setStatus("카카오 인증이 완료되었습니다. RUNGETHER 회원가입을 진행합니다.");
          router.replace("/signup");
          return;
        }

        setStatus("인증 응답이 없습니다. 홈으로 돌아가 카카오 로그인을 다시 눌러 주세요.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setStatus(error.message);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        clearAuthFlow();
        setStatus("카카오 계정을 확인하지 못했습니다. 다시 로그인해 주세요.");
        return;
      }

      const { data: profile } = await (supabase.from("users") as any)
        .select("onboarding_completed")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profile?.onboarding_completed) {
        clearAuthFlow();
        setStatus("로그인이 완료되었습니다.");
        router.replace("/");
        return;
      }

      markAuthFlowConfirmed();
      setStatus("카카오 인증이 완료되었습니다. RUNGETHER 회원가입을 진행합니다.");
      router.replace("/signup");
    }

    void finishLogin();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-[420px]">
        <CardHeader>
          <CardTitle>카카오 로그인</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-bold leading-6 text-muted">{status}</p>
        </CardContent>
      </Card>
    </main>
  );
}
