'use strict';



// Остановка текущего источника воспроизведения при включении нового //

// Загрузка YouTube IFrame Player API асинхронно
const youtubeIframeApiScript = document.createElement('script');
youtubeIframeApiScript.src = "https://www.youtube.com/iframe_api";
const firstScript = document.getElementsByTagName('script')[0];
firstScript.parentNode.insertBefore(youtubeIframeApiScript, firstScript);

// Создание пустого массива для хранения плееров
const players = [];

let isAudioPlaying = false;

window.addEventListener('audioPlayerState', function(event) {
    isAudioPlaying = event.detail.playOn;
});

window.addEventListener('startAudioPlaying', function() {
    players.forEach(function(player) {
        player.pauseVideo();
    });
});

// Функция, вызываемая API после загрузки
function onYouTubeIframeAPIReady() {
    // Находим все элементы iframe на странице
    const videoContainer = document.getElementById('video-container');
    const videos = videoContainer.querySelectorAll('.video');

    // Инициализация плееров для каждого найденного iframe
    videos.forEach(function(video, idx) {
        // Добавление enablejsapi=1 к URL, если еще не добавлено
        if (video.src.indexOf('enablejsapi=1') === -1) {
            video.src += (video.src.indexOf('?') === -1 ? '?' : '&') + 'enablejsapi=1';
        }

        // Создание плеера с помощью API и добавление его в массив
        players[idx] = new YT.Player(video, {
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
        players.forEach(function(player) {
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
