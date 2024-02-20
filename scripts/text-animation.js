'use strict';

let textInfo = [];
document.querySelectorAll('.about .info > p').forEach(p => textInfo.push(p));

window.addEventListener('load', () => animateText({
    timing(timeFraction) {
        return Math.pow(timeFraction, 1.75);
    },

    draw(progress) {
        const separator = 0.77;

        textInfo.forEach(p => {
            let text = p.dataset.text;
            let length = text.length;
            let endPos;

            if (progress <= separator) {
                if (p.classList.contains('par2')) return;

                endPos = Math.ceil(length * progress * (1 / separator));
            } else {
                if (p.classList.contains('par1')) {
                    p.innerHTML = text;
                    return;
                }

                endPos = Math.ceil(length * (progress - separator) * (1 / (1 - separator)));
            }
            
            p.innerHTML = text.slice(0, endPos);
        });
    },

    duration: 2500
}));

function animateText({timing, draw, duration}) {
    let startTime = performance.now();
  
    requestAnimationFrame(function animateFrame(time) {
        let timeFraction = (time - startTime) / duration; // From <0 to >1
        if (timeFraction > 1) timeFraction = 1;
    
        let progress = timing(timeFraction);
    
        draw(progress);
    
        if (timeFraction < 1) {
            requestAnimationFrame(animateFrame);
        }
    });
}
