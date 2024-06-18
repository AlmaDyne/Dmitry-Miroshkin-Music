'use strict';

/*const navigate = document.querySelector('.navigate');

navigate.addEventListener('click', function(event) {
    const targetA = event.target.closest('a');
    if (!targetA) return;

    const anchors = [...navigate.children].filter(a => a !== targetA && !a.classList.contains('current-page'));

    shuffle(anchors);

    const newA = anchors[0];
    targetA.href = newA.getAttribute('href');

    alert('Ты хотел перейти на страницу "' + targetA.textContent + '"?\n' +
        'Ха! Однако, ты перейдёшь на страницу "' + newA.textContent + '".');
});

navigate.oncontextmenu = function(event) {
    const targetA = event.target.closest('a');
    if (targetA) event.preventDefault();
};

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}*/
