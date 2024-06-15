'use strict';

// Остановка текущего источника воспроизведения при включении нового //

// Загрузка YouTube IFrame Player API асинхронно
const youtubeIframeApiScript = document.createElement('script');
youtubeIframeApiScript.src = "https://www.youtube.com/iframe_api";
const firstScript = document.getElementsByTagName('script')[0];
firstScript.parentNode.insertBefore(youtubeIframeApiScript, firstScript);

const videos = document.getElementById('video-container').querySelectorAll('.video');
const videoPlayers = [];

let isAudioPlaying = false;

window.addEventListener('audioPlayerState', function(event) {
    isAudioPlaying = event.detail.playOn;
});

window.addEventListener('startAudioPlaying', function() {
    videoPlayers.forEach(function(player) {
        player.pauseVideo();
    });
});

window.addEventListener('showVideos', function() {
    videos.forEach(function(video, idx) {
        setTimeout(() => video.parentElement.classList.add('show'), idx * 300);
    });
}, { once: true });

// Функция, вызываемая API после загрузки
function onYouTubeIframeAPIReady() {
    // Инициализация плееров для каждого найденного iframe
    videos.forEach(function(video, idx) {
        // Добавление enablejsapi=1 к URL, если еще не добавлено
        if (video.src.indexOf('enablejsapi=1') === -1) {
            video.src += (video.src.indexOf('?') === -1 ? '?' : '&') + 'enablejsapi=1';
        }

        // Создание плеера с помощью API и добавление его в массив
        videoPlayers[idx] = new YT.Player(video, {
            events: {
                'onStateChange': onPlayerStateChange
            }
        });
    });
}

// Обработчик изменения состояния плеера
function onPlayerStateChange(event) {
    // Если видео начинает воспроизводиться
    if (event.data == YT.PlayerState.PLAYING) {
        // Остановка всех других видео
        videoPlayers.forEach(function(player) {
            if (player !== event.target) {
                player.pauseVideo();
            }
        });

        // Остановка аудиоплеера
        if (isAudioPlaying) {
            window.dispatchEvent(new CustomEvent('pauseAudio'));
        }
    }
}
