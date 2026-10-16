# AGENTS.md — 보조바퀴 (웹) 작업 규칙

이 저장소에서 코드를 고치는 사람/에이전트를 위한 규칙. 먼저 `README.md` 를 읽는다.

## 명령
- `npm run dev` 화면 + `/api` (http://localhost:5173), `npm test` 서버 테스트, `npm run build`, `npm run db:setup`
- 변경 후에는 `npm test` 와 `npm run build` 를 둘 다 통과시킨다.

## 구조 규칙
- 브라우저(`src/`)는 `/api` 만 부른다. 키, 재료 검사, AI 호출, AI 결과 검사, 요청 횟수 제한, 확정 기록은 **서버에서만** 한다.
- LLM 호출은 `lib/llm.js` 한 곳에서만 한다. provider 를 추가하면 거기에 분기를 더하고 `test/server.test.js` 에 요청 형식 테스트를 더한다.
- AI 결과 검사(하네스)는 `lib/harness.js` 가 유일한 기준이다. 검사를 완화하지 않는다. 오탐이 나면 **재료 데이터**(`aliases`, `guard`)를 고치고 테스트를 더한다.
- `lib/ingredients.js` 는 서버와 화면이 같이 쓴다. `node:` import, `process`, `require` 금지 (테스트가 막는다).
- 재료의 **양**은 서버가 `lib/ingredients.js` 에서 채운다. AI 응답의 양/재료 목록은 쓰지 않는다.
- 서버 함수 한 파일 = `api/` 한 파일. 새 엔드포인트는 같은 순서(형식 검사 → 요청 횟수 → 처리)와 오류 형식 `{ error, message }` 를 따른다 (`lib/http.js`).
- 요청 횟수 제한은 서버리스 특성상 DB(`rate_limits`)에 둔다. DB가 없을 때만 메모리로 센다.

## 보안 규칙 (어기지 말 것)
- `.env` 내용과 키 값을 출력·로그·응답·문서·테스트 출력에 쓰지 않는다. 오류 로그는 **종류와 HTTP 상태만** (`logSafe`).
- 비밀 변수 이름에 `VITE_` 를 붙이지 않는다. `.env` 는 `.gitignore`. 새 변수는 `.env.example` 에 **이름과 설명만** 추가한다.
- 사용자 입력(예: `avoidMenuName`)과 참고 자료는 프롬프트의 user 구역(데이터)에만 넣는다. system 에 섞지 않는다.
- 쇼핑몰은 검색 링크만 만든다. 수집/크롤링 코드를 추가하지 않는다.
- 칼로리·영양 수치, 효과 문구(예: "살이 빠진다")를 화면과 AI 결과에 넣지 않는다 (기획서 Won't).

## 테스트 규칙
- `node --test`, 서버 함수를 가짜 req/res 로 직접 호출한다 (`test/util.js`). 네트워크와 실제 DB는 쓰지 않는다 (`globalThis.fetch` 와 `__setSqlForTests` 로 대체).
- 테스트마다 `isolate()` 로 환경 변수·DB·메모리 카운터를 격리하고 `restore()` 한다.
- 쿼리 **순서**에 의존하는 테스트를 쓰지 않는다 (요청 제한이 가끔 정리 쿼리를 추가로 실행한다).
- 하네스를 바꾸면 "재료 누락, 목록 밖 재료, 금지 표현, 형식 오류, 별칭, 순두부≠두부, 가지런히" 케이스와 mock 8,000 조합 테스트가 통과해야 한다.

## UI 규칙
- MUI 9: `Stack` 에 `justifyContent`/`alignItems`/`flexWrap` prop 을 쓰지 말고 `sx` 로 쓴다.
- 개인 기록은 `src/local.js` (localStorage) 만 쓴다. 서버로 보내는 개인 값은 익명 `browserId` 뿐이다.
- 로딩/오류/빈 상태는 화면 명세표(노션)의 문구를 따른다. 실패해도 사용자의 재료와 기존 메뉴는 유지한다.

## 3순위 (설계만 있음 — README "3순위 설계")
- `scripts/collect-prices.js`, `GET /api/prices`, `/api/create` 의 식약처(COOKRCP01) 참고 레시피 연결은 **아직 만들지 않았다**.
  만들 때는 공공 API 를 요청마다 부르지 않고(가격은 DB 저장값만), 실패 시 기존 값을 유지하며, 14초 예산을 지킨다.
- 선행: `lib/ingredients.js` 의 `publicCode` 채우기.
