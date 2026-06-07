import { Suspense } from "react";

import { AuthCallback } from "@/components/auth/auth-callback";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallback />
    </Suspense>
  );
}

function AuthCallbackFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <p className="text-sm font-bold text-muted">로그인 응답을 기다리고 있어요.</p>
    </main>
  );
}
