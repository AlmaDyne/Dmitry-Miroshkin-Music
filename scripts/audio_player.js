import { tracklistData } from './tracklist.js';
import { eventManager } from './function_storage.js';
import { configClassic } from './controls_config_classic.js';
import { configStylish } from './controls_config_stylish.js';
import { HoverIntent } from './hover_intent.js';

console.log(localStorage);
//localStorage.clear();

// Constants-anchors
const cssRoot = document.querySelector(':root');
const preloader = document.getElementById('preloader');
const audioPlayerContainer = document.getElementById('audio-player-container');
const audioPlayer = document.getElementById('audio-player');
const tooltip = document.getElementById('tooltip');
const startInfoDisplay = document.getElementById('start-info-display');
const trackTitleDisplay = document.getElementById('title-display');
const artistNameDisplay = document.getElementById('artist-display');
const curTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('duration');
const timeRange = document.getElementById('time-range');
const timeLine = document.getElementById('time-line');
const timeBar = document.getElementById('time-bar');
const audioControls = document.querySelector('audio-controls');
const playPauseBtn = document.getElementById('play-pause');
const stopBtn = document.getElementById('stop');
const rewindBtn = document.getElementById('rewind');
const forwardBtn = document.getElementById('forward');
const indicator = document.getElementById('indicator');
const shuffleBtn = document.getElementById('shuffle');
const repeatBtn = document.getElementById('repeat');
const volumeBtn = document.getElementById('volume');
const volumeRange = document.getElementById('volume-range');
const volumeLine = document.getElementById('volume-line');
const volumeBar = document.getElementById('volume-bar');
const playlistContainer = document.getElementById('playlist-container');
const playlistLim = document.getElementById('playlist-limiter');
const visPlaylistArea = document.getElementById('visible-playlist-area');
const playlist = document.getElementById('playlist');
const playlistScrollArrowUp = document.getElementById('playlist-scroll-arrow-up');
const playlistScrollArrowDown = document.getElementById('playlist-scroll-arrow-down');
const configBtn = document.getElementById('configuration');
const colorBtn = document.getElementById('coloring');
const playlistStyleBtn = document.getElementById('playlist-style');
const keysInfoBtn = document.getElementById('info');
const keysInfoWin = document.getElementById('keys-info-window');

// Calculated and transformed constants
const commonSpacing = parseInt(getComputedStyle(audioPlayerContainer).getPropertyValue('--common-spacing')),
    timeLineMrgnLeft = Math.abs(parseInt(getComputedStyle(timeLine).marginLeft)), 
    trackHeight = parseInt(getComputedStyle(playlistLim).getPropertyValue('--track-height'))
;

// Setted constants
const MAX_LOADED_AUDIOS = 5,
    TIMELINE_POSITION_STEP = 2,
    TIMELINE_UPDATE_INTERVAL = 200,
    LAG = 16.7,
    ACCELERATION_FACTOR = 5,
    ACCELERATION_DELAY = 750,
    DEFAULT_SCROLLING_TIME = 150,
    KEY_SCROLLING_TIME = 120,
    PLAYLIST_FINISH_DELAY = 500,
    HIDE_SCROLL_ELEMENTS_DELAY = 500
;

// Constants-collections and other
const origOrderedAudios = [],
    curOrderedAudios = [],
    orderedDownloads = [],
    tooltipHoverIntentByElem = new WeakMap(),
    highlightedBtns = new Map(),
    cachedAudioPool = new Set(),
    activeScrollKeys = new Set(),
    activeStepAccKeys = new Set(),
    canceledStepAccKeys = new Set(),
    titleMoveTimers = {},
    animationDelays = {}
;

// Variables
let accelerateScrolling = false;
let pointerModeScrolling = false;
let activeScrollAndAlign = false;
let activeScrollOnKeyRepeat = false;
let activeScrollInPointerMode = false;
let cursorOverPlaylist = false;
let scrollablePlaylist = false;
let scrollElemsDisplaying = false;
let playOn = false;
let timePosSeeking = false;
let timeRangeEnter = false;
let timeLinePos = 0;
let timerTimeLineUpd = null;
let timerAccelerateAudioDelay = null;
let timerFinishPlay = null;
let timerHideScrollElems = null;
let timerAccelerateScrolling = null;
let requestCheckCurTime = null;
let requestAligningScroll = null;
let requestScrollInPointerMode = null;
let requestScrollOnKeyRepeat = null;
let savedActiveElem = null;
let playlistLimScrollDirection = null;
let playlistLimScrollTop = 0;
let curAccelerateKey = null;
let acceleratePlaying = true;
let acceleration = false;
let accelerationType = 'none';
let removingTracksNum = 0;
let selectedAudio;

const DEFAULTS_DATA = {
    'audio-player-volume': 0.75,
    'scroll-elements-opacity': 70,
    'wheel-scroll-step': 2
};

const executeTaskHoverIntentStrategies = {
    'time-range': executeTimeRangeTask,
    'volume-range': executeVolumeRangeTask
};

const accelerationData = {
    types: {
        'fast-forward': {
            playbackRate: ACCELERATION_FACTOR,
            classIcons: {
                accOn: 'icon-fast-forward',
                accOff: 'icon-to-end'
            },
            button: forwardBtn
        },
        'fast-rewind': {
            playbackRate: -ACCELERATION_FACTOR,
            classIcons: {
                accOn: 'icon-fast-backward',
                accOff: 'icon-to-start'
            },
            button: rewindBtn
        },
        'none': {
            playbackRate: 1
        }
    },

    keys: {
        KeyA: {
            stepFunc: stepBack,
            accelerationType: 'fast-rewind',
            button: rewindBtn
        },
        KeyD: {
            stepFunc: stepForward,
            accelerationType: 'fast-forward',
            button: forwardBtn
        },
        ArrowLeft: {
            stepFunc: stepBack,
            accelerationType: 'fast-rewind',
            button: rewindBtn
        },
        ArrowRight: {
            stepFunc: stepForward,
            accelerationType: 'fast-forward',
            button: forwardBtn
        },
        PointerRewind: {
            stepFunc: stepBack,
            accelerationType: 'fast-rewind',
            button: rewindBtn
        },
        PointerForward: {
            stepFunc: stepForward,
            accelerationType: 'fast-forward',
            button: forwardBtn
        }
    }
};

const scrollingKeysData = {
    'ArrowUp': {
        direction: 'up',
        factor: 1,
        deltaHeight: function() { return trackHeight * this.factor }
    },
    'ArrowDown': {
        direction: 'down',
        factor: 1,
        deltaHeight: function() { return trackHeight * this.factor }
    },
    'PageUp': {
        direction: 'up',
        factor: 3,
        deltaHeight: function() { return trackHeight * this.factor }
    },
    'PageDown': {
        direction: 'down',
        factor: 3,
        deltaHeight: function() { return trackHeight * this.factor }
    },
    'Home': {
        direction: 'up',
        deltaHeight: function() { return playlistLim.scrollTop }
    },
    'End': {
        direction: 'down',
        deltaHeight: function() {
            return playlistLim.scrollHeight - (playlistLim.scrollTop + playlistLim.clientHeight)
        }
    }
};

/////////////////////////
// Selected track info //
/////////////////////////

function showTrackInfo(audio, prevSelected = null) {
    startInfoDisplay.hidden = true;

    keepSelectedTitleVisible(audio);
    tooltipHoverIntentByElem.get(timeRange).executeTask();

    if (audio !== prevSelected) {
        if (prevSelected) disconnectAudioHandlers(prevSelected);
        connectAudioHandlers(audio);

        clearTitlesMovingTimers();

        trackTitleDisplay.textContent = audio.dataset.title;
        artistNameDisplay.textContent = audio.dataset.artist;
        
        trackTitleDisplay.style.left = '';
        artistNameDisplay.style.left = '';

        moveTitles(trackTitleDisplay, artistNameDisplay);
    }
    
    if (audio.duration) {
        updateTimeDisplay({ audio });
        updateDurationDisplay({ audio });
    } else {
        updateTimeDisplay({ displayStr: '??:??' });
        updateDurationDisplay({ displayStr: '??:??' });

        audio.ondurationchange = () => {
            if (audio !== selectedAudio) return;

            updateDurationDisplay({ audio });
            audio.currentTime = timeLinePos * audio.duration / timeRange.offsetWidth;

            if (acceleration) {
                clearUpdTimers();
                runUpdTimers(audio);
            } else {
                updateTimeDisplay({ audio });
            }

            tooltipHoverIntentByElem.get(timeRange).executeTask();
        };
    }

    updateTimeLine(audio);
}

function connectAudioHandlers(audio) {
    audio.onplaying = () => {
        hideLoading(audio);

        if (audio === selectedAudio && playOn && !timePosSeeking) {
            console.log('playing | ' + audio.dataset.title);

            window.dispatchEvent(new CustomEvent('startAudioPlaying'));

            clearUpdTimers();
            audio.volume = settedVolume;
            indicator.classList.add('active');

            try {
                audio.playbackRate = accelerationData.types[accelerationType].playbackRate;
            } catch(error) {
                console.error(error.name + ': ' + error.message);
        
                if (error.name === 'NotSupportedError') {
                    acceleratePlaying = false;
                    audio.pause();
                }
            }

            runUpdTimers(audio);
            saveLastPlayedAudioInfo(audio);
        } else {
            console.log('pause after ready | ' + audio.dataset.title);

            audio.pause();

            if (audio !== selectedAudio) audio.onplaying = null;
        }
    };
    
    audio.onended = () => {
        if (timePosSeeking) return;
        if (timerFinishPlay) return;
        if (acceleration && accelerationType === 'fast-rewind') return;

        if (acceleration && accelerationType === 'fast-forward') {
            console.log(`track ended in ${accelerationType} | ${audio.dataset.title}`);
        } else if (!acceleration) {
            console.log('track ended | ' + audio.dataset.title);
        }

        finishTrack(audio);
    };

    audio.onpause = () => {
        indicator.classList.remove('active');
    };

    audio.onwaiting = () => {
        console.log('waiting | ' + audio.dataset.title);

        clearUpdTimers();
        showLoading(audio);
        audio.volume = 0;

        if (acceleration) runUpdTimers(audio);
    };
    
    audio.onseeking = () => {
        setTimeout(() => {
            if (!audio.seeking) return;

            showLoading(audio);

            audio.onseeked = () => {
                console.log('seeked! readyState = ' + audio.readyState + ' | ' + audio.dataset.title);

                hideLoading(audio);

                audio.onseeked = null;
            };
        }, LAG); // Audio ready state update delay
    };
}

function disconnectAudioHandlers(audio) {
    if (audio.paused) audio.onplaying = null;
    audio.onended = null;
    audio.onpause = null;
    audio.onwaiting = null;
    audio.onseeking = null;

    if (cachedAudioPool.size >= MAX_LOADED_AUDIOS) {
        let firstAudio = cachedAudioPool.values().next().value;
        clearAudioCache(firstAudio);
        hideLoading(firstAudio);
    }
}

function clearAudioCache(audio) {
    cachedAudioPool.delete(audio);
    audio.removeAttribute('src');
    audio.load();
}

function moveTitles(...titles) {
    for (let title of titles) {
        let boxWidth = audioPlayer.querySelector('.selected-track').offsetWidth;
        let titleWidth = title.offsetWidth;
        if (titleWidth <= boxWidth) return;

        title.style.left = 0;

        let timerTitleMove = setTimeout(() => {
            let diffWidth = boxWidth - titleWidth;
            let pos = 0;

            timerTitleMove = requestAnimationFrame(function shiftTitle() {
                title.style.left = --pos + 'px';

                if (pos <= diffWidth) {
                    timerTitleMove = setTimeout(moveTitles, 1500, title);
                } else {
                    timerTitleMove = requestAnimationFrame(shiftTitle);
                }
                titleMoveTimers[title.id + '-timer'] = timerTitleMove;
            });
            titleMoveTimers[title.id + '-timer'] = timerTitleMove;
        }, 1000);
        titleMoveTimers[title.id + '-timer'] = timerTitleMove;
    }
}

/////////////////////////////////////////////
// Audio player controls - Play/Pause/Stop //
/////////////////////////////////////////////

playPauseBtn.onclick = playPauseAction;

window.addEventListener('pauseAudio', playPauseAction);

function playPauseAction() {
    if (!selectedAudio) {
        selectedAudio = curOrderedAudios[0];
        if (!selectedAudio) return;

        setSelected(selectedAudio);
        if (timeRangeEnter) enterTimeRange();
        showTrackInfo(selectedAudio);
    }

    clearFinPlayTimer();
    clearUpdTimers();

    if (!playOn) {
        console.log('play (knob) | ' + selectedAudio.dataset.title);

        setPlayState();
        playAudio(selectedAudio);
    } else {
        console.log('pause (knob) | ' + selectedAudio.dataset.title);

        setPauseState();
        pauseAudio(selectedAudio);
        if (acceleration && !timePosSeeking) runUpdTimers(selectedAudio);
    }
}

function pauseAudio(audio) {
    if (audio.readyState >= 3) {
        audio.pause();
        updateTimeDisplay({ audio });
    }
}

function playAudio(audio) { // playOn = true
    indicator.classList.remove('active');

    if (!audio.src) {
        audio.src = audio.dataset.src;
        cachedAudioPool.add(audio);

        if (!audio.duration) showLoading(audio);
        runPlaying(audio);
    } else {
        if (audio.duration && audio.paused) {
            runPlaying(audio);
        } else if (acceleration) {
            runUpdTimers(audio);
        }
    }

    function runPlaying(audio) {
        /*if (acceleration && accelerationType === 'fast-rewind' && audio.ended === true) {
            audio.currentTime = 0;
            audio.currentTime = audio.duration;
        }*/

        audio.volume = 0;
        audio.preservesPitch = false;
        acceleratePlaying = true;

        audio.play().catch(error => {
            if (error.name !== 'AbortError') {
                console.error(error);
            }
        });
    }
}

stopBtn.onclick = stopAction;

function stopAction() {
    if (!selectedAudio) return;
    if (timerFinishPlay) return;

    console.log('stop (knob) | ' + selectedAudio.dataset.title);

    clearUpdTimers();
    if (playOn) pauseAudio(selectedAudio);
    finishPlaying();
}

function setPlayState() {
    playOn = true;
    window.dispatchEvent(new CustomEvent('audioPlayerState', { detail: { playOn } }));

    playPauseBtn.classList.remove('icon-play');
    playPauseBtn.classList.add('icon-pause');
}

function setPauseState() {
    playOn = false;
    window.dispatchEvent(new CustomEvent('audioPlayerState', { detail: { playOn } }));

    playPauseBtn.classList.remove('icon-pause');
    playPauseBtn.classList.add('icon-play');
}

///////////////////////////////////
// Audio player controls - FW/RW //
///////////////////////////////////

// Pointer step/acceleration handlers
for (let button of [rewindBtn, forwardBtn]) {
    let key = 'Pointer' + button.id[0].toUpperCase() + button.id.slice(1);

    button.onpointerdown = function(event) {
        if (event.button !== 0) return;

        this.setPointerCapture(event.pointerId);

        downKeyStepAccAction(key);
    };
    
    button.onpointerup = function() {
        upKeyStepAccAction(key);
    };

    button.oncontextmenu = (event) => {
        if (event.pointerType !== 'mouse') return false;
    }

    button.onpointercancel = () => {
        clearTimeout(timerAccelerateAudioDelay);
        if (acceleration) stopAcceleration();

        curAccelerateKey = null;
        activeStepAccKeys.clear();
        canceledStepAccKeys.clear();
    };
}

function downKeyStepAccAction(key) {
    clearTimeout(timerAccelerateAudioDelay);
    activeStepAccKeys.add(key);
    if (!selectedAudio) return;

    timerAccelerateAudioDelay = setTimeout(runAcceleration, ACCELERATION_DELAY);
}

function upKeyStepAccAction(key) {
    if (!activeStepAccKeys.size) return;

    clearTimeout(timerAccelerateAudioDelay);
    activeStepAccKeys.delete(key);

    if (activeStepAccKeys.size) {
        if (acceleration) {
            if (key === curAccelerateKey) {
                runAcceleration();
            } else {
                if (!canceledStepAccKeys.has(key)) {
                    if (!timePosSeeking) accelerationData.keys[key].stepFunc();
                } else {
                    canceledStepAccKeys.delete(key);
                }
            }
        } else {
            if (!timePosSeeking) accelerationData.keys[key].stepFunc();
            timerAccelerateAudioDelay = setTimeout(runAcceleration, ACCELERATION_DELAY);
        }
    } else {
        if (acceleration) {
            stopAcceleration();
        } else {
            if (!timePosSeeking) accelerationData.keys[key].stepFunc();
        }

        curAccelerateKey = null;
        canceledStepAccKeys.clear();
    }
}

function runAcceleration() {
    if (timerFinishPlay) return;

    canceledStepAccKeys.clear();
    activeStepAccKeys.forEach(activeKey => canceledStepAccKeys.add(activeKey));
    
    curAccelerateKey = Array.from(activeStepAccKeys)[activeStepAccKeys.size - 1];
    let keyAccType = accelerationData.keys[curAccelerateKey].accelerationType;

    if (keyAccType !== accelerationType) {
        if (acceleration) stopAcceleration();
        accelerationType = keyAccType;
        if (selectedAudio) accelerate(selectedAudio);
    }
}

function stepBack() {
    if (!selectedAudio) {
        selectedAudio = curOrderedAudios[curOrderedAudios.length - 1];
        if (!selectedAudio) return;

        console.log('step-rewind track selecting | ' + selectedAudio.dataset.title);
        
        setSelected(selectedAudio);
        if (timeRangeEnter) enterTimeRange();
        showTrackInfo(selectedAudio);
        return;
    }

    if (
        (selectedAudio.duration && selectedAudio.currentTime <= 3) ||
        (!selectedAudio.duration && !timeLinePos)
    ) { 
        if (!curOrderedAudios.length) return; // Playlist is cleared, selected audio is in the temporary track box

        clearFinPlayTimer();
        clearUpdTimers();
    
        if (playOn) pauseAudio(selectedAudio);

        let prevSelectedAudio = selectedAudio;
        let idx = curOrderedAudios.findIndex(aud => aud === selectedAudio);
        let prevAudio = curOrderedAudios[--idx];
        
        removeSelected(prevSelectedAudio);
        selectedAudio = prevAudio ? prevAudio : curOrderedAudios[curOrderedAudios.length - 1];
        setSelected(selectedAudio);

        console.log('step-rewind track selecting | ' + selectedAudio.dataset.title);

        prevSelectedAudio.currentTime = 0;
        selectedAudio.currentTime = 0;
        timeLinePos = 0;
        
        showTrackInfo(selectedAudio, prevSelectedAudio);

        if (playOn) {
            playAudio(selectedAudio);
        } else if (acceleration) {
            runUpdTimers(selectedAudio);
        }
    } else {
        console.log('skip to start | ' + selectedAudio.dataset.title);

        clearFinPlayTimer();

        selectedAudio.currentTime = 0;
        timeLinePos = 0;

        keepSelectedTitleVisible(selectedAudio);
        if (selectedAudio.duration) updateTimeDisplay({ audio: selectedAudio });
        updateTimeLine(selectedAudio);
    }
}

function stepForward() {
    if (!selectedAudio) {
        selectedAudio = curOrderedAudios[0];
        if (!selectedAudio) return;

        console.log('step-forward track selecting | ' + selectedAudio.dataset.title);

        setSelected(selectedAudio);
        if (timeRangeEnter) enterTimeRange();
        showTrackInfo(selectedAudio);
        return;
    }

    if (!curOrderedAudios.length) return; // Playlist is cleared, selected audio is in the temporary track box

    clearFinPlayTimer();
    clearUpdTimers();

    if (playOn) pauseAudio(selectedAudio);
    
    let prevSelectedAudio = selectedAudio;
    let idx = curOrderedAudios.findIndex(aud => aud === selectedAudio);
    let nextAudio = curOrderedAudios[++idx];

    removeSelected(prevSelectedAudio);
    selectedAudio = nextAudio ? nextAudio : curOrderedAudios[0];
    setSelected(selectedAudio);

    console.log('step-forward track selecting | ' + selectedAudio.dataset.title);

    prevSelectedAudio.currentTime = 0;
    selectedAudio.currentTime = 0;
    timeLinePos = 0;

    showTrackInfo(selectedAudio, prevSelectedAudio);

    if (playOn) {
        playAudio(selectedAudio);
    } else if (acceleration) {
        runUpdTimers(selectedAudio);
    }
}

function accelerate(audio) {
    console.log(`start ${accelerationType} acceleration`);

    acceleration = true;

    let accBtn = accelerationData.types[accelerationType].button;
    accBtn.className = accelerationData.types[accelerationType].classIcons.accOn;

    clearUpdTimers();

    try {
        audio.playbackRate = accelerationData.types[accelerationType].playbackRate;
    } catch(error) {
        console.error(error.name + ': ' + error.message);

        if (error.name === 'NotSupportedError') {
            acceleratePlaying = false;
            if (playOn && audio.readyState >= 3) audio.pause();
        }
    }

    console.log('playbackRate = ' + audio.playbackRate);

    if (!timePosSeeking) runUpdTimers(audio);
}

function stopAcceleration() {
    console.log(`stop ${accelerationType} acceleration`);

    clearUpdTimers();

    let accBtn = accelerationData.types[accelerationType].button;
    accBtn.className = accelerationData.types[accelerationType].classIcons.accOff;

    acceleratePlaying = true;
    acceleration = false;
    accelerationType = 'none';

    selectedAudio.playbackRate = accelerationData.types[accelerationType].playbackRate;

    updateTimeLine(selectedAudio);

    if (playOn) {
        if (selectedAudio.paused) {
            playAudio(selectedAudio);
        } else if (selectedAudio.readyState >= 3) {
            runUpdTimers(selectedAudio);
        }
    } else {
        if (selectedAudio.duration) {
            updateTimeDisplay({ audio: selectedAudio });
        }
    }
}

function stopAccelerationAndClear() {
    if (!activeStepAccKeys.size) return;

    clearTimeout(timerAccelerateAudioDelay);
    if (acceleration) stopAcceleration();

    curAccelerateKey = null;
    activeStepAccKeys.clear();
    canceledStepAccKeys.clear();
}

/////////////////////////////////////
// Audio player controls - Shuffle //
/////////////////////////////////////

shuffleBtn.onclick = shuffleAction;

function shuffleAction() {
    let isActive = shuffleBtn.firstElementChild.classList.toggle('active');
    setPlaylistOrder(!isActive);
};

function setPlaylistOrder(isOriginalOrder) {
    if (!origOrderedAudios.length) return;

    console.log(`${isOriginalOrder ? 'origin' : 'random'} track order`);

    if (isOriginalOrder) {
        curOrderedAudios.length = 0;
        origOrderedAudios.forEach(audio => curOrderedAudios.push(audio));
    } else {
        shuffle(curOrderedAudios);
    }
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

////////////////////////////////////
// Audio player controls - Repeat //
////////////////////////////////////

repeatBtn.onclick = repeatAction;

function repeatAction() {
    const circleBackground = repeatBtn.firstElementChild;
    const repeatImg = circleBackground.firstElementChild;
    const repeatStates = ['none', 'playlist', 'track'];
    let idx = repeatStates.indexOf(repeatBtn.dataset.repeat);
    let repeat = repeatStates[idx + 1] || repeatStates[0];

    repeatBtn.setAttribute('data-repeat', repeat);

    console.log('repeat: ' + repeatBtn.dataset.repeat);

    switch (repeat) {
        case 'none':
            circleBackground.classList.remove('active');
            repeatImg.src = 'img/icons/repeat_playlist.png';
            repeatImg.alt = 'Repeat Playlist';
            break;
        case 'playlist':
            circleBackground.classList.add('active');
            repeatImg.src = 'img/icons/repeat_playlist.png';
            repeatImg.alt = 'Repeat Playlist';
            break;
        case 'track':
            circleBackground.classList.add('active');
            repeatImg.src = 'img/icons/repeat_track.png';
            repeatImg.alt = 'Repeat Track';
            break;
    }
}

////////////////////////////////////
// Audio player controls - Volume //
////////////////////////////////////

function changeVolumeAction(changeType, keyRepeat) {
    if (changeType !== 'increase' && changeType !== 'reduce') return;

    if (settedVolume && !keyRepeat) savedVolume = settedVolume;

    const step = 2;
    let xPos = settedVolume * (volumeRange.offsetWidth - volumeBar.offsetWidth);
    xPos += changeType === 'increase' ? step : -step;
    let volumePos = moveVolumeAt(xPos);
    setVolume(volumePos);

    showVolumeIcon(settedVolume);
    volumeBar.classList.toggle('active', settedVolume);
    
    tooltipHoverIntentByElem.get(volumeRange).executeTask();
}

volumeBtn.onclick = volumeAction;

function volumeAction() {
    let isActive = volumeBtn.classList.contains('active');
    if (isActive) savedVolume = settedVolume;
    
    let xPos = isActive ? 0 : savedVolume * (volumeRange.offsetWidth - volumeBar.offsetWidth);
    let volumePos = moveVolumeAt(xPos);
    setVolume(volumePos);

    showVolumeIcon(settedVolume);
    volumeBar.classList.toggle('active', !!settedVolume);

    tooltipHoverIntentByElem.get(volumeRange).executeTask();
}

volumeRange.onclick = null;

volumeRange.oncontextmenu = () => {
    if (isTouchDevice) return false;
}

volumeRange.onpointerdown = function(event) {
    if (event.pointerType === 'mouse' && !event.target.closest('#volume-range')) return;

    if (settedVolume) savedVolume = settedVolume;

    changeVolume(event.clientX);

    volumeBar.setPointerCapture(event.pointerId);

    volumeBar.onpointermove = (event) => changeVolume(event.clientX);

    volumeBar.onpointerup = () => {
        if (!settedVolume) volumeBar.classList.remove('active');

        volumeBar.onpointermove = null;
        volumeBar.onpointerup = null;
    };

    function changeVolume(clientX) {
        volumeBar.classList.add('active');

        let xPos = clientX - volumeRange.getBoundingClientRect().left - volumeBar.offsetWidth / 2;
        let volumePos = moveVolumeAt(xPos);
        setVolume(volumePos);

        showVolumeIcon(settedVolume);
    }
};

function moveVolumeAt(x) {
    x = Math.max(x, 0);
    x = Math.min(x, volumeRange.offsetWidth - volumeBar.offsetWidth);

    volumeLine.style.width = x + volumeBar.offsetWidth / 2 + 'px';
    volumeBar.style.left = x + 'px';

    return x;
}
    
function setVolume(pos) {
    settedVolume = pos / (volumeRange.offsetWidth - volumeBar.offsetWidth);
    localStorage.setItem('audio_player_volume', settedVolume);

    if (selectedAudio) selectedAudio.volume = settedVolume;
}

function showVolumeIcon(vol) {
    volumeBtn.className = vol === 0 ? 'icon-volume-off' :
        vol <= 0.5 ? 'icon-volume-down active' :
        vol <= 0.9 ? 'icon-volume active' :
        'icon-volume-up active'
    ;
}
    
function executeVolumeRangeTask() {
    tooltip.textContent = calcVolumeTooltip();
    positionTooltip(volumeBar.getBoundingClientRect(), this.y1, 10);

    function calcVolumeTooltip() {
        return (settedVolume * 100).toFixed(0) + '%';
    }
}

//////////////////////////////////
// Track time and position info //
//////////////////////////////////

timeRange.onclick = null;

timeRange.oncontextmenu = () => {
    if (isTouchDevice) return false;
}

timeRange.onpointerenter = enterTimeRange;

function enterTimeRange() {
    timeRangeEnter = true;

    timeRange.onpointermove = moveOverTimeRange;

    timeRange.onpointerleave = function() {
        timeRangeEnter = false;
        timeBar.hidden = true;
        this.style.cursor = '';

        this.onpointerdown = null;
        this.onpointermove = null;
        this.onpointerleave = null;
    };

    if (!selectedAudio) return;

    timeBar.hidden = false;
    timeRange.style.cursor = 'pointer';

    timeRange.onpointerdown = function(event) {
        if (event.button !== 0) return;

        document.getSelection().empty();

        this.setPointerCapture(event.pointerId);
        this.pointerId = event.pointerId;

        clearFinPlayTimer();
        clearUpdTimers();

        if (playOn) {
            console.log('pause (pointer down on timeline) | ' + selectedAudio.dataset.title);

            pauseAudio(selectedAudio);
        }

        timePosSeeking = true;

        moveOverTimeRange = moveOverTimeRange.bind(this);
        moveOverTimeRange(event);

        this.onpointerup = function() {
            timePosSeeking = false;

            if (playOn) {
                playAudio(selectedAudio);
            } else if (acceleration) {
                runUpdTimers(selectedAudio);
            }

            this.onpointerup = null;
            delete this.pointerId;
        };
    };

    function moveOverTimeRange(event) {
        let x = findXPos(event.clientX);
        let timeBarPos = (x < this.offsetWidth) ? x : x - 1;

        timeBar.style.left = timeBarPos + 'px';

        if (timePosSeeking) {
            document.getSelection().empty();

            timeLinePos = x;
            updateTimePosition(x);
        }
    }

    function findXPos(clientX) {
        let x = clientX - timeRange.getBoundingClientRect().left;
        if (x < 0) x = 0;
        if (x > timeRange.offsetWidth) x = timeRange.offsetWidth;
        return x;
    }

    function updateTimePosition(xPos) {
        if (selectedAudio.duration) {
            selectedAudio.currentTime = xPos * selectedAudio.duration / timeRange.offsetWidth;
            updateTimeDisplay({ audio: selectedAudio });
        }

        updateTimeLine(selectedAudio);
    }
}

function executeTimeRangeTask() {
    if (!selectedAudio) return;

    tooltip.textContent = calcTimeRangeTooltip(this.x1);
    positionTooltip(timeBar.getBoundingClientRect(), this.y1, 5);

    function calcTimeRangeTooltip(xPos) {
        if (!selectedAudio.duration) return '??:??';
    
        let calculatedTime = xPos * selectedAudio.duration / timeRange.offsetWidth;
        if (calculatedTime < 0) calculatedTime = 0;
        if (calculatedTime > selectedAudio.duration) calculatedTime = selectedAudio.duration;
    
        let mins = Math.floor(calculatedTime / 60);
        let secs = Math.floor(calculatedTime - mins * 60);
    
        if (mins < 10) mins = '0' + mins;
        if (secs < 10) secs = '0' + secs;
    
        return calculatedTime = mins + ':' + secs;
    }
}

//////////////////////////////////////
// Updating track time and position //
//////////////////////////////////////

function updateTimeDisplay(options = {}) {
    let { audio = null, displayStr = '**:**', roundTime = false } = options;

    if (audio) {
        console.log(audio.currentTime + ' | ' + audio.dataset.title);

        let mins = roundTime ?
            Math.floor(Math.round(audio.currentTime) / 60) :
            Math.floor(audio.currentTime / 60);
        let secs = roundTime ?
            Math.round(audio.currentTime % 60) :
            Math.floor(audio.currentTime % 60);
    
        if (mins < 10) mins = '0' + mins;
        if (secs < 10) secs = '0' + secs;

        displayStr = mins + ':' + secs;
    }

    [...curTimeDisplay.children].forEach((signBox, idx) => signBox.textContent = displayStr[idx] || '');
}

function updateDurationDisplay(options = {}) {
    let { audio = null, displayStr = '**:**' } = options;

    if (audio) {
        let mins = Math.floor(audio.duration / 60);
        let secs = Math.round(audio.duration % 60);
    
        if (mins < 10) mins = '0' + mins;
        if (secs < 10) secs = '0' + secs;
    
        displayStr = mins + ':' + secs;
    }

    [...durationDisplay.children].forEach((signBox, idx) => signBox.textContent = displayStr[idx] || '');
}

function updateTimeLine(audio) {
    let timeLineWidth = audio.duration ?
        audio.currentTime / audio.duration * 100 :
        timeLinePos / timeRange.offsetWidth * 100;
    
    timeLine.style.width = `calc(${timeLineMrgnLeft}px + ${timeLineWidth}%)`;
}

function runUpdTimers(audio) {
    if (audio.duration) runUpdCurTimeDisplay(audio);
    runUpdateTimeLine(audio, !!audio.duration);
}

function runUpdCurTimeDisplay(audio) {
    updateTimeDisplay({ audio });

    let lastTime = Math.floor(audio.currentTime);

    requestCheckCurTime = requestAnimationFrame(function checkCurTime() {
        let curTime = Math.floor(audio.currentTime);

        if (curTime !== lastTime) {
            updateTimeDisplay({ audio });
            lastTime = curTime;
        }

        requestCheckCurTime = requestAnimationFrame(checkCurTime);
    });
}

function runUpdateTimeLine(audio, hasDuration) {
    const curTimeChangeStep = TIMELINE_UPDATE_INTERVAL / 1000;
    const rateFactor = acceleration ? ACCELERATION_FACTOR : 1;
    const timeLineUpdInterval = TIMELINE_UPDATE_INTERVAL / rateFactor;
    let isTrackFinished = false;
    
    timerTimeLineUpd = setInterval(() => {
        let isCurTimeChanging = hasDuration ? 
            (acceleration && (!playOn || audio.readyState < 3 || !acceleratePlaying)) : 
            acceleration
        ;
        
        if (isCurTimeChanging) {
            switch (accelerationType) {
                case 'fast-forward':
                    if (hasDuration) {
                        audio.currentTime += curTimeChangeStep;
                        isTrackFinished = audio.currentTime >= audio.duration;
                    } else {
                        timeLinePos += TIMELINE_POSITION_STEP;
                        isTrackFinished = timeLinePos >= timeRange.offsetWidth;
                    }
                    break;
                case 'fast-rewind':
                    if (hasDuration) {
                        audio.currentTime -= curTimeChangeStep;
                        isTrackFinished = audio.currentTime <= 0;
                    } else {
                        timeLinePos -= TIMELINE_POSITION_STEP;
                        isTrackFinished = timeLinePos <= 0;
                    }
                    break;
            }
            
            if (isTrackFinished) {
                console.log(`track ended in ${accelerationType} (${hasDuration ? 'no playback' : 'no duration'}) |\
                    ${audio.dataset.title}`);

                finishTrack(audio);
            }
        }
        
        updateTimeLine(audio);
    }, timeLineUpdInterval);
}

////////////////////
// Finish playing //
////////////////////

function finishTrack(audio) {
    clearUpdTimers();

    // Round the current time to the audio duration and extend the timeline over the entire range
    updateTimeDisplay({ audio, roundTime: true });
    updateTimeLine(audio);

    if (repeatBtn.dataset.repeat === 'track') {
        playFollowingAudio(audio);
    } else {
        let idx = curOrderedAudios.findIndex(aud => aud === audio);
        let followingAudio = (acceleration && accelerationType === 'fast-rewind') ?
            curOrderedAudios[--idx] :
            curOrderedAudios[++idx];

        if (followingAudio) {
            playFollowingAudio(followingAudio);
        } else {
            if (acceleration && accelerationType === 'fast-rewind') {
                followingAudio = curOrderedAudios[curOrderedAudios.length - 1];
                if (followingAudio) playFollowingAudio(followingAudio);
            } else {
                let shuffleInfo = shuffleBtn.firstElementChild.classList.contains('active') ? 'shuffle ' : '';

                if (repeatBtn.dataset.repeat === 'playlist') {
                    followingAudio = curOrderedAudios[0];

                    if (followingAudio) {
                        console.log(`repeat ${shuffleInfo}playlist`);

                        playFollowingAudio(followingAudio);
                    } else {
                        console.log(`${shuffleInfo}playlist ended`);

                        finishPlaying();
                    }
                } else if (repeatBtn.dataset.repeat === 'none') {
                    console.log(`${shuffleInfo}playlist ended`);

                    finishPlaying();
                }
            }
        }
    }

    function playFollowingAudio(followingAudio) {
        let prevSelectedAudio = selectedAudio;

        removeSelected(prevSelectedAudio);
        selectedAudio = followingAudio;
        setSelected(selectedAudio);

        console.log('following track selecting | ' + selectedAudio.dataset.title);

        if (!acceleration || (acceleration && accelerationType === 'fast-forward')) {
            prevSelectedAudio.currentTime = 0;
            selectedAudio.currentTime = 0;
            timeLinePos = 0;
        } else if (acceleration && accelerationType === 'fast-rewind') { 
            if (selectedAudio.duration) selectedAudio.currentTime = selectedAudio.duration;
            timeLinePos = timeRange.offsetWidth;
        }

        showTrackInfo(selectedAudio, prevSelectedAudio);

        if (playOn) {
            playAudio(selectedAudio);
        } else if (acceleration) {
            runUpdTimers(selectedAudio);
        }
    }
}

function finishPlaying() {
    console.log('finish playing');
    
    setPauseState();
    clearTitlesMovingTimers();
    clearTimeout(timerAccelerateAudioDelay);
    if (acceleration) stopAcceleration();

    timerFinishPlay = setTimeout(() => {
        stopAccelerationAndClear();

        trackTitleDisplay.textContent = '';
        artistNameDisplay.textContent = '';

        updateTimeDisplay({ displayStr: '--:--' });
        updateDurationDisplay({ displayStr: '--:--' });

        tooltipHoverIntentByElem.get(timeRange).dismissTask();
        timePosSeeking = false;
        timeLine.style.width = timeLineMrgnLeft + 'px';
        timeRange.style.cursor = '';
        timeBar.hidden = true;
        timeRange.onpointerdown = null;
        timeRange.onpointerup = null;
        if (timeRange.pointerId) {
            timeRange.releasePointerCapture(timeRange.pointerId);
            delete timeRange.pointerId;
        }

        selectedAudio.currentTime = 0;
        timeLinePos = 0;
        
        disconnectAudioHandlers(selectedAudio);
        removeSelected(selectedAudio);
        selectedAudio = undefined;

        if (playlistLim.scrollTop) {
            showScrollElems();
            scrollAndAlignPlaylist({
                direction: 'up',
                deltaHeight: playlistLim.scrollTop,
                align: false,
                hide: true
            });
        }
        
        window.scrollTo({
            left: window.scrollX,
            top: 0,
            behavior: 'smooth'
        });

        timerFinishPlay = null;
    }, PLAYLIST_FINISH_DELAY);
}

//////////////////
// Clear timers //
//////////////////

function clearUpdTimers() {
    cancelAnimationFrame(requestCheckCurTime);
    clearInterval(timerTimeLineUpd);
}

function clearTitlesMovingTimers() {
    for (let key in titleMoveTimers) {
        cancelAnimationFrame(titleMoveTimers[key]);
        clearInterval(titleMoveTimers[key]);
        delete titleMoveTimers[key];
    }
}

function clearFinPlayTimer() {
    if (timerFinishPlay) moveTitles(trackTitleDisplay, artistNameDisplay);

    clearTimeout(timerFinishPlay);
    timerFinishPlay = null;
}

//////////////
// Playlist //
//////////////

visPlaylistArea.onpointerover = (event) => {
    if (!event.target.hasAttribute('data-actionable')) return;

    let track = event.target.closest('.track');
    let relTarget = event.relatedTarget;
    if (track.contains(relTarget) && relTarget.hasAttribute('data-actionable')) return;

    let actionableElems = Array.from(track.querySelectorAll('.artist-name, .track-title'));

    actionableElems.forEach(elem => {
        elem.classList.add('hover');
        elem.parentElement.classList.add('visible');
    });

    adjustTrackInfoLimitersWidth(actionableElems);

    track.addEventListener('pointerout', function removeHovers(event) {
        let relTarget = event.relatedTarget;
        if (actionableElems.includes(relTarget)) return;
        
        actionableElems.forEach(elem => {
            elem.classList.remove('hover');
            elem.parentElement.classList.remove('visible');
        });

        if (!removingTracksNum) playlistLim.style.width = '';

        track.removeEventListener('pointerout', removeHovers);
    });
};

function adjustTrackInfoLimitersWidth(actionableElems) {
    if (removingTracksNum) return;

    let maxTrackInfo = actionableElems.reduce(
        (maxElem, elem) => maxElem.offsetWidth > elem.offsetWidth ? maxElem : elem
    );
    
    let maxTrackInfoLeft = maxTrackInfo.getBoundingClientRect().left + window.scrollX;
    let playlistLimLeft = playlistLim.getBoundingClientRect().left + window.scrollX;
    let maxTrackInfoLim = maxTrackInfo.parentElement;
    let maxTrackInfoWidth = maxTrackInfo.offsetWidth;
    let playlistWidth = playlist.offsetWidth;

    if (maxTrackInfoLeft - playlistLimLeft + maxTrackInfoWidth + commonSpacing <= playlistWidth) {
        playlistLim.style.width = '';
        return;
    }

    let docWidth = getDocWidth();
    let shift = isTouchDevice ? 1 : 0; // Bug on some mobile devices

    if (maxTrackInfoLim.hasAttribute('data-animating')) {
        playlistLim.style.width = docWidth - playlistLimLeft - shift + 'px';

        eventManager.addOnceEventListener(maxTrackInfoLim, 'transitionend', () => {
            if (maxTrackInfo.classList.contains('hover')) {
                if (maxTrackInfoLim.classList.contains('visible')) {
                    extendWidth();
                } else { // Works on touchscreen
                    playlistLim.style.width = '';
                }
            }
        });
    } else {
        extendWidth();
    }

    function extendWidth() {
        maxTrackInfoLeft = maxTrackInfo.getBoundingClientRect().left + window.scrollX;
        maxTrackInfoWidth = maxTrackInfo.offsetWidth;

        if (maxTrackInfoLeft - playlistLimLeft + maxTrackInfoWidth + commonSpacing > playlistWidth) {
            playlistLim.style.width = maxTrackInfoLeft - playlistLimLeft + maxTrackInfoWidth + commonSpacing + 'px';
        }
        if (maxTrackInfoLeft + maxTrackInfoWidth + commonSpacing > docWidth) {
            playlistLim.style.width = docWidth - playlistLimLeft - shift + 'px';
        }
    }
}

// Playlist focus and text select handlers
visPlaylistArea.addEventListener('pointerdown', function (event) {
    let outOfVisibleArea = event.clientX > this.getBoundingClientRect().right;
    if (outOfVisibleArea) preventFocus(this);

    if (event.pointerType === 'mouse' && event.button === 1) return;

    if (event.target.closest('.track-info-box')) {
        let trackInfoBox = event.target.closest('.track-info-box');

        if (
            event.target.matches('.artist-name') ||
            event.target.matches('.track-title') ||
            event.target.matches('.status') ||
            event.target.matches('.display-progress')
        ) {
            preventFocus(this);
            preventFocus(trackInfoBox);

            // Prohibiting text selection on the touchscreen
            if (isTouchDevice && event.isPrimary && event.target.hasAttribute('data-actionable')) {
                let maxTrackInfo = event.target;
                maxTrackInfo.style.userSelect = 'none';

                document.addEventListener('pointerup', () => maxTrackInfo.style.userSelect = '', {once: true});
            }
        } else { // Focus handling
            if (document.activeElement === trackInfoBox) {
                event.preventDefault();
                setTimeout(() => trackInfoBox.focus());
            } else {
                trackInfoBox.removeAttribute('tabindex');
                this.focus({preventScroll: true});
                setTimeout(() => trackInfoBox.setAttribute('tabindex', 0));
            }
        }
    } else if (event.target.matches('.remove-track')) {
        preventFocus(this);
    }

    function preventFocus(elem) {
        elem.removeAttribute('tabindex');
        setTimeout(() => elem.setAttribute('tabindex', 0));
    }
});

visPlaylistArea.onclick = (event) => {
    // Artist name or track title
    if (event.target.hasAttribute('data-actionable')) {
        let track = event.target.closest('.track');
        selectPlaylistTrack(track);
    }
};

function selectPlaylistTrack(track) {
    if (document.getSelection().toString().length) return;

    let newAudio = track.querySelector('audio');

    console.log('playlist track selecting | ' + newAudio.dataset.title);

    setPlayState();
    
    if (!selectedAudio) {
        selectedAudio = newAudio;

        setSelected(selectedAudio);
        if (timeRangeEnter) enterTimeRange();
        showTrackInfo(selectedAudio);
        playAudio(selectedAudio);
        return;
    }

    clearFinPlayTimer();

    if (newAudio !== selectedAudio) {
        clearUpdTimers();
    
        if (playOn) pauseAudio(selectedAudio);
    
        let prevSelectedAudio = selectedAudio;

        removeSelected(prevSelectedAudio);
        selectedAudio = newAudio;
        setSelected(selectedAudio);

        prevSelectedAudio.currentTime = 0;
        selectedAudio.currentTime = 0;
        timeLinePos = 0;
    
        showTrackInfo(selectedAudio, prevSelectedAudio);
    } else {
        selectedAudio.currentTime = 0;
        timeLinePos = 0;

        showTrackInfo(selectedAudio, selectedAudio);
    }

    playAudio(selectedAudio);
}

visPlaylistArea.oncontextmenu = function(event) {
    if (!event.target.hasAttribute('data-actionable')) return;

    event.preventDefault();

    document.getSelection().empty();

    let trackMenu = document.createElement('div');
    trackMenu.className = 'track-menu';
    audioPlayer.appendChild(trackMenu);
    
    let downloadLink = document.createElement('div');
    downloadLink.className = 'menu-item';
    downloadLink.textContent = 'Save audio as MP3';
    trackMenu.appendChild(downloadLink);

    let audioPlayerRect = audioPlayer.getBoundingClientRect(); // audioPlayer - parent element for trackMenu

    let x = event.clientX - audioPlayerRect.left;
    if (x > (document.documentElement.clientWidth - audioPlayerRect.left - trackMenu.offsetWidth)) {
        x = document.documentElement.clientWidth - audioPlayerRect.left - trackMenu.offsetWidth;
    }
    trackMenu.style.left = x + 'px';

    let y = event.clientY - audioPlayerRect.top;
    if (y > (document.documentElement.clientHeight - audioPlayerRect.top - trackMenu.offsetHeight)) {
        y = document.documentElement.clientHeight - audioPlayerRect.top - trackMenu.offsetHeight;
    }
    trackMenu.style.top = y + 'px';

    let audio = event.target.closest('.track').querySelector('audio');

    eventManager.addOnceEventListener(downloadLink, 'click', clickDownloadLink);
    document.addEventListener('pointerdown', removeTrackMenu);

    function clickDownloadLink() {
        let loadInfo = audio.parentElement.querySelector('.load-info');
        if (loadInfo) loadInfo.remove();

        downloadAudio(audio);

        trackMenu.remove();
        document.removeEventListener('pointerdown', removeTrackMenu);
    }
    
    function removeTrackMenu(event) {
        if (event.target.closest('.track-menu')) return;

        trackMenu.remove();
        document.removeEventListener('pointerdown', removeTrackMenu);
        eventManager.removeOnceEventListener(downloadLink, 'click', 'clickDownloadLink');
    }

    async function downloadAudio(audio) {
        let trackInfoBox = audio.parentElement.querySelector('.track-info-box');
            
        let loadInfo = document.createElement('div');
        loadInfo.className = 'load-info';
        trackInfoBox.appendChild(loadInfo);

        let progress = document.createElement('div');
        progress.className = 'progress';
        loadInfo.appendChild(progress);

        let status = document.createElement('div');
        status.className = 'status';
        status.textContent = 'Waiting for loading...';
        progress.appendChild(status);

        let displayProgress = document.createElement('div');
        displayProgress.className = 'display-progress';
        displayProgress.textContent = '0%';
        loadInfo.appendChild(displayProgress);

        let url = audio.dataset.src;
        let response = await fetch(url);
    
        if (response.ok) {
            status.textContent = 'Loading...';

            const reader = response.body.getReader();
            const contentLength = +response.headers.get('Content-Length');
            let binaryData = new Uint8Array(contentLength);
            let receivedLength = 0;
        
            while(true) {
                const {done, value} = await reader.read();
                if (done) break;
        
                binaryData.set(value, receivedLength);
                receivedLength += value.length;

                let receivedPercent = receivedLength / contentLength * 100;
                progress.style.width = `calc(${receivedPercent}%)`;
                displayProgress.textContent = Math.floor(receivedPercent) + '%';
            }

            if (receivedLength === contentLength) status.textContent = 'Complete download!';

            let audioBlob = new Blob([binaryData], {type: 'audio/mpeg'});
            let audioName = audio.dataset.artist + ' - ' + audio.dataset.title + '.mp3';

            orderedDownloads.push(() => saveFile(audioBlob, audioName));
            if (orderedDownloads.length === 1) orderedDownloads[0]();

            async function saveFile(blob, fileName) {
                // Обнаружение поддержки браузером File System Access API.
                // API должен поддерживаться и приложение не запущено в iframe.
                const supportsFileSystemAccess =
                    'showSaveFilePicker' in window &&
                    (() => {
                        try {
                            return window.self === window.top;
                        } catch {
                            return false;
                        }
                    })();

                if (supportsFileSystemAccess) { // File System Access API поддерживается
                    try {
                        // Показать диалог сохранения файла.
                        let handle = await window.showSaveFilePicker({
                            suggestedName: fileName
                        });
                        
                        // Записать blob в файл.
                        let writable = await handle.createWritable();
                        await writable.write(blob);
                        await writable.close();

                        status.textContent = 'Audio file is saved!';
                        hideLoadStatus();
                    } catch (err) {
                        console.error(err.name + ': ' + err.message);

                        if (err.name === 'AbortError') { // Отмена скачивания файла, не предлагать второй вариант
                            status.textContent = 'Audio file saving canceled';
                            hideLoadStatus();
                        }

                        if (err.name === 'SecurityError') {
                            console.log('File System Access API не работает при длительной загрузке файла. ' + 
                                'Осуществлён метод загрузки через ссылку.');
                        }
                    }
                } else {
                    // Доступ API к файловой системе не поддерживается или ошибка в процессе => Загрузка через ссылку
                    let audioLink = document.createElement('a');
                    audioLink.download = fileName;
                    audioLink.href = URL.createObjectURL(blob);
                    audioLink.click();
                    URL.revokeObjectURL(audioLink.href);

                    eventManager.addOnceEventListener(window, 'focus', hideLoadStatus);
                }
            }
        } else {
            alert("Download error! Response status: " + response.status);

            status.textContent = 'Download failed';
            hideLoadStatus();
        }

        function hideLoadStatus() {
            loadInfo.style.opacity = 0;

            let loadInfoStyle = getComputedStyle(loadInfo);
            let transitionProperties = loadInfoStyle.transitionProperty.split(', ');
            let transitionDurations = loadInfoStyle.transitionDuration.split(', ');
            let opacityIdx = transitionProperties.indexOf('opacity');
            let hideDelay = ~opacityIdx ? parseFloat(transitionDurations[opacityIdx]) * 1000 : 0;

            setTimeout(() => {
                if (trackInfoBox.contains(loadInfo)) loadInfo.remove();
            }, hideDelay);

            orderedDownloads.shift();
            if (orderedDownloads.length) orderedDownloads[0]();
        }
    }
};

////////////////////////
// Playlist scrolling //
////////////////////////

playlistLim.onscroll = () => {
    playlistLimScrollDirection = playlistLim.scrollTop > playlistLimScrollTop ? 'down' : 'up';
    playlistLimScrollTop = playlistLim.scrollTop;
};

playlistContainer.onpointerenter = () => {
    cursorOverPlaylist = true;

    if (!scrollablePlaylist) return;

    clearTimeout(timerHideScrollElems);
    checkReachingPlaylistBoundaries('all');
    showScrollElems();

    let activeElem = document.activeElement;
    let key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
    let isDocScrollbar = isDocScrollbarCheck();

    if (!accelerateScrolling) return;
    if (!isDocScrollbar) return;
    if (activeElem === visPlaylistArea) return;
    if (activeElem !== visPlaylistArea && !activeElem.matches('.tracklist-section') &&
        activeElem.scrollHeight > activeElem.clientHeight) return;
    if (activeElem.matches('input[type="number"]') && (key === 'ArrowUp' || key === 'ArrowDown')) return;
    if (pointerModeScrolling) return;

    startScrolling(key);
};

playlistContainer.onpointerleave = () => {
    cursorOverPlaylist = false;

    if (!scrollablePlaylist) return;
    if (pointerModeScrolling) return;

    if (!activeScrollKeys.size) {
        if (!removingTracksNum) hideScrollElems();
    } else {
        let activeElem = document.activeElement;
        if (activeElem === visPlaylistArea) return;

        let isDocScrollbar = isDocScrollbarCheck();
        let key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
        let direction = scrollingKeysData[key].direction;
        let isReachingLimits = checkReachingPlaylistBoundaries(direction);
        let isProhibitedActiveElem = 
            (activeElem.matches('input[type="number"]') && (key === 'ArrowUp' || key === 'ArrowDown')) ||
            (!activeElem.matches('.tracklist-section') && activeElem.scrollHeight > activeElem.clientHeight)
        ;

        if (isDocScrollbar) {
            if (accelerateScrolling && !isReachingLimits && !isProhibitedActiveElem) {
                stopScrolling(KEY_SCROLLING_TIME);
            } else {
                if (!removingTracksNum) hideScrollElems();
            }
        } else {
            if (isProhibitedActiveElem && !removingTracksNum) hideScrollElems();
        }
    }
};

// Works if document.activeElement = document.body
visPlaylistArea.addEventListener('blur', () => {
    if (!scrollablePlaylist) return;
    if (!accelerateScrolling) return;
    if (cursorOverPlaylist) return;
    if (pointerModeScrolling) return;

    setTimeout(() => {
        let activeElem = document.activeElement;
        let isDocScrollbar = isDocScrollbarCheck();

        if (!isDocScrollbar) return;
        if (activeElem !== document.body) return;
        if (visPlaylistArea.classList.contains('focused')) return;
        
        stopScrolling(KEY_SCROLLING_TIME);
    });
});

visPlaylistArea.onwheel = (event) => {
    if (!scrollablePlaylist) return;

    event.preventDefault();
    
    scrollAndAlignPlaylist({
        direction: (event.deltaY > 0) ? 'down' : 'up',
        deltaHeight: trackHeight * wheelScrollStep,
        wheel: true
    });
};

// Pointer Mode Scrolling
visPlaylistArea.onpointerdown = function(event) {
    if (event.pointerType === 'mouse' && event.button !== 1) return;
    if (isTouchDevice && !event.isPrimary) return;
    if (!scrollablePlaylist) return;
    if (pointerModeScrolling) return;
    let outOfVisibleArea = event.clientX > this.getBoundingClientRect().right;
    if (outOfVisibleArea) return;
    event.preventDefault();

    document.getSelection().empty();

    this.setPointerCapture(event.pointerId);

    if (event.pointerType === 'mouse') {
        document.body.classList.add('pointer-scroll-mode');

        eventManager.addOnceEventListener(this, 'pointerup', runPointerModeScrolling);
    } else if (isTouchDevice) {
        eventManager.addOnceEventListener(this, 'pointermove', runPointerModeScrolling);
    }

    function runPointerModeScrolling(event) {
        console.log('pointer mode scrolling on');
    
        pointerModeScrolling = true;

        this.focus({preventScroll: true});
    
        let centerY = event.clientY;
        let currentY = centerY;
        let lastCurrentY = currentY;
        let sensingDistance = 30;
        let direction, deltaHeight;

        document.addEventListener('pointermove', pointerMoveInPointerModeScrolling);
        
        function pointerMoveInPointerModeScrolling(event) {
            cancelAnimationFrame(requestScrollInPointerMode);
    
            // if pointermove was caused by the dispatchEvent method => event.clientY === null
            currentY = event.clientY || lastCurrentY;
    
            if (currentY <= centerY - sensingDistance) {
                direction = 'up';

                if (event.pointerType === 'mouse') {
                    document.body.classList.remove('scroll-down');
                    document.body.classList.add('scroll-up');
                }
            } else if (currentY >= centerY + sensingDistance) {
                direction = 'down';

                if (event.pointerType === 'mouse') {
                    document.body.classList.remove('scroll-up');
                    document.body.classList.add('scroll-down');
                }
            } else {
                direction = null;

                if (event.pointerType === 'mouse') {
                    document.body.classList.remove('scroll-up');
                    document.body.classList.remove('scroll-down');
                }
            }
    
            if ( // Scrolling in progress
                (direction === 'up' && playlistLim.scrollTop > 0) ||
                (direction === 'down' && playlistLim.scrollHeight - playlistLim.scrollTop > playlistLim.clientHeight)
            ) {
                requestScrollInPointerMode = requestAnimationFrame(function scrollInPointerMode() {
                    if (!activeScrollInPointerMode) {
                        cancelAnimationFrame(requestAligningScroll);
                        activeScrollAndAlign = false;
                        activeScrollInPointerMode = true;
                    }
            
                    let range = 200;
                    let maxDeltaHeight = playlistLim.scrollHeight / 30;
                    if (maxDeltaHeight < 40) maxDeltaHeight = 40;
                    let maxSpeed = 1;
                    let minSpeed = maxSpeed / maxDeltaHeight;
                    let y = Math.abs(centerY - currentY) - sensingDistance;
                    let speed = minSpeed + (maxSpeed - minSpeed) * (y / range) ** 3;
                    if (speed > maxSpeed) speed = maxSpeed;
                    deltaHeight = maxDeltaHeight * speed;
            
                    playlistLim.scrollTop += (direction === 'down') ? deltaHeight :
                        (direction === 'up') ? -deltaHeight : 0;
            
                    let isReachingLimits = checkReachingPlaylistBoundaries(direction);
    
                    if (isReachingLimits) {
                        activeScrollInPointerMode = false;
                    } else {
                        requestScrollInPointerMode = requestAnimationFrame(scrollInPointerMode);
                    }
                });
            } else { // No scrolling action
                if (
                    !activeScrollOnKeyRepeat &&
                    !direction &&
                    activeScrollInPointerMode &&
                    (Math.abs(lastCurrentY - centerY) >= sensingDistance)
                ) {
                    scrollAndAlignPlaylist({
                        duration: 400 / deltaHeight
                    });
                    
                    activeScrollInPointerMode = false;
                }
            }
    
            lastCurrentY = currentY;
        }
    
        // Cancellation pointerModeScrolling
        cancelPointerModeScrolling = cancelPointerModeScrolling.bind(this);

        if (event.pointerType === 'mouse') {
            eventManager.addOnceEventListener(document, 'pointerdown', cancelPointerModeScrolling);
        } else if (isTouchDevice) {
            eventManager.addOnceEventListener(this, 'pointerup', cancelPointerModeScrolling);
        }
        
        function cancelPointerModeScrolling(event) {
            console.log('pointer mode scrolling off');
            
            if (event.pointerType === 'mouse' && event.button === 1) {
                event.preventDefault();
            }
    
            // Before pointerModeScrolling === false to prevent additional alignment
            if (!event.target.closest('#visible-playlist-area')) {
                this.blur();
            }
    
            pointerModeScrolling = false;
    
            cancelAnimationFrame(requestScrollInPointerMode);
    
            if (!accelerateScrolling) {
                alignPlaylist();
            } else {
                let isDocScrollbar = isDocScrollbarCheck();
    
                if (isDocScrollbar && !cursorOverPlaylist) {
                    alignPlaylist();
                }
            }
    
            if (event.pointerType === 'mouse') {
                document.body.classList.remove('pointer-scroll-mode');
                document.body.classList.remove('scroll-up');
                document.body.classList.remove('scroll-down');
            }
        
            document.removeEventListener('pointermove', pointerMoveInPointerModeScrolling);
    
            function alignPlaylist() {
                let duration = activeScrollInPointerMode ? (400 / deltaHeight) : 0;
    
                scrollAndAlignPlaylist({
                    duration,
                    hide: true,
                    hideDelay: duration
                });
            }
        }
    }
};

function keepSelectedTitleVisible(audio) {
    if (!scrollablePlaylist) return;

    let initScrolled = playlistLim.scrollTop;
    let visibleHeight = playlistLim.clientHeight;
    let selTrackPlaylistTop = origOrderedAudios.indexOf(audio) * trackHeight;
    let direction, deltaHeight;

    if (selTrackPlaylistTop < initScrolled) {
        direction = 'up';
        deltaHeight = initScrolled - selTrackPlaylistTop;
    }

    if (selTrackPlaylistTop + trackHeight > initScrolled + visibleHeight) {
        direction = 'down';
        deltaHeight = trackHeight + selTrackPlaylistTop - (initScrolled + visibleHeight);
    }

    if (direction && deltaHeight) { // The track title IS NOT FULL in the visible area of the playlist
        showScrollElems();
        scrollAndAlignPlaylist({
            direction,
            deltaHeight,
            align: false,
            hide: true
        });
    } else {
        cancelAnimationFrame(requestAligningScroll);
        activeScrollAndAlign = false;

        if (initScrolled % trackHeight) {
            showScrollElems();
            scrollAndAlignPlaylist({
                hide: true
            });
        }
    }
}

function downKeyScrollAction(event) {
    let key = event.code;
    if (activeScrollKeys.has(key)) return;

    activeScrollKeys.add(key);

    if (activeScrollKeys.size === 1) {
        timerAccelerateScrolling = setTimeout(() => {
            timerAccelerateScrolling = null;
            accelerateScrolling = true;

            let canPlaylistScrolling = canPlaylistScrollingCheck(key);

            if (canPlaylistScrolling) {
                event.preventDefault();
                startScrolling(key);
                if (pointerModeScrolling) document.dispatchEvent(new Event('pointermove'));
            };
        }, 500);
    } else if (timerAccelerateScrolling) {
        clearTimeout(timerAccelerateScrolling);
        timerAccelerateScrolling = null;
        accelerateScrolling = true;
    }

    let canPlaylistScrolling = canPlaylistScrollingCheck(key);

    if (canPlaylistScrolling) {
        event.preventDefault();
        startScrolling(key);
    } else {
        if (activeScrollOnKeyRepeat) {stopScrolling(KEY_SCROLLING_TIME);}
        if (pointerModeScrolling) document.dispatchEvent(new Event('pointermove'));
    }
}

function repeatKeyScrollAction(event) {
    let key = event.code;
    let canPlaylistScrolling = canPlaylistScrollingCheck(key);
    if (canPlaylistScrolling) event.preventDefault();
}

function upKeyScrollAction(event) {
    if (!activeScrollKeys.size) return;

    if (timerAccelerateScrolling) {
        clearTimeout(timerAccelerateScrolling);
        timerAccelerateScrolling = null;
    }

    if (pointerModeScrolling) document.dispatchEvent(new Event('pointermove'));

    let key = event.code;
    activeScrollKeys.delete(key);

    if (activeScrollKeys.size) {
        let prevKey = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
        let canPlaylistScrolling = canPlaylistScrollingCheck(prevKey);

        if (canPlaylistScrolling) {
            event.preventDefault();
            startScrolling(prevKey);
        } else {
            if (activeScrollOnKeyRepeat) stopScrolling(KEY_SCROLLING_TIME);
        }
    } else { // The last active scroll key has been released
        if (accelerateScrolling) accelerateScrolling = false;

        let canPlaylistScrolling = canPlaylistScrollingCheck(null);
        if (!canPlaylistScrolling) return;

        let direction = scrollingKeysData[key].direction;
        let isReachingLimits = checkReachingPlaylistBoundaries(direction);

        if (
            isReachingLimits &&
            !cursorOverPlaylist &&
            !pointerModeScrolling &&
            !playlist.hasAttribute('adding-tracks')
        ) {
            hideScrollElems();
        }

        if (activeScrollOnKeyRepeat && !activeScrollInPointerMode && !isReachingLimits) {
            stopScrolling(HIDE_SCROLL_ELEMENTS_DELAY);
        }
    }
}

function canPlaylistScrollingCheck(key) {
    let activeElem = document.activeElement;

    if (!scrollablePlaylist) return false;
    if (activeElem !== visPlaylistArea && !activeElem.matches('.tracklist-section') &&
        activeElem.scrollHeight > activeElem.clientHeight) return false;
    if (activeElem.matches('input[type="number"]') && (key === 'ArrowUp' || key === 'ArrowDown')) return false;

    let isDocScrollbar = isDocScrollbarCheck();

    if (isDocScrollbar) {
        if (
            activeElem === visPlaylistArea ||
            cursorOverPlaylist ||
            pointerModeScrolling
        ) {
            return true;
        } else {
            return false;
        }
    } else {
        return true;
    }
}

function startScrolling(key) {
    clearTimeout(timerHideScrollElems);
    showScrollElems();

    if (!accelerateScrolling) {
        scrollAndAlignPlaylist({
            direction: scrollingKeysData[key].direction,
            deltaHeight: scrollingKeysData[key].deltaHeight(),
            duration: KEY_SCROLLING_TIME,
            align: (key === 'Home' || key === 'End') ? false : true,
            hide: true
        });
    } else {
        requestScrollOnKeyRepeat = requestAnimationFrame(scrollOnKeyRepeat);
    }
}

function stopScrolling(hideDelay) {
    if (!scrollablePlaylist) return;

    scrollAndAlignPlaylist({
        duration: KEY_SCROLLING_TIME,
        hide: true,
        hideDelay
    });
}

function stopScrollingAndClean() {
    if (!activeScrollKeys.size) return;

    stopScrolling(KEY_SCROLLING_TIME);

    activeScrollKeys.clear();
    accelerateScrolling = false;

    if (timerAccelerateScrolling) {
        clearTimeout(timerAccelerateScrolling);
        timerAccelerateScrolling = null;
    }
}

function scrollOnKeyRepeat() {
    if (!activeScrollKeys.size) return;
    if (!accelerateScrolling) return;

    cancelAnimationFrame(requestAligningScroll);
    activeScrollAndAlign = false;
    cancelAnimationFrame(requestScrollOnKeyRepeat);

    let key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
    let direction = scrollingKeysData[key].direction;
    let isReachingLimits = checkReachingPlaylistBoundaries(direction);
    if (isReachingLimits && !playlist.hasAttribute('adding-tracks')) {
        finalizeScrolling();
        return;
    }

    activeScrollOnKeyRepeat = true;

    let deltaHeight = (key === 'Home' || key === 'End') ?
        playlistLim.scrollHeight / 10 :
        scrollingKeysData[key].factor * 10;

    playlistLim.scrollTop += (direction === 'down') ? deltaHeight : ((direction === 'up') ? -deltaHeight : 0);

    isReachingLimits = checkReachingPlaylistBoundaries(direction);
    if (isReachingLimits && !playlist.hasAttribute('adding-tracks')) {
        finalizeScrolling();
        return;
    }

    function finalizeScrolling() {
        activeScrollOnKeyRepeat = false;
        if (pointerModeScrolling) document.dispatchEvent(new Event('pointermove'));
    }

    requestScrollOnKeyRepeat = requestAnimationFrame(scrollOnKeyRepeat);
}

function scrollAndAlignPlaylist(options) {
    options = Object.assign(
        {
            direction: playlistLimScrollDirection,
            deltaHeight: 0,
            duration: DEFAULT_SCROLLING_TIME,
            wheel: false,
            align: true,
            hide: false,
            hideDelay: HIDE_SCROLL_ELEMENTS_DELAY
        },
        options
    );

    let {direction, deltaHeight, duration, wheel, align, hide, hideDelay} = options;

    if (
        hide &&
        scrollElemsDisplaying &&
        !cursorOverPlaylist &&
        !pointerModeScrolling
    ) {
        clearTimeout(timerHideScrollElems);

        timerHideScrollElems = setTimeout(() => {
            let activeElem = document.activeElement;
            let key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
            let isDocScrollbar = isDocScrollbarCheck();

            if (cursorOverPlaylist) return;
            if (pointerModeScrolling) return;
            if (removingTracksNum) return;
            if (
                !isDocScrollbar &&
                activeScrollKeys.size &&
                activeElem.scrollHeight <= activeElem.clientHeight &&
                !(activeElem.matches('input[type="number"]') && (key === 'ArrowUp' || key === 'ArrowDown'))
            ) return;

            hideScrollElems();
        }, hideDelay);
    }
    
    cancelAnimationFrame(requestAligningScroll);
    activeScrollAndAlign = false;
    cancelAnimationFrame(requestScrollOnKeyRepeat);
    activeScrollOnKeyRepeat = false;

    let isReachingLimits = checkReachingPlaylistBoundaries(direction);
    if (isReachingLimits) return;

    let initScrolled = playlistLim.scrollTop;
    let remainder = initScrolled % trackHeight;
    if (!deltaHeight && !remainder) return;

    activeScrollAndAlign = true;
    
    let remainderRatio = remainder / trackHeight;

    if (remainderRatio && align) {
        let k = wheel ? 1 : 0;

        if (direction === 'down') {
            deltaHeight += trackHeight * (k + 1 - remainderRatio);
        }
        if (direction === 'up') {
            deltaHeight += trackHeight * (k + remainderRatio);
        }
    }

    let startTime = performance.now();
    
    requestAligningScroll = requestAnimationFrame(function aligningScroll(time) {
        let timeFraction = (time - startTime) / duration;
        if (timeFraction < 0) {
            requestAligningScroll = requestAnimationFrame(aligningScroll);
            return;
        }
        if (timeFraction > 1) timeFraction = 1;
    
        let progress = timing(timeFraction);
        
        function timing(timeFraction) {
            return timeFraction;
        }
    
        if (direction === 'down') {
            playlistLim.scrollTop = initScrolled + deltaHeight * progress;
        }
        if (direction === 'up') {
            playlistLim.scrollTop = initScrolled - deltaHeight * progress;
        }

        let isReachingLimits = checkReachingPlaylistBoundaries(direction);

        if (isReachingLimits) {
            endScrollAndAlign();
        } else {
            if (timeFraction < 1) {
                requestAligningScroll = requestAnimationFrame(aligningScroll);
            } else {
                endScrollAndAlign();
            }
        }

        function endScrollAndAlign() {
            activeScrollAndAlign = false;

            // If the scroll keys are pressed after the wheel or Tab focus has completed scrolling
            if (accelerateScrolling) {
                let key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
                let canPlaylistScrolling = canPlaylistScrollingCheck(key);
                if (canPlaylistScrolling) startScrolling(key);
            }
        }
    });
}

function checkReachingPlaylistBoundaries(direction) {
    let isTopBoundaryReached = playlistLim.scrollTop === 0;
    playlistScrollArrowUp.classList.toggle('inactive', isTopBoundaryReached);

    let isBottomBoundaryReached = playlistLim.scrollHeight - playlistLim.scrollTop <= playlistLim.clientHeight;
    playlistScrollArrowDown.classList.toggle('inactive', isBottomBoundaryReached);

    return (isTopBoundaryReached && direction === 'up') || (isBottomBoundaryReached && direction === 'down');
}

function showScrollElems() {
    clearTimeout(timerHideScrollElems);

    scrollElemsDisplaying = true;

    playlistScrollArrowUp.hidden = false;
    playlistScrollArrowDown.hidden = false;
}

function hideScrollElems() {
    clearTimeout(timerHideScrollElems);

    scrollElemsDisplaying = false;

    playlistScrollArrowUp.hidden = true;
    playlistScrollArrowDown.hidden = true;
}

function checkPlaylistScrollability() {
    const isScrollable = playlistLim.scrollHeight > playlistLim.clientHeight;
    if (scrollablePlaylist === isScrollable) return;
    
    scrollablePlaylist = isScrollable;
    playlistContainer.classList.toggle('scrollable', isScrollable);
    
    checkReachingPlaylistBoundaries('all');
    
    if (isScrollable) {
        if (cursorOverPlaylist || pointerModeScrolling) showScrollElems();
    } else {
        timerHideScrollElems = setTimeout(hideScrollElems, HIDE_SCROLL_ELEMENTS_DELAY);
    }
}

//////////////////
// Track titles //
//////////////////

function showLoading(audio) {
    let track = audio.closest('.track');
    track.classList.add('no-color-transition');
    track.classList.add('loading');
    indicator.classList.remove('active');
}
function hideLoading(audio) {
    let track = audio.closest('.track');
    track.classList.remove('loading');
    void track.offsetWidth; // Causes reflow
    track.classList.remove('no-color-transition');
}

function setSelected(audio) {
    let track = audio.closest('.track');
    track.classList.add('selected');
    checkAnimatedTransition(track);
}
function removeSelected(audio) {
    let track = audio.closest('.track');
    track.classList.remove('selected');
    checkAnimatedTransition(track);
}

function checkAnimatedTransition(track) {
    if (playlistStyle === 'smooth') {
        let actionableElems = Array.from(track.querySelectorAll('.artist-name, .track-title'));
        let isHovered = false;

        actionableElems.forEach(trackInfo => {
            let trackInfoLim = trackInfo.parentElement;
            trackInfoLim.setAttribute('data-animating', '');
            if (!isHovered && trackInfo.classList.contains('hover')) isHovered = true;
    
            eventManager.addOnceEventListener(trackInfoLim, 'transitionend', () => {
                trackInfoLim.removeAttribute('data-animating');
            });
        });

        if (isHovered) adjustTrackInfoLimitersWidth(actionableElems);
    }
}

/////////////////////////////////
// Audio player footer buttons //
/////////////////////////////////

configBtn.onclick = (event) => {
    changeAudioControlsConfiguration.eventType = event.type;
    let configIdx = configsBank.indexOf(config);
    changeAudioControlsConfiguration(configIdx + 1);
}

colorBtn.onclick = () => {
    let colorIdx = audioPlayerColorsBank.indexOf(audioPlayerColor);
    changeAudioPlayerColor(colorIdx + 1);
};

playlistStyleBtn.onclick = () => {
    let styleIdx = playlistStylesBank.indexOf(playlistStyle);
    changePlaylistStyle(styleIdx + 1);
};

keysInfoBtn.onclick = showKeysInfo;

//////////////////////
// Keys information //
//////////////////////

function keysInfoAction() {
    if (!keysInfoWin.classList.contains('active')) {
        showKeysInfo();
    } else {
        hideKeysInfo();
    }
}

function showKeysInfo() {
    activateModalWindow(keysInfoWin);
}

function hideKeysInfo() {
    keysInfoWin.classList.remove('active');

    promiseChange(keysInfoWin, 'transition', 'opacity', keysInfoBtn, 'KeyI', () => deactivateModalWindow(keysInfoWin));
}

// Closing key info by clicking
keysInfoWin.onclick = (event) => {
    if (event.target === keysInfoBtn) return;
    if (event.target.closest('.keys-info') && !event.target.closest('.close-button')) return;

    hideKeysInfo();
};

/////////////////////
// Global handlers //
/////////////////////

// Checking document sizes
function getDocWidth() {
    return Math.max(
        document.body.scrollWidth, document.documentElement.scrollWidth,
        document.body.offsetWidth, document.documentElement.offsetWidth,
        document.body.clientWidth, document.documentElement.clientWidth
    );
}

function getDocHeight() {
    return Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
    );
}

// Checking window sizes
function getWinWidth() {
    return isTouchDevice ? window.innerWidth : document.documentElement.clientWidth;
}

function getWinHeight() {
    return isTouchDevice ? window.innerHeight : document.documentElement.clientHeight;
}

// Check Y-scrollbar
function isDocScrollbarCheck() {
    let winHeight = getWinHeight();
    let docHeight = getDocHeight();

    return (docHeight > winHeight) ? true : false;
}

// Stop scrolling on context menu
document.oncontextmenu = () => {
    if (accelerateScrolling) stopScrollingAndClean();
};

// Document blur
document.body.onblur = () => {
    setTimeout(() => {
        stopScrollingAndClean();
        stopAccelerationAndClear();
        removeButtonHighlightings();
    });
};

// Focus handler
document.addEventListener('focus', function(event) {
    const selector = 'input, button, textarea, [tabindex]';
    if (!event.target.matches(selector)) return;

    handleFocus(event.target);
}, true);

function handleFocus(elem) {
    if (accelerateScrolling) {
        if (!scrollablePlaylist) return;

        let isDocScrollbar = isDocScrollbarCheck();
        let key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
        let direction = scrollingKeysData[key].direction;
        let isReachingLimits = checkReachingPlaylistBoundaries(direction);

        // Quickly hide playlist scroll elements
        if (
            isReachingLimits &&
            elem !== visPlaylistArea &&
            isDocScrollbar &&
            !cursorOverPlaylist &&
            !pointerModeScrolling
        ) {
            hideScrollElems();
        }

        // Start/stop scrolling
        if (elem !== visPlaylistArea && isDocScrollbar && !cursorOverPlaylist && !pointerModeScrolling) {
            stopScrolling(KEY_SCROLLING_TIME);
        } else if (
                elem === visPlaylistArea ||
                (
                    !isDocScrollbar ||
                    cursorOverPlaylist ||
                    pointerModeScrolling
                )
        ) {
            startScrolling(key);
        }
    }

    // Check reaching playlist limits when focusing on the last track via Tab
    if (elem.matches('.track-info-box') && scrollablePlaylist) {
        checkReachingPlaylistBoundaries('all');
    }

    if (pointerModeScrolling) document.dispatchEvent(new Event('pointermove'));
}

// Alignment after auto scrolling focused track title
visPlaylistArea.addEventListener('keydown', function(event) {
    if (event.code !== 'Tab') return;
    if (!scrollablePlaylist) return;
    if (activeScrollAndAlign) return;

    let track;
    if (event.target === this) track = playlist.firstElementChild;
    if (event.target.matches('.track-info-box')) {
        let prevTrack = event.target.closest('.track');
        track = event.shiftKey ? prevTrack.previousElementSibling : prevTrack.nextElementSibling;
    }
    if (!track) return;

    // Showing scroll elements and aligning the playlist after auto-scrolling
    if (
        track.offsetTop < playlistLim.scrollTop ||
        track.offsetTop + track.offsetHeight > playlistLim.scrollTop + playlistLim.offsetHeight
    ) {
        setTimeout(() => {
            showScrollElems();
            scrollAndAlignPlaylist({
                direction: (event.shiftKey || track === playlist.firstElementChild) ? 'up' : 'down',
                duration: KEY_SCROLLING_TIME,
                hide: true
            });
        });
    }
});

// Creating tooltips
function initTooltipHoverIntentConnections() {
    const tooltipElems = audioPlayerContainer.querySelectorAll('[data-tooltip]');
    tooltipElems.forEach(elem => connectTooltipHoverIntent(elem));
}

function connectTooltipHoverIntent(tooltipElem) {
    setAdditionalAttributes(tooltipElem);
    
    let hoverIntent = new HoverIntent({
        elem: tooltipElem,

        repeatTask: (tooltipElem === timeRange || tooltipElem === volumeRange) ? true : false,

        executeTask() {
            tooltip.textContent = this.elem.dataset.tooltip;
            positionTooltip(this.elemRect, this.y1, 0);
        },

        dismissTask() {
            tooltip.style.opacity = '';
            tooltip.style.transform = '';
        }
    });

    tooltipHoverIntentByElem.set(tooltipElem, hoverIntent);
        
    let strategy = executeTaskHoverIntentStrategies[tooltipElem.id];
    if (strategy) hoverIntent.setExecuteTaskStrategy(strategy);
}

function positionTooltip(targElemRect, elemCursorY, shiftY) {
    let x = targElemRect.left + targElemRect.width / 2 - tooltip.offsetWidth / 2;
    x = Math.max(x, 0);
    x = Math.min(x, document.documentElement.clientWidth - tooltip.offsetWidth);

    let y = targElemRect.top - tooltip.offsetHeight - shiftY;
    if (y < 0) y = targElemRect.top + elemCursorY + 24;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    
    tooltip.style.opacity = 1;
    tooltip.style.transform = 'translateY(0)';
}

function setAdditionalAttributes(tooltipElem) {
    tooltipElem.setAttribute('aria-label', tooltipElem.getAttribute('data-tooltip'));
    if (tooltipElem.tagName !== 'BUTTON') tooltipElem.setAttribute('role', 'button');
}

// Promise change on pointer or key event
function promiseChange(animatedElem, animationType, animatedProp, btn, key, func) {
    // animatedProp is used for partial time to resolve the promise.
    // If the full animation time is needed, set it to "null".
    new Promise((resolve, reject) => {
        let animatedElemStyle = getComputedStyle(animatedElem || cssRoot);
        let animatedTime = animatedElem ?
            parseFloat(animatedElemStyle[`${animationType}Duration`]) * 1000 :
            parseInt(animatedElemStyle.getPropertyValue('--transition-time-primary'))
        ;

        if (animatedProp) {
            let curAnimatedPropValue = parseFloat(animatedElemStyle[animatedProp]);
            animatedTime *= curAnimatedPropValue;
        }

        let timerResolvePromise = setTimeout(resolvePromise, animatedTime);

        btn.addEventListener('click', rejectPromise);
        document.addEventListener('keyup', rejectPromise);

        function resolvePromise() {
            removeListeners();
            resolve();
        }

        function rejectPromise(event) {
            if (event.type === 'keyup' && event.code !== key) return;

            clearTimeout(timerResolvePromise);
            removeListeners();
            reject();
        }

        function removeListeners() {
            btn.removeEventListener('click', rejectPromise);
            document.removeEventListener('keyup', rejectPromise);
        }
    }).then(
        func,
        () => {}
    );
}

// Highlighting the pressed button
function highlightButton(btn, key, actionFunc, ...args) {
    highlightedBtns.set(key, btn);

    if (actionFunc === downKeyStepAccAction) {
        let keyAccType = accelerationData.keys[key].accelerationType;

        if (keyAccType !== accelerationType) {
            btn.classList.add('key-pressed');
        }

        actionFunc(...args);
    } else {
        btn.classList.add('key-pressed');
    }

    document.addEventListener('keyup', function removeKeyPressedFx(event) {
        if (event.code !== key) return;
        document.removeEventListener('keyup', removeKeyPressedFx);
        if (!highlightedBtns.has(key)) return;

        highlightedBtns.delete(key);

        // Checking for duplicates of highlighted buttons
        let removeHighlighting = checkHighlightedBtn();
        if (removeHighlighting) btn.classList.remove('key-pressed');

        // Run action function
        if (actionFunc === downKeyStepAccAction) {
            upKeyStepAccAction(key);
        } else {
            actionFunc(...args);
        }

        function checkHighlightedBtn() {
            for (let highlightedBtn of highlightedBtns.values()) {
                if (highlightedBtn === btn) return false;
            }
            return true;
        }
    });
}

function removeButtonHighlightings() {
    for (let [key, btn] of highlightedBtns) {
        btn.classList.remove('key-pressed');
        highlightedBtns.delete(key);
    }
}

// Playlist scroll arrows handlers
playlistScrollArrowUp.onclick = () => {
    if (playlistScrollArrowUp.classList.contains('inactive')) return;

    playlistScrollArrowDown.classList.remove('inactive');

    playlistLim.scrollTo({
        left: 0,
        top: 0,
        behavior: 'smooth'
    });

    eventManager.clearEventHandlers(playlistLim, 'scrollend');
    eventManager.addOnceEventListener(playlistLim, 'scrollend', () => checkReachingPlaylistBoundaries('up'));
};

playlistScrollArrowDown.onclick = () => {
    if (playlistScrollArrowDown.classList.contains('inactive')) return;

    playlistScrollArrowUp.classList.remove('inactive');

    playlistLim.scrollTo({
        left: 0,
        top: playlistLim.scrollHeight,
        behavior: 'smooth'
    });

    eventManager.clearEventHandlers(playlistLim, 'scrollend');
    eventManager.addOnceEventListener(playlistLim, 'scrollend', () => checkReachingPlaylistBoundaries('down'));
};

// Modal window on/off
function activateModalWindow(modalWindow) {
    let activeElem = document.activeElement;
    if (!savedActiveElem && activeElem !== document.body) savedActiveElem = activeElem;

    audioPlayer.setAttribute('inert', '');

    modalWindow.hidden = false;
    void modalWindow.offsetWidth;  // Causes a reflow
    modalWindow.classList.add('active');
}

function deactivateModalWindow(modalWindow) {
    modalWindow.hidden = true;

    audioPlayer.removeAttribute('inert');

    if (savedActiveElem && savedActiveElem.tabIndex !== -1) savedActiveElem.focus();
    savedActiveElem = null;
}

// Set delay for group animations
function setAnimationDelay(action, idx, func) {
    let key = action + '_' + crypto.randomUUID();
    let delay = idx * 20;
    
    animationDelays[key] = setTimeout(function() {
        delete animationDelays[key];
        func();
    }, delay);
}

// Resize event
let resizeTick = false;

window.addEventListener('resize', () => {
    if (!resizeTick) {
        requestAnimationFrame(function () {
            checkPlaylistScrollability();

            resizeTick = false;
        });
    }
    
    resizeTick = true;
});

////////////////////////////
// Touch device detection //
////////////////////////////

const isTouchDevice = isTouchDeviceCheck();

function isTouchDeviceCheck() {
    if (
        ('ontouchstart' in window) ||
        (window.DocumentTouch && document instanceof DocumentTouch)
    ) {
        return true;
    }
  
    let prefixes = ' -webkit- -moz- -o- -ms- '.split(' ');
    let query = ['(', prefixes.join('touch-enabled),('), 'heartz', ')'].join('');

    return window.matchMedia(query).matches;
}

///////////////////////////
// Buttons configuration //
///////////////////////////

const configsBank = ['classic', 'stylish'];
let config = localStorage.getItem('buttons_configuration');

customElements.define('audio-controls', class extends HTMLElement {
    connectedCallback() {
        this.attachShadow({mode: 'open'});
    }

    static get observedAttributes() {
        return ['config'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log('buttons ' + name + ' = ' + newValue);

        localStorage.setItem('buttons_configuration', newValue);

        if (oldValue) {
            configBtn.parentElement.classList.remove('rotate');

            let rotateTime = (changeAudioControlsConfiguration.eventType === 'keydown') ? LAG : 0;
            setTimeout(() => {
                configBtn.parentElement.classList.add('rotate');

                promiseChange(configBtn.parentElement, 'animation', null, configBtn, 'KeyZ', () => {
                    configBtn.parentElement.classList.remove('rotate');
                });
            }, rotateTime);
            delete changeAudioControlsConfiguration.eventType;
        }

        switch (newValue) {
            case 'classic':
                audioPlayer.insertAdjacentHTML('beforeend', configClassic);
                break;
            case 'stylish':
                audioPlayer.insertAdjacentHTML('beforeend', configStylish);
                break;
        }
        
        const tmplConfig = document.getElementById('tmpl-' + newValue);
        this.shadowRoot.innerHTML = '';
        this.shadowRoot.appendChild(tmplConfig.content.cloneNode(true));
        tmplConfig.remove();
    }
});

function changeAudioControlsConfiguration(idx) {
    audioPlayer.classList.remove(`buttons-configuration-${config}`);
    config = configsBank[idx] || configsBank[0];
    audioControls.setAttribute('config', config);
    audioPlayer.classList.add(`buttons-configuration-${config}`);
}

///////////////////////////
// Audio player coloring //
///////////////////////////

const audioPlayerColorsBank = ['black', 'white'];
let audioPlayerColor = localStorage.getItem('audio_player_color');

function changeAudioPlayerColor(idx) {
    audioPlayerContainer.classList.remove('color-' + audioPlayerColor);
    audioPlayerColor = audioPlayerColorsBank[idx] || audioPlayerColorsBank[0];
    localStorage.setItem('audio_player_color', audioPlayerColor);
    audioPlayerContainer.classList.add('color-' + audioPlayerColor);

    console.log('audio player color = ' + audioPlayerColor);

    audioPlayer.classList.add('changing-color');
    promiseChange(null, null, null, colorBtn, 'KeyX', () => audioPlayer.classList.remove('changing-color'));
}

////////////////////
// Playlist style //
////////////////////

const playlistStylesBank = ['smooth', 'strict'];
let playlistStyle = localStorage.getItem('playlist_style');

function changePlaylistStyle(idx) {
    if (selectedAudio) removeSelected(selectedAudio);
    playlist.classList.remove(playlistStyle);
    playlistStyle = playlistStylesBank[idx] || playlistStylesBank[0];
    localStorage.setItem('playlist_style', playlistStyle);
    playlist.classList.add(playlistStyle);
    if (selectedAudio) setSelected(selectedAudio);

    console.log('playlist style = ' + playlistStyle);

    switch (playlistStyle) {
        case "smooth":
            playlistStyleBtn.className = 'icon-align-center';
            break;
        case "strict":
            playlistStyleBtn.className = 'icon-align-left';
            break;
    }
}

////////////////////
// Initial volume //
////////////////////

let settedVolume = localStorage.getItem('audio_player_volume');
let savedVolume;

function changeInitialVolume(value) {
    if (value === null) value = DEFAULTS_DATA['audio-player-volume'];
    savedVolume = +value === 0 ? DEFAULTS_DATA['audio-player-volume'] : +value;

    let xPos = +value * (volumeRange.offsetWidth - volumeBar.offsetWidth);
    let volumePos = moveVolumeAt(xPos);
    setVolume(volumePos);

    showVolumeIcon(settedVolume);
    volumeBar.classList.toggle('active', settedVolume);
    
    tooltipHoverIntentByElem.get(volumeRange).executeTask();
}

/////////////////////////////
// Scroll elements opacity //
/////////////////////////////

const scrollElemsOpacity = DEFAULTS_DATA['scroll-elements-opacity'];
audioPlayerContainer.style.setProperty('--scroll-elements-opacity', scrollElemsOpacity / 100);

///////////////////////
// Wheel scroll step //
///////////////////////

const wheelScrollStep = DEFAULTS_DATA['wheel-scroll-step'];

///////////////////////
// Playlist creation //
///////////////////////

let playlistTracksData = tracklistData.tracks || [];

function createPlaylist() {
    const addedTracksFragment = document.createDocumentFragment();
    const addedPlaylistTracks = [];

    playlistTracksData.forEach(trackData => {
        let artist = trackData['artist'];
        let title = trackData['title'];
        let src = trackData['src'];

        let track = document.createElement('div');
        track.className = 'track not-ready';
        addedTracksFragment.appendChild(track);

        addedPlaylistTracks.push(track);
    
        let audio = document.createElement('audio');
        audio.setAttribute('data-artist', artist);
        audio.setAttribute('data-title', title);
        audio.setAttribute('data-src', src);
        audio.setAttribute('type', 'audio/mpeg');
        audio.setAttribute('preload', 'none');
        track.appendChild(audio);

        origOrderedAudios.push(audio);

        let additionals = document.createElement('div');
        additionals.className = 'additionals';
        track.appendChild(additionals);

        let loadFig = document.createElement('div');
        loadFig.className = 'loading-figure';
        additionals.appendChild(loadFig);
        
        let trackInfoBox = document.createElement('div');
        trackInfoBox.className = 'track-info-box';
        trackInfoBox.tabIndex = 0;
        track.appendChild(trackInfoBox);

        let artistNameLim = document.createElement('div');
        artistNameLim.className = 'artist-name-limiter';
        trackInfoBox.appendChild(artistNameLim);

        let artistName = document.createElement('span');
        artistName.className = 'artist-name';
        artistName.setAttribute('data-actionable', '');
        artistName.textContent = artist;
        artistNameLim.appendChild(artistName);
    
        let trackTitleLim = document.createElement('div');
        trackTitleLim.className = 'track-title-limiter';
        trackInfoBox.appendChild(trackTitleLim);
    
        let trackTitle = document.createElement('span');
        trackTitle.className = 'track-title';
        trackTitle.setAttribute('data-actionable', '');
        trackTitle.textContent = title;
        trackTitleLim.appendChild(trackTitle);
    });

    playlist.appendChild(addedTracksFragment);
    
    setPlaylistOrder(true);
    runAddTracks(addedPlaylistTracks);
            
    function runAddTracks(addedPlaylistTracks) {
        addedPlaylistTracks.forEach((track, idx) => {
            setAnimationDelay('add-track-in-playlist', idx, () => {
                playlist.setAttribute('adding-tracks', '');
                track.classList.add('adding');
    
                eventManager.addOnceEventListener(track, 'animationend', () => {
                    track.classList.remove('adding');
                    track.classList.remove('not-ready');
    
                    checkPlaylistScrollability();
    
                    if (pointerModeScrolling) document.dispatchEvent(new Event('pointermove'));
    
                    // Last added track
                    if (idx === addedPlaylistTracks.length - 1) {
                        playlist.removeAttribute('adding-tracks');
    
                        if (!accelerateScrolling) {
                            stopScrolling(KEY_SCROLLING_TIME);
                        } else if (!activeScrollOnKeyRepeat) {
                            let key = Array.from(activeScrollKeys)[activeScrollKeys.size - 1];
                            let canPlaylistScrolling = canPlaylistScrollingCheck(key);
                            if (canPlaylistScrolling) startScrolling(key);
                        }
                    }
                });
            });
        });
    }
}

//////////////////////////////////
// Last played track start info //
//////////////////////////////////

function showLastPlayedTrackInfo() {
    if (selectedAudio) return;

    let cookies = document.cookie
        .split(';')
        .reduce((acc, cookie) => {
            const [key, value] = cookie.split('=').map(c => c.trim());
            acc[key] = value;
            return acc;
        }, {});

    let lastPlayedAudio = cookies['last_played_audio'] && decodeURIComponent(cookies['last_played_audio']);
    let lastPlayDate = cookies['date_of_last_play'];
    if (!lastPlayedAudio || !lastPlayDate) return;

    let timeElapsed = new Date() - new Date(lastPlayDate);
    let timeComponents = {
        days: Math.floor(timeElapsed / (1000 * 60 * 60 * 24)),
        hours: Math.floor((timeElapsed / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((timeElapsed / (1000 * 60)) % 60),
        seconds: Math.floor((timeElapsed / 1000) % 60)
    };

    let timeElapsedString = Object.entries(timeComponents)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${value} ${key}`)
        .join(' ');
    
    let startInfo = `Last time you listened to the track
        <span class="track">"${lastPlayedAudio}"</span>
        <span class="time">${timeElapsedString}</span> ago.`;

    startInfoDisplay.innerHTML = startInfo;
    startInfoDisplay.hidden = false;

    setTimeout(() => {
        startInfoDisplay.style.opacity = 1;

        let transTime = parseFloat(getComputedStyle(startInfoDisplay).transitionDuration) * 1000;
        setTimeout(() => {
            startInfoDisplay.scrollTop = startInfoDisplay.scrollHeight;
            
            setTimeout(() => {
                startInfoDisplay.style.opacity = '';
    
                setTimeout(() => startInfoDisplay.hidden = true, transTime);
            }, 1750);
        }, 1750 + transTime);
    }, 250);
}

function saveLastPlayedAudioInfo(audio) {
    let lastPlayedAudio = 'last_played_audio=' +
        encodeURIComponent(audio.dataset.artist + ' - ' + audio.dataset.title);
    let lastPlayDate = 'date_of_last_play=' + new Date().toUTCString();
    let dateExpires = new Date(Date.now() + 864e6).toUTCString(); // Delete cookies after 10 days
    let path = '/';
    
    document.cookie = `${lastPlayedAudio}; path=${path}; expires=${dateExpires}`;
    document.cookie = `${lastPlayDate}; path=${path}; expires=${dateExpires}`;
}

//////////////////
// Key handlers //
//////////////////

function connectKeyHandlers() {
    // Document keys, no modifiers or repea
    document.addEventListener('keydown', (event) =>  {
        if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;

        //Playing/pausing audio
        if (event.code === 'KeyW' || event.code === 'Space') {
            event.preventDefault();
            highlightButton(playPauseBtn, event.code, playPauseAction);
            return;
        }
        // Stoping audio
        if (event.code === 'KeyS') {
            highlightButton(stopBtn, event.code, stopAction);
            return;
        }

        // Stepping/accelerating audio
        if (
            (event.code === 'ArrowLeft' || event.code === 'ArrowRight' ||
            event.code === 'KeyA' || event.code === 'KeyD') 
        ) {
            let btn = accelerationData.keys[event.code].button;
            highlightButton(btn, event.code, downKeyStepAccAction, event.code);
            return;
        }

        // Randomizing playlist
        if (event.code === 'KeyQ') {
            highlightButton(shuffleBtn, event.code, shuffleAction);
            return;
        }
        // Repeating track/playlist
        if (event.code === 'KeyE') {
            highlightButton(repeatBtn, event.code, repeatAction);
            return;
        }

        // Changing buttons configuration
        if (event.code === 'KeyZ') {
            changeAudioControlsConfiguration.eventType = event.type;
            let idx = configsBank.indexOf(config);
            highlightButton(configBtn, event.code, changeAudioControlsConfiguration, idx + 1);
            return;
        }
        // Changing audio player coloring
        if (event.code === 'KeyX') {
            let idx = audioPlayerColorsBank.indexOf(audioPlayerColor);
            highlightButton(colorBtn, event.code, changeAudioPlayerColor, idx + 1);
            return;
        }
        // Changing playlist style
        if (event.code === 'KeyC') {
            let idx = playlistStylesBank.indexOf(playlistStyle);
            highlightButton(playlistStyleBtn, event.code, changePlaylistStyle, idx + 1);
            return;
        }

        // Showing/hiding keys info
        if (event.code === 'KeyI') {
            highlightButton(keysInfoBtn, event.code, keysInfoAction);
            return;
        }

        // Closing keys info and settings by keypressing 'Escape'
        if (event.code === 'Escape') {
            const areas = [ // Order is important!
                { element: keysInfoWin, action: hideKeysInfo }
            ];
            
            for (let { element, action } of areas) {
                if (element.classList.contains('active')) {
                    let closeBtn = element.querySelector('.close-button');
                    highlightButton(closeBtn, event.code, action);
                    return;
                }
            }
        }
    });

    // Сhanging volume
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        // On/off volume
        if (event.code === 'KeyM' || event.code === 'KeyR') {
            if (event.repeat) return;
            highlightButton(volumeBtn, event.code, volumeAction);
            return;
        }
        // Increasing volume
        if ((event.shiftKey && event.code === 'ArrowUp') || event.code === 'Period') {
            let keyRepeat = event.repeat ? true : false;
            changeVolumeAction('increase', keyRepeat);
            return;
        }
        // Reducing volume
        if ((event.shiftKey && event.code === 'ArrowDown') || event.code === 'Comma') {
            let keyRepeat = event.repeat ? true : false;
            changeVolumeAction('reduce', keyRepeat);
            return;
        }
    });

    // Scrolling playlist
    document.addEventListener('keydown', (event) =>  {
        if (event.shiftKey && (event.code === 'ArrowUp' || event.code === 'ArrowDown')) return;

        if (
            (event.code === 'ArrowUp' || event.code === 'ArrowDown' ||
            event.code === 'PageUp' || event.code === 'PageDown' ||
            event.code === 'Home' || event.code === 'End') &&
            !event.repeat
        ) {
            downKeyScrollAction(event);
            return;
        }
        if (
            (event.code === 'ArrowUp' || event.code === 'ArrowDown' ||
            event.code === 'PageUp' || event.code === 'PageDown' ||
            event.code === 'Home' || event.code === 'End') &&
            event.repeat
        ) {
            repeatKeyScrollAction(event);
            return;
        }
    });
    document.addEventListener('keyup', (event) =>  {
        if (
            event.code === 'ArrowUp' || event.code === 'ArrowDown' ||
            event.code === 'PageUp' || event.code === 'PageDown' ||
            event.code === 'Home' || event.code === 'End'
        ) {
            upKeyScrollAction(event);
        }
    });

    // Focusing tracks
    visPlaylistArea.addEventListener('keydown', function (event) {
        let trackInfoBox = event.target.closest('.track-info-box');
        if (!trackInfoBox || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;

        // Select track in playlist
        if (event.key === 'Enter') {
            let track = trackInfoBox.closest('.track');
            document.getSelection().empty();
            highlightButton(playPauseBtn, event.code, selectPlaylistTrack, track);
            return;
        }
    });

    // Temporary check handler
    document.addEventListener('keydown', (event) => {
        if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
        if (event.code === 'KeyG') {
            //console.log(document.activeElement);
            //console.log(eventManager.eventTypesByElement);
            //console.log(tooltipHoverIntentByElem);
            console.log(audioPlayer.offsetHeight);
            console.log(document.getElementById('video-container').offsetHeight);
        }
    });
}

//////////////////////////////////
// Run initials and window load //
//////////////////////////////////

runInitials();

function runInitials() {
    initTooltipHoverIntentConnections();
    initAudioPlayerChanges();

    function initAudioPlayerChanges() {
        changeAudioControlsConfiguration(configsBank.indexOf(config));
        changeAudioPlayerColor(audioPlayerColorsBank.indexOf(audioPlayerColor));
        changePlaylistStyle(playlistStylesBank.indexOf(playlistStyle));
        changeInitialVolume(settedVolume);
    }
}

eventManager.addOnceEventListener(window, 'load', hidePreload);

function hidePreload() {
    console.log('page load time = ' + performance.now());

    let hidePreloadDelay = (performance.now() < 500) ? (500 - performance.now()) : 0;
    setTimeout(() => {
        preloader.classList.remove('active');
    
        eventManager.addOnceEventListener(preloader, 'transitionend', () => {
            preloader.remove();
            audioPlayer.classList.add('show');
            window.dispatchEvent(new CustomEvent('showVideos'));

            eventManager.addOnceEventListener(audioPlayer, 'animationend', () => {
                document.body.classList.remove('loading');
                audioPlayer.classList.remove('show');
                audioPlayer.classList.add('active');

                createPlaylist();

                let timeDelay = playlistTracksData.length ? 750 : 0;
                setTimeout(() => {
                    connectKeyHandlers();
                    showLastPlayedTrackInfo();
                }, timeDelay);
            });
        });
    }, hidePreloadDelay);
}
