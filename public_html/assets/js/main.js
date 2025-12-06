$(function () {

	// ==================================================
	// All important elements and variables
	// ==================================================
	var $characterSelectionScreen = $("#character-screen");
	var $characters = $("#character-selection-box .character-box");
	var $receptionScreen = $("#reception-screen");
	var $gameScreen = $("#game-screen"); // wrapper for game view
	var $scoreboard = $("#scoreboard");
	var $scoreBoxes = $scoreboard.find(".score-box");
	var $backButton = $("#back-btn");
	var $locationCharacters = $(".location-character");
	var $locationCharacterImages = $(".location-character-img");
	var $mapLinks = $(".map-link");

	var $centralScore = $("#central-score");
	var $centralScoreCards = $centralScore.find(".score-box");
	var $outdoorScore = $("#outdoor-score");
	var $outdoorScoreCards = $outdoorScore.find(".score-box");
	var $workScore = $("#work-score");
	var $workScoreCards = $workScore.find(".score-box");

	var $arrowKeys = $(".arrow-key");

	// each map wrapper (assumed IDs: #central-map, #outdoor-map, #work-map)
	var $centralGroundMap = $("#centralGround-map");
	var $centralFirstMap  = $("#centralFirst-map");   // 🔴 add this
	var $outdoorMap       = $("#outdoor-map");
	var $workMap          = $("#work-map");

	var $mapScreens = $centralGroundMap
		.add($centralFirstMap)   // 🔴 include it
		.add($outdoorMap)
		.add($workMap);


	// player elements (for currently active map)
	var $player = null;
	var $playerRing = null;

	// Map of work-map locations to popup screen IDs
	const workMapScreens = {
		locKitchenette: "theKitchenette",
		locAltWork: "theAlternameWorkArea",
		locMeeting: "theMeetingRooms",
		locBreakout: "breakoutArea",
		locFocus: "theFocusRooms",
		locHuddle: "huddle",
		locSmallKitchenette: "theSmallKitchenette",
	};


	// scorecards lookup per map
	var scoreCardsByMap = {
		centralGround: $centralScoreCards,
		centralFirst: $centralScoreCards,
		outdoor: $outdoorScoreCards,
		work: $workScoreCards
	};

	// ==================================================
	// Custom scrollbars
	// ==================================================
	$(".scroll-box").mCustomScrollbar({
		axis: "y",
		scrollInertia: 300,
		mouseWheel: {
			enable: true,
			scrollAmount: "auto"
		},
		advanced: {
			autoExpandHorizontalScroll: true,
			updateOnContentResize: true
		},
		callbacks: {
			onOverflowY: function () {
				$(this).addClass("has-scroll");
			},
			onOverflowYNone: function () {
				$(this).removeClass("has-scroll");
			}
		}
	});

	// ==================================================
	// State Object
	// ==================================================
	var state = {
		screens: {
			active: "site-loading",
			list: ["site-loading", "character", "reception", "game"]
		},
		activeCharacter: null,

		maps: {
			active: null,
			all: ["centralGround", "centralFirst", "outdoor", "work"],
			data: {
				centralGround: {
					currentNodeId: null,
					visitedRegions: {},
					visitedCount: 0,
					visitedNodes: {},
					visitedPlaces: {},
					traversedEdges: {}
				},
				centralFirst: {
					currentNodeId: null,
					visitedRegions: {},
					visitedCount: 0,
					visitedNodes: {},
					visitedPlaces: {},
					traversedEdges: {}
				},
				outdoor: {
					currentNodeId: null,
					visitedRegions: {},
					visitedCount: 0,
					visitedNodes: {},
					visitedPlaces: {},
					traversedEdges: {}
				},
				work: {
					currentNodeId: null,
					visitedRegions: {},
					visitedCount: 0,
					visitedNodes: {},
					visitedPlaces: {},
					traversedEdges: {}
				}
			}
		},

		keys: {
			active: null,
			all: ["left", "up", "right", "down"]
		},

		KEY_TO_DIR: {
			37: "left",
			38: "up",
			39: "right",
			40: "down"
		}
	};

	// per-map SVG graphs
	// graphs[mapName] = { nodeId: { id, $el, x, y, neighbors, isPlace, placeName } }
	var graphs = {
		centralGround: {},
		centralFirst: {},
		outdoor: {},
		work: {}
	};

	// ==================================================
	// Timer
	// ==================================================
	var timerInterval = null;
	var totalSeconds = 0;

	function pad(num) {
		return num < 10 ? "0" + num : "" + num;
	}

	function updateTimerDisplay() {
		var mins = Math.floor(totalSeconds / 60);
		var secs = totalSeconds % 60;

		$("#timer-mins").text(pad(mins));
		$("#timer-secs").text(pad(secs));
	}

	function startTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
		}

		totalSeconds = 0;
		updateTimerDisplay();

		timerInterval = setInterval(function () {
			totalSeconds++;
			updateTimerDisplay();
		}, 1000);
	}

	function resetTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		totalSeconds = 0;
		updateTimerDisplay();
	}

	// ==================================================
	// Screen helpers
	// ==================================================
	function setActiveScreen(screenName) {
		if (state.screens.active === screenName) return;

		// Hide previous screen
		if (state.screens.active) {
			$("#" + state.screens.active + "-screen").removeClass("active");
		}

		// Show new screen
		$("#" + screenName + "-screen").addClass("active");
		state.screens.active = screenName;

		updateBackButtonLabel();
	}
	function updateBackButtonLabel() {
		const $label = $backButton.find(".text");

		if (state.screens.active === "game") {
			$label.text("Back to Reception");
			$backButton.addClass("active");

		} else if (state.screens.active === "reception") {
			$label.text("Back to Character Selection");
			$backButton.addClass("active");

		} else {
			// On character screen or loading → hide back button
			$backButton.removeClass("active");
		}
	}


	// ==================================================
	// Map + scoreboard helpers
	// ==================================================
	function setScoreboardForMap(mapName) {
		$centralScore.toggleClass("active", mapName === "centralGround");
		$centralScore.toggleClass("active", mapName === "centralFirst");
		$outdoorScore.toggleClass("active", mapName === "outdoor");
		$workScore.toggleClass("active", mapName === "work");
	}

	function setActiveMap(mapName) {
		if (!mapName || state.maps.active === mapName) {
			return;
		}

		// hide all map SVG wrappers
		$mapScreens.removeClass("active");

		// show the selected map
		$("#" + mapName + "-map").addClass("active");

		state.maps.active = mapName;
		setScoreboardForMap(mapName);

		// cache player elements inside active map
		var $activeMapRoot = $("#" + mapName + "-map");
		$playerGroup = $activeMapRoot.find(".player-group");

		// make sure game screen is visible
		setActiveScreen("game");

		// place player at currentNodeId for this map
		var mapData = state.maps.data[mapName];
		if (mapData.currentNodeId && graphs[mapName][mapData.currentNodeId]) {
			positionPlayerAt(mapName, mapData.currentNodeId, false);
		}

		updateAvailableDirections();
	}

	function markRegionVisited(mapName, regionId) {
		if (!mapName || !regionId || !state.maps.data[mapName]) {
			return;
		}

		var mapState = state.maps.data[mapName];

		if (!mapState.visitedRegions[regionId]) {
			mapState.visitedRegions[regionId] = true;
			mapState.visitedCount++;

			// 1) Scoreboard card by region
			var $cards = scoreCardsByMap[mapName];
			if ($cards && $cards.length) {
				$cards
					.filter('[data-region="' + regionId + '"]')
					.addClass("active");
			}

			// 2) Area highlight in SVG (new bit)
			var $mapRoot = $("#" + mapName + "-map").find(".map-svg");
			$mapRoot
				.find('.area-group[data-region="' + regionId + '"]')
				.addClass("region-visited");
		}
	}

	function triggerPlaceIfAdjacent(mapName, nodeId) {
		var graph   = graphs[mapName];
		var mapData = state.maps.data[mapName];

		if (!graph || !mapData) return;

		var node = graph[nodeId];
		if (!node || node.isPlace) {
			// If it's already a place node, normal flow will handle it
			return;
		}

		// Look at all neighbors of this joint node
		var triggered = false;
		$.each(node.neighbors, function (dir, neighborId) {
			var neighbor = graph[neighborId];
			if (neighbor && neighbor.isPlace) {
				// Mark that place as visited (adds visited-place, region, score, confetti)
				markVisitedPlace(mapName, neighborId);

				// Open its location screen if configured
				var $placeEl   = neighbor.$el;
				var screenSel  = $placeEl.data("screen-target");
				if (screenSel) {
					$(".location-screen").removeClass("active");
					$(screenSel).addClass("active");
				}

				triggered = true;
				return false; // break $.each
			}
		});

		if (triggered) {
			// Keep nearby labels in sync
			updateNearbyPlaces(mapName);
		}
	}

	// expose for debugging / external triggers if needed
	window.gameState = state;
	window.setActiveMap = setActiveMap;
	window.markRegionVisited = markRegionVisited;

	// ==================================================
	// Graph + navigation setup
	// ==================================================
	function initGraphsFromSvg() {
		state.maps.all.forEach(function (mapName) {
			var $root = $('#' + mapName + '-map').find('.map-svg');
			if (!$root.length) {
				return;
			}

			var graph = {};
			$root.find("[data-node-id]").each(function () {
				var $node = $(this);
				var id = String($node.data("node-id"));
				var neighborsStr = ($node.data("neighbors") || "").toString();
				var neighbors = {};

				if (neighborsStr.length > 0) {
					neighborsStr.split(",").forEach(function (pair) {
						var parts = pair.split(":");
						if (parts.length === 2) {
							var dir = $.trim(parts[0]);
							var dest = $.trim(parts[1]);
							if (dir && dest) {
								neighbors[dir] = dest;
							}
						}
					});
				}

				var isPlace = $node.hasClass("place");
				var cx = parseFloat($node.attr("cx")) || parseFloat($node.data("x"));
				var cy = parseFloat($node.attr("cy")) || parseFloat($node.data("y"));

				// data-no-score="true" on staircase etc.
				var noScore = false;
				if (isPlace) {
					var ds = $node.data("no-score");
					noScore = ds === true || ds === "true";
				}

				graph[id] = {
					id: id,
					$el: $node,
					x: cx,
					y: cy,
					neighbors: neighbors,
					isPlace: isPlace,
					noScore: noScore,
					placeName: $node.data("place-name") || null
				};
			});

			graphs[mapName] = graph;

			// set start node: data-start-node on map wrapper or first node in graph
			var startNodeId = $root.data("start-node");
			if (!startNodeId) {
				var ids = Object.keys(graph);
				startNodeId = ids.length ? ids[0] : null;
			}

			if (startNodeId) {
				state.maps.data[mapName].currentNodeId = startNodeId;
				state.maps.data[mapName].visitedNodes[startNodeId] = true;
			}
		});
	}

	// ==================================================
	//  MOVEMENT ENGINE With <g class="player-group">
	// ==================================================

	function attemptMove(dir) {
		var activeMap = state.maps.active;
		if (!activeMap) return;

		var graph = graphs[activeMap];
		var mapData = state.maps.data[activeMap];

		if (!graph || !mapData || !mapData.currentNodeId) return;

		var currentNode = graph[mapData.currentNodeId];
		var nextNodeId = currentNode.neighbors[dir];

		if (!nextNodeId) return;

		moveToNode(activeMap, nextNodeId, dir);
	}

	function moveToNode(mapName, nextNodeId, dir) {
		var graph = graphs[mapName];
		var mapData = state.maps.data[mapName];

		var currentNodeId = mapData.currentNodeId;
		var currentNode = graph[currentNodeId];
		var nextNode = graph[nextNodeId];
		if (!nextNode) return;

		// update state
		mapData.currentNodeId = nextNodeId;
		markVisitedNode(mapName, nextNodeId);
		markTraversedEdge(mapName, currentNodeId, nextNodeId);

		console.log("[moveToNode]", {
			map: mapName,
			from: currentNodeId,
			to: nextNodeId,
			dir: dir,
			node: nextNode
		});

		// Move player if on this map
		if (state.maps.active === mapName) {
			positionPlayerAt(mapName, nextNodeId, true);
		}

		// If location node
		if (nextNode.isPlace) {
			markVisitedPlace(mapName, nextNodeId);
		}

		if (state.maps.active === mapName) {
			updateAvailableDirections();
			updateNearbyPlaces(mapName);
		}
	}

	// ==================================================
	//  Position player-group using transform="translate(x, y)"
	// ==================================================

	function positionPlayerAt(mapName, nodeId, animate) {
		var graph = graphs[mapName];
		if (!graph) return;

		var node = graph[nodeId];
		if (!node || !$playerGroup) return;

		var x = node.x;
		var y = node.y;

		// No animation (initial placement)
		if (!animate) {
			$playerGroup.attr("transform", `translate(${x}, ${y})`);
			return;
		}

		// Animated transition
		var transform = $playerGroup.attr("transform") || "translate(0,0)";
		var match = transform.match(/translate\(([-0-9.]+),\s*([-0-9.]+)\)/);

		var startX = match ? parseFloat(match[1]) : x;
		var startY = match ? parseFloat(match[2]) : y;

		$({ px: startX, py: startY }).animate(
			{ px: x, py: y },
			{
				duration: 200,
				step: function (now, fx) {
					if (fx.prop === "px") {
						$playerGroup.attr("transform", `translate(${fx.now}, ${this.py})`);
					} else if (fx.prop === "py") {
						$playerGroup.attr("transform", `translate(${this.px}, ${fx.now})`);
					}
				}
			}
		);
	}

	// ==================================================
	// Node and edge marking (unchanged)
	// ==================================================

	function markVisitedNode(mapName, nodeId) {
		var mapData = state.maps.data[mapName];
		if (!mapData.visitedNodes[nodeId]) {
			mapData.visitedNodes[nodeId] = true;
		}
	}

	function markTraversedEdge(mapName, fromId, toId) {
		var key = edgeKey(fromId, toId);
		var mapData = state.maps.data[mapName];

		if (!mapData.traversedEdges[key]) {
			mapData.traversedEdges[key] = true;
		}

		var $root = $('#' + mapName + '-map').find('.map-svg');
		var selector = `[data-edge="${fromId}-${toId}"], [data-edge="${toId}-${fromId}"]`;
		$root.find(selector).addClass("visited");
	}

	function updateScoreboard(mapName) {
		var mapData = state.maps.data[mapName];
		if (!mapData) {
			return;
		}

		// number of unique visited place nodes on this map
		var visitedCount = Object.keys(mapData.visitedPlaces).length;

		var $cards = null;
		if (mapName === "outdoor") $cards = $outdoorScoreCards;
		if (mapName === "centralGround") $cards = $centralScoreCards;
		if (mapName === "centralFirst") $cards = $centralScoreCards;
		if (mapName === "work")    $cards = $workScoreCards;

		if (!$cards || !$cards.length) {
			return;
		}

		// DEBUG (so you can see it in console)
		console.log("[scoreboard] updateScoreboard", mapName, "visitedCount =", visitedCount);

		// simple rule: first N cards = visited
		$cards.removeClass("active");
		for (var i = 0; i < visitedCount && i < $cards.length; i++) {
			$cards.eq(i).addClass("active");
		}
	}

		// ----------------------------------------------------------------------
	// PORTAL HANDLER (staircases between maps)
	// ----------------------------------------------------------------------
	function handleMapPortal(fromMapName, nodeId) {
		var graph = graphs[fromMapName];
		if (!graph) return;

		var node = graph[nodeId];
		if (!node || !node.isPlace) return;

		var $el           = node.$el;
		var targetMapName = $el.data("target-map");
		var targetNodeId  = $el.data("target-node");

		if (!targetMapName || !state.maps.data[targetMapName]) {
			console.warn("[portal] Invalid target-map on", nodeId, "->", targetMapName);
			return;
		}

		var targetGraph   = graphs[targetMapName];
		var targetMapData = state.maps.data[targetMapName];

		// Prefer an explicit target node near the staircase
		if (targetNodeId && targetGraph && targetGraph[targetNodeId]) {
			targetMapData.currentNodeId = targetNodeId;
			targetMapData.visitedNodes[targetNodeId] = true;
		} else {
			// Fallback: if currentNodeId is missing or invalid, use first node in that map
			if (!targetMapData.currentNodeId || !targetGraph || !targetGraph[targetMapData.currentNodeId]) {
				if (targetGraph) {
					var ids = Object.keys(targetGraph);
					if (ids.length) {
						targetMapData.currentNodeId = ids[0];
						targetMapData.visitedNodes[ids[0]] = true;
					}
				}
			}
		}

		// Close any open location popups
		$(".location-screen").removeClass("active");
		if (typeof refreshBackButtonVisibility === "function") {
			refreshBackButtonVisibility();
		}

		// Now switch map. This will:
		// - set state.maps.active
		// - set screen to "game"
		// - position the player (via positionPlayerAt)
		// - updateAvailableDirections()
		setActiveMap(targetMapName);
	}

	// ==================================================
	// Place (Location) handling
	// ==================================================
	function markVisitedPlace(mapName, nodeId) {
		var graph   = graphs[mapName];
		var mapData = state.maps.data[mapName];
		if (!graph || !mapData) return;

		var node = graph[nodeId];
		if (!node || !node.isPlace) return;

		var $placeEl     = node.$el;
		var targetMapName = $placeEl.data("target-map");

		// --------------------------------------------------
		// PORTAL PLACES (staircases)
		// --------------------------------------------------
		if (targetMapName) {
			// Staircases should act as portals ONLY, no score/confetti
			handleMapPortal(mapName, nodeId);
			return;
		}

		// --------------------------------------------------
		// NORMAL PLACES
		// --------------------------------------------------
		if (!mapData.visitedPlaces[nodeId]) {
			mapData.visitedPlaces[nodeId] = true;

			// Visually mark place + region
			$placeEl.addClass("visited-place");

			var regionId = $placeEl.data("region") || nodeId;
			markRegionVisited(mapName, regionId);

			// Open its content screen if configured
			var screen = $placeEl.data("screen-target");
			if (screen) {
				$(".location-screen").removeClass("active");
				$(screen).addClass("active");
				refreshBackButtonVisibility();
			}

			// Only affect scoreboard & completion if NOT a "no-score" place
			if (!node.noScore) {
				updateScoreboard(mapName);
				checkMapCompletion(mapName);
			}
		}
	}



	// ==================================================
	// Exit from location screen back to its map,
	// and move player back to the nearest joint node
	// ==================================================
	$(".exit-to-map").on("click", function (evt) {
		evt.preventDefault();

		// 1) Which screen are we closing?
		var $screen  = $(this).closest(".location-screen");
		var screenId = $screen.attr("id");

		// 2) Which map does it belong to?
		var mapName = $screen.data("map") || state.maps.active;

		// Hide all location screens
		$(".location-screen").removeClass("active");
		refreshBackButtonVisibility();


		if (!mapName) {
			setActiveScreen("game");
			return;
		}

		var graph   = graphs[mapName];
		var mapData = state.maps.data[mapName];

		if (graph && mapData) {
			// 3) Find the place node whose data-screen-target matches this screen
			var placeNodeId = null;

			$.each(graph, function (id, node) {
				if (
					node.isPlace &&
					node.$el.data("screen-target") === "#" + screenId
				) {
					placeNodeId = id;
					return false; // break $.each
				}
			});

			if (placeNodeId) {
				var placeNode = graph[placeNodeId];
				var jointId   = null;

				// 4) Find a neighbor that is NOT a place (i.e. a regular joint node)
				Object.keys(placeNode.neighbors).some(function (dir) {
					var neighborId   = placeNode.neighbors[dir];
					var neighborNode = graph[neighborId];

					if (neighborNode && !neighborNode.isPlace) {
						jointId = neighborId;
						return true; // break .some
					}
					return false;
				});

				if (jointId) {
					// Update state to this joint
					mapData.currentNodeId = jointId;
					markVisitedNode(mapName, jointId);

					// If this map is already active, move player immediately
					if (state.maps.active === mapName) {
						positionPlayerAt(mapName, jointId, false);
					}
				}
			}
		}

		// 5) Ensure map view is active (also repositions player using currentNodeId)
		setActiveMap(mapName);
	});

	// ----------------------------------------------------------------------
	// GLOBAL: map completion tracking + confetti trigger
	// ----------------------------------------------------------------------

	// Track which maps already fired confetti to avoid duplicates
	state.mapCompletionFired = state.mapCompletionFired || {};

	// ----------------------------------------------------------------------
	// GLOBAL: map completion tracking + confetti trigger
	// ----------------------------------------------------------------------

	// Track which maps already fired confetti to avoid duplicates
	state.mapCompletionFired = state.mapCompletionFired || {};

	// NEW: combined completion for centralGround + centralFirst
	function checkCentralCompletion() {
		var centralMaps = ["centralGround", "centralFirst"];

		var allPlaceKeys = [];
		var visitedKeys = new Set();

		centralMaps.forEach(function (mapName) {
			var graph = graphs[mapName];
			var mapData = state.maps.data[mapName];
			if (!graph || !mapData) return;

			// all places that DO count (no noScore)
			Object.keys(graph).forEach(function (id) {
				var node = graph[id];
				if (node && node.isPlace && !node.noScore) {
					allPlaceKeys.push(mapName + ":" + id);
				}
			});

			// visited places on this map
			Object.keys(mapData.visitedPlaces || {}).forEach(function (id) {
				visitedKeys.add(mapName + ":" + id);
			});
		});

		if (allPlaceKeys.length > 0 && visitedKeys.size === allPlaceKeys.length) {
			if (!state.mapCompletionFired.centralCombined) {
				state.mapCompletionFired.centralCombined = true;
				// label "central" here is just for the log
				runConfettiCelebration("central");
			}
		}
	}

	// Existing, but now used for outdoor/work only
	function checkMapCompletion(mapName) {
		if (!mapName || !graphs[mapName]) return;

		// Central maps use combined logic instead
		if (mapName === "centralGround" || mapName === "centralFirst") {
			checkCentralCompletion();
			return;
		}

		var graph   = graphs[mapName];
		var mapData = state.maps.data[mapName];
		if (!mapData) return;

		// Only places that count (no staircase, etc.)
		var allPlaces = Object.keys(graph).filter(function (id) {
			var node = graph[id];
			return node && node.isPlace && !node.noScore;
		});

		var visitedPlacesObj = mapData.visitedPlaces || {};
		var visitedPlaceIds  = Object.keys(visitedPlacesObj);

		if (allPlaces.length > 0 && visitedPlaceIds.length === allPlaces.length) {
			if (!state.mapCompletionFired[mapName]) {
				state.mapCompletionFired[mapName] = true;
				runConfettiCelebration(mapName);
			}
		}
	}

	// Confetti wrapper so we can tweak later if needed
	function runConfettiCelebration(mapName) {
		console.log("🎉 All places visited in map:", mapName);

		// Your existing confetti settings:
		confetti({
			particleCount: 120,
			angle: 60,
			spread: 100,
			origin: { x: 0 }
		});

		confetti({
			particleCount: 120,
			angle: 120,
			spread: 100,
			origin: { x: 1 }
		});
	}


	// ==================================================
	function edgeKey(a, b) {
		return a < b ? `${a}-${b}` : `${b}-${a}`;
	}

	function updateAvailableDirections() {
		const activeMap = state.maps.active;
		const mapData = state.maps.data[activeMap];
		const graph = graphs[activeMap];

		if (!activeMap || !graph || !mapData || !mapData.currentNodeId) {
			$arrowKeys.removeClass("available").addClass("disabled");
			return;
		}

		const currentNode = graph[mapData.currentNodeId];
		if (!currentNode) {
			// bad state: ID not in graph → disable keys instead of crashing
			$arrowKeys.removeClass("available").addClass("disabled");
			return;
		}

		["up", "right", "down", "left"].forEach((dir) => {
			const $btn = $(`.arrow-key[data-dir="${dir}"]`);
			if (currentNode.neighbors[dir]) {
				$btn.addClass("available").removeClass("disabled");
			} else {
				$btn.addClass("disabled").removeClass("available");
			}
		});
	}

	function logCurrentNode() {
	var mapName = state.maps.active;
	if (!mapName) {
		console.log("No active map");
		return;
	}

	var mapData = state.maps.data[mapName];
	if (!mapData || !mapData.currentNodeId) {
		console.log("No current node for map:", mapName);
		return;
	}

	var nodeId = mapData.currentNodeId;
	var node = graphs[mapName][nodeId];

	console.log("Current node:", {
		map: mapName,
		nodeId: nodeId,
		node: node
	});
}
	// ==================================================
	// Character selection
	// ==================================================
	function selectCharacter(evt) {
		var clickedIndex = $characters.index(this);

		state.activeCharacter = clickedIndex;

		// show reception screen
		setActiveScreen("reception");

		// timer + UI
		startTimer();
		$scoreboard.addClass("active");

		$locationCharacters.find(".character-" + state.activeCharacter).addClass("active");
		if(clickedIndex === 1) {
			$locationCharacters.addClass("char-2");
		}
	}

	function deSelectCharacter() {
		state.activeCharacter = null;

		setActiveScreen("character");
		resetTimer();

		$scoreBoxes.removeClass("active");
		$scoreboard.removeClass("active");
		$locationCharacterImages.removeClass("active");

		$mapScreens.removeClass("active");
		state.maps.active = null;

		$arrowKeys.removeClass("available").addClass("disabled");
	}

	$characters.on("click", selectCharacter);

	// ==================================================
	// Back button
	// ==================================================
	function refreshBackButtonVisibility() {
		// If any location popup is open → hide Back button
		if ($(".location-screen.active").length > 0) {
			$backButton.removeClass("active");
			return;
		}

		// Otherwise rely on default screen logic
		updateBackButtonLabel();
	}

	function handleBackButtonClick(evt) {
		evt.preventDefault();
		$(".location-screen").removeClass("active");

		if (state.screens.active === "game") {
			// GAME → RECEPTION
			$mapScreens.removeClass("active");
			state.maps.active = null;
			updateAvailableDirections();

			setActiveScreen("reception");

		} else if (state.screens.active === "reception") {
			// RECEPTION → CHARACTER SELECTION
			deSelectCharacter();
		}
	}

	$backButton.on("click", handleBackButtonClick);

	// ==================================================
	// Map links
	// ==================================================
	function handleShowMap(evt, mapName) {
		evt.preventDefault();

		if (!mapName) {
			return;
		}
		if (state.activeCharacter === null) {
			return;
		}

		setActiveMap(mapName);
	}

	$mapLinks.on("click", function (evt) {
		var $this = $(this);
		var mapToShow = $this.data("mapname"); // "centralGround" | "centralFirst" | "outdoor" | "work"
		handleShowMap(evt, mapToShow);
	});

	// ==================================================
	// Arrow key controls (keyboard + on-screen)
	// ==================================================
	$(document).on("keydown", function (evt) {
		var dir = state.KEY_TO_DIR[evt.which];
		if (!dir) {
			return;
		}

		if (state.screens.active !== "game" || !state.maps.active) {
			return;
		}

		evt.preventDefault();
		attemptMove(dir);
	});

	$arrowKeys.on("click", function () {
		var dir = $(this).data("dir");
		if (state.screens.active !== "game" || !state.maps.active) {
			return;
		}
		attemptMove(dir);
	});


	function updateNearbyPlaces(mapName) {
		if (!mapName) {
			mapName = state.maps.active;
		}
		if (!mapName) return;

		var graph = graphs[mapName];
		var mapData = state.maps.data[mapName];
		if (!graph || !mapData || !mapData.currentNodeId) return;

		// 1) Clear previous nearby flags on this map
		$.each(graph, function (id, node) {
			if (node.isPlace) {
				node.$el.removeClass("nearby-place");
			}
		});

		var currentNode = graph[mapData.currentNodeId];
		if (!currentNode) return;

		// 2) For each neighbor of current node:
		//    if the neighbor is a place → mark it as nearby
		$.each(currentNode.neighbors, function (dir, neighborId) {
			var neighborNode = graph[neighborId];
			if (neighborNode && neighborNode.isPlace) {
				neighborNode.$el.addClass("nearby-place");
			}
		});
	}


	// ==================================================
	// Initialisation
	// ==================================================
	initGraphsFromSvg();

	setTimeout(function () {
		$("#state-loading-website").addClass("screen-out");
		setActiveScreen("character");
	}, 200);


	function updateScreenWarning() {
		var w = $(window).width();
		var h = $(window).height();
		var $overlay = $('#screen-warning-overlay');
		var $text = $('.screen-warning-text');

		// Case 1: width < 1220 AND height < 1220
		if (w < 1220 && h < 1220) {
			$text.text('Please view this website on a desktop or laptop for the best experience.');
			$overlay.show();
			$('body').addClass('overlay-active');
		}
		// Case 2: width < 1220 AND height >= 1220
		else if (w < 1220 && h >= 1220) {
			$text.text('For the best experience, please rotate your device to landscape.');
			$overlay.show();
			$('body').addClass('overlay-active');
		}
		// Otherwise, hide the overlay
		else {
			$overlay.hide();
			$('body').removeClass('overlay-active');
		}
	}

	// Run on load
	updateScreenWarning();

	// Run on resize and orientation change
	$(window).on('resize orientationchange', function () {
		updateScreenWarning();
	});
});
