function initFramebufferObject(gl, width, height) {
    var framebuffer = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);   
    var renderbuffer = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer); 
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);   
    
    var shadowMap = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, shadowMap);  
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);   
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);   
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);   

    framebuffer.texture = shadowMap;   
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowMap, 0);   
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);   
    var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER); 

    if (status !== gl.FRAMEBUFFER_COMPLETE) { 
        console.log('Framebuffer object is incomplete: ' + status.toString()); 
    }   

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); 
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);   
    framebuffer.width = width; 
    framebuffer.height = height;  

    return framebuffer; 
}

function initAttributeVariable(gl, attribute, buffer, num, type) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(attribute, num, type, false, 0, 0);
    gl.enableVertexAttribArray(attribute);
}

function modifyProjectionMatrix(clipplane, projection) {
    // MV.js has no copy constructor for matrices
    var oblique = mult(mat4(), projection);
    var q = vec4((Math.sign(clipplane[0]) + projection[0][2])/projection[0][0],
    (Math.sign(clipplane[1]) + projection[1][2])/projection[1][1],
    -1.0,
    (1.0 + projection[2][2])/projection[2][3]);
    var s = 2.0/dot(clipplane, q);

    oblique[2] = vec4(clipplane[0]*s, clipplane[1]*s,
    clipplane[2]*s + 1.0, clipplane[3]*s);

    return oblique;
    }

window.onload = async function init() {
    const canvas = document.getElementById("c");
    const gl = WebGLUtils.setupWebGL(canvas, { alpha: false , stencil: true});
    gl.getExtension('OES_element_index_uint'); // needed for gl.UNSIGNED_INT
    if (!gl) {
        alert("WebGL isn't available");
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    // gl.clearColor(0.3921, 0.5843, 0.9294, 1.0);
    gl.clearColor(0.8745, 0.7058, 0.5843, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.STENCIL_TEST);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    
    // Load Shaders
    const depthProgram = initShaders(gl, "vertex-shader-depth", "fragment-shader-depth");
    const teapotProgram = initShaders(gl, "vertex-shader-teapot", "fragment-shader-teapot");
    const floorProgram = initShaders(gl, "vertex-shader-floor", "fragment-shader-floor");

    // Load OBJ Model (Teapot)
    const objFilename = "teapot/teapot.obj";
    const drawingInfo = await readOBJFile(objFilename, 0.25, true); // Scale by 0.25

    // Translate teapot model to coordinatates (0, -1, -3)
    var teapotModelMatrix = mat4();
    teapotModelMatrix = mult(teapotModelMatrix,translate(vec3(0, -1, -3)));

    // Reflection matrix for the mirrored Teapot
    var ReflectedTeapotModelMatrix= mult(rotateX(180), translate(0,1,3));

    // Floor Data
    const floorVertices = [
        vec4(-2.0, -1.0, -1.0, 1.0),
        vec4(-2.0, -1.0, -5.0, 1.0),
        vec4(2.0, -1.0, -1.0, 1.0),
        vec4(2.0, -1.0, -1.0, 1.0),
        vec4(2.0, -1.0, -5.0, 1.0),
        vec4(-2.0, -1.0, -5.0, 1.0),
    ];
    const floorTexCoords = [
        vec2(0.0, 1.0),
        vec2(0.0, 0.0),
        vec2(1.0, 1.0),
        vec2(1.0, 1.0),
        vec2(1.0, 0.0),
        vec2(0.0, 0.0),
    ];


    // Floor Texture
    const floorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, floorTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST + 2);
    const floorImage = document.createElement("img");
    floorImage.crossOrigin = "anonymous";
    floorImage.onload = function () {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, floorTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, floorImage);
        gl.generateMipmap(gl.TEXTURE_2D);
    };
    floorImage.src = "xamp23.png";


    // Buffers for Floor
    const floorVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, floorVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(floorVertices), gl.STATIC_DRAW);

    const floorTBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, floorTBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(floorTexCoords), gl.STATIC_DRAW);

    // Buffers for the Teapot
    const teapotVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, teapotVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(drawingInfo.vertices), gl.STATIC_DRAW);

    const teapotCBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, teapotCBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(drawingInfo.colors), gl.STATIC_DRAW);

    // Normal Buffer
    const teapotNBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, teapotNBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(drawingInfo.normals), gl.STATIC_DRAW);

    const teapotIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapotIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, drawingInfo.indices, gl.STATIC_DRAW);


    // Initialize framebuffer for shadow mapping
    const fbo = initFramebufferObject(gl, 512, 512);
    
    // BUTTONS:
    // Button for the teapot jumping
    let jumping = false; 
    let jumpingTime = -0.1113410143; //so the starting position of the jumping teapot is at y=-1
    document.getElementById("toggle-motion-button").addEventListener("click", function () {
        jumping = !jumping;
    });

    // Button for the orbiting light
    let lightOrbiting = false; 
    let lightTheta = 0.0; 
    let lightRadius = 2.0;
    document.getElementById("light_circulation_button").addEventListener("click", function () {
        lightOrbiting = !lightOrbiting;
    });


    // Projection matrices
    const projectionMatrix = perspective(65, canvas.width / canvas.height, 0.1 , 100.0); 
    const lightProjectionMatrix = perspective(95, canvas.width / canvas.height, 0.8, 200); // for the shadow mapping
    const reflectProjectionMatrix = modifyProjectionMatrix(vec4(0, -1, 0, -1), projectionMatrix) // for the reflected teapot

    // Camera parameters
    let camera_eye = vec3(0.0, 0.0, 1.0);
    let camera_at = vec3(0.0, 0.0, -3.0);
    let up = vec3(0.0 , 1.0, 0.0);
    const viewMatrix = lookAt(camera_eye, camera_at, up);

    let light_eye = vec3(0,2,-2);
    let light_at = vec3(0,-1,-3);
    const lightViewMatrix = lookAt(light_eye, light_at, up);

    // Select between the texture for the objects
    var textureSelection = gl.getUniformLocation(floorProgram, "textureSelection");

    // RENDER FUNCTION
    function render() {
            

        // Orbiting light position
        if (lightOrbiting) {
            lightTheta += 0.01; // Adjust speed
        }
            
        const pointLightPosition = vec3(
            lightRadius * Math.sin(lightTheta),
            2.0,
            lightRadius * Math.cos(lightTheta) - 2.0
        );

        const lightDirection = normalize(subtract(vec3(0.0, -1.0, -3.0), pointLightPosition));

        const reflectedpointLightPosition = vec3(
            -lightRadius * Math.sin(-lightTheta),
            -4,
            lightRadius * Math.cos(-lightTheta) - 2.0
        );
        const reflectedlightDirection = normalize(subtract(vec3(0.0, -1.0, -3.0), reflectedpointLightPosition));
        // Recompute the lightViewMatrix with the updated light_eye
        light_eye = pointLightPosition;            
        const lightViewMatrix = lookAt(light_eye, light_at, up);

        // Jumping teapot
        if (jumping) {
            const yTranslation = Math.sin(jumpingTime) * 0.9 - 0.9;
            jumpingTime += 0.01;
            teapotModelMatrix = mult(mat4(),translate(vec3(0, yTranslation, -3)));
            ReflectedTeapotModelMatrix = mult(
                mult(rotateX(180), translate(0, 1, 3)), // Base reflection transformation
                translate(vec3(0, yTranslation +1, 0))   // Match the original teapot's movement
            );
        }

        // Render depth pass
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, fbo.width, fbo.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(depthProgram);
        
            // Render teapot to shadow map
            initAttributeVariable(gl, gl.getAttribLocation(depthProgram, "vPosition"), teapotVBuffer, 4, gl.FLOAT);
            gl.uniformMatrix4fv(gl.getUniformLocation(depthProgram, "lightProLoc"), false, flatten(lightProjectionMatrix));
            gl.uniformMatrix4fv(gl.getUniformLocation(depthProgram, "lightViewLoc"), false, flatten(lightViewMatrix));
            gl.uniformMatrix4fv(gl.getUniformLocation(depthProgram, "modLoc"), false, flatten(teapotModelMatrix));
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapotIndexBuffer);
            gl.drawElements(gl.TRIANGLES, drawingInfo.indices.length, gl.UNSIGNED_INT, 0);

            // Render floor to shadow map
            initAttributeVariable(gl, gl.getAttribLocation(depthProgram, "vPosition"), floorVBuffer, 4, gl.FLOAT);
            gl.uniformMatrix4fv(gl.getUniformLocation(depthProgram, "modLoc"), false, flatten(mat4()));
            gl.drawArrays(gl.TRIANGLES, 0, floorVertices.length);

        // Main rendering pass
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);


        // Stencil
        gl.enable(gl.STENCIL_TEST);
            gl.stencilFunc(gl.ALWAYS, 1, 0xFF); // Always pass stencil test
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); // Replace stencil value with 1
            gl.colorMask(false, false, false, false); // Disable color output
            gl.depthMask(false); // Disable depth write

            // Render floor to stencil buffer
            gl.useProgram(floorProgram);
            initAttributeVariable(gl, gl.getAttribLocation(floorProgram, "vPosition"), floorVBuffer, 4, gl.FLOAT);
            initAttributeVariable(gl, gl.getAttribLocation(floorProgram, "vTexCoord"), floorTBuffer, 2, gl.FLOAT);
            gl.uniformMatrix4fv(gl.getUniformLocation(floorProgram, "proLoc"), false, flatten(projectionMatrix));
            gl.uniformMatrix4fv(gl.getUniformLocation(floorProgram, "viewLoc"), false, flatten(viewMatrix));
            gl.uniformMatrix4fv(gl.getUniformLocation(floorProgram, "modLoc"), false, flatten(mat4()));
            gl.drawArrays(gl.TRIANGLES, 0, floorVertices.length);

            gl.colorMask(true, true, true, true); // Re-enable color output
            gl.depthMask(true); // Re-enable depth write

            gl.stencilFunc(gl.EQUAL, 1, 0xFF); // Only render where stencil == 1
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP); // Keep stencil values unchanged
        
        
            // Rendering reflected teapot
            gl.useProgram(teapotProgram);
                initAttributeVariable(gl, gl.getAttribLocation(teapotProgram, "vPosition"), teapotVBuffer, 4, gl.FLOAT);
                initAttributeVariable(gl, gl.getAttribLocation(teapotProgram, "vColor"), teapotCBuffer, 4, gl.FLOAT);
                initAttributeVariable(gl, gl.getAttribLocation(teapotProgram, "vNormal"), teapotNBuffer, 4, gl.FLOAT);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapotIndexBuffer);

                gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "proLoc"), false, flatten(reflectProjectionMatrix));
                gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "viewLoc"), false, flatten(viewMatrix));
                    
                gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "lightProLoc"), false, flatten(lightProjectionMatrix));
                gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "lightViewLoc"), false, flatten(lightViewMatrix));

                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
                gl.uniform1i(gl.getUniformLocation(teapotProgram, "shadowMap"), 1);
                
                // Light parameters for the reflected teapot
                gl.uniform3fv(gl.getUniformLocation(teapotProgram, "ambientLight"), flatten(vec3(0.1, 0.1, 0.1)));
                gl.uniform3fv(gl.getUniformLocation(teapotProgram, "lightColor"), flatten(vec3(1.0, 1.0, 1.0))); // Light color (PURE WHITE)
                gl.uniform3fv(gl.getUniformLocation(teapotProgram, "uPointLightPosition"), flatten(reflectedpointLightPosition));
                gl.uniform3fv(gl.getUniformLocation(teapotProgram, "lightDirection"), flatten(reflectedlightDirection));
                gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "modLoc"), false, flatten(ReflectedTeapotModelMatrix));
                gl.drawElements(gl.TRIANGLES, drawingInfo.indices.length, gl.UNSIGNED_INT, 0);
    
            gl.clear(gl.DEPTH_BUFFER_BIT); // Required with oblique clipping   

        gl.disable(gl.STENCIL_TEST);


        // Render actual Teapot
        gl.useProgram(teapotProgram);
            initAttributeVariable(gl, gl.getAttribLocation(teapotProgram, "vPosition"), teapotVBuffer, 4, gl.FLOAT);
            initAttributeVariable(gl, gl.getAttribLocation(teapotProgram, "vColor"), teapotCBuffer, 4, gl.FLOAT);
            initAttributeVariable(gl, gl.getAttribLocation(teapotProgram, "vNormal"), teapotNBuffer, 4, gl.FLOAT);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapotIndexBuffer);

            gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "proLoc"), false, flatten(projectionMatrix));
            gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "viewLoc"), false, flatten(viewMatrix));
            gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "modLoc"), false, flatten(teapotModelMatrix));
                
            gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "lightProLoc"), false, flatten(lightProjectionMatrix));
            gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "lightViewLoc"), false, flatten(lightViewMatrix));

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
            gl.uniform1i(gl.getUniformLocation(teapotProgram, "shadowMap"), 1);
            
            // Light parameters for the actual teapot
            gl.uniform3fv(gl.getUniformLocation(teapotProgram, "uPointLightPosition"), flatten(pointLightPosition));
            gl.uniform3fv(gl.getUniformLocation(teapotProgram, "ambientLight"), flatten(vec3(0.1, 0.1, 0.1)));
            gl.uniform3fv(gl.getUniformLocation(teapotProgram, "lightColor"), flatten(vec3(1.0, 1.0, 1.0))); // Light color (PURE WHITE)
            gl.uniform3fv(gl.getUniformLocation(teapotProgram, "lightDirection"), flatten(lightDirection));
            gl.uniformMatrix4fv(gl.getUniformLocation(teapotProgram, "modLoc"), false, flatten(teapotModelMatrix));
            gl.drawElements(gl.TRIANGLES, drawingInfo.indices.length, gl.UNSIGNED_INT, 0);


        // Render Floor
        gl.useProgram(floorProgram);
            initAttributeVariable(gl, gl.getAttribLocation(floorProgram, "vPosition"), floorVBuffer, 4, gl.FLOAT);
            initAttributeVariable(gl, gl.getAttribLocation(floorProgram, "vTexCoord"), floorTBuffer, 2, gl.FLOAT);

            gl.uniformMatrix4fv(gl.getUniformLocation(floorProgram, "proLoc"), false, flatten(projectionMatrix));
            gl.uniformMatrix4fv(gl.getUniformLocation(floorProgram, "viewLoc"), false, flatten(viewMatrix));
            gl.uniformMatrix4fv(gl.getUniformLocation(floorProgram, "modLoc"), false, flatten(mat4()));
            
            gl.uniform1i(textureSelection, 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, floorTexture);
            gl.uniform1i(gl.getUniformLocation(floorProgram, "texMapFloor"), 0);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
            gl.uniform1i(gl.getUniformLocation(floorProgram, "shadowMap"), 1);
                
            gl.uniformMatrix4fv(gl.getUniformLocation(floorProgram, "lightProLoc"), false, flatten(lightProjectionMatrix));
            gl.uniformMatrix4fv(gl.getUniformLocation(floorProgram, "lightViewLoc"), false, flatten(lightViewMatrix));
            gl.drawArrays(gl.TRIANGLES, 0, floorVertices.length);
        
        requestAnimationFrame(render);
        
    }

    render();
};

