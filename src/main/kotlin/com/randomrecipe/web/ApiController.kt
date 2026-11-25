package com.randomrecipe.web

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.randomrecipe.ai.LlmClient
import com.randomrecipe.ai.LlmException
import com.randomrecipe.recipe.Ingredients
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

// React 화면이 부르는 API. 요청·응답 형식은 Node 버전(/api/*)과 같다.
// 새 엔드포인트도 같은 순서(형식 검사 → 요청 횟수 → 처리)와 오류 형식 { error, message } 를 따른다.
@RestController
class ApiController(
	private val service: RecipeService,
	private val llm: LlmClient,
	private val confirms: ConfirmRepository,
	private val mapper: ObjectMapper,
) {
	@GetMapping("/api/ingredients")
	fun ingredients() =
		mapOf(
			"slots" to Ingredients.SLOTS,
			"ingredients" to Ingredients.ALL.map { mapOf("id" to it.id, "name" to it.name, "slot" to it.slot, "amount" to it.amount) },
		)

	/** 창조 / 다시 창조. 요청 { ingredientIds: [3개], avoidMenuName?: 이전 메뉴 이름(40자 이하) } */
	@PostMapping("/api/create")
	fun create(
		@RequestBody(required = false) raw: JsonNode?,
		req: HttpServletRequest,
	): CreateOut {
		val body = objectBody(raw)
		val picked = Ingredients.resolveTriple(stringList(body["ingredientIds"])) ?: throw ApiException(ErrorCode.INVALID_INGREDIENTS)
		var avoidMenuName: String? = null
		if (body.has("avoidMenuName")) {
			val a = body["avoidMenuName"]
			if (!a.isTextual || a.asText().isBlank() || a.asText().length > 40) throw ApiException(ErrorCode.INVALID_REQUEST)
			avoidMenuName = a.asText().trim()
		}
		return service.create(picked, avoidMenuName, RateLimiter.clientIp(req))
	}

	/** 확정 기록. 요청 { browserId(UUID), menuName(1~40자), ingredientIds }. 화면은 응답을 기다리지 않는다. */
	@PostMapping("/api/confirm")
	fun confirm(
		@RequestBody(required = false) raw: JsonNode?,
		req: HttpServletRequest,
	): ConfirmOut {
		val body = objectBody(raw)
		val browserId = body["browserId"]?.takeIf { it.isTextual }?.asText()
		val menuName = body["menuName"]?.takeIf { it.isTextual }?.asText()?.trim() ?: ""
		if (browserId == null || !UUID.matches(browserId)) throw ApiException(ErrorCode.INVALID_REQUEST)
		if (menuName.isEmpty() || menuName.length > 40) throw ApiException(ErrorCode.INVALID_REQUEST)
		val picked = Ingredients.resolveTriple(stringList(body["ingredientIds"])) ?: throw ApiException(ErrorCode.INVALID_INGREDIENTS)
		return service.confirm(browserId, menuName, picked, RateLimiter.clientIp(req))
	}

	/** 화면용 연결 확인 (Node 버전과 같은 모양). 비밀 값 없이 설정 여부만 알려 준다. */
	@GetMapping("/api/health")
	fun apiHealth(): Map<String, Any?> = mapOf("ok" to true, "mode" to aiMode().takeIf { it != "not_configured" }, "db" to confirms.ping())

	/** 수업 배포용 상태 확인: status=ok 와 database=up 이어야 배포 워크플로가 통과한다. */
	@GetMapping("/common/health")
	fun commonHealth(): ResponseEntity<Map<String, String>> {
		val dbUp = confirms.ping()
		val out = mapOf("status" to if (dbUp) "ok" else "error", "database" to if (dbUp) "up" else "down", "aiMode" to aiMode())
		return ResponseEntity.status(if (dbUp) 200 else 503).body(out)
	}

	private fun aiMode() =
		try {
			llm.config().mode
		} catch (e: LlmException) {
			"not_configured"
		}

	// 본문이 JSON 문자열로 한 번 더 감싸여 와도 받아 준다 (Node 버전과 같음). 객체가 아니면 400.
	private fun objectBody(raw: JsonNode?): JsonNode {
		val b = if (raw != null && raw.isTextual) runCatching { mapper.readTree(raw.asText()) }.getOrNull() else raw
		if (b == null || !b.isObject) throw ApiException(ErrorCode.INVALID_REQUEST)
		return b
	}

	private fun stringList(n: JsonNode?): List<String>? = if (n != null && n.isArray && n.all { it.isTextual }) n.map { it.asText() } else null

	companion object {
		private val UUID = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE)
	}
}
