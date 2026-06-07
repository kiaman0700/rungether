"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AtSign, Camera, Check, Loader2, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { clearAuthFlow, hasConfirmedAuthFlow } from "@/lib/auth-flow";
import { getSupabaseClient } from "@/lib/supabase";

const handlePattern = /^[a-z0-9._]{3,20}$/;

type ProfileFormProps = {
  mode: "onboarding" | "edit";
};

type ExistingProfile = {
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
};

export function ProfileForm({ mode }: ProfileFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [userId, setUserId] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (mode === "onboarding" && !hasConfirmedAuthFlow()) {
        router.replace("/");
        return;
      }

      if (!supabase) {
        setStatus("Supabase 환경 변수가 설정되지 않았습니다.");
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/");
        return;
      }

      setUserId(data.user.id);
      const { data: profile } = await (supabase.from("users") as any)
        .select("handle,display_name,bio,avatar_url,onboarding_completed")
        .eq("id", data.user.id)
        .maybeSingle();
      const existing = profile as ExistingProfile | null;

      if (mode === "onboarding" && existing?.onboarding_completed) {
        router.replace("/");
        return;
      }

      if (mode === "edit" && !existing) {
        router.replace("/onboarding");
        return;
      }

      if (existing) {
        setHandle(existing.handle ?? "");
        setDisplayName(existing.display_name ?? "");
        setBio(existing.bio ?? "");
        setAvatarUrl(existing.avatar_url);
        setAvatarPreview(existing.avatar_url);
      } else {
        const kakaoAvatar =
          data.user.user_metadata?.avatar_url ??
          data.user.user_metadata?.picture ??
          null;
        setAvatarUrl(kakaoAvatar);
        setAvatarPreview(kakaoAvatar);
      }

      setIsReady(true);
    }

    void loadProfile();
  }, [mode, router, supabase]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus("이미지 파일만 선택할 수 있습니다.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatus("프로필 이미지는 5MB 이하로 선택해 주세요.");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setStatus("");
  }

  function removeAvatar() {
    setAvatarFile(null);
    setAvatarUrl(null);
    setAvatarPreview(null);
    setStatus("");
  }

  async function uploadAvatar() {
    if (!supabase || !avatarFile || !userId) {
      return avatarUrl;
    }

    const extension = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("avatars").upload(path, avatarFile, {
      cacheControl: "3600",
      contentType: avatarFile.type,
      upsert: true
    });

    if (error) {
      throw new Error("프로필 사진 업로드에 실패했습니다. 최신 Supabase SQL을 실행해 주세요.");
    }

    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  async function saveProfile(skipOptional: boolean) {
    const normalizedHandle = handle.trim().toLowerCase();

    if (!handlePattern.test(normalizedHandle)) {
      setStatus("아이디는 영문 소문자, 숫자, 점, 밑줄로 3~20자까지 입력해 주세요.");
      return;
    }

    if (!supabase || !userId) {
      setStatus("로그인 세션을 찾을 수 없습니다.");
      return;
    }

    setIsLoading(true);
    setStatus("프로필을 저장하고 있습니다.");

    const { data: duplicate } = await (supabase.from("users") as any)
      .select("id")
      .eq("handle", normalizedHandle)
      .neq("id", userId)
      .maybeSingle();

    if (duplicate) {
      setStatus("이미 사용 중인 아이디입니다.");
      setIsLoading(false);
      return;
    }

    try {
      const uploadedAvatar = skipOptional ? avatarUrl : await uploadAvatar();
      const nextDisplayName =
        skipOptional || !displayName.trim() ? normalizedHandle : displayName.trim();
      const { error } = await (supabase.from("users") as any).upsert({
        id: userId,
        handle: normalizedHandle,
        display_name: nextDisplayName,
        bio: skipOptional ? null : bio.trim() || null,
        avatar_url: uploadedAvatar,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }

      clearAuthFlow();
      router.replace("/");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
      setIsLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveProfile(false);
  }

  return (
    <main className="min-h-screen bg-white text-ink sm:bg-surface sm:px-4 sm:py-10">
      <section className="mx-auto min-h-screen w-full max-w-[600px] bg-white sm:min-h-0 sm:overflow-hidden sm:rounded-md sm:border sm:border-border sm:shadow-soft">
        <form onSubmit={submit}>
          <header className="sticky top-0 z-10 grid h-14 grid-cols-[88px_1fr_88px] items-center border-b border-border bg-white/95 px-3 backdrop-blur">
            <button
              className="justify-self-start text-sm font-bold"
              disabled={isLoading}
              onClick={() => router.replace("/")}
              type="button"
            >
              취소
            </button>
            <h1 className="text-center text-base font-black">
              {mode === "onboarding" ? "프로필 만들기" : "프로필 편집"}
            </h1>
            <button
              className="inline-flex items-center justify-self-end text-sm font-black text-primary disabled:opacity-50"
              disabled={!isReady || isLoading}
              type="submit"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : "완료"}
            </button>
          </header>

          <div className="px-5 py-7 sm:px-8">
            <div className="flex flex-col items-center">
              <div className="relative grid size-24 place-items-center overflow-hidden rounded-full bg-zinc-100 text-muted">
                {avatarPreview ? (
                  <img
                    alt="프로필 미리보기"
                    className="size-full object-cover"
                    src={avatarPreview}
                  />
                ) : (
                  <UserRound size={38} />
                )}
                {!avatarPreview ? (
                  <span className="absolute bottom-1 right-1 grid size-7 place-items-center rounded-full border-2 border-white bg-primary text-white">
                    <Camera size={14} />
                  </span>
                ) : null}
              </div>
              <label className="mt-3 cursor-pointer text-sm font-black text-primary hover:underline">
                프로필 사진 변경
                <input
                  accept="image/*"
                  className="sr-only"
                  disabled={!isReady || isLoading}
                  onChange={selectAvatar}
                  type="file"
                />
              </label>
              {avatarPreview ? (
                <button
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-danger"
                  disabled={isLoading}
                  onClick={removeAvatar}
                  type="button"
                >
                  <X size={14} />
                  현재 사진 삭제
                </button>
              ) : null}
            </div>

            <div className="mt-8 divide-y divide-border border-y border-border">
              <label className="grid gap-2 py-4 sm:grid-cols-[110px_1fr] sm:items-center sm:gap-5">
                <span className="text-sm font-bold">이름</span>
                <input
                  className="min-w-0 border-0 bg-transparent text-sm font-semibold outline-none placeholder:text-zinc-400"
                  disabled={!isReady || isLoading}
                  maxLength={30}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="이름"
                  value={displayName}
                />
              </label>

              <label className="grid gap-2 py-4 sm:grid-cols-[110px_1fr] sm:items-center sm:gap-5">
                <span className="text-sm font-bold">사용자 이름</span>
                <div className="flex min-w-0 items-center gap-2">
                  <AtSign className="shrink-0 text-muted" size={17} />
                  <input
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none placeholder:text-zinc-400"
                    disabled={!isReady || isLoading}
                    maxLength={20}
                    onChange={(event) => setHandle(event.target.value)}
                    placeholder="rungether.id"
                    value={handle}
                  />
                </div>
              </label>

              <label className="grid gap-2 py-4 sm:grid-cols-[110px_1fr] sm:gap-5">
                <span className="text-sm font-bold sm:pt-1">소개</span>
                <div>
                  <textarea
                    className="min-h-24 w-full resize-none border-0 bg-transparent text-sm font-semibold leading-6 outline-none placeholder:text-zinc-400"
                    disabled={!isReady || isLoading}
                    maxLength={160}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="러닝 목표나 좋아하는 코스를 소개해 보세요."
                    value={bio}
                  />
                  <p className="text-right text-xs font-semibold text-muted">
                    {bio.length}/160
                  </p>
                </div>
              </label>
            </div>

            <p className="mt-3 min-h-5 text-xs font-bold leading-5 text-danger" role="status">
              {status}
            </p>

            {mode === "onboarding" ? (
              <Button
                className="mt-3 w-full"
                disabled={!isReady || isLoading}
                onClick={() => void saveProfile(true)}
                variant="secondary"
              >
                <Check size={18} />
                아이디만 저장하고 시작
              </Button>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
}
