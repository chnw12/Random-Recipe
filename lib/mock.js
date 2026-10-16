// LLM_PROVIDER=mock 일 때의 예시 생성기. 템플릿이라 "창의적인 AI"가 아니다. 화면에는 "예시 모드"로 표시한다.
// 문장에는 뽑힌 재료만 이름 그대로 넣고, 다른 목록 재료 이름은 쓰지 않는다 (하네스 통과 + "목록 밖 재료 금지").

function hasBatchim(word) {
  for (let i = word.length - 1; i >= 0; i--) {
    const c = word.charCodeAt(i)
    if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0
    if (/[A-Za-z0-9]/.test(word[i])) return /[0136-8LMNRlmnr]/.test(word[i])
  }
  return false
}
const PAIRS = { 은: ['은', '는'], 을: ['을', '를'], 과: ['과', '와'], 로: ['으로', '로'] }
/** 받침에 따라 조사를 고른다. 예: josa('두부','은') → '두부는', josa('오븐구이','로') → '오븐구이로' */
export function josa(word, kind) {
  const [withB, without] = PAIRS[kind]
  const c = word.charCodeAt(word.length - 1)
  const rieul = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 === 8
  return word + (hasBatchim(word) && !(kind === '로' && rieul) ? withB : without)
}

const METHOD = new Set(['s-airfryer', 's-oven', 's-steam'])
const choose = (list, rng) => list[Math.floor(rng() * list.length)]

/** picked: 칸 순서 [단백질, 채소·탄수화물, 양념·조리법]. 결과는 AI 응답과 같은 모양의 객체. */
export function mockRecipe(picked, { avoidMenuName, rng = Math.random } = {}) {
  const [p, c, s] = picked
  const ids = picked.map((x) => x.id)
  const norm = (v) => v.replace(/\s+/g, '')
  for (let tries = 0; ; tries++) {
    let out
    if (METHOD.has(s.id)) {
      const steam = s.id === 's-steam'
      out = {
        menuName: `${s.name} ${p.name} ${c.name} ${steam ? choose(['찜', '스팀 한 접시'], rng) : choose(['구이', '한 접시', '플레이트'], rng)}`,
        minutes: choose([15, 20, 25], rng),
        usedIngredientIds: ids,
        steps: [
          `${josa(p.name, '은')} 먹기 좋은 크기로 썰고 소금, 후추를 아주 조금만 뿌려 둔다.`,
          `${c.name}도 비슷한 크기로 손질한다.`,
          `${josa(s.name, '로')} ${josa(p.name, '과')} ${josa(c.name, '을')} 한 번에 ${steam ? '쪄' : '구워'} 익힌다.`,
          choose(['중간에 한 번 뒤집어 고르게 익힌다.', '속까지 익었는지 확인하고 시간을 조금 더한다.'], rng),
          choose(['접시에 담아 따뜻할 때 먹는다.', '그릇에 가지런히 담아 낸다.'], rng)
        ]
      }
    } else {
      out = {
        menuName: `${s.name} ${c.name} ${p.name} ${choose(['볶음', '덮밥 스타일', '한 접시', '스킬렛'], rng)}`,
        minutes: choose([10, 15, 20], rng),
        usedIngredientIds: ids,
        steps: [
          `${josa(p.name, '은')} 먹기 좋은 크기로 손질한다.`,
          `${c.name}도 한입 크기로 준비한다.`,
          `달군 팬에 ${josa(p.name, '을')} 먼저 넣고 겉이 익을 때까지 볶는다.`,
          `${josa(c.name, '을')} 넣고 물을 조금 넣어 약불에서 3분 더 볶는다.`,
          choose([`${josa(s.name, '을')} 넣고 고루 섞어 마무리한다.`, `마지막에 ${josa(s.name, '을')} 더해 한 번 더 버무린다.`], rng)
        ]
      }
    }
    // 다시 창조에서 이전과 같은 이름이 나오지 않게 (후보 이름이 몇 개뿐이라 몇 번 더 뽑는다)
    if (!avoidMenuName || norm(out.menuName) !== norm(avoidMenuName) || tries >= 20) return out
  }
}
