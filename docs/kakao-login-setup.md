# 카카오 로그인 및 지도 설정

RUNGETHER는 로그인에 Supabase Auth의 Kakao OAuth를 사용하고, 지도에는 Kakao 지도 Web API의 JavaScript 키를 사용합니다. 두 키의 역할이 다릅니다.

## 1. 카카오 로그인

### Kakao Developers

1. Kakao Developers에서 RUNGETHER 앱을 엽니다.
2. `앱 설정 > 앱 > 플랫폼 키`에서 `REST API 키`를 확인합니다.
3. `제품 설정 > 카카오 로그인`을 활성화합니다.
4. Redirect URI에 아래 주소를 등록합니다.

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

5. `카카오 로그인 > 보안`에서 Client Secret을 발급하고 활성화합니다.
6. 동의항목은 다음처럼 설정합니다.

- 카카오계정 이메일: 서비스 계정 식별과 로그인 계정 연결 목적
- 닉네임: 초기 프로필 참고 목적, 선택 동의
- 프로필 사진: 프로필 이미지 표시 목적, 선택 동의

RUNGETHER 아이디는 카카오 닉네임과 별도로 회원가입 마지막 단계에서 사용자가 직접 만듭니다.

### Supabase

`Authentication > Providers > Kakao`에서:

- Enabled: ON
- Client ID: Kakao `REST API 키`
- Client Secret: Kakao 로그인 `Client Secret`

`Authentication > URL Configuration`에서:

- Site URL: `http://localhost:3000`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://127.0.0.1:3000/auth/callback`
  - 배포 후 `https://<배포도메인>/auth/callback`

## 2. 카카오 지도

현재 RUNGETHER 키로 SDK를 직접 확인했을 때 Kakao가 다음 403 응답을
반환했습니다.

```text
App(RUNGETHER) disabled OPEN_MAP_AND_LOCAL service.
```

JavaScript 키나 React 코드의 문제가 아니라 RUNGETHER 앱에서 지도·로컬
서비스 이용 권한이 꺼져 있다는 뜻입니다. 아래 1번을 먼저 완료해야
지도가 표시됩니다.

1. Kakao Developers에서 RUNGETHER 앱을 열고 `제품 설정` 또는
   `API/서비스` 메뉴의 `Kakao Map`·`지도/로컬` 서비스를 활성화합니다.
   콘솔 UI에 `활성화`, `사용 설정`, `서비스 이용` 중 하나로 표시될 수
   있습니다.
2. `앱 설정 > 앱 > 플랫폼 키`로 이동합니다.
3. JavaScript 키를 새로 만들거나 기존 JavaScript 키를 선택합니다.
4. 키 이름은 예를 들어 `RUNGETHER Web Map`으로 입력합니다.
5. JavaScript SDK 도메인에 아래 주소를 등록합니다.

```text
http://localhost:3000
```

6. 배포 후에는 실제 서비스 도메인도 추가합니다.

```text
https://<배포도메인>
```

7. 발급된 `JavaScript 키`를 `.env.local`에 입력합니다. REST API 키를 넣으면 안 됩니다.

```bash
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=<KAKAO_JAVASCRIPT_KEY>
```

8. 서버를 다시 시작하고 `http://localhost:3000`을 새로고침합니다.

## 3. 로컬 환경 변수

`.env.local`에는 아래 네 값이 필요합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=<KAKAO_JAVASCRIPT_KEY>
```

현재 프로젝트에는 네 항목이 모두 입력되어 있습니다. 키 값은 GitHub에 커밋하지 마세요.

## 4. 지도 오류 확인

지도가 뜨지 않을 때는 다음 순서로 확인합니다.

1. 주소창이 `http://localhost:3000`인지 확인합니다.
2. JavaScript SDK 도메인에 `http://localhost:3000`이 저장되어 있는지 확인합니다.
3. `.env.local` 값이 `JavaScript 키`인지 확인합니다.
4. Kakao Map 또는 지도/로컬 서비스가 활성화되어 있는지 확인합니다.
5. Kakao Developers에서 해당 JavaScript 키가 활성 상태인지 확인합니다.
6. 서버를 완전히 다시 시작합니다.

Kakao 지도 공식 문서: https://apis.map.kakao.com/web/guide/
