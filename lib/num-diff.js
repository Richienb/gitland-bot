"use strict"

module.exports = (a, b) => {
	if (typeof a !== "number" || typeof b !== "number") {
		throw new TypeError("2 numbers must be provided!")
	}

	return Math.abs(a - b)
}
