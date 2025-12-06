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
	var $centralMap = $("#central-map");
	var $outdoorMap = $("#outdoor-map");
	var $workMap = $("#work-map");
	var $mapScreens = $centralMap.add($outdoorMap).add($workMap);

	// player elements (for currently active map)
	var $player = null;
	var $playerRing = null;

	// Map of work-map locations to popup screen IDs
	const workMapScreens = {
		locKitchenette: "theKitchenette",
		locAltWork: "theAlternameWorkArea",
		locMeetRoom: "theMeetingRooms",
		locBreakout: "breakoutArea",
		locFocus: "theFocusRooms",
		locHuddle: "huddle",
		locSmallKitchenette: "theSmallKitchenette",
	};


	// scorecards lookup per map
	var scoreCardsByMap = {
		central: $centralScoreCards,
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
			all: ["central", "outdoor", "work"],
			data: {
				central: {
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
		central: {},
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
		$centralScore.toggleClass("active", mapName === "central");
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

			var $cards = scoreCardsByMap[mapName];
			if ($cards && $cards.length) {
				$cards
					.filter('[data-region="' + regionId + '"]')
					.addClass("active");
			}
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

				graph[id] = {
					id: id,
					$el: $node,
					x: cx,
					y: cy,
					neighbors: neighbors,
					isPlace: isPlace,
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

		// Update state
		mapData.currentNodeId = nextNodeId;
		markVisitedNode(mapName, nextNodeId);
		markTraversedEdge(mapName, currentNodeId, nextNodeId);

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
		if (mapName === "central") $cards = $centralScoreCards;
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
	// ==================================================
	// Place (Location) handling
	// ==================================================
	function markVisitedPlace(mapName, nodeId) {
		var graph   = graphs[mapName];
		var mapData = state.maps.data[mapName];
		if (!graph || !mapData) return;

		if (!mapData.visitedPlaces[nodeId]) {
			mapData.visitedPlaces[nodeId] = true;

			var node = graph[nodeId];
			if (node && node.isPlace) {
				node.$el.addClass("visited-place");

				var regionId = node.$el.data("region") || nodeId;
				markRegionVisited(mapName, regionId);

				console.log("[game] visited place node:", nodeId, "map:", mapName, "region:", regionId);

				var screen = node.$el.data("screen-target");
				if (screen) {
					$(".location-screen").removeClass("active");
					$(screen).addClass("active");
				}
			}

			// Update UI counts
			updateScoreboard(mapName);

			// 🔔 Check if this map is now 100% explored
			checkMapCompletion(mapName);
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

	function checkMapCompletion(mapName) {
		if (!mapName || !graphs[mapName]) return;

		var graph   = graphs[mapName];
		var mapData = state.maps.data[mapName];
		if (!mapData) return;

		// 1) List all PLACE nodes in this map (locA, locB, locMeeting, etc.)
		var allPlaces = Object.keys(graph).filter(function (id) {
			return graph[id].isPlace; // set in initGraphsFromSvg
		});

		// 2) Get visited place IDs from your state (markVisitedPlace fills this)
		var visitedPlacesObj = mapData.visitedPlaces || {};
		var visitedPlaceIds  = Object.keys(visitedPlacesObj);

		// 3) If we have at least 1 place, and all of them are visited
		if (allPlaces.length > 0 && visitedPlaceIds.length === allPlaces.length) {

			// 4) Only fire once per map
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
		var activeMap = state.maps.active;
		var mapData = state.maps.data[activeMap];
		var graph = graphs[activeMap];

		if (!activeMap || !graph || !mapData) {
			$arrowKeys.removeClass("available").addClass("disabled");
			return;
		}

		var currentNode = graph[mapData.currentNodeId];

		["up", "right", "down", "left"].forEach(dir => {
			var $btn = $(`.arrow-key[data-dir="${dir}"]`);
			if (currentNode.neighbors[dir]) {
				$btn.addClass("available").removeClass("disabled");
			} else {
				$btn.addClass("disabled").removeClass("available");
			}
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
	function handleBackButtonClick(evt) {
		evt.preventDefault();

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
		var mapToShow = $this.data("mapname"); // "central" | "outdoor" | "work"
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
});
