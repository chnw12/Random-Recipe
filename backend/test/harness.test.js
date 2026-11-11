import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRecipe, hasBannedWording, mentionedOutsiders, parseJsonLoose } from '../lib/harness.js'
import { INGREDIENTS, SLOTS, bySlot, drawThree, getIngredient, resolveTriple } from '../lib/ingredients.js'
import { josa, mockRecipe } from '../lib/mock.js'
import { GOOD_RECIPE, TRIPLE } from './util.js'

const ids = (...n) => n.map((x) => getIngredient(x))
const picked = ids(...TRIPLE)
const good = (extra = {}) => ({ ...GOOD_RECIPE, ...extra })

test('재료 목록: 칸마다 20개, id·이름 중복 없음, 공공데이터 코드는 비어 있음', () => {
  for (const s of SLOTS) assert.equal(bySlot(s.id).length, 20)
  assert.equal(new Set(INGREDIENTS.map((i) => i.id)).size, 60)
  assert.equal(new Set(INGREDIENTS.map((i) => i.name)).size, 60)
  assert.ok(INGREDIENTS.every((i) => i.publicCode === null))
})

test('하네스: 정상 결과 통과', () => {
  const r = checkRecipe(good(), picked)
  assert.equal(r.ok, true)
  assert.deepEqual(r.recipe.usedIngredientIds, [...TRIPLE].sort())
})

test('하네스: 재료 누락 (3개 중 하나라도 안 쓰면 실패)', () => {
  const r = checkRecipe(good({ menuName: '두부 양배추 볶음', steps: ['두부를 볶는다.', '양배추를 넣는다.', '접시에 담는다.'] }), picked)
  assert.equal(r.ok, false)
  assert.match(r.reason, /카레가루/)
})

test('하네스: 목록 밖 재료 (뽑지 않은 목록 재료를 쓰면 실패, 기본 재료는 허용)', () => {
  assert.equal(checkRecipe(good({ steps: ['두부를 볶는다.', '양배추를 넣는다.', '간장을 넣고 카레가루를 섞는다.'] }), picked).ok, false)
  assert.equal(checkRecipe(good({ steps: ['두부를 볶는다.', '양배추를 넣고 물을 조금 붓는다.', '소금, 후추, 카레가루로 간한다.'] }), picked).ok, true)
})

test('하네스: 순두부 ≠ 두부 (양방향)', () => {
  // 두부를 뽑았는데 순두부를 쓰면 실패
  const r1 = checkRecipe(good({ steps: ['순두부를 넣는다.', '양배추와 두부를 볶는다.', '카레가루를 넣는다.'] }), picked)
  assert.equal(r1.ok, false)
  assert.match(r1.reason, /순두부/)
  // 순두부를 뽑았는데 그냥 두부만 쓰면 순두부가 쓰이지 않은 것
  const soft = ids('p-soft-tofu', 'c-cabbage', 's-curry')
  const r2 = checkRecipe({ menuName: '두부 양배추 카레', minutes: 10, usedIngredientIds: soft.map((x) => x.id), steps: ['두부를 볶는다.', '양배추를 넣는다.', '카레가루를 넣는다.'] }, soft)
  assert.equal(r2.ok, false)
  // 순두부를 뽑고 순두부를 쓰면 통과 (두부로 오탐하지 않음)
  const r3 = checkRecipe({ menuName: '순두부 양배추 카레', minutes: 10, usedIngredientIds: soft.map((x) => x.id), steps: ['순두부를 데운다.', '양배추를 넣는다.', '카레가루를 넣는다.'] }, soft)
  assert.equal(r3.ok, true)
})

test('하네스: "가지런히", "여러 가지"는 가지(채소)로 오인하지 않는다', () => {
  assert.deepEqual(mentionedOutsiders('접시에 가지런히 담고 여러 가지 방법으로 먹는다', picked), [])
  assert.deepEqual(mentionedOutsiders('가지를 굽는다', picked), ['가지'])
})

test('하네스: 금지 표현 (칼로리/열량/효과/감량)', () => {
  for (const t of ['약 300kcal의', '칼로리가 낮아요', '열량 걱정 없는', '살이 빠지는', '체중 감량에 좋은', '다이어트 효과', '체지방 분해']) {
    assert.equal(hasBannedWording(t), true, t)
    assert.equal(checkRecipe(good({ menuName: `${t} 두부 양배추 카레가루` }), picked).ok, false, t)
  }
  assert.equal(hasBannedWording('가볍게 볶아 먹는 두부 요리'), false)
})

test('하네스: 형식 오류', () => {
  for (const bad of [null, 'text', [], {}, good({ menuName: '' }), good({ menuName: 'x'.repeat(41) }), good({ minutes: 'x' }), good({ minutes: 0 }), good({ minutes: 999 }),
    good({ steps: ['하나', '둘'] }), good({ steps: Array(9).fill('두부 양배추 카레가루') }), good({ steps: ['두부', 5, '양배추'] }), good({ usedIngredientIds: ['p-tofu', 'c-cabbage', 's-lemon'] }),
    good({ usedIngredientIds: 'p-tofu' }), good({ usedIngredientIds: TRIPLE.slice(0, 2) })]) {
    assert.equal(checkRecipe(bad, picked).ok, false, JSON.stringify(bad)?.slice(0, 60))
  }
})

test('하네스: 별칭 인정 (양송이→양송이버섯, 요거트→그릭요거트)', () => {
  const p = ids('p-greek-yogurt', 'c-mushroom', 's-lemon')
  const r = checkRecipe({ menuName: '레몬 요거트 양송이 볼', minutes: 5, usedIngredientIds: p.map((x) => x.id), steps: ['요거트를 담는다.', '양송이를 얇게 썬다.', '레몬을 짜서 올린다.'] }, p)
  assert.equal(r.ok, true)
})

test('하네스: 다시 창조에서 이전과 같은 이름이면 실패', () => {
  assert.equal(checkRecipe(good(), picked, { avoidMenuName: '카레향 두부 양배추 볶음' }).ok, false)
  assert.equal(checkRecipe(good(), picked, { avoidMenuName: '다른 이름' }).ok, true)
})

test('JSON 느슨한 파싱: 코드블록/앞뒤 설명', () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(parseJsonLoose('결과입니다 {"a":1} 끝'), { a: 1 })
  assert.equal(parseJsonLoose('아무 말'), null)
  assert.equal(parseJsonLoose('{깨진'), null)
  assert.equal(parseJsonLoose(undefined), null)
})

test('mock 생성기: 재료 3개의 모든 조합(8,000가지) × 2회가 하네스를 통과한다', () => {
  let bad = 0
  const sample = []
  for (const p of bySlot('protein')) for (const c of bySlot('carb')) for (const s of bySlot('sauce')) {
    const t = [p, c, s]
    for (let k = 0; k < 2; k++) {
      const r = checkRecipe(mockRecipe(t), t)
      if (!r.ok) { bad++; if (sample.length < 5) sample.push(`${p.name}+${c.name}+${s.name}: ${r.reason}`) }
    }
  }
  assert.deepEqual(sample, [])
  assert.equal(bad, 0)
})

test('mock 생성기: 다시 창조(avoidMenuName)는 다른 이름을 낸다, 조사도 맞다', () => {
  const t = ids('p-tofu', 'c-cabbage', 's-curry')
  for (let i = 0; i < 30; i++) {
    const first = mockRecipe(t)
    assert.notEqual(mockRecipe(t, { avoidMenuName: first.menuName }).menuName, first.menuName)
  }
  assert.equal(josa('두부', '은'), '두부는')
  assert.equal(josa('연어', '을'), '연어를')
  assert.equal(josa('스팀 찜', '로'), '스팀 찜으로')
  assert.equal(josa('오븐구이', '로'), '오븐구이로')
  assert.doesNotMatch(JSON.stringify(mockRecipe(t)), /은\(는\)|을\(를\)/)
})

test('뽑기: 칸마다 하나, 칸 순서(단백질·채소·양념), 난수 주입으로 결정적', () => {
  for (let n = 0; n < 100; n++) assert.deepEqual(drawThree().picked.map((x) => x.slot), ['protein', 'carb', 'sauce'])
  assert.deepEqual(drawThree(() => 0).picked.map((x) => x.id), ['p-chicken-breast', 'c-broccoli', 's-perilla-oil'])
  assert.deepEqual(drawThree(() => 0.999).picked.map((x) => x.id), ['p-mussel', 'c-lettuce', 's-mustard'])
  // 모든 재료가 뽑힐 수 있다
  const seen = new Set()
  for (let i = 0; i < 20; i++) for (const p of drawThree(() => i / 20).picked) seen.add(p.id)
  assert.equal(seen.size, 60)
})

test('조리 순서 길이: 3~6단계, 각 70자 이하', () => {
  const picked = ids(...TRIPLE)
  const ok = (steps) => checkRecipe({ ...GOOD_RECIPE, steps }, picked).ok
  const line = '두부와 양배추를 볶고 카레가루를 넣는다.'
  assert.equal(ok(Array(2).fill(line)), false)
  assert.equal(ok(Array(3).fill(line)), true)
  assert.equal(ok(Array(6).fill(line)), true)
  assert.equal(ok(Array(7).fill(line)), false)
  const head = '두부 양배추 카레가루를 '
  const withLen = (n) => head + '가'.repeat(n - head.length)
  assert.equal(withLen(70).length, 70)
  assert.equal(ok([withLen(70), line, line]), true) // 정확히 70자는 허용
  assert.equal(ok([withLen(71), line, line]), false) // 71자는 거절
})

test('날생선·해산물 익히기: 가열 단계가 있어야 하고 날것 조리법은 거절', () => {
  const salmon = ids('p-salmon', 'c-cabbage', 's-lemon')
  const mk = (steps, menuName = '레몬 연어 양배추 요리') => ({ menuName, minutes: 15, usedIngredientIds: salmon.map((x) => x.id), steps })
  // 가열 단계 있음 → 통과
  assert.equal(checkRecipe(mk(['연어를 먹기 좋게 썬다.', '양배추를 손질한다.', '팬에 연어를 속까지 익도록 굽는다.', '레몬을 짜서 올린다.']), salmon).ok, true)
  // 가열 단계 없음 → 실패
  const noHeat = checkRecipe(mk(['연어를 먹기 좋게 썬다.', '양배추를 채 썬다.', '접시에 담고 레몬을 짜서 올린다.']), salmon)
  assert.equal(noHeat.ok, false)
  assert.match(noHeat.reason, /익히는 단계/)
  // 날것 조리법 → 실패 (가열 단계가 같이 있어도)
  for (const raw of ['연어를 날로 얇게 썰어 올린다.', '연어를 생으로 레몬에 재운다.', '연어 세비체처럼 버무린다.', '연어 타르타르를 만든다.']) {
    assert.equal(checkRecipe(mk(['양배추를 볶는다.', raw, '레몬을 짜서 올린다.']), salmon).ok, false, raw)
  }
  // 해당 없는 재료(두부)는 가열 단계가 없어도 된다
  assert.equal(checkRecipe(good({ steps: ['두부를 썬다.', '양배추를 썬다.', '카레가루를 뿌려 섞는다.'] }), picked).ok, true)
})

test('날생선·해산물 표시: 7개(연어, 대구살, 삼치, 오징어, 새우, 가리비 관자, 홍합살)만 cook', () => {
  assert.deepEqual(INGREDIENTS.filter((i) => i.cook).map((i) => i.name).sort(), ['가리비 관자', '대구살', '삼치', '새우', '연어', '오징어', '홍합살'].sort())
})

test('mock 생성기: 날생선·해산물 조합은 "속까지 익히는" 문장을 넣는다', () => {
  for (const p of bySlot('protein').filter((x) => x.cook)) for (const s of ['s-curry', 's-oven', 's-steam']) {
    const t = [p, getIngredient('c-cabbage'), getIngredient(s)]
    const r = mockRecipe(t)
    assert.match(r.steps.join(' '), /속까지 완전히/, `${p.name}+${s}`)
    assert.equal(checkRecipe(r, t).ok, true)
  }
})

test('resolveTriple: 목록 밖/칸 중복/개수 오류를 거부하고 칸 순서로 정렬', () => {
  assert.deepEqual(resolveTriple(['s-curry', 'p-tofu', 'c-cabbage']).map((i) => i.id), TRIPLE)
  for (const bad of [['p-tofu', 'p-egg', 's-curry'], ['p-tofu', 'c-cabbage', 'x'], ['p-tofu', 'c-cabbage'], 'p-tofu', null, [1, 2, 3], ['p-tofu', 'p-tofu', 'p-tofu']]) assert.equal(resolveTriple(bad), null)
})
