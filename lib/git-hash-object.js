"use strict"

const hasha = require("hasha")

module.exports = input => {
	if (typeof input !== "string") {
		throw new TypeError("A string must be provided!")
	}

	return hasha(`blob ${input.length}\0${input}`, { algorithm: "sha1" })
}
