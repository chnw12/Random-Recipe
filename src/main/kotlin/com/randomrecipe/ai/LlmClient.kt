package com.randomrecipe.ai

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.randomrecipe.recipe.Ingredient
import com.randomrecipe.recipe.MockRecipe
import com.randomrecipe.recipe.PromptPair
import org.springframework.core.env.Environment
import org.springframework.stereotype.Component
import java.io.IOException
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.http.HttpTimeoutException
import java.time.Duration

// LLM 호출은 이 파일 한 곳에서만 한다.
// LLM_PROVIDER = openai (chat/completions) | gemini (OpenAI 호환 엔드포인트) | anthropic (messages) | mock
// 오류는 not_configured / upstream(HTTP 상태만) / timeout / network 로 나눈다.
// 키와 응답 원문은 예외, 로그, 응답 어디에도 넣지 않는다.

enum class LlmErrorKind { NOT_CONFIGURED, UPSTREAM, TIMEOUT, NETWORK }

class LlmException(
	val kind: LlmErrorKind,
	val status: Int? = null,
	// 설정 안내(필요한 환경 변수 이름만)
	val hint: String? = null,
) : RuntimeException(kind.name.lowercase())

data class LlmConfig(val provider: String, val apiKey: String? = null, val model: String? = null, val url: String? = null) {
	/** 화면 표시용: 'mock' | 'ai' */
	val mode get() = if (provider == "mock") "mock" else "ai"

	// 키가 toString/로그에 섞이지 않게 한다
	override fun toString() = "LlmConfig(provider=$provider, model=$model)"
}

data class LlmHttpResponse(val status: Int, val body: String)

/** 실제 HTTP 전송. 테스트에서는 가짜로 바꿔 끼운다. */
fun interface LlmTransport {
	fun post(
		url: String,
		headers: Map<String, String>,
		body: String,
		timeout: Duration,
	): LlmHttpResponse
}

@Component
class JdkLlmTransport : LlmTransport {
	private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()

	override fun post(
		url: String,
		headers: Map<String, String>,
		body: String,
		timeout: Duration,
	): LlmHttpResponse {
		val req = HttpRequest.newBuilder(URI.create(url)).timeout(timeout).POST(HttpRequest.BodyPublishers.ofString(body))
		headers.forEach { (k, v) -> req.header(k, v) }
		val res =
			try {
				http.send(req.build(), HttpResponse.BodyHandlers.ofString())
			} catch (e: HttpTimeoutException) {
				throw LlmException(LlmErrorKind.TIMEOUT)
			} catch (e: IOException) {
				throw LlmException(LlmErrorKind.NETWORK)
			} catch (e: InterruptedException) {
				Thread.currentThread().interrupt()
				throw LlmException(LlmErrorKind.TIMEOUT)
			}
		return LlmHttpResponse(res.statusCode(), res.body() ?: "")
	}
}

object LlmSettings {
	val PROVIDERS = listOf("openai", "gemini", "anthropic", "mock")

	private data class Default(val url: String, val keyVar: String, val modelVar: String, val model: String, val baseVar: String? = null)

	// 모델 이름은 계정/시점마다 달라질 수 있어 환경 변수로 바꿀 수 있게 둔다.
	private val DEFAULTS =
		mapOf(
			"openai" to Default("https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY", "OPENAI_MODEL", "gpt-4o-mini", "OPENAI_BASE_URL"),
			"gemini" to Default("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "GEMINI_API_KEY", "GEMINI_MODEL", "gemini-2.5-flash"),
			"anthropic" to Default("https://api.anthropic.com/v1/messages", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "claude-sonnet-5-5"),
		)

	/**
	 * 설정 점검. 문제가 있으면 LlmException(NOT_CONFIGURED)에 "어떤 설정이 필요한지"(변수 이름만)를 담아 던진다.
	 * 수업 예제 서버의 변수 이름(AI_MODE, AI_MODEL)도 대체 이름으로 읽는다.
	 */
	fun from(env: (String) -> String?): LlmConfig {
		fun v(name: String) = env(name)?.trim()?.takeIf { it.isNotEmpty() }
		val provider = (v("LLM_PROVIDER") ?: v("AI_MODE") ?: "").lowercase()
		if (provider.isEmpty()) throw LlmException(LlmErrorKind.NOT_CONFIGURED, hint = "LLM_PROVIDER (${PROVIDERS.joinToString(" | ")})")
		if (provider !in PROVIDERS) {
			throw LlmException(LlmErrorKind.NOT_CONFIGURED, hint = "LLM_PROVIDER는 ${PROVIDERS.joinToString(" | ")} 중 하나여야 해요")
		}
		if (provider == "mock") return LlmConfig(provider)
		val d = DEFAULTS.getValue(provider)
		val apiKey = v(d.keyVar) ?: throw LlmException(LlmErrorKind.NOT_CONFIGURED, hint = d.keyVar)
		val url = d.baseVar?.let { v(it) }?.let { "${it.trimEnd('/')}/chat/completions" } ?: d.url
		val model = v(d.modelVar) ?: (if (provider == "gemini") v("AI_MODEL") else null) ?: d.model
		return LlmConfig(provider, apiKey, model, url)
	}
}

@Component
class LlmClient(
	private val transport: LlmTransport,
	private val env: (String) -> String?,
) {
	@org.springframework.beans.factory.annotation.Autowired
	constructor(transport: LlmTransport, environment: Environment) : this(transport, { environment.getProperty(it) })

	private val mapper = ObjectMapper()

	fun config(): LlmConfig = LlmSettings.from(env)

	/** 모델이 돌려준 텍스트 (JSON 문자열이어야 하며 검사는 Harness 가 한다) */
	fun call(
		prompt: PromptPair,
		picked: List<Ingredient>,
		avoidMenuName: String?,
		timeout: Duration,
	): String {
		val cfg = config()
		if (cfg.provider == "mock") return mapper.writeValueAsString(MockRecipe.generate(picked, avoidMenuName))
		if (timeout.isNegative || timeout.isZero) throw LlmException(LlmErrorKind.TIMEOUT)

		val headers: Map<String, String>
		val body: Map<String, Any>
		if (cfg.provider == "anthropic") {
			headers = mapOf("content-type" to "application/json", "x-api-key" to cfg.apiKey!!, "anthropic-version" to "2023-06-01")
			body = mapOf("model" to cfg.model!!, "max_tokens" to 1200, "system" to prompt.system, "messages" to listOf(mapOf("role" to "user", "content" to prompt.user)))
		} else {
			// openai, gemini(OpenAI 호환)
			headers = mapOf("content-type" to "application/json", "authorization" to "Bearer ${cfg.apiKey}")
			body =
				mapOf(
					"model" to cfg.model!!,
					"messages" to listOf(mapOf("role" to "system", "content" to prompt.system), mapOf("role" to "user", "content" to prompt.user)),
					"response_format" to mapOf("type" to "json_object"),
				)
		}

		val res = transport.post(cfg.url!!, headers, mapper.writeValueAsString(body), timeout)
		// 응답 본문은 오류일 때 읽지도, 남기지도 않는다
		if (res.status !in 200..299) throw LlmException(LlmErrorKind.UPSTREAM, status = res.status)
		val json: JsonNode =
			runCatching { mapper.readTree(res.body) }.getOrNull()
				?: throw LlmException(LlmErrorKind.UPSTREAM, status = res.status)
		val text =
			if (cfg.provider == "anthropic") {
				json["content"]?.filter { it["type"]?.asText() == "text" }?.joinToString("") { it["text"]?.asText() ?: "" }
			} else {
				json["choices"]?.get(0)?.get("message")?.get("content")?.takeIf { it.isTextual }?.asText()
			}
		if (text.isNullOrBlank()) throw LlmException(LlmErrorKind.UPSTREAM, status = res.status)
		return text
	}
}
