package com.randomrecipe.recipe

import kotlin.random.Random

// LLM_PROVIDER=mock 일 때의 예시 생성기. 템플릿이라 "창의적인 AI"가 아니다. 화면에는 "예시 모드"로 표시한다.
// 문장에는 뽑힌 재료만 이름 그대로 넣고, 다른 목록 재료 이름은 쓰지 않는다 (하네스 통과 + "목록 밖 재료 금지").

data class RecipeDraft(val menuName: String, val minutes: Int, val usedIngredientIds: List<String>, val steps: List<String>)

object MockRecipe {
	private val PAIRS = mapOf("은" to ("은" to "는"), "을" to ("을" to "를"), "과" to ("과" to "와"), "로" to ("으로" to "로"))
	private val METHOD = setOf("s-airfryer", "s-oven", "s-steam")
	private val WS = Regex("""\s+""")

	private fun hasBatchim(word: String): Boolean {
		for (i in word.indices.reversed()) {
			val c = word[i]
			if (c in '가'..'힣') return (c - '가') % 28 != 0
			// 영문·숫자로 끝나면 읽는 소리 기준 (JS 판의 [0136-8LMNRlmnr] 와 같은 글자)
			if (c.isLetterOrDigit() && c.code < 128) return c in "013678LMNRlmnr"
		}
		return false
	}

	/** 받침에 따라 조사를 고른다. 예: josa("두부", "은") → "두부는", josa("오븐구이", "로") → "오븐구이로" */
	fun josa(
		word: String,
		kind: String,
	): String {
		val (withB, without) = PAIRS.getValue(kind)
		val c = word.last()
		val rieul = c in '가'..'힣' && (c - '가') % 28 == 8
		return word + if (hasBatchim(word) && !(kind == "로" && rieul)) withB else without
	}

	private fun <T> choose(
		list: List<T>,
		rng: Random,
	) = list[rng.nextInt(list.size)]

	/** picked: 칸 순서 [단백질, 채소·탄수화물, 양념·조리법]. 결과는 AI 응답과 같은 모양. */
	fun generate(
		picked: List<Ingredient>,
		avoidMenuName: String? = null,
		rng: Random = Random.Default,
	): RecipeDraft {
		val (p, c, s) = picked
		val ids = picked.map { it.id }
		var tries = 0
		while (true) {
			val out =
				if (s.id in METHOD) {
					val steam = s.id == "s-steam"
					RecipeDraft(
						menuName = "${s.name} ${p.name} ${c.name} ${if (steam) {
							choose(
								listOf("찜", "스팀 한 접시"),
								rng,
							)
						} else {
							choose(listOf("구이", "한 접시", "플레이트"), rng)
						}}",
						minutes = choose(listOf(15, 20, 25), rng),
						usedIngredientIds = ids,
						steps =
							listOf(
								"${josa(p.name, "은")} 먹기 좋은 크기로 썰고 소금, 후추를 아주 조금만 뿌려 둔다.",
								"${c.name}도 비슷한 크기로 손질한다.",
								"${josa(s.name, "로")} ${josa(p.name, "과")} ${josa(c.name, "을")} 한 번에 ${if (steam) "쪄" else "구워"} 익힌다.",
								if (p.cook) {
									"속까지 완전히 익었는지 꼭 확인한다."
								} else {
									choose(listOf("중간에 한 번 뒤집어 고르게 익힌다.", "속까지 익었는지 확인하고 시간을 조금 더한다."), rng)
								},
								choose(listOf("접시에 담아 따뜻할 때 먹는다.", "그릇에 가지런히 담아 낸다."), rng),
							),
					)
				} else {
					RecipeDraft(
						menuName = "${s.name} ${c.name} ${p.name} ${choose(listOf("볶음", "덮밥 스타일", "한 접시", "스킬렛"), rng)}",
						minutes = choose(listOf(10, 15, 20), rng),
						usedIngredientIds = ids,
						steps =
							listOf(
								"${josa(p.name, "은")} 먹기 좋은 크기로 손질한다.",
								"${c.name}도 한입 크기로 준비한다.",
								if (p.cook) {
									"달군 팬에 ${josa(p.name, "을")} 먼저 넣고 속까지 완전히 익도록 충분히 볶는다."
								} else {
									"달군 팬에 ${josa(p.name, "을")} 먼저 넣고 겉이 익을 때까지 볶는다."
								},
								"${josa(c.name, "을")} 넣고 물을 조금 넣어 약불에서 3분 더 볶는다.",
								choose(listOf("${josa(s.name, "을")} 넣고 고루 섞어 마무리한다.", "마지막에 ${josa(s.name, "을")} 더해 한 번 더 버무린다."), rng),
							),
					)
				}
			// 다시 창조에서 이전과 같은 이름이 나오지 않게 (후보 이름이 몇 개뿐이라 몇 번 더 뽑는다)
			if (avoidMenuName == null || out.menuName.replace(WS, "") != avoidMenuName.replace(WS, "") || tries >= 20) return out
			tries++
		}
	}
}
