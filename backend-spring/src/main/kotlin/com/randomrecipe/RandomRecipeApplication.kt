package com.randomrecipe

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class RandomRecipeApplication

fun main(args: Array<String>) {
	runApplication<RandomRecipeApplication>(*args)
}
