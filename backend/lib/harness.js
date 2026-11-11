// 하네스: AI 결과 검사. 기획서 "서버가 JSON 형식, 재료 3개 사용, 목록 밖 재료, 칼로리 표현을 검사해 걸리면 실패 처리".
import { INGREDIENTS, getIngredient } from './ingredients.js'

// 칼로리/영양 수치 + 효과 단정(화면 명세: "살이 빠진다는 효과 문구" 금지)
const BANNED = /kcal|킬로칼로리|칼로리|열량|\bcal\b|영양\s*성분|영양소|단백질\s*\d|탄수화물\s*\d|살\s*(이\s*)?(빠|빼|뺄)|체중|감량|체지방|지방\s*(연소|분해)|효과|다이어트\s*(성공|효능)/i

const norm = (s) => s.replace(/\s+/g, '')
const termsOf = (i) => [i.name, ...(i.aliases ?? [])].map(norm)
// 조리 순서 길이: 한 화면에 레시피가 한눈에 들어오는 길이
export const STEPS_MIN = 3
export const STEPS_MAX = 6
export const STEP_MAX_CHARS = 70

// 날생선·해산물(cook: true)을 쓰면 가열해서 익히는 단계가 있어야 하고, 날것으로 먹는 조리법은 안 된다
const HEAT = /익히|익혀|익도록|익을|익었|굽|구워|볶|삶|찌|쪄|끓|데치|튀기|튀겨|가열|졸이/
const RAW_STYLE = /날것|날로|생으로|회로|회처럼|사시미|초밥|세비체|타르타르|카르파초|육회|덜\s*익/

const isStr = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max

export const hasBannedWording = (text) => BANNED.test(text)

/** 'JSON만 답하라'를 어긴 응답(코드블록, 앞뒤 설명)도 견디도록 첫 JSON 객체를 꺼낸다. 실패하면 null. */
export function parseJsonLoose(raw) {
  if (typeof raw !== 'string') return null
  const t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(t)
  } catch {
    /* 아래에서 중괄호 구간을 시도 */
  }
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try {
    return JSON.parse(t.slice(a, b + 1))
  } catch {
    return null
  }
}

/**
 * 공백을 지운 텍스트에서 "가장 긴 이름부터" 맞춰 읽어 재료별 언급을 센다.
 * ("순두부"는 "두부"가 아니라 순두부 하나로 읽는다. "가지런히"는 가지가 아니다.)
 * 한 글자 별칭(예: 찜)은 다른 낱말에 섞여 오탐하므로 뽑힌 재료(own)일 때만 인정한다.
 */
function scanMentions(text, own) {
  let t = norm(text)
  for (const ing of INGREDIENTS) for (const g of ing.guard ?? []) t = t.split(norm(g)).join('·'.repeat(norm(g).length))
  const entries = INGREDIENTS.flatMap((ing) => termsOf(ing).filter((x) => x.length >= 2 || own.has(ing.id)).map((term) => ({ term, id: ing.id }))).sort((a, b) => b.term.length - a.term.length)
  const found = new Set()
  for (let i = 0; i < t.length; ) {
    const hit = entries.find((e) => t.startsWith(e.term, i))
    if (hit) {
      found.add(hit.id)
      i += hit.term.length
    } else i++
  }
  return found
}

/** 뽑히지 않은 목록 재료의 이름들 (기본 재료 물/소금/후추는 목록에 없으므로 해당 없음) */
export function mentionedOutsiders(text, picked) {
  const own = new Set(picked.map((p) => p.id))
  return [...scanMentions(text, own)].filter((id) => !own.has(id)).map((id) => getIngredient(id).name)
}

/**
 * 메뉴 만들기 응답 검사. 성공이면 { ok: true, recipe }, 아니면 { ok: false, reason }.
 * 기대 형식: { menuName, minutes, usedIngredientIds: [3개], steps: [3~8개] } (재료 양은 서버가 채우므로 AI는 쓰지 않는다)
 */
export function checkRecipe(data, picked, { avoidMenuName } = {}) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, reason: 'JSON 객체가 아님' }
  if (!isStr(data.menuName, 40)) return { ok: false, reason: 'menuName 없음/너무 김' }
  const minutes = Number(data.minutes)
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) return { ok: false, reason: 'minutes 범위 오류' }
  const want = picked.map((p) => p.id).sort()
  const got = Array.isArray(data.usedIngredientIds) ? data.usedIngredientIds.map(String).sort() : null
  if (!got || got.join() !== want.join()) return { ok: false, reason: 'usedIngredientIds가 뽑은 재료 3개와 다름' }
  const steps = data.steps
  if (!Array.isArray(steps) || steps.length < STEPS_MIN || steps.length > STEPS_MAX || !steps.every((s) => isStr(s, STEP_MAX_CHARS))) {
    return { ok: false, reason: `steps는 ${STEPS_MIN}~${STEPS_MAX}개, 각 ${STEP_MAX_CHARS}자 이하의 짧은 문장이어야 함` }
  }
  const text = [data.menuName, ...steps].join(' ')
  if (hasBannedWording(text)) return { ok: false, reason: '칼로리/효과 표현 포함' }
  const used = scanMentions(text, new Set(want))
  for (const p of picked) if (!used.has(p.id)) return { ok: false, reason: `${p.name}이(가) 메뉴/조리 순서에 쓰이지 않음` }
  const outsiders = mentionedOutsiders(text, picked)
  if (outsiders.length) return { ok: false, reason: `뽑지 않은 재료 언급: ${outsiders.join(', ')}` }
  const raw = picked.filter((p) => p.cook)
  if (raw.length) {
    const names = raw.map((p) => p.name).join(', ')
    if (RAW_STYLE.test(text)) return { ok: false, reason: `${names}은(는) 날것으로 먹는 조리법이면 안 됨` }
    if (!HEAT.test(steps.join(' '))) return { ok: false, reason: `${names}을(를) 속까지 익히는 단계가 없음` }
  }
  if (avoidMenuName && norm(data.menuName) === norm(avoidMenuName)) return { ok: false, reason: '이전 메뉴와 같은 이름' }
  return { ok: true, recipe: { menuName: data.menuName.trim(), minutes: Math.round(minutes), usedIngredientIds: want, steps: steps.map((s) => s.trim()) } }
}
