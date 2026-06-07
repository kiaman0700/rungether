# RUNGETHER

`PRD.md`를 기반으로 만든 러닝 중심 SNS입니다. 인스타그램처럼 익숙한
로그인, 피드, 좋아요, 프로필 흐름을 사용하되 모든 게시물과 관계가 러닝
기록, 경로, 크루 활동을 중심으로 이어지도록 구성합니다.

서비스: https://rungether.vercel.app

## 스택

- Next.js App Router
- TypeScript
- TailwindCSS
- Supabase client scaffold
- Kakao Map 환경 변수 scaffold

## 실행

```bash
npm install
npm run dev
```

환경 변수는 `.env.example`을 기준으로 `.env.local`에 설정합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=
```

카카오 로그인 설정값은 [docs/kakao-login-setup.md](docs/kakao-login-setup.md)에 정리했습니다.
Supabase 테이블 생성은 [docs/supabase-setup.md](docs/supabase-setup.md)를 따라 진행합니다.
Vercel 배포는 [docs/vercel-deploy.md](docs/vercel-deploy.md)를 따라 진행합니다.

## 구현 범위

- 모바일 앱 홈: 러닝 GPS 세션, 위치 공유, 친구 위치, 피드, 국토대장정 진행률
- 데스크톱 웹 스튜디오: 경로 계획, 크루 운영, SNS 피드 관리, 기록 분석, 안전 현황
- 같은 SNS 데이터 모델을 공유하는 반응형 화면 구조
- 첫 화면의 카카오 로그인 또는 회원가입
- 로그인 후 고유 RUNGETHER 아이디 생성과 선택형 프로필 설정
- 언제든 다시 수정할 수 있는 프로필 편집
- 피드, 좋아요, 친구, 채팅, 러닝 기록을 잇는 러닝 중심 SNS
- PWA manifest 및 앱 아이콘 scaffold
- Supabase DB 스키마 초안
