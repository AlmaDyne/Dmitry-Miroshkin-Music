'use strict';

document.addEventListener('pointerdown', function() {
    let range = new Range();

    document.onselectionchange = function() {
        let {anchorNode, anchorOffset, focusNode, focusOffset} = document.getSelection();

        range.setStart(anchorNode, anchorOffset);
        range.setEnd(focusNode, focusOffset);

        if (range.collapsed) {
            range.setStart(focusNode, focusOffset);
            range.setEnd(anchorNode, anchorOffset);
        }
    };

    document.addEventListener('pointerup', function deleteSelection() {
        range.deleteContents();
        
        document.onselectionchange = () => false;
        document.removeEventListener('pointerup', deleteSelection);
    });
});
