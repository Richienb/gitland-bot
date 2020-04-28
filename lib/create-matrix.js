"use strict"

module.exports = (rows, columns) => {
	if (!(Number.isInteger(rows) && rows > 0 && Number.isInteger(columns) && columns > 0)) {
		throw new TypeError("A positive integer must be provided for rows and columns.")
	}

	return new Array(rows).fill(new Array(columns).fill(0))
}
