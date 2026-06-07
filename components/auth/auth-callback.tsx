"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { markAuthFlowConfirmed } from "@/lib/auth-flow";
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
          markAuthFlowConfirmed();
          setStatus("로그인이 완료되었습니다. RUNGETHER 아이디를 확인합니다.");
          router.replace("/onboarding");
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

      markAuthFlowConfirmed();
      setStatus("로그인이 완료되었습니다. RUNGETHER 아이디를 확인합니다.");
      router.replace("/onboarding");
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
