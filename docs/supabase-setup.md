# Supabase 설정

RUNGETHER의 러닝 기록, 피드, 친구, 채팅, 위치 공유 기능은 Supabase 테이블과 RLS 정책을 사용합니다.

## 반드시 실행할 작업

1. Supabase Dashboard에서 RUNGETHER 프로젝트를 엽니다.
2. 왼쪽 메뉴에서 `SQL Editor`를 선택합니다.
3. `New query`를 누릅니다.
4. 프로젝트의 `supabase/schema.sql` 파일 전체를 붙여 넣습니다.
5. 오른쪽 아래 `Run`을 누릅니다.
6. `Success. No rows returned`가 표시되면 완료입니다.

이미 예전 SQL을 실행했더라도 최신 파일 전체를 다시 실행해야 합니다. 정책은 `drop policy if exists` 후 다시 생성되므로 반복 실행할 수 있습니다.

## 이번 SQL에서 활성화되는 기능

- `users`: 고유 RUNGETHER 아이디, 프로필, 온보딩 완료 상태
- `runs`, `run_tracks`: GPS 러닝 기록과 경로
- `posts`, `likes`, `comments`: 피드와 좋아요
- `friends`: 친구 요청과 수락
- `chats`, `messages`: RUNGETHER 공개 라운지 채팅
- `live_locations`: 선택한 사용자의 실시간 위치 공유
- `emergency_reports`: 앱 안의 SOS 요청 기록
- `crews`, `journeys`: 크루와 국토대장정 데이터 기반
- `avatars` Storage 버킷: 사용자가 업로드한 프로필 이미지

## 실행 후 확인

`Table Editor`에서 다음 테이블이 보이는지 확인합니다.

- `users`
- `runs`
- `run_tracks`
- `posts`
- `likes`
- `friends`
- `chats`
- `messages`
- `live_locations`

`chats` 테이블에는 `RUNGETHER 라운지` 행이 자동으로 한 개 생성됩니다.

`Storage`에는 `avatars` 버킷이 보여야 합니다. 버킷은 공개 이미지 읽기를
허용하지만, 업로드·수정·삭제는 로그인한 사용자가 자기 폴더에 저장한
파일에만 허용됩니다.

## 기존 사용자가 있는 경우

최신 SQL을 다시 실행하면 `users.onboarding_completed` 열이 추가됩니다.
기존 사용자의 기본값은 `false`이므로 다음 로그인 때 한 번 RUNGETHER
아이디와 프로필 설정 화면을 거칩니다. 필수 항목은 아이디뿐이고,
표시 이름·소개·프로필 사진은 건너뛴 뒤 나중에 수정할 수 있습니다.

## 주의

`SOS 기록`은 현재 데이터베이스에 요청을 남기는 기능입니다. 실제 112/119 신고나 보호자 문자 발송은 별도의 통신 서비스와 앱 권한 연동이 필요합니다.
