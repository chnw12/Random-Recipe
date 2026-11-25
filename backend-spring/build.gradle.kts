import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

// 수업 예제 서버(idea-support-server)와 같은 틀: Kotlin + Spring Boot 3.2 + Java 17 + Jib + ktlint
plugins {
	id("org.springframework.boot") version "3.2.1"
	id("io.spring.dependency-management") version "1.1.4"
	id("com.google.cloud.tools.jib") version "3.3.2"
	kotlin("jvm") version "1.9.21"
	kotlin("plugin.spring") version "1.9.21"
	id("org.jlleitschuh.gradle.ktlint").version("12.1.1")
}

// 이미지 프로필: ./gradlew jib -PprojectDataImageTargetEnv=dev  → spring.profiles.active=dev
val imageTargetEnv =
	if (properties.containsKey("projectDataImageTargetEnv")) {
		property("projectDataImageTargetEnv")
	} else {
		"local"
	}

group = "com.randomrecipe"
version = "0.0.1-SNAPSHOT"

java {
	sourceCompatibility = JavaVersion.VERSION_17
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-web")
	implementation("org.springframework.boot:spring-boot-starter-jdbc")
	implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
	implementation("org.jetbrains.kotlin:kotlin-reflect")
	implementation("org.liquibase:liquibase-core")
	runtimeOnly("com.mysql:mysql-connector-j")
	// 로컬 실행(local 프로필)과 테스트는 메모리 DB를 쓴다. dev/prod 는 MySQL.
	runtimeOnly("com.h2database:h2")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.withType<KotlinCompile> {
	kotlinOptions {
		// -Xjdk-release=17: 로컬 JDK 가 더 새 버전이어도 Java 17 에 없는 API 를 쓰면 컴파일 오류로 잡는다 (이미지는 Java 17)
		freeCompilerArgs += listOf("-Xjsr305=strict", "-Xjdk-release=17")
		jvmTarget = "17"
	}
}

tasks.withType<Test>().configureEach {
	useJUnitPlatform()
	testLogging {
		events("failed")
		exceptionFormat = TestExceptionFormat.FULL
	}
	addTestListener(
		object : TestListener {
			override fun beforeSuite(suite: TestDescriptor) {}

			override fun beforeTest(testDescriptor: TestDescriptor) {}

			override fun afterTest(
				testDescriptor: TestDescriptor,
				result: TestResult,
			) {}

			override fun afterSuite(
				suite: TestDescriptor,
				result: TestResult,
			) {
				if (suite.parent == null) {
					logger.lifecycle(
						"TEST RESULT: ${result.resultType} | total=${result.testCount} passed=${result.successfulTestCount} " +
							"failed=${result.failedTestCount} skipped=${result.skippedTestCount}",
					)
				}
			}
		},
	)
}

// 실제 환경 파일은 JAR/컨테이너에 넣지 않는다.
tasks.processResources {
	exclude(".env", "**/.env")
}

jib {
	from {
		image = "eclipse-temurin:17-jre"
	}
	to {
		image =
			providers.gradleProperty("containerImage")
				.orElse(providers.environmentVariable("CONTAINER_IMAGE"))
				.getOrElse("local/random-recipe-server")
		val registryUser = System.getenv("REGISTRY_USER")
		val registryPassword = System.getenv("REGISTRY_PASSWORD")
		if (!registryUser.isNullOrBlank() && !registryPassword.isNullOrBlank()) {
			auth {
				username = registryUser
				password = registryPassword
			}
		}
	}
	container {
		jvmFlags =
			when (imageTargetEnv) {
				"prod" -> listOf("-XX:+UseContainerSupport", "-Dfile.encoding=UTF-8", "-Dspring.profiles.active=prod")
				"dev" -> listOf("-XX:+UseContainerSupport", "-Dfile.encoding=UTF-8", "-Dspring.profiles.active=dev")
				else -> listOf("-XX:+UseContainerSupport", "-Dfile.encoding=UTF-8", "-Dspring.profiles.active=local")
			}
		ports = listOf("8080")
	}
}
