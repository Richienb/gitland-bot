const { Octokit } = require("@octokit/rest")
const toBase64 = require("btoa-lite")
const fromBase64 = require("atob-lite")
const PathFinding = require("pathfinding")
const numberSort = require("num-sort")
const difference = require("./lib/num-diff")
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

const move = async (player, direction) => {
	const { x, y } = await getPlayerLocation(player)

	console.log(`${player} is now at x: ${x}, y: ${y}`)

	console.log(`Moving ${player} ${direction}`)

	let sha
	try {
		const { data } = await octokit.repos.getContents({
			owner: player,
			repo: "gitland-client",
			path: "act"
		})
		sha = data.sha
	} catch (_) { }

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

const runForPlayer = async player => {
	const map = await getMap()
	const { x, y } = await getPlayerLocation(player)

	const obstacled = map.map(line => line.map(space => space.startsWith("c") ? 1 : 0))

	const possibleLocations = []
	obstacled.forEach((line, thisY) => line.forEach((space, thisX) => {
		if (space !== 1 && map[thisY][thisX] !== "ur" && !(thisY === y && thisX === x)) {
			possibleLocations.push({
				y: thisY, x: thisX
			})
		}
	}))

	const determineDistance = point => difference(x, point.x) + difference(y, point.y)
	const [closestPoint] = possibleLocations.map(point => [point, determineDistance(point)]).sort((a, b) => numberSort.ascending(a[1], b[1]))[0]

	const grid = new PathFinding.Grid(obstacled)
	const finder = new PathFinding.BestFirstFinder()
	const nextCoordinates = finder.findPath(x, y, closestPoint.x, closestPoint.y, grid)[1]

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

	console.log("Couldn't find next unclaimed space!")
	return move(player, "idle")
}

runEvery(60000, async () => {
	await runForPlayer("Richienbland")
	await runForPlayer("garygary1275")
	await runForPlayer("Lolgamer521")
	await runForPlayer("COGB35")
	await runForPlayer("Richienb")
})
