-- Neon PostgreSQL. npm run db:setup 으로 실행한다. 여러 번 실행해도 안전하다(if not exists).

-- 확정 기록: 개인 정보 없음 (시각, 익명 브라우저 ID, 메뉴 이름, 재료 ID 3개)
create table if not exists confirmations (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  browser_id uuid not null,
  menu_name text not null,
  ingredient_ids text[] not null
);
create index if not exists confirmations_browser_menu_time_idx on confirmations (browser_id, menu_name, created_at);

-- 요청 횟수 제한: 서버리스 함수는 메모리로 셀 수 없어서 DB에 둔다. ip 칸에는 "구분:IP"를 해시한 값이 들어간다(IP 원문 저장 안 함).
create table if not exists rate_limits (
  ip text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip, window_start)
);

-- 목표 1 집계(익명 브라우저 기준 추정치):
--   select count(distinct browser_id) from confirmations;
