function initBuffers(gl, shape = 'triangle', vertexCount = 0) {
    const positionBuffer = initPositionBuffer(gl, shape, vertexCount);
  
    return {
      position: positionBuffer,
      vertexCount: getVertexCount(shape, vertexCount)
    };
  }
  
  function getVertexCount(shape, customVertices) {
    switch(shape) {
      case 'triangle': return 4;
      case 'square': return 5;
      case 'circle': return 51; // 50 segments + 1 to close
      case 'custom': return customVertices + 1; // +1 to close the shape
      default: return 4;
    }
  }
  
  function initPositionBuffer(gl, shape, customVertices = 0) {
    // Create a buffer for the positions
    const positionBuffer = gl.createBuffer();
  
    // Select the positionBuffer as the one to apply buffer
    // operations to from here out.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    
    let positions = [];
    
    // Generate vertices based on shape
    switch(shape) {
      case 'triangle':
        // Create an equilateral triangle
        positions = [
          0.0, 0.95,             // top vertex (0 degrees)
          -0.823, -0.475,        // bottom left vertex (120 degrees)
          0.823, -0.475,         // bottom right vertex (240 degrees)
          0.0, 0.95              // back to top to close the triangle
        ];
        break;
        
      case 'square':
        // Create a square
        positions = [
          -0.75, 0.75,   // top left
          0.75, 0.75,    // top right
          0.75, -0.75,   // bottom right
          -0.75, -0.75,  // bottom left
          -0.75, 0.75    // back to top left to close the square
        ];
        break;
        
      case 'circle':
        // Generate a circle with 50 segments
        const circleSegments = 50;
        const circleRadius = 0.75;
        
        for (let i = 0; i <= circleSegments; i++) {
          const theta = (i / circleSegments) * 2 * Math.PI;
          const x = circleRadius * Math.cos(theta);
          const y = circleRadius * Math.sin(theta);
          positions.push(x, y);
        }
        break;
        
      case 'custom':
        // Generate a custom regular polygon with specified number of vertices
        const radius = 0.75;
        const vertices = Math.max(3, customVertices); // Minimum 3 vertices
        
        for (let i = 0; i <= vertices; i++) {
          const theta = (i / vertices) * 2 * Math.PI;
          const x = radius * Math.cos(theta);
          const y = radius * Math.sin(theta);
          positions.push(x, y);
        }
        break;
        
      default:
        // Default to triangle
        positions = [
          0.0, 0.95,
          -0.823, -0.475,
          0.823, -0.475,
          0.0, 0.95
        ];
    }
  
    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  
    return positionBuffer;
  }
  
  export { initBuffers };
  