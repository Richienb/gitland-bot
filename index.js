const { Octokit } = require("@octokit/rest")
const toBase64 = require("btoa-lite")
const fromBase64 = require("atob-lite")
const PathFinding = require("pathfinding")
const numberSort = require("num-sort")
const figures = require("figures")
const numberDiff = require("num-diff")
require("dotenv").config()

const octokit = new Octokit({
	auth: process.env.GITHUB_TOKEN,
	userAgent: "Richienb's Gitland Client",
	headers: {
		"Cache-Control": "no-cache",
		Pragma: "no-cache"
	}
})

const getFileContent = async options => {
	const { data } = await octokit.repos.getContents(options)

	return fromBase64(data.content)
}

const getPlayerLocation = async player => {
	return {
		x: Number(await getFileContent({
			owner: "programical",
			repo: "gitland",
			path: `players/${player}/x`
		})),
		y: Number(await getFileContent({
			owner: "programical",
			repo: "gitland",
			path: `players/${player}/y`
		}))
	}
}

const getDecayMap = async () => {
	const decay = await getFileContent({
		owner: "programical",
		repo: "gitland",
		path: "decay"
	})

	return decay.split("\n").map(line => line.split(",").map(time => Number(time)))
}

const actionSymbol = new Map([
	["up", figures.arrowUp],
	["down", figures.arrowDown],
	["left", figures.arrowLeft],
	["right", figures.arrowRight]
])

const calculateDirectionCoordinates = (x, y, direction) => {
	if (direction === "idle") {
		return { x, y }
	}

	if (direction === "up") {
		return { x, y: y - 1 }
	}

	if (direction === "down") {
		return { x, y: y + 1 }
	}

	if (direction === "left") {
		return { x: x - 1, y }
	}

	if (direction === "right") {
		return { x: x + 1, y }
	}

	throw new TypeError("Unknown direction specified")
}

const move = async (player, direction) => {
	if (await getPlayerTeam(player) !== "red") {
		console.log(figures.error, `${player} is not in the red team! Idling will be forced.`)
		direction = "idle"
	} else if (direction === "idle") {
		console.log(figures.radioOff, `Idling ${player}`)
	} else {
		const { x, y } = await getPlayerLocation(player)
		const { x: newX, y: newY } = calculateDirectionCoordinates(x, y, direction)
		console.log(actionSymbol.get(direction), `Moving ${player} to ${newX}, ${newY}`)
	}

	let sha
	try {
		const { data } = await octokit.repos.getContents({
			owner: player,
			repo: "gitland-client",
			path: "act"
		})
		sha = data.sha
	} catch (_) { }

	try {
		await octokit.repos.createOrUpdateFile({
			owner: player,
			repo: "gitland-client",
			path: "act",
			message: `Move ${direction}`,
			content: toBase64(direction),
			sha: sha,
			committer: {
				name: "Richienbland Bot",
				email: "64409073+Richienbland@users.noreply.github.com"
			}
		})
	} catch (error) {
		console.log(figures.warning, `Failed to write move for ${player} because ${error.message}`)
	}
}

const teamIds = new Map([
	["cr", "red"],
	["cg", "green"],
	["cb", "blue"],
	["ur", "red"],
	["ug", "green"],
	["ub", "blue"]
])

const getPlayerTeam = async player => {
	const teamId = await getFileContent({
		owner: "programical",
		repo: "gitland",
		path: `players/${player}/team`
	})

	return teamIds.get(teamId)
}

const getPlayerMap = async () => {
	const playerMap = await getFileContent({
		owner: "programical",
		repo: "gitland",
		path: "map"
	})
	return playerMap.split("\n").map(line => line.split(",").map(teamId => {
		if (teamId.startsWith("c")) {
			return teamIds.get(teamId)
		}

		return undefined
	}))
}

const getMap = async () => {
	const map = await getFileContent({
		owner: "programical",
		repo: "gitland",
		path: "map"
	})

	return map.split("\n").map(line => line.split(","))
}

const coordsExist = (map, x, y) => map && map[y] && map[y][x]

const runEvery = (duration, callback) => {
	callback()
	const id = setInterval(callback, duration)
	return () => clearInterval(id)
}

const finder = new PathFinding.BestFirstFinder()

const runForPlayer = async (player, { map }) => {
	const { x, y } = await getPlayerLocation(player)

	const withObstacles = map.map(line => line.map(tile => tile.startsWith("c") ? 1 : 0))

	const determineDistance = point => numberDiff(x, point.x) + numberDiff(y, point.y)

	// Filter out decaying spaces: decayMap[thisY][thisX] > 30 - determineDistance({ y: thisY, x: thisX }))

	const possibleLocations = []
	withObstacles.forEach((line, thisY) => line.forEach((space, thisX) => {
		if ((space !== 1 && !(thisY === y && thisX === x)) && map[thisY][thisX] !== "ur") {
			possibleLocations.push({
				y: thisY, x: thisX
			})
		}
	}))

	const [closestPoint] = possibleLocations.map(point => [point, determineDistance(point)]).sort((a, b) => numberSort.ascending(a[1], b[1]))[0]

	const grid = new PathFinding.Grid(withObstacles)
	const coordinates = finder.findPath(x, y, closestPoint.x, closestPoint.y, grid)

	if (coordinates) {
		const nextCoordinates = coordinates[1]

		if (nextCoordinates[1] < y) {
			return move(player, "up")
		}

		if (nextCoordinates[0] < x) {
			return move(player, "left")
		}

		if (nextCoordinates[1] > y) {
			return move(player, "down")
		}

		if (nextCoordinates[0] > x) {
			return move(player, "right")
		}
	}

	console.log(figures.warning, `Couldn't find next available space for ${player}!`)
	return move(player, "idle")
}

runEvery(60000, async () => {
	const map = await getMap()

	const runPlayer = player => runForPlayer(player, { map })

	await runPlayer("Richienbland")
	await runPlayer("garygary1275")
	await runPlayer("Lolgamer521")
	await runPlayer("COGB35")
	await runPlayer("Richienb")
})
