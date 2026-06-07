import type { SupabaseClient } from "@supabase/supabase-js";

import { clearAuthFlow } from "@/lib/auth-flow";

export async function cancelIncompleteKakaoSignup(supabase: SupabaseClient) {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session?.provider_token) {
    await fetch("/api/auth/cancel-signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ providerToken: session.provider_token })
    }).catch(() => null);
  }

  clearAuthFlow();
  await supabase.auth.signOut({ scope: "local" });
}
