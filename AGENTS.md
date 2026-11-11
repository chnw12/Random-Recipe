# AGENTS.md — 보조바퀴 (웹) 작업 규칙

이 저장소에서 코드를 고치는 사람/에이전트를 위한 규칙. 먼저 `README.md`(전체 기능 목록 포함)를 읽는다.

## 명령
- `npm run dev` 화면 + `/api` (http://localhost:5173), `npm test` 서버 테스트, `npm run build`, `npm run db:setup`
- `npm run data:check` 공공데이터 API 확인용(보류 중인 기능의 사전 조사). DB에 쓰지 않는다.
- 변경 후에는 `npm test` 와 `npm run build` 를 둘 다 통과시킨다.

## 현재 범위 (줄인 범위 — 임의로 넓히지 말 것)
- 있음: 재료 뽑기, 다시 뽑기, 창조/다시 창조, 메뉴 확정, 레시피 복사, 쓴 금액 입력·저장, 평균 열량(= 쓴 금액 통계), 가격 시트(빈 상태 + 검색 링크).
- **준비 중(화면만 있고 기능 없음)**: 즐겨찾기, 재료 제외, 카테고리. 사이드바 항목, 확정 화면의 ☆ 버튼(누르면 "준비 중" 알림), `ComingSoonScreen` 만 있다. 실제 기능(저장·제외 동작)을 만들려면 먼저 사용자에게 확인한다.
- **뺀 것**: 채팅 메뉴 추천. 다시 넣으려면 먼저 사용자에게 확인한다.
- **보류한 것**: 식약처 참고 레시피(COOKRCP01)와 가격(KAMIS·참가격) 연결. `scripts/check-data.js`, `docs/data-check.md` 는 남겨 두되 더 진행하지 않는다. 연결을 시작하려면 사용자 승인을 먼저 받는다 (단계마다 멈추고 보고).
  - 사실만: 식약처 호스트는 `openapi.foodsafetykorea.go.kr`, KAMIS 응답의 품목은 `price` 배열(`item_code` 없음, `productno`), 참가격 요청 주소는 미확인.
  - 식약처 응답의 `INFO_*`(열량 등)는 저장·표시하지 않는다.

## 구조 규칙
- 브라우저(`src/`)는 `/api` 만 부른다. 키, 재료 검사, AI 호출, AI 결과 검사, 요청 횟수 제한, 확정 기록은 **서버에서만** 한다.
- LLM 호출은 `lib/llm.js` 한 곳에서만 한다. provider 를 추가하면 거기에 분기를 더하고 `test/server.test.js` 에 요청 형식 테스트를 더한다.
- AI 결과 검사(하네스)는 `lib/harness.js` 가 유일한 기준이다. 검사를 완화하지 않는다. 오탐이 나면 **재료 데이터**(`aliases`, `guard`)를 고치고 테스트를 더한다.
- 조리 순서 길이(3~6단계, 각 70자)는 `lib/harness.js` 의 `STEPS_MIN/STEPS_MAX/STEP_MAX_CHARS` 와 `lib/prompt.js` 의 규칙 문장이 **같이** 바뀌어야 한다.
- 날생선·해산물은 `lib/ingredients.js` 의 `cook: true` 로 표시한다. 새 해산물 재료를 추가하면 이 표시와 테스트("cook 7개")를 함께 고친다.
- `lib/ingredients.js` 는 서버와 화면이 같이 쓴다. `node:` import, `process`, `require` 금지 (테스트가 막는다).
- 재료의 **양**은 서버가 `lib/ingredients.js` 에서 채운다. AI 응답의 양/재료 목록은 쓰지 않는다.
- 서버 함수 한 파일 = `api/` 한 파일. 새 엔드포인트는 같은 순서(형식 검사 → 요청 횟수 → 처리)와 오류 형식 `{ error, message }` 를 따른다 (`lib/http.js`).
- 요청 횟수 제한은 서버리스 특성상 DB(`rate_limits`)에 둔다. DB가 없을 때만 메모리로 센다.

## 보안 규칙 (어기지 말 것)
- `.env` 내용과 키 값, 키가 들어간 URL을 출력·로그·응답·문서·테스트 출력에 쓰지 않는다. 오류 로그는 **종류와 HTTP 상태만** (`logSafe`). 공공데이터 확인 스크립트는 모든 출력을 `scrub()` 으로 거른다.
- 비밀 변수 이름에 `VITE_` 를 붙이지 않는다. `.env` 는 `.gitignore`. 새 변수는 `.env.example` 에 **이름과 설명만** 추가한다.
- 사용자 입력(예: `avoidMenuName`)과 참고 자료는 프롬프트의 user 구역(데이터)에만 넣는다. system 에 섞지 않는다.
- 쇼핑몰은 검색 링크만 만든다. 수집/크롤링 코드를 추가하지 않는다.
- 칼로리·영양 수치, 효과 문구(예: "살이 빠진다")를 화면과 AI 결과에 넣지 않는다 (기획서 Won't).
- 개발·테스트 중 실제 DB에 기록이 남지 않게 하려면 `DATABASE_URL=` (빈 값)으로 서버를 띄운다.

## 테스트 규칙
- `node --test`, 서버 함수를 가짜 req/res 로 직접 호출한다 (`test/util.js`). 네트워크와 실제 DB는 쓰지 않는다 (`globalThis.fetch` 와 `__setSqlForTests` 로 대체).
- 테스트마다 `isolate()` 로 환경 변수·DB·메모리 카운터를 격리하고 `restore()` 한다.
- 쿼리 **순서**에 의존하는 테스트를 쓰지 않는다 (요청 제한이 가끔 정리 쿼리를 추가로 실행한다).
- 하네스를 바꾸면 "재료 누락, 목록 밖 재료, 금지 표현, 형식·길이 경계(70자/71자, 2·3·6·7단계), 날생선 가열·날것 조리법, 별칭, 순두부≠두부, 가지런히" 케이스와 mock 8,000 조합 테스트가 통과해야 한다.

## UI 규칙
- **색은 `src/theme.js` 에서만 정한다.** 화면 코드(`screens.jsx`, `ui.jsx`, `App.jsx`)에 `#RRGGBB`/`rgb()` 를 쓰지 않고 theme 키만 쓴다 (`primary.main`, `primary.dark`(진한 초록 글자), `primary.light`(연한 그린 배경), `text.secondary`, `divider`, `warning.*`). 새 색이 필요하면 토큰을 먼저 추가한다.
- 버튼은 `AppButton`(`tone="primary"` 그린 배경+흰 글자 / `tone="secondary"` 흰 배경+그린 테두리), 카드는 `Surface`, 헤더/본문/하단은 `Top`/`Body`/`Foot` 를 쓴다. 화면마다 따로 스타일을 만들지 않는다.
- **이모지·유니코드 기호(→, ☰, ✨ 등)를 UI 글자로 쓰지 않는다.** `src/icons.jsx` 의 SVG 아이콘(선 굵기 2)을 쓰고, 새 아이콘은 같은 파일에 추가한다.
- 글꼴은 Plus Jakarta Sans(영문·숫자) + 시스템 한글. 라이트 테마만 쓴다.
- 사이드바(`AppDrawer`)는 그룹(핵심 기능 / 기록) + 아이콘 + 텍스트이고, 활성 항목은 `selected`(연한 그린). 메인·뽑기·결과·확정은 "재료 뽑기"가 활성이다. 사이드바로 갈 수 있는 화면(메인, 뽑기, 평균 열량, 준비 중)은 `Top` 에 `onMenu` 를 넘긴다.
- MUI 9: `Stack` 에 `justifyContent`/`alignItems`/`flexWrap` prop 을 쓰지 말고 `sx` 로 쓴다.
- 결과 화면 버튼 순서: [다시 창조][다시 뽑기] 위, **[이 메뉴로 확정] 맨 아래** (실수로 확정을 먼저 누르는 것을 막기 위함). 바꾸지 않는다.
- 개인 기록은 `src/local.js` (localStorage) 만 쓴다. 서버로 보내는 개인 값은 익명 `browserId` 뿐이다.
- 로딩/오류/빈 상태는 화면 명세표(노션)의 문구를 따른다. 실패해도 사용자의 재료와 기존 메뉴는 유지한다.
- 날생선·해산물이 들어간 결과에는 "속까지 충분히 익혀서 드세요" 안내를 보인다.
