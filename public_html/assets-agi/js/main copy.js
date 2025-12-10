$(function () {

	// ================================================== All important elements and variables
	var $characterSelectionScreen = $("#character-selection-screen");
	var $characters = $("#character-selection-box .character-box");
	var $receptionScreen = $("#reception-screen");
	var $scoreboard = $("#scoreboard");
	var $scoreBoxes = $scoreboard.find(".score-box");
	var $backButton = $("#back-btn");
	var $locationCharacters = $(".location-character");
	var $locationCharacterImages = $(".location-character-img");
	var $mapLinks = $(".map-link");
	var $arrowKeys = $(".arrow-key");
	var $centralScore = $("#central-score");
	var $centralScoreCards = $centralScore.find(".score-box");
	var $outdoorScore = $("#outdoor-score");
	var $outdoorScoreCards = $outdoorScore.find(".score-box");
	var $workScore = $("#work-score");
	var $workScoreCards = $workScore.find(".score-box");

	var $player = null;
	var $playerRing = null;

	// ================================================== Custom scrollbars
	$('.scroll-box').mCustomScrollbar({
		axis: 'y',
		scrollInertia: 300,
		mouseWheel: {
			enable: true,
			scrollAmount: 'auto'
		},
		advanced: {
			autoExpandHorizontalScroll: true,
			updateOnContentResize: true
		},
		// theme: 'minimal-dark',
		callbacks: {
			onOverflowY: function () {
				// vertical scrolling required
				$(this).addClass('has-scroll');
			},
			onOverflowYNone: function () {
				// vertical scrolling NOT required
				$(this).removeClass('has-scroll');
			}
		}
	});

	// ===================================================
	// =================================================== Confetti
	// ===================================================
	// $('#win-button').on('click', function () {
	// 	confetti({
	// 		particleCount: 80,
	// 		angle: 60,
	// 		spread: 55,
	// 		origin: { x: 0 }
	// 	});

	// 	confetti({
	// 		particleCount: 80,
	// 		angle: 120,
	// 		spread: 55,
	// 		origin: { x: 1 }
	// 	});
	// });

	// ===================================================
	// =================================================== SVG's
	// ===================================================
	const outDoorSVG = `<svg width="0" height="0" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="position: absolute; width: 0; height: 0; overflow: hidden;"></svg>`;

	// ===================================================
	// =================================================== State Object
	// ===================================================
	// central = 0, outdoor = 1, work = 2
	// central regions: groundFloorCafeteria, firstFloorCareteria, theTrainingRoom, eventSpace
	// outdoor regions: theOutdoorCoffeeKiosk, theBasketballCourt, theJoggingTrack, theAmphitheater, thePickleballCourt, theOutdoorTeaKiosk
	// work regions: theKitchenette, theAlternameWorkArea, theMeetingRooms, breakoutArea, theFocusRooms, huddle, theSmallKitchenette
	const state = {
		screens: {
			active: "site-loading",
			list: ["site-loading", "character", "reception", "game"],
		},
		activeMap: null,
		activePath: null,
		activeRegion: null,
		activeCharacter: null,
		keys: {
			active: null,
			all: ["left", "top", "right", "bottom"]
		},
		init: function () {},
		KEY_TO_DIR : {
			37: "left",
			38: "up",
			39: "right",
			40: "down"
		}
	};

	// ================================================== Removing the Website loading screen
	setTimeout(() => {
		$('#state-loading-website').addClass('screen-out');
		$characterSelectionScreen.addClass("active");
		// set active screen
		state.screens.active = "character";
	}, 2000);

	// ===================================================
	// =================================================== Timer
	// ===================================================
	let timerInterval = null;
	let totalSeconds = 0;
	
	function pad(num) {
		return num < 10 ? '0' + num : '' + num;
	}
	
	function updateTimerDisplay() {
		const mins = Math.floor(totalSeconds / 60);
		const secs = totalSeconds % 60;
		
		$('#timer-mins').text(pad(mins));
		$('#timer-secs').text(pad(secs));
	}
	
	function startTimer() {
		// Restart timer on every click
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
		// Stop the interval completely
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		// Reset time to default
		totalSeconds = 0;
		// Update UI
		updateTimerDisplay();
	}

	
	// ===================================================
	// =================================================== Character selection
	// =================================================== 
	function selectCharacter(evt) {
		var clickedIndex = $characters.index(this);
		// set active character ins tate
		state.activeCharacter = clickedIndex;
		// remove character screen
		$characterSelectionScreen.removeClass("active");
		// add reception screen
		$receptionScreen.addClass("active");
		// set active screen in state
		state.screens.active = "reception";
		// start game timer
		startTimer();
		// show scroreboard
		$scoreboard.addClass("active");
		// show back button
		$backButton.addClass("active");
		// enable selected character everywhere
		$locationCharacters.find(".character-" + state.activeCharacter).addClass("active");
	}
	function deSelectCharacter(evt) {
		// set active character to null in state
		state.activeCharacter = null;
		// remove reception screen
		$receptionScreen.removeClass("active");
		// add character screen
		$characterSelectionScreen.addClass("active");
		// set active screen to character
		state.screens.active = "character";
		// stop game timer
		resetTimer();
		// hide scoreboard
		$scoreboard.addClass("active");
		// remove active classes from all the scoreboxes
		$scoreBoxes.removeClass("active");
		// hide scroreboard
		$scoreboard.removeClass("active");
		// hide back button
		$backButton.removeClass("active");
		// hide chatacters everywhere
		$locationCharacterImages.removeClass("active");
	}
	$characters.on("click", selectCharacter);


	// =================================================== Back button
	function handleBackButtonClick(evt) {
		evt.preventDefault();
		if(state.screens.active === "reception") {
			deSelectCharacter();
		}
	}
	$backButton.on("click", handleBackButtonClick);

	
	// =================================================== Map links
	function handleShowMap(evt, mapName) {
		evt.preventDefault();
		if(mapName === "outdoor") {
			// remove current active screen
			$("#" + state.screens.active + "-screen").removeClass("active");
			// activate screen with given mapname
			$("#" + mapName + "-map").addClass("active");
			// set active map
			state.activeMap = mapName;


		}
	}
	$mapLinks.on("click", function(evt) {
		var $this = $(this);
		var mapToShow = $this.data("mapname");
		handleShowMap(evt, mapToShow);
	});
});

