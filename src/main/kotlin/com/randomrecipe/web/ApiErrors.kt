package com.randomrecipe.web

import jakarta.servlet.http.HttpServletRequest
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.web.HttpRequestMethodNotSupportedException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.servlet.resource.NoResourceFoundException

// 오류 형식 { error: 코드, message: 화면에 보여줄 한국어 문구 } (Node 버전과 같은 코드·문구)
// message 를 바꿔 쓸 수 있지만 키·응답 원문·환경 변수 값은 넣지 않는다.

enum class ErrorCode(val status: Int, val message: String) {
	INVALID_INGREDIENTS(400, "재료 3개(단백질·채소·양념 칸마다 하나)가 올바르지 않아요."),
	INVALID_REQUEST(400, "요청 형식이 올바르지 않아요."),
	NOT_FOUND(404, "없는 API예요."),
	METHOD_NOT_ALLOWED(405, "허용되지 않는 요청 방식이에요."),
	DUPLICATE(409, "방금 이미 확정한 메뉴예요."),
	RULE_FAILED(422, "메뉴를 안전하게 만들지 못했어요. 다시 시도해 주세요."),
	RATE_LIMITED(429, "요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요."),
	NOT_CONFIGURED(500, "서버 설정이 아직 없어요."),
	RECORD_FAILED(500, "기록을 저장하지 못했어요."),
	AI_FAILED(502, "AI 호출에 실패했어요. 잠시 뒤에 다시 시도해 주세요."),
	;

	val code get() = name.lowercase()
}

class ApiException(
	val error: ErrorCode,
	override val message: String = error.message,
	val retryAfterSec: Long? = null,
) : RuntimeException(error.code)

data class ErrorBody(val error: String, val message: String)

/** 로그에는 오류 종류와 HTTP 상태만 남긴다. 키, 요청/응답 원문, 환경 변수 값은 남기지 않는다. */
object SafeLog {
	private val log = LoggerFactory.getLogger("random-recipe")

	fun warn(
		tag: String,
		info: Map<String, Any?>,
	) = log.warn("[{}] {}", tag, info.filterValues { it != null })
}

@RestControllerAdvice
class ApiExceptionHandler {
	private fun body(
		code: ErrorCode,
		message: String = code.message,
	) = ResponseEntity.status(code.status).body(ErrorBody(code.code, message))

	@ExceptionHandler(ApiException::class)
	fun api(e: ApiException): ResponseEntity<ErrorBody> {
		val res = ResponseEntity.status(e.error.status)
		e.retryAfterSec?.let { res.header("Retry-After", it.toString()) }
		return res.body(ErrorBody(e.error.code, e.message))
	}

	@ExceptionHandler(HttpRequestMethodNotSupportedException::class)
	fun method(e: HttpRequestMethodNotSupportedException): ResponseEntity<ErrorBody> =
		ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
			.header("Allow", e.supportedMethods?.joinToString(", ") ?: "")
			.body(ErrorBody(ErrorCode.METHOD_NOT_ALLOWED.code, ErrorCode.METHOD_NOT_ALLOWED.message))

	// 깨진 JSON, JSON 이 아닌 본문
	@ExceptionHandler(HttpMessageNotReadableException::class, HttpMediaTypeNotSupportedException::class)
	fun unreadable() = body(ErrorCode.INVALID_REQUEST)

	@ExceptionHandler(NoResourceFoundException::class)
	fun notFound() = body(ErrorCode.NOT_FOUND)

	@ExceptionHandler(Exception::class)
	fun unknown(
		e: Exception,
		req: HttpServletRequest,
	): ResponseEntity<ErrorBody> {
		// 메시지에 비밀이 섞일 수 있어 종류만 남긴다
		SafeLog.warn("server", mapOf("kind" to e.javaClass.simpleName, "path" to req.requestURI))
		return body(ErrorCode.RECORD_FAILED, "서버에서 오류가 났어요.")
	}
}
