# Vercel 배포

이 프로젝트는 Next.js라 별도의 `vercel.json` 없이 Vercel에 배포할 수
있습니다. 현재 폴더는 Git 저장소가 아니므로 아래 GitHub 방식이 가장
관리하기 쉽습니다.

## 1. GitHub 저장소 준비

프로젝트 루트에서 Git 저장소를 만들고 GitHub의 새 비공개 저장소에
올립니다. `.env.local`은 `.gitignore`에 포함되어 있으므로 커밋하지
않습니다.

## 2. Vercel 프로젝트 만들기

1. Vercel Dashboard에서 `Add New > Project`를 선택합니다.
2. 방금 만든 GitHub 저장소를 Import합니다.
3. Framework Preset이 `Next.js`인지 확인합니다.
4. Build Command는 기본값 `next build`를 그대로 사용합니다.

## 3. 환경 변수 등록

`Project > Settings > Environment Variables`에 아래 네 항목을 넣습니다.
Production, Preview, Development를 모두 선택해도 됩니다.

```text
NEXT_PUBLIC_SUPABASE_URL=<Supabase Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon public key>
NEXT_PUBLIC_SITE_URL=https://<고정-배포-도메인>
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=<Kakao JavaScript key>
```

환경 변수를 새로 추가하거나 수정한 뒤에는 반드시 다시 배포해야 합니다.
이미 끝난 배포에는 변경값이 적용되지 않습니다.

## 4. Supabase 배포 주소 등록

Supabase Dashboard의 `Authentication > URL Configuration`에서:

- Site URL: `https://<고정-배포-도메인>`
- Redirect URLs:
  - `https://<고정-배포-도메인>/auth/callback`
  - `http://localhost:3000/auth/callback`

Preview 배포에서도 로그인을 시험하려면 아래 형식을 추가할 수 있습니다.

```text
https://*-<Vercel-team-or-account-slug>.vercel.app/**
```

운영 주소는 와일드카드 대신 정확한 callback 주소를 등록합니다.

## 5. Kakao 배포 주소 등록

Kakao Developers의 RUNGETHER 앱에서:

1. JavaScript SDK 도메인에 `https://<고정-배포-도메인>`을 추가합니다.
2. Kakao Map 또는 지도/로컬 서비스를 활성화합니다.
3. 카카오 로그인 Redirect URI는 Vercel 주소가 아니라 기존 Supabase
   callback 주소를 유지합니다.

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

Vercel Preview 주소는 배포마다 달라질 수 있으므로 카카오 지도와 로그인
최종 확인은 고정된 Production 도메인에서 하는 편이 안정적입니다.

## 6. 배포 후 확인

1. 첫 화면에 `카카오톡으로 로그인 또는 회원가입`만 표시되는지 확인합니다.
2. 로그인 후 `/onboarding`에서 고유 아이디를 저장합니다.
3. 프로필 선택 항목을 입력하거나 건너뜁니다.
4. 피드 화면으로 이동하는지 확인합니다.
5. 러닝 시작, 게시물 작성, 좋아요, 친구, 채팅, 프로필 편집을 확인합니다.
6. 지도 화면이 표시되는지 확인합니다.

Vercel Next.js 공식 문서: https://vercel.com/docs/frameworks/full-stack/nextjs

Vercel 환경 변수 공식 문서: https://vercel.com/docs/environment-variables

Supabase Redirect URL 공식 문서: https://supabase.com/docs/guides/auth/redirect-urls
