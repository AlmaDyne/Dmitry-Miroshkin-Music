'use strict';

const infoElements = Array.from(document.querySelectorAll('.about .info'));
const infoData = infoElements.map(info => {
    const paragraphs = Array.from(info.children);
    const textLengths = paragraphs.map(p => p.dataset.text.length);
    const allTextLength = textLengths.reduce((sum, length) => sum + length, 0);
    const textRatios = textLengths.map((_, idx) => {
        const textLength = textLengths.slice(0, idx + 1).reduce((sum, length) => sum + length, 0);
        return textLength / allTextLength;
    });
    
    return { paragraphs, textRatios };
});

window.addEventListener('load', () => {
    animateText({
        timing(timeFraction) {
            return Math.pow(timeFraction, 1.75);
        },

        draw(progress) {
            infoData.forEach(({ paragraphs, textRatios }) => {
                paragraphs.forEach((p, idx) => {
                    const prevTextRatio = textRatios[idx - 1] || 0;
                    if (progress <= prevTextRatio) return;
                    
                    const text = p.dataset.text;
                    const curTextRatio = textRatios[idx];
                    const textLength = text.length;
                    
                    if (progress < curTextRatio) {
                        const endPos = Math.ceil((progress - prevTextRatio) / (curTextRatio - prevTextRatio) * textLength);
                        p.textContent = text.slice(0, endPos);
                    } else {
                        p.textContent = text;
                    }
                });
            });
        },

        duration: 2500
    });
});

function animateText({timing, draw, duration}) {
    const startTime = performance.now();
  
    requestAnimationFrame(function animateFrame(time) {
        let timeFraction = (time - startTime) / duration;
        if (timeFraction < 0) timeFraction = 0;
        if (timeFraction > 1) timeFraction = 1;
    
        const progress = timing(timeFraction);
        draw(progress);
    
        if (timeFraction < 1) {
            requestAnimationFrame(animateFrame);
        }
    });
}
