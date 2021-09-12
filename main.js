const mainCanvas = document.getElementById('mainCanvas');

// Adjust to new dimensions
mainCanvas.height = window.innerHeight;
mainCanvas.width = window.innerWidth;

window.onresize = event => {
    mainCanvas.height = window.innerHeight;
    mainCanvas.width = window.innerWidth;
}

console.log(mainCanvas);