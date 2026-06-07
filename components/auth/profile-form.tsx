"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AtSign, Camera, Check, Loader2, SkipForward, UserRound } from "lucide-react";
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
  const [status, setStatus] = useState(
    mode === "onboarding"
      ? "아이디는 필수이고 나머지 정보는 선택입니다."
      : "변경할 프로필 정보를 입력하세요."
  );
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
    setStatus("아이디와 프로필을 저장하고 있습니다.");

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
    <main className="min-h-screen bg-surface px-4 py-8 sm:py-12">
      <section className="mx-auto w-full max-w-[560px] overflow-hidden rounded-md border border-border bg-white shadow-soft">
        <div className="border-b border-border px-5 py-6 sm:px-7">
          <p className="text-xs font-black text-primary">
            {mode === "onboarding" ? "프로필 설정" : "프로필 편집"}
          </p>
          <h1 className="mt-2 text-2xl font-black">
            {mode === "onboarding" ? "RUNGETHER에서 어떻게 보일까요?" : "내 프로필 관리"}
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            아이디만 필수입니다. 이름, 사진, 소개는 지금 입력하지 않아도 됩니다.
          </p>
        </div>

        <form className="grid gap-5 px-5 py-6 sm:px-7" onSubmit={submit}>
          <div className="flex items-center gap-4">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-md bg-zinc-100 text-muted">
              {avatarPreview ? (
                <img
                  alt="프로필 미리보기"
                  className="size-full object-cover"
                  src={avatarPreview}
                />
              ) : (
                <UserRound size={30} />
              )}
            </div>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-bold hover:bg-zinc-50">
              <Camera size={17} />
              사진 선택
              <input
                accept="image/*"
                className="sr-only"
                disabled={!isReady || isLoading}
                onChange={selectAvatar}
                type="file"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-bold">
              아이디 <span className="text-danger">필수</span>
            </span>
            <div className="grid h-12 grid-cols-[auto_1fr] items-center gap-2 rounded-md border border-border px-3">
              <AtSign className="text-muted" size={18} />
              <input
                autoCapitalize="none"
                autoCorrect="off"
                className="min-w-0 bg-transparent text-sm font-bold outline-none"
                disabled={!isReady || isLoading}
                maxLength={20}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="rungether.id"
                value={handle}
              />
            </div>
            <span className="text-xs font-semibold text-muted">
              영문 소문자, 숫자, 점, 밑줄만 사용할 수 있습니다.
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">표시 이름 <span className="text-muted">선택</span></span>
            <input
              className="h-12 rounded-md border border-border px-3 text-sm font-semibold outline-none focus:border-primary"
              disabled={!isReady || isLoading}
              maxLength={30}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="친구들에게 보일 이름"
              value={displayName}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">소개 <span className="text-muted">선택</span></span>
            <textarea
              className="min-h-24 resize-y rounded-md border border-border p-3 text-sm font-semibold outline-none focus:border-primary"
              disabled={!isReady || isLoading}
              maxLength={160}
              onChange={(event) => setBio(event.target.value)}
              placeholder="러닝 목표나 좋아하는 코스를 소개해 보세요."
              value={bio}
            />
            <span className="text-right text-xs font-semibold text-muted">{bio.length}/160</span>
          </label>

          <p className="text-xs font-bold leading-5 text-muted" role="status">
            {status}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {mode === "onboarding" ? (
              <Button
                disabled={!isReady || isLoading}
                onClick={() => void saveProfile(true)}
                variant="secondary"
              >
                <SkipForward size={18} />
                선택 정보 건너뛰기
              </Button>
            ) : (
              <Button
                disabled={isLoading}
                onClick={() => router.replace("/")}
                variant="secondary"
              >
                취소
              </Button>
            )}
            <Button disabled={!isReady || isLoading} type="submit">
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              {mode === "onboarding" ? "저장하고 시작" : "변경사항 저장"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
