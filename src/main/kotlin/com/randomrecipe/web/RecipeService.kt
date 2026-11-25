package com.randomrecipe.web

import com.randomrecipe.ai.LlmClient
import com.randomrecipe.ai.LlmErrorKind
import com.randomrecipe.ai.LlmException
import com.randomrecipe.recipe.CheckResult
import com.randomrecipe.recipe.Harness
import com.randomrecipe.recipe.Ingredient
import com.randomrecipe.recipe.Prompt
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.Duration
import java.time.Instant

data class IngredientOut(val id: String, val name: String, val amount: String)

data class CreateOut(
	val menuName: String,
	val minutes: Int,
	val servings: Int,
	val ingredients: List<IngredientOut>,
	val steps: List<String>,
	// 식약처 레시피(COOKRCP01) 연결은 보류 → 항상 빈 목록
	val references: List<Any>,
	val mode: String,
)

data class ConfirmOut(val ok: Boolean, val recorded: Boolean)

/**
 * 창조(다시 창조)와 확정 기록. 순서와 제한은 Node 버전과 같다.
 * create: 요청 횟수 → 설정 점검 → AI 호출 → 하네스 검사(실패 시 남은 시간 ≥ 1.5초면 1번 재요청). 재시도 포함 전체 14초.
 * confirm: 요청 횟수 → 같은 browserId+메뉴가 10분 안에 있으면 409 → DB 저장.
 * (입력 형식 검사는 컨트롤러가 먼저 한다)
 */
@Service
class RecipeService(
	private val llm: LlmClient,
	private val rate: RateLimiter,
	private val confirms: ConfirmRepository,
	@Value("\${app.create.deadline-ms:14000}") private val deadlineMs: Long,
	@Value("\${app.create.retry-min-remaining-ms:1500}") private val retryMinRemainingMs: Long,
) {
	var clock: () -> Long = System::currentTimeMillis

	fun create(
		picked: List<Ingredient>,
		avoidMenuName: String?,
		ip: String,
	): CreateOut {
		limit(ip, "create", CREATE_LIMIT)
		val cfg =
			try {
				llm.config()
			} catch (e: LlmException) {
				throw notConfigured(e)
			}

		val t0 = clock()
		var retryReason: String? = null
		var lastReason = ""
		for (attempt in 0..1) {
			val prompt = Prompt.recipe(picked, avoidMenuName, retryReason)
			val text =
				try {
					llm.call(prompt, picked, avoidMenuName, Duration.ofMillis(deadlineMs - (clock() - t0)))
				} catch (e: LlmException) {
					// 종류와 HTTP 상태만. 키·응답 원문은 남기지 않는다.
					SafeLog.warn("create", mapOf("kind" to e.kind.name.lowercase(), "status" to e.status))
					if (e.kind == LlmErrorKind.NOT_CONFIGURED) throw notConfigured(e)
					throw ApiException(ErrorCode.AI_FAILED, AI_MESSAGES.getValue(e.kind))
				}
			when (val chk = Harness.checkRecipe(Harness.parseJsonLoose(text), picked, avoidMenuName)) {
				is CheckResult.Ok ->
					return CreateOut(
						menuName = chk.recipe.menuName,
						minutes = chk.recipe.minutes,
						servings = 1,
						// 재료의 양은 AI가 아니라 서버가 정한다
						ingredients = picked.map { IngredientOut(it.id, it.name, it.amount) },
						steps = chk.recipe.steps,
						references = emptyList(),
						mode = cfg.mode,
					)
				is CheckResult.Fail -> {
					lastReason = chk.reason
					val remaining = deadlineMs - (clock() - t0)
					if (attempt == 0 && remaining >= retryMinRemainingMs) {
						retryReason = chk.reason
					} else {
						break
					}
				}
			}
		}
		SafeLog.warn("create", mapOf("kind" to "rule_failed", "reason" to lastReason))
		throw ApiException(ErrorCode.RULE_FAILED)
	}

	fun confirm(
		browserId: String,
		menuName: String,
		picked: List<Ingredient>,
		ip: String,
	): ConfirmOut {
		limit(ip, "confirm", CONFIRM_LIMIT)
		val now = Instant.ofEpochMilli(clock())
		try {
			if (confirms.existsSince(browserId, menuName, now.minusMillis(DUPLICATE_WINDOW_MS))) throw ApiException(ErrorCode.DUPLICATE)
			confirms.insert(browserId, menuName, picked.map { it.id }, now)
		} catch (e: ApiException) {
			throw e
		} catch (e: Exception) {
			// DB 오류 원문(연결 주소가 섞일 수 있음)은 남기지 않는다
			SafeLog.warn("confirm", mapOf("kind" to "record_failed", "type" to e.javaClass.simpleName))
			throw ApiException(ErrorCode.RECORD_FAILED)
		}
		return ConfirmOut(ok = true, recorded = true)
	}

	private fun limit(
		ip: String,
		bucket: String,
		limit: Int,
	) {
		val r = rate.hit(ip, bucket, limit, WINDOW_MS)
		if (!r.allowed) throw ApiException(ErrorCode.RATE_LIMITED, retryAfterSec = r.retryAfterSec)
	}

	private fun notConfigured(e: LlmException) = ApiException(ErrorCode.NOT_CONFIGURED, "서버 설정이 필요해요: ${e.hint ?: "LLM_PROVIDER"} (.env 확인)")

	companion object {
		const val WINDOW_MS = 10 * 60_000L
		const val CREATE_LIMIT = 20
		const val CONFIRM_LIMIT = 30
		const val DUPLICATE_WINDOW_MS = 10 * 60_000L

		val AI_MESSAGES =
			mapOf(
				LlmErrorKind.TIMEOUT to "AI 응답이 너무 오래 걸려요(14초 초과). 다시 시도해 주세요.",
				LlmErrorKind.NETWORK to "AI 서버에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.",
				LlmErrorKind.UPSTREAM to "AI 호출에 실패했어요. 잠시 뒤에 다시 시도해 주세요.",
				LlmErrorKind.NOT_CONFIGURED to "AI 호출에 실패했어요. 잠시 뒤에 다시 시도해 주세요.",
			)
	}
}
