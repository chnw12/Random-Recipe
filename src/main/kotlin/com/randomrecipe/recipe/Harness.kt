package com.randomrecipe.recipe

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper

// 하네스: AI 결과 검사. JSON 형식, 재료 3개 사용, 목록 밖 재료, 칼로리·효과 표현, 날생선 익히기를 검사해 걸리면 실패 처리.
// 검사를 완화하지 않는다. 오탐이 나면 재료 데이터(aliases, guard)를 고치고 테스트를 더한다.

data class CheckedRecipe(val menuName: String, val minutes: Int, val usedIngredientIds: List<String>, val steps: List<String>)

sealed interface CheckResult {
	data class Ok(val recipe: CheckedRecipe) : CheckResult

	data class Fail(val reason: String) : CheckResult
}

object Harness {
	// 조리 순서 길이: 한 화면에 레시피가 한눈에 들어오는 길이 (Prompt 의 규칙 문장과 같이 바꾼다)
	const val STEPS_MIN = 3
	const val STEPS_MAX = 6
	const val STEP_MAX_CHARS = 70

	// 칼로리/영양 수치 + 효과 단정 ("살이 빠진다는 효과 문구" 금지)
	private val BANNED =
		Regex(
			"""kcal|킬로칼로리|칼로리|열량|\bcal\b|영양\s*성분|영양소|단백질\s*\d|탄수화물\s*\d|살\s*(이\s*)?(빠|빼|뺄)|체중|감량|체지방|지방\s*(연소|분해)|효과|다이어트\s*(성공|효능)""",
			RegexOption.IGNORE_CASE,
		)

	// 날생선·해산물(cook)을 쓰면 가열해서 익히는 단계가 있어야 하고, 날것으로 먹는 조리법은 안 된다
	private val HEAT = Regex("익히|익혀|익도록|익을|익었|굽|구워|볶|삶|찌|쪄|끓|데치|튀기|튀겨|가열|졸이")
	private val RAW_STYLE = Regex("""날것|날로|생으로|회로|회처럼|사시미|초밥|세비체|타르타르|카르파초|육회|덜\s*익""")
	private val WS = Regex("""\s+""")
	private val mapper = ObjectMapper()

	private fun norm(s: String) = s.replace(WS, "")

	private fun termsOf(i: Ingredient) = (listOf(i.name) + i.aliases).map(::norm)

	fun hasBannedWording(text: String) = BANNED.containsMatchIn(text)

	/** 'JSON만 답하라'를 어긴 응답(코드블록, 앞뒤 설명)도 견디도록 첫 JSON 객체를 꺼낸다. 실패하면 null. */
	fun parseJsonLoose(raw: String?): JsonNode? {
		if (raw == null) return null
		val t = raw.trim().replace(Regex("""^```(?:json)?\s*""", RegexOption.IGNORE_CASE), "").replace(Regex("""```\s*$"""), "")
		runCatching { return mapper.readTree(t) }
		val a = t.indexOf('{')
		val b = t.lastIndexOf('}')
		if (a < 0 || b <= a) return null
		return runCatching { mapper.readTree(t.substring(a, b + 1)) }.getOrNull()
	}

	/**
	 * 공백을 지운 텍스트에서 "가장 긴 이름부터" 맞춰 읽어 재료별 언급을 센다.
	 * ("순두부"는 "두부"가 아니라 순두부 하나로 읽는다. "가지런히"는 가지가 아니다.)
	 * 한 글자 별칭(예: 찜)은 다른 낱말에 섞여 오탐하므로 뽑힌 재료(own)일 때만 인정한다.
	 */
	private fun scanMentions(
		text: String,
		own: Set<String>,
	): Set<String> {
		var t = norm(text)
		for (ing in Ingredients.ALL) for (g in ing.guard) t = t.replace(norm(g), "·".repeat(norm(g).length))
		val entries =
			Ingredients.ALL
				.flatMap { ing -> termsOf(ing).filter { it.length >= 2 || ing.id in own }.map { it to ing.id } }
				.sortedByDescending { it.first.length }
		val found = linkedSetOf<String>()
		var i = 0
		while (i < t.length) {
			val hit = entries.firstOrNull { t.startsWith(it.first, i) }
			if (hit != null) {
				found += hit.second
				i += hit.first.length
			} else {
				i++
			}
		}
		return found
	}

	/** 뽑히지 않은 목록 재료의 이름들 (기본 재료 물/소금/후추는 목록에 없으므로 해당 없음) */
	fun mentionedOutsiders(
		text: String,
		picked: List<Ingredient>,
	): List<String> {
		val own = picked.map { it.id }.toSet()
		return scanMentions(text, own).filter { it !in own }.map { Ingredients.get(it)!!.name }
	}

	private fun str(
		n: JsonNode?,
		max: Int,
	): String? = n?.takeIf { it.isTextual }?.asText()?.takeIf { it.isNotBlank() && it.length <= max }

	/**
	 * 메뉴 만들기 응답 검사.
	 * 기대 형식: { menuName, minutes, usedIngredientIds: [3개], steps: [3~6개] } (재료 양은 서버가 채우므로 AI는 쓰지 않는다)
	 */
	fun checkRecipe(
		data: JsonNode?,
		picked: List<Ingredient>,
		avoidMenuName: String? = null,
	): CheckResult {
		if (data == null || !data.isObject) return CheckResult.Fail("JSON 객체가 아님")
		val menuName = str(data["menuName"], 40) ?: return CheckResult.Fail("menuName 없음/너무 김")
		val minutes = minutesOf(data["minutes"])
		if (minutes == null || minutes < 1 || minutes > 180) return CheckResult.Fail("minutes 범위 오류")
		val want = picked.map { it.id }.sorted()
		val usedNode = data["usedIngredientIds"]
		val got = if (usedNode != null && usedNode.isArray) usedNode.map { it.asText() }.sorted() else null
		if (got != want) return CheckResult.Fail("usedIngredientIds가 뽑은 재료 3개와 다름")
		val stepsNode = data["steps"]
		val steps = if (stepsNode != null && stepsNode.isArray) stepsNode.map { str(it, STEP_MAX_CHARS) } else null
		if (steps == null || steps.size < STEPS_MIN || steps.size > STEPS_MAX || steps.any { it == null }) {
			return CheckResult.Fail("steps는 ${STEPS_MIN}~${STEPS_MAX}개, 각 ${STEP_MAX_CHARS}자 이하의 짧은 문장이어야 함")
		}
		val okSteps = steps.filterNotNull()
		val text = (listOf(menuName) + okSteps).joinToString(" ")
		if (hasBannedWording(text)) return CheckResult.Fail("칼로리/효과 표현 포함")
		val used = scanMentions(text, want.toSet())
		for (p in picked) if (p.id !in used) return CheckResult.Fail("${p.name}이(가) 메뉴/조리 순서에 쓰이지 않음")
		val outsiders = mentionedOutsiders(text, picked)
		if (outsiders.isNotEmpty()) return CheckResult.Fail("뽑지 않은 재료 언급: ${outsiders.joinToString(", ")}")
		val raw = picked.filter { it.cook }
		if (raw.isNotEmpty()) {
			val names = raw.joinToString(", ") { it.name }
			if (RAW_STYLE.containsMatchIn(text)) return CheckResult.Fail("${names}은(는) 날것으로 먹는 조리법이면 안 됨")
			if (!HEAT.containsMatchIn(okSteps.joinToString(" "))) return CheckResult.Fail("${names}을(를) 속까지 익히는 단계가 없음")
		}
		if (avoidMenuName != null && norm(menuName) == norm(avoidMenuName)) return CheckResult.Fail("이전 메뉴와 같은 이름")
		return CheckResult.Ok(CheckedRecipe(menuName.trim(), Math.round(minutes).toInt(), want, okSteps.map { it.trim() }))
	}

	// JS 의 Number(x) 처럼 숫자 또는 숫자 문자열을 받는다
	private fun minutesOf(n: JsonNode?): Double? =
		when {
			n == null || n.isNull -> null
			n.isNumber -> n.asDouble()
			n.isTextual -> n.asText().trim().toDoubleOrNull()
			else -> null
		}?.takeIf { it.isFinite() }
}
