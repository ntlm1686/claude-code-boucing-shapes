import { initBuffers } from "./init-buffers.js";
import { drawScene } from "./draw-scene.js";
main();


//
// start here
//
function main() {
  const canvas = document.querySelector("#gl-canvas");
  // Initialize the GL context
  const gl = canvas.getContext("webgl");
  // Vertex shader program
  const vsSource = `
  attribute vec4 aVertexPosition;
  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;
  uniform float uScale;
  void main() {
    // Apply scale to vertex positions
    vec4 scaledPosition = aVertexPosition;
    scaledPosition.xy *= uScale; // Scale only x and y components
    gl_Position = uProjectionMatrix * uModelViewMatrix * scaledPosition;
  }
  `;

  const fsSource = `
    precision mediump float;
    uniform float uTime;
    
    vec3 rainbow(float t) {
      // Cycle through rainbow colors
      vec3 color;
      t = fract(t); // Keep t in [0, 1]
      
      if (t < 0.167) {
        // Red to yellow
        color = vec3(1.0, t * 6.0, 0.0);
      } else if (t < 0.333) {
        // Yellow to green
        color = vec3(1.0 - (t - 0.167) * 6.0, 1.0, 0.0);
      } else if (t < 0.5) {
        // Green to cyan
        color = vec3(0.0, 1.0, (t - 0.333) * 6.0);
      } else if (t < 0.667) {
        // Cyan to blue
        color = vec3(0.0, 1.0 - (t - 0.5) * 6.0, 1.0);
      } else if (t < 0.833) {
        // Blue to magenta
        color = vec3((t - 0.667) * 6.0, 0.0, 1.0);
      } else {
        // Magenta to red
        color = vec3(1.0, 0.0, 1.0 - (t - 0.833) * 6.0);
      }
      return color;
    }
    
    void main() {
      gl_FragColor = vec4(rainbow(uTime), 1.0);
    }
  `;

  //
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  
    // Create the shader program
  
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
  
    // If creating the shader program failed, alert
  
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert(
        `Unable to initialize the shader program: ${gl.getProgramInfoLog(
          shaderProgram,
        )}`,
      );
      return null;
    }
  
    return shaderProgram;
  }
  
  //
  // creates a shader of the given type, uploads the source and
  // compiles it.
  //
  function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
  
    // Send the source to the shader object
  
    gl.shaderSource(shader, source);
  
    // Compile the shader program
  
    gl.compileShader(shader);
  
    // See if it compiled successfully
  
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(
        `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`,
      );
      gl.deleteShader(shader);
      return null;
    }
  
    return shader;
  }

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
      time: gl.getUniformLocation(shaderProgram, "uTime"),
      scale: gl.getUniformLocation(shaderProgram, "uScale"),
    },
  };
  
  // Global variables to store the current settings
  let triangleScale = 1.0;
  let rotationSpeed = 1.0;
  let startTime = performance.now() / 1000; // Store initial time in seconds
  let lastTime = 0; // Track the last rendered time
  let currentAngle = 0; // Track the current rotation angle
  let targetFPS = 60; // Default target FPS
  let frameInterval = 1000 / targetFPS; // Time between frames in ms
  let lastFrameTime = 0; // Last time a frame was rendered
  
  // Variables for dragging
  let isDragging = false;
  let shapePositionX = 0;
  let shapePositionY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  
  // Variables for auto-motion
  let isAutoMotion = false;
  let velocityX = 0;
  let velocityY = 0;
  let motionSpeed = 1.0; // Speed multiplier for auto-motion
  let gravityEnabled = true; // Flag to toggle gravity on/off
  let gravityStrength = 0.001; // Adjustable gravity strength (default increased)
  let gravityAccelerating = false; // Flag for gravity acceleration mode
  let gravityAcceleration = 0.0; // Gravity acceleration rate
  let maxGravityStrength = 0.005; // Maximum gravity strength
  const bounceCoefficient = 0.75; // Energy loss on bounce (increased for more realism)

  // Only continue if WebGL is available and working
  if (gl === null) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it.",
    );
    return;
  }

  // Set clear color to black, fully opaque
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  // Clear the color buffer with specified clear color
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  // Track current shape
  let currentShape = 'triangle';
  
  // Initialize buffers with the default shape (triangle)
  let buffers = initBuffers(gl, currentShape);

  // Set up slider event handling
  const sizeSlider = document.getElementById('size-slider');
  const sizeValue = document.getElementById('size-value');
  const speedSlider = document.getElementById('speed-slider');
  const speedValue = document.getElementById('speed-value');

  sizeSlider.addEventListener('input', (e) => {
    triangleScale = parseFloat(e.target.value);
    sizeValue.textContent = triangleScale.toFixed(1);
  });
  
  speedSlider.addEventListener('input', (e) => {
    rotationSpeed = parseFloat(e.target.value);
    speedValue.textContent = rotationSpeed.toFixed(1);
  });
  
  // Update position constraints when scale changes
  sizeSlider.addEventListener('change', () => {
    // Re-apply constraints with the new scale
    const constrained = constrainPosition(shapePositionX, shapePositionY, triangleScale);
    shapePositionX = constrained.x;
    shapePositionY = constrained.y;
  });
  
  // Set up shape button handlers
  const triangleBtn = document.getElementById('btn-triangle');
  const squareBtn = document.getElementById('btn-square');
  const circleBtn = document.getElementById('btn-circle');
  const customBtn = document.getElementById('btn-custom');
  const customControls = document.getElementById('custom-controls');
  const vertexCountInput = document.getElementById('vertex-count');
  const applyBtn = document.getElementById('btn-apply');
  
  // Set up FPS control buttons
  const fps30Btn = document.getElementById('fps-30');
  const fps60Btn = document.getElementById('fps-60');
  const fps120Btn = document.getElementById('fps-120');
  const fpsUnlimitedBtn = document.getElementById('fps-unlimited');
  
  // Set up motion control buttons
  const bounceBtn = document.getElementById('btn-bounce');
  const stopBtn = document.getElementById('btn-stop');
  const gravityBtn = document.getElementById('btn-gravity');
  const gravityIncreaseBtn = document.getElementById('btn-gravity-increase');
  const motionSpeedSlider = document.getElementById('motion-speed-slider');
  const motionSpeedValue = document.getElementById('motion-speed-value');
  const motionSpeedContainer = document.getElementById('motion-speed-container');
  const gravityStrengthSlider = document.getElementById('gravity-strength-slider');
  const gravityStrengthValue = document.getElementById('gravity-strength-value');
  const gravityStrengthContainer = document.getElementById('gravity-strength-container');
  
  // Track custom vertex count
  let customVertexCount = 6; // Default
  
  // Helper function to handle shape changes
  function changeShape(newShape) {
    currentShape = newShape;
    
    // Update active button styling
    triangleBtn.classList.toggle('active', newShape === 'triangle');
    squareBtn.classList.toggle('active', newShape === 'square');
    circleBtn.classList.toggle('active', newShape === 'circle');
    customBtn.classList.toggle('active', newShape === 'custom');
    
    // Show/hide custom controls
    customControls.style.display = newShape === 'custom' ? 'flex' : 'none';
    
    // Recreate buffers with the new shape
    if (newShape === 'custom') {
      buffers = initBuffers(gl, currentShape, customVertexCount);
    } else {
      buffers = initBuffers(gl, currentShape);
    }
  }
  
  // Add click handlers for shape buttons
  triangleBtn.addEventListener('click', () => changeShape('triangle'));
  squareBtn.addEventListener('click', () => changeShape('square'));
  circleBtn.addEventListener('click', () => changeShape('circle'));
  customBtn.addEventListener('click', () => changeShape('custom'));
  
  // Handle custom vertex count changes
  applyBtn.addEventListener('click', () => {
    const newCount = parseInt(vertexCountInput.value, 10);
    customVertexCount = Math.max(3, Math.min(100, newCount));
    vertexCountInput.value = customVertexCount; // In case it was clamped
    buffers = initBuffers(gl, 'custom', customVertexCount);
  });
  
  // Also handle Enter key on input
  vertexCountInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applyBtn.click();
    }
  });
  
  // Gravity toggle button handler
  gravityBtn.addEventListener('click', () => {
    gravityEnabled = !gravityEnabled;
    
    // If gravity is disabled, also disable accelerating gravity
    if (!gravityEnabled && gravityAccelerating) {
      gravityAccelerating = false;
      gravityIncreaseBtn.classList.remove('active');
    }
    
    // Update button text and styling based on state
    if (gravityEnabled) {
      gravityBtn.textContent = 'Gravity: ON';
      gravityBtn.classList.add('active');
      gravityStrengthContainer.style.display = 'flex';
      gravityIncreaseBtn.disabled = false;
    } else {
      gravityBtn.textContent = 'Gravity: OFF';
      gravityBtn.classList.remove('active');
      gravityStrengthContainer.style.display = 'none';
      gravityIncreaseBtn.disabled = true;
    }
  });
  
  // Gravity acceleration button handler
  gravityIncreaseBtn.addEventListener('click', () => {
    // Only toggle if gravity is enabled
    if (gravityEnabled) {
      gravityAccelerating = !gravityAccelerating;
      
      if (gravityAccelerating) {
        gravityIncreaseBtn.classList.add('active');
        // Set initial acceleration rate
        gravityAcceleration = 0.00005;
      } else {
        gravityIncreaseBtn.classList.remove('active');
        // Reset gravity strength to slider value when disabling acceleration
        gravityStrength = parseFloat(gravityStrengthSlider.value);
        updateGravityDisplay();
      }
    }
  });
  
  // Initialize gravity strength slider
  // Format the display value to show as a percentage of earth gravity
  function updateGravityDisplay() {
    // Show as percentage with earth gravity as 100%
    const percentage = Math.round((gravityStrength / 0.001) * 100);
    gravityStrengthValue.textContent = `${percentage}%`;
  }
  
  // Initialize the gravity strength display
  updateGravityDisplay();
  
  // Gravity strength slider handler
  gravityStrengthSlider.addEventListener('input', (e) => {
    // If gravity acceleration is active, disable it when manually adjusting
    if (gravityAccelerating) {
      gravityAccelerating = false;
      gravityIncreaseBtn.classList.remove('active');
    }
    
    gravityStrength = parseFloat(e.target.value);
    updateGravityDisplay();
  });
  
  // Motion speed slider handler
  motionSpeedSlider.addEventListener('input', (e) => {
    motionSpeed = parseFloat(e.target.value);
    
    // For larger numbers, use whole numbers instead of decimals
    if (motionSpeed >= 10) {
      motionSpeedValue.textContent = Math.round(motionSpeed);
    } else {
      motionSpeedValue.textContent = motionSpeed.toFixed(1);
    }
  });
  
  // Set up auto-bounce motion
  bounceBtn.addEventListener('click', () => {
    if (!isAutoMotion) {
      isAutoMotion = true;
      
      // Set initial random velocity for x and y
      // Use stronger initial velocities for more dynamic movement
      velocityX = (Math.random() - 0.5) * 0.04;
      // Give a slight upward bias to the initial velocity when gravity is on
      velocityY = gravityEnabled ? 
                   (Math.random() * 0.05) + 0.02 : // Upward bias with gravity
                   (Math.random() - 0.5) * 0.04;   // No bias without gravity
      
      // Update button states
      bounceBtn.disabled = true;
      stopBtn.disabled = false;
      
      // Show the motion speed slider
      motionSpeedContainer.style.display = 'flex';
      
      // Change cursor to indicate you can still interact
      canvas.style.cursor = 'grab';
    }
  });
  
  // Stop auto-motion
  stopBtn.addEventListener('click', () => {
    if (isAutoMotion) {
      isAutoMotion = false;
      velocityX = 0;
      velocityY = 0;
      
      // Update button states
      bounceBtn.disabled = false;
      stopBtn.disabled = true;
      
      // Hide the motion speed slider
      motionSpeedContainer.style.display = 'none';
      
      // Restore grab cursor for dragging
      canvas.style.cursor = 'grab';
    }
  });
  
  // Helper function to change FPS
  function changeFPS(fps) {
    // Update active button styling
    fps30Btn.classList.toggle('active', fps === 30);
    fps60Btn.classList.toggle('active', fps === 60);
    fps120Btn.classList.toggle('active', fps === 120);
    fpsUnlimitedBtn.classList.toggle('active', fps === Infinity);
    
    // Update target FPS and frame interval
    targetFPS = fps;
    frameInterval = fps === Infinity ? 0 : 1000 / fps;
  }
  
  // Add click handlers for FPS buttons
  fps30Btn.addEventListener('click', () => changeFPS(30));
  fps60Btn.addEventListener('click', () => changeFPS(60));
  fps120Btn.addEventListener('click', () => changeFPS(120));
  fpsUnlimitedBtn.addEventListener('click', () => changeFPS(Infinity));
  
  // Set up drag functionality
  canvas.style.cursor = 'grab'; // Change cursor to indicate draggable
  
  // Helper function to convert screen coordinates to WebGL coordinates
  function getWebGLCoordinates(canvas, x, y) {
    const rect = canvas.getBoundingClientRect();
    // Convert screen coordinates to clip space (-1 to 1)
    const clipX = (x - rect.left) / rect.width * 2 - 1;
    const clipY = -((y - rect.top) / rect.height * 2 - 1); // Flip Y coordinate
    
    // Adjust for perspective division and z-distance
    // This is a simplified approach that works for our basic scene
    // For more complex scenes, you'd need to use the inverse projection matrix
    const z = -6.0; // The z-position of our shape
    const scale = -z / 6.0; // Scale factor based on perspective
    
    return {
      x: clipX * scale,
      y: clipY * scale
    };
  }
  
  // Helper function to constrain shape within boundaries
  function constrainPosition(x, y, scale) {
    // Calculate the bounds of the view frustum at our z distance
    const z = -6.0;
    const aspectRatio = gl.canvas.width / gl.canvas.height;
    const fieldOfView = (45 * Math.PI) / 180; // in radians
    
    // Calculate view boundaries at our z distance
    const viewHeight = 2 * Math.tan(fieldOfView / 2) * Math.abs(z);
    const viewWidth = viewHeight * aspectRatio;
    
    // Calculate the maximum allowed position based on shape size and view boundaries
    // Use scale as an approximation of the shape's radius
    const maxX = viewWidth / 2 - scale;
    const maxY = viewHeight / 2 - scale;
    
    // Constrain x and y within boundaries
    return {
      x: Math.max(Math.min(x, maxX), -maxX),
      y: Math.max(Math.min(y, maxY), -maxY)
    };
  }
  
  // Add mouse event listeners
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    canvas.style.cursor = 'grabbing';
    
    // Get the coordinates of the click
    const coords = getWebGLCoordinates(canvas, e.clientX, e.clientY);
    dragStartX = coords.x - shapePositionX;
    dragStartY = coords.y - shapePositionY;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const coords = getWebGLCoordinates(canvas, e.clientX, e.clientY);
      
      // Calculate the new position
      let newX = coords.x - dragStartX;
      let newY = coords.y - dragStartY;
      
      // Apply constraints to keep shape within boundaries
      const constrained = constrainPosition(newX, newY, triangleScale);
      
      if (isAutoMotion) {
        // Calculate how much the shape was moved
        const deltaX = constrained.x - shapePositionX;
        const deltaY = constrained.y - shapePositionY;
        
        // Apply a force to the velocity based on movement
        // Multiply by a drag factor to convert position change to velocity
        // Use higher drag factor for more responsive feeling
        const dragFactor = 0.4;
        velocityX += deltaX * dragFactor;
        velocityY += deltaY * dragFactor;
        
        // Update position
        shapePositionX = constrained.x;
        shapePositionY = constrained.y;
      } else {
        // Normal dragging behavior
        shapePositionX = constrained.x;
        shapePositionY = constrained.y;
      }
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });
  
  // Also support touch events for mobile
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      isDragging = true;
      
      const touch = e.touches[0];
      const coords = getWebGLCoordinates(canvas, touch.clientX, touch.clientY);
      dragStartX = coords.x - shapePositionX;
      dragStartY = coords.y - shapePositionY;
    }
  });
  
  canvas.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
      e.preventDefault();
      
      const touch = e.touches[0];
      const coords = getWebGLCoordinates(canvas, touch.clientX, touch.clientY);
      
      // Calculate the new position
      let newX = coords.x - dragStartX;
      let newY = coords.y - dragStartY;
      
      // Apply constraints to keep shape within boundaries
      const constrained = constrainPosition(newX, newY, triangleScale);
      
      if (isAutoMotion) {
        // Calculate how much the shape was moved
        const deltaX = constrained.x - shapePositionX;
        const deltaY = constrained.y - shapePositionY;
        
        // Apply a force to the velocity based on movement
        // Use a slightly higher drag factor for touch since it's less precise
        // Increased for more responsive feel
        const dragFactor = 0.45;
        velocityX += deltaX * dragFactor;
        velocityY += deltaY * dragFactor;
        
        // Update position
        shapePositionX = constrained.x;
        shapePositionY = constrained.y;
      } else {
        // Normal dragging behavior
        shapePositionX = constrained.x;
        shapePositionY = constrained.y;
      }
    }
  });
  
  canvas.addEventListener('touchend', () => {
    isDragging = false;
  });

  // Track FPS
  let frameCount = 0;
  let lastFpsUpdateTime = 0;
  const fpsDisplay = document.createElement('div');
  fpsDisplay.style.position = 'absolute';
  fpsDisplay.style.top = '10px';
  fpsDisplay.style.right = '10px';
  fpsDisplay.style.background = 'rgba(0,0,0,0.5)';
  fpsDisplay.style.color = 'white';
  fpsDisplay.style.padding = '5px';
  fpsDisplay.style.borderRadius = '3px';
  fpsDisplay.style.fontFamily = 'monospace';
  document.body.appendChild(fpsDisplay);
  
  // Add drag hint
  const dragHint = document.createElement('div');
  dragHint.className = 'drag-hint';
  dragHint.textContent = 'Drag to move the shape (even during auto-bounce)';
  document.body.appendChild(dragHint);
  
  // Set the initial state of gravity controls
  if (gravityEnabled) {
    gravityStrengthContainer.style.display = 'flex';
    gravityIncreaseBtn.disabled = false;
  } else {
    gravityStrengthContainer.style.display = 'none';
    gravityIncreaseBtn.disabled = true;
  }
  
  // Hide hint after 8 seconds
  setTimeout(() => {
    dragHint.style.opacity = '0';
  }, 8000);
  
  // Draw the scene repeatedly for animation
  function render(now) {
    // Skip this frame if we're targeting a specific FPS and 
    // not enough time has passed since the last frame
    if (frameInterval > 0) { // If we have a fps limit
      const elapsed = now - lastFrameTime;
      if (elapsed < frameInterval) {
        requestAnimationFrame(render);
        return; // Skip this frame
      }
      // Only update lastFrameTime when we actually render a frame
      lastFrameTime = now - (elapsed % frameInterval); // Adjust for any extra time
    } else {
      lastFrameTime = now; // For unlimited FPS
    }
    
    // Convert to seconds
    const nowSeconds = now / 1000;
    
    // Calculate delta time since last frame
    const deltaTime = nowSeconds - lastTime;
    lastTime = nowSeconds;
    
    // If this is not the first frame, update the rotation angle
    if (deltaTime > 0) {
      // Update angle based on speed and time elapsed
      currentAngle += rotationSpeed * deltaTime;
      
      // Keep angle between 0 and 2π for consistency
      currentAngle %= (2 * Math.PI);
      
      // Make currentAngle available globally
      window.currentAngle = currentAngle;
      
      // Handle auto-motion with physics if enabled
      if (isAutoMotion) {
        // Apply gravity to y velocity if gravity is enabled
        if (gravityEnabled) {
          // Handle accelerating gravity
          if (gravityAccelerating) {
            // Increase gravity strength based on acceleration rate
            gravityStrength += gravityAcceleration * deltaTime;
            
            // Clamp to maximum value
            if (gravityStrength > maxGravityStrength) {
              gravityStrength = maxGravityStrength;
            }
            
            // Update the slider UI and display
            gravityStrengthSlider.value = gravityStrength;
            updateGravityDisplay();
          }
          
          // Use the custom gravity strength multiplied by motion speed
          const gravity = gravityStrength * motionSpeed;
          velocityY -= gravity * deltaTime;
        }
        
        // Calculate new position with motion speed applied
        let newX = shapePositionX + velocityX * deltaTime * 60 * motionSpeed; // Scale by 60 to normalize for ~60fps
        let newY = shapePositionY + velocityY * deltaTime * 60 * motionSpeed;
        
        // Get maximum boundaries
        const z = -6.0;
        const aspectRatio = gl.canvas.width / gl.canvas.height;
        const fieldOfView = (45 * Math.PI) / 180;
        const viewHeight = 2 * Math.tan(fieldOfView / 2) * Math.abs(z);
        const viewWidth = viewHeight * aspectRatio;
        const maxX = viewWidth / 2 - triangleScale;
        const maxY = viewHeight / 2 - triangleScale;
        
        // Check for boundary collisions and apply bounce
        if (newX > maxX || newX < -maxX) {
          velocityX *= -bounceCoefficient; // Reverse and reduce x velocity
          
          // Make sure it stays in bounds
          if (newX > maxX) {
            newX = maxX;
          } else if (newX < -maxX) {
            newX = -maxX;
          }
          
          // Add a small random component on bounce to simulate imperfect surfaces
          // Scale by motion speed but use a smaller value for more predictable physics
          velocityY += (Math.random() - 0.5) * 0.001 * motionSpeed;
        }
        
        if (newY > maxY || newY < -maxY) {
          velocityY *= -bounceCoefficient; // Reverse and reduce y velocity
          
          // Make sure it stays in bounds
          if (newY > maxY) {
            newY = maxY;
          } else if (newY < -maxY) {
            newY = -maxY;
          }
          
          // Add a small random component on bounce to simulate imperfect surfaces
          // Scale by motion speed but use a smaller value for more predictable physics
          velocityX += (Math.random() - 0.5) * 0.001 * motionSpeed;
        }
        
        // Apply air resistance - more realistic damping with quadratic air drag
        // Higher speeds experience more air resistance
        const airResistance = 0.003;
        const vxSign = Math.sign(velocityX);
        const vySign = Math.sign(velocityY);
        const vxMag = Math.abs(velocityX);
        const vyMag = Math.abs(velocityY);
        
        // Apply quadratic drag (force proportional to velocity squared)
        velocityX -= vxSign * vxMag * vxMag * airResistance * deltaTime;
        velocityY -= vySign * vyMag * vyMag * airResistance * deltaTime;
        
        // Update position
        shapePositionX = newX;
        shapePositionY = newY;
      }
    }
    
    // Draw the scene with current position
    drawScene(gl, programInfo, buffers, triangleScale, rotationSpeed, shapePositionX, shapePositionY);
    
    // Calculate and display FPS
    frameCount++;
    if (nowSeconds - lastFpsUpdateTime >= 1.0) { // Update every second
      const fps = Math.round(frameCount / (nowSeconds - lastFpsUpdateTime));
      const targetDisplay = targetFPS === Infinity ? "Unlimited" : `${targetFPS}`;
      fpsDisplay.textContent = `${fps} FPS (Target: ${targetDisplay})`;
      frameCount = 0;
      lastFpsUpdateTime = nowSeconds;
    }
    
    // Request next frame
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

}0
