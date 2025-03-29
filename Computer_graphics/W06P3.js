window.onload = function init() {
    var canvas = document.getElementById("c");
    var gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    var ext = gl.getExtension('OES_element_index_uint');
    if (!ext) { console.log('Warning: Unable to use an extension');}

    gl.viewport(0, 0, canvas.width, canvas.height);
    // gl.clearColor(0.3921, 0.5843, 0.9294, 1.0);
    gl.clearColor(0.8745, 0.7058, 0.5843, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT); 

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);        // Enable culling
    //gl.cullFace(gl.BACK);           // Cull back faces
    
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Set light direction
    var lightDirectionLoc = gl.getUniformLocation(program, "lightDirection");
    gl.uniform3fv(lightDirectionLoc, vec3(0.0, 0.0, -1.0)); //Light direction

    // Set ambient light color
    var ambientLightLoc = gl.getUniformLocation(program, "ambientLight");
    gl.uniform3fv(ambientLightLoc, vec3(0.1, 0.1, 0.1)); // Low ambient light

    // Set light color
    var lightColorLoc = gl.getUniformLocation(program, "lightColor");
    gl.uniform3fv(lightColorLoc, vec3(1.0, 1.0, 1.0)); // White light

    // Set view direction (camera direction)
    var viewDirectionLoc = gl.getUniformLocation(program, "viewDirection");
    gl.uniform3fv(viewDirectionLoc, vec3(0.0, 0.0, 1.0)); // Facing the sphere

    var subCount = 1;
    var finalVerts = [];

    function loadTexture(gl) {
        const texture = gl.createTexture();
        const image = document.createElement('img');
        image.crossOrigin = 'anonymous'; // Allow cross-origin requests
        image.src = 'earth.jpg';
    
        image.onload = function () {
            gl.bindTexture(gl.TEXTURE_2D, texture);

            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D);
    
            // Set texture filtering options
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
            // Set texture wrapping options for seamless mapping
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        };
    
        return texture;
    }

    const texture = loadTexture(gl);
    const textureLoc = gl.getUniformLocation(program, "texture");
    gl.uniform1i(textureLoc, 0); // Bind the texture to texture unit 0

    function initSphere(gl, numSub){
        //Vertices sphere is built on
        var initialVertices = [
            vec3(0.0, 0.0, 1.0), //Top
            vec3(0.0, 0.942809, -0.333333),
            vec3(-0.816497, -0.471405, -0.333333),
            vec3(0.816497, -0.471405, -0.333333)
        ];
    

        function triangle(a, b, c){
            finalVerts.push(a);
            finalVerts.push(b);
            finalVerts.push(c);
            }

        function divideTriangle(a, b, c, count) {
            if (count > 0) {
                var ab = normalize(mix(a, b, 0.5), false);
                var ac = normalize(mix(a, c, 0.5), false);
                var bc = normalize(mix(b, c, 0.5), false);
            
                divideTriangle(a, ab, ac, count - 1);
                divideTriangle(ab, b, bc, count - 1);
                divideTriangle(bc, c, ac, count - 1);
                divideTriangle(ab, bc, ac, count - 1);
            }else {
                triangle(a, b, c);
                }
            }

        function tetrahedron(a, b, c, d, n) {
            divideTriangle(a, b, c, n);
            divideTriangle(d, c, b, n);
            divideTriangle(a, d, b, n);
            divideTriangle(a, c, d, n);
            }

        finalVerts = [];
        tetrahedron(initialVertices[0], initialVertices[1], initialVertices[2], initialVertices[3], numSub);

        gl.bindBuffer(gl.ARRAY_BUFFER, gl.vbuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(finalVerts), gl.STATIC_DRAW);

    }

    gl.vbuffer = gl.createBuffer();
    initSphere(gl, subCount);

    var increase = document.getElementById("Increment_button");
    increase.addEventListener("click", function () {
        if (subCount <= 7){
            subCount++;
            finalVerts = [];
            initSphere(gl, subCount);
        }
    });

    var decrease = document.getElementById("Decrement_button");
    decrease.addEventListener("click", function () {
        if (subCount >= 0){
            subCount--;
            finalVerts = [];
            initSphere(gl, subCount);
        }
    });

    var isOrbiting = true; // Flag to control whether the camera orbits
    var angle = 0.0; // Initial angle for orbiting

    // Event listener to toggle orbiting
    var toggleOrbit = document.getElementById("Toggle_Orbit_button");
    toggleOrbit.addEventListener("click", function () {
        isOrbiting = !isOrbiting;
    });

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    var proMatrix = perspective(45, 1, 1, 10);
    var proLoc = gl.getUniformLocation(program, "proLoc");
    gl.uniformMatrix4fv(proLoc, false, flatten(proMatrix));

    viewLoc = gl.getUniformLocation(program, "viewLoc");


    let rotationAngle = 0.0;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    function render() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
        const at = vec3(0.0, 0.0, 0.0);  // Look-at center of the sphere
        const up = vec3(0.0, 1.0, 0.0);  // Up direction
        const radius = 5.0;             // Distance of the camera and light from the sphere
    
        // Orbit the camera around the sphere
        if (isOrbiting) {
            angle += 0.01; // Adjust rotation speed
        }
    
        // Camera position
        const eye = vec3(
            radius * Math.sin(angle),
            0.0,
            radius * Math.cos(angle)
        );
        const viewMatrix = lookAt(eye, at, up);
    
        // Update the view matrix in the shader
        gl.uniformMatrix4fv(viewLoc, false, flatten(viewMatrix));
    
        // Light direction (simulate sunlight from a different angle or stationary sun)
        const lightAngle = angle - Math.PI / 4; // Offset light position from camera
        const lightDirection = vec3(
            Math.sin(lightAngle), // Rotate the light around the sphere
            0.0,
            Math.cos(lightAngle)
        );
        gl.uniform3fv(lightDirectionLoc, flatten(lightDirection));
    
        // Draw the sphere
        gl.drawArrays(gl.TRIANGLES, 0, finalVerts.length);
        requestAnimationFrame(render);
    }

    render();
};
