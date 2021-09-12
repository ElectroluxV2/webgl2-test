const mainCanvas = document.getElementById('mainCanvas');

// Adjust to new dimensions
mainCanvas.height = window.innerHeight;
mainCanvas.width = window.innerWidth;

window.onresize = event => {
    mainCanvas.height = window.innerHeight;
    mainCanvas.width = window.innerWidth;
}

const fpsMeter = document.querySelector('span.fps');

  window.countFPS = (function() {
    let lastLoop = (new Date()).getMilliseconds();
    let count = 1;
    let fps = 0;

    return function() {
      const currentLoop = (new Date()).getMilliseconds();
      if (lastLoop > currentLoop) {
        fps = count;
        count = 1;
      } else {
        count += 1;
      }
      lastLoop = currentLoop;
      return fps;
    };
  }());

  (function loop() {
    requestAnimationFrame(function() {
      fpsMeter.innerText = countFPS();
      loop();
    });
  }());

class GlRenderer {
    #canvas;
    #gl;

    #increment;
    #worldToClipSpace;

    #trianglesCount;
    #vertices;
    #colors;

    #matrixUniform;
    #shaderProgram;

    #animationFrameRequestId;

    /**
     * @param {HTMLCanvasElement} canvas The canvas on which to draw.
     * @constructor
     */
    constructor(canvas) {
        this.#canvas = canvas;
        this.#gl = canvas.getContext('webgl2');

        this.#increment = 0.01;
        this.#worldToClipSpace = new Float32Array(16);

        this.#trianglesCount = 1_000_000;
        this.#vertices = [];
        this.#colors = [];

        this.#matrixUniform = null;
        this.#shaderProgram = null;

        this.#animationFrameRequestId = null;

        this.#initializeShaders();
        this.#initializeBuffers();
        this.#initializeUniforms();
    }

    setNumTriangles(numTriangles) {
        this.#trianglesCount = numTriangles;
        this.#initializeBuffers();
    }

    #addVertices(verticesCoords, red, green, blue) {
        for (let i = 0; i < verticesCoords.length / 2; i++) {
            this.#vertices.push(verticesCoords[2 * i]); // x
            this.#vertices.push(verticesCoords[2 * i + 1]); // y
            this.#colors.push(red);
            this.#colors.push(green);
            this.#colors.push(blue);
        }
    }

    /**
     * Compiles a vertex or fragment shader from the supplied source code.
     * @param {String} src
     * @param {WebGLShader} shader
     * @return {Boolean} Whether the shader compiled successfully.
     * @private
     */
    #compileShader(src, shader) {
        this.#gl.shaderSource(shader, src);
        this.#gl.compileShader(shader);
        const compileStatus = this.#gl.getShaderParameter(shader, this.#gl.COMPILE_STATUS);
        return compileStatus;
    }

    #initializeShaders() {
        // Vertex shader source code.
        const vertCode = [
        'uniform mat4 uMapMatrix;',
        'attribute vec2 aWorldCoords;',
        'attribute vec3 aColor;',
        'varying vec3 vColor;',
        'void main(void) {',
        '  gl_Position = uMapMatrix * vec4(aWorldCoords, 0.0, 1.0);',
        '  vColor = aColor;',
        '}'
        ].join('\n');

        // Create a vertex shader object.
        const vertShader = this.#gl.createShader(this.#gl.VERTEX_SHADER);

        // Compile the vertex shader.
        if (!this.#compileShader(vertCode, vertShader)) {
            throw new Error('Unable to compile vertex shader:' + this.#gl.getShaderInfoLog(vertShader));
        }

        // Fragment shader source code.
        const fragCode = [
        'precision mediump float;',
        'varying vec3 vColor;',
        'void main(void) {',
        '  gl_FragColor = vec4(vColor, 1.0);',
        '}'
        ].join('\n');

        // Create fragment shader object.
        const fragShader = this.#gl.createShader(this.#gl.FRAGMENT_SHADER);

        // Compile the fragment shader.
        if (!this.#compileShader(fragCode, fragShader)) {
        throw new Error('Unable to compile fragment shader:\n' + this.#gl.getShaderInfoLog(fragShader));
        }

        // Create a shader program object to store combined shader program.
        this.#shaderProgram = this.#gl.createProgram();

        // Attach a vertex shader.
        this.#gl.attachShader(this.#shaderProgram, vertShader);

        // Attach a fragment shader.
        this.#gl.attachShader(this.#shaderProgram, fragShader);

        // Link both programs.
        this.#gl.linkProgram(this.#shaderProgram);

        // Use the combined shader program object
        this.#gl.useProgram(this.#shaderProgram);
    }

    #addTriangle() {
        const vertices = [];
        const firstVerticeX = Math.random();
        const firstVerticeY = Math.random();
        
        vertices.push(firstVerticeX);
        vertices.push(firstVerticeY);
        
        for (let i = 0; i < 2; i++) {
            vertices.push(firstVerticeX + Math.random() * 0.05);
            vertices.push(firstVerticeY + Math.random() * 0.05);
        }

        this.#addVertices(vertices, Math.random(), Math.random(), Math.random());
    }

    #initializeBuffers() {
        this.#vertices = [];
        this.#colors = [];

        for (let i = 0; i < this.#trianglesCount; i++) {
            this.#addTriangle();
        }

        // Create a new buffer object
        const vertexBuffer = this.#gl.createBuffer();

        // Bind an empty array buffer to it
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, vertexBuffer);

        // Pass the vertices data to the buffer
        this.#gl.bufferData(this.#gl.ARRAY_BUFFER, new Float32Array(this.#vertices), this.#gl.STATIC_DRAW);

        // Unbind the buffer
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, null);

        // Create an empty buffer object and store color data
        const colorBuffer = this.#gl.createBuffer();
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, colorBuffer);
        this.#gl.bufferData(this.#gl.ARRAY_BUFFER, new Float32Array(this.#colors), this.#gl.STATIC_DRAW);

        // Bind vertex buffer object
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, vertexBuffer);

        // Get the attribute location
        const coords = this.#gl.getAttribLocation(this.#shaderProgram, "aWorldCoords");

        // point an attribute to the currently bound VBO
        this.#gl.vertexAttribPointer(coords, 2, this.#gl.FLOAT, false, 0, 0);

        // Enable the attribute
        this.#gl.enableVertexAttribArray(coords);

        // bind the color buffer
        this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, colorBuffer);

        // get the attribute location
        const color = this.#gl.getAttribLocation(this.#shaderProgram, "aColor");

        // point attribute to the color buffer object
        this.#gl.vertexAttribPointer(color, 3, this.#gl.FLOAT, false, 0, 0);

        // enable the color attribute
        this.#gl.enableVertexAttribArray(color);

        /* Step5: Drawing the required object (triangle) */

        // Clear the canvas
        this.#gl.clearColor(1, 1, 0, 0);

        this.#worldToClipSpace.set([
            2, 0, 0, 0,
            0, -2, 0, 0,
            0, 0, 0, 0, -1, 1, 0, 1
        ]);
    }

    #initializeUniforms() {
        this.#matrixUniform = this.#gl.getUniformLocation(
        this.#shaderProgram, "uMapMatrix");
    }

    requestDraw() {
        if (this.#animationFrameRequestId) return;

        this.#animationFrameRequestId = requestAnimationFrame(() => {
            this.#animationFrameRequestId = null;
            this.#draw();
        });
    }

    #draw() {
        this.#gl.uniformMatrix4fv(this.#matrixUniform, false, this.#worldToClipSpace);
        // Clear the color buffer bit
        this.#gl.clear(this.#gl.COLOR_BUFFER_BIT);

        // Draw triangles
        this.#gl.drawArrays(this.#gl.TRIANGLES, 0, this.#vertices.length / 2);

        this.#worldToClipSpace[12] += this.#increment;

        if (Math.abs(this.#worldToClipSpace[12] + 1) > 1) {
            this.#increment *= -1;
        }

        requestAnimationFrame(this.#draw.bind(this));
    }

    /** Starts the animation */
    init() {
        const width = this.#canvas.width;
        const height = this.#canvas.height;
        this.#gl.viewport(0, 0, width, height);
        this.requestDraw();
    }
}

const glRenderer = new GlRenderer(mainCanvas);
glRenderer.init();
