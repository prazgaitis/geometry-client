import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import './App.css'

function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const pointCloudRef = useRef<THREE.Points | null>(null)
  const [dimensions, setDimensions] = useState({ width: 640, height: 640 })

  const [numPoints, setNumPoints] = useState(100)
  const [dispersion, setDispersion] = useState(5)
  const [pointColor, setPointColor] = useState('#00ff00')

  const updateDimensions = useCallback(() => {
    if (mountRef.current) {
      const width = Math.max(mountRef.current.clientWidth, 640)
      const height = Math.max(mountRef.current.clientHeight, 640)
      setDimensions({ width, height })
    }
  }, [])

  const generatePoints = useCallback(() => {
    if (!sceneRef.current) return

    if (pointCloudRef.current) {
      sceneRef.current.remove(pointCloudRef.current)
      pointCloudRef.current.geometry.dispose()
      ;(pointCloudRef.current.material as THREE.Material).dispose()
    }

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(numPoints * 3)

    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = Math.random() * dispersion     // x (0 to dispersion)
      positions[i + 1] = Math.random() * dispersion // y (0 to dispersion)
      positions[i + 2] = Math.random() * dispersion // z (0 to dispersion)
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({ color: pointColor, size: 0.1 })
    const pointCloud = new THREE.Points(geometry, material)
    sceneRef.current.add(pointCloud)
    pointCloudRef.current = pointCloud
  }, [numPoints, dispersion, pointColor])

  const getPointsAsJSON = useCallback(() => {
    if (!pointCloudRef.current) return '[]'
    const positions = pointCloudRef.current.geometry.attributes.position.array
    const points = []
    for (let i = 0; i < positions.length; i += 3) {
      points.push({
        x: positions[i],
        y: positions[i + 1],
        z: positions[i + 2]
      })
    }
    return JSON.stringify(points)
  }, [])

  const getPointsAsArray = useCallback(() => {
    if (!pointCloudRef.current) return []
    const positions = pointCloudRef.current.geometry.attributes.position.array
    const points = []
    for (let i = 0; i < positions.length; i += 3) {
      points.push([positions[i], positions[i + 1], positions[i + 2]])
    }
    return points
  }, [])

  const boundingBoxRef = useRef<THREE.LineSegments | null>(null)

  const drawBoundingBox = useCallback((boundingBoxPoints: number[][]) => {
    if (!sceneRef.current) return

    // Remove existing bounding box if any
    if (boundingBoxRef.current) {
      sceneRef.current.remove(boundingBoxRef.current)
      boundingBoxRef.current.geometry.dispose()
      ;(boundingBoxRef.current.material as THREE.Material).dispose()
    }

    const geometry = new THREE.BufferGeometry()
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 }) // Red color for the bounding box

    // Define the vertices of the bounding box
    const vertices = new Float32Array(boundingBoxPoints.flat())
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))

    // Define the indices for the lines
    const indices = new Uint16Array([
      0, 1, 1, 2, 2, 3, 3, 0, // Bottom face
      4, 5, 5, 6, 6, 7, 7, 4, // Top face
      0, 4, 1, 5, 2, 6, 3, 7  // Connecting lines
    ])
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))

    const boundingBox = new THREE.LineSegments(geometry, material)
    sceneRef.current.add(boundingBox)
    boundingBoxRef.current = boundingBox
  }, [])

  const handleBoundingBox = useCallback(async () => {
    const points = getPointsAsArray()
    const apiUrl = "http://localhost:3001/api/bounding_box"
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mesh: points }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("# BOUNDING BOX Response:", data)
      
      if (data["bounding_box"]) {
        drawBoundingBox(data["bounding_box"])
      } else {
        console.error("Unexpected response format")
      }
    } catch (error) {
      console.error("Error fetching bounding box:", error)
    }
  }, [getPointsAsArray, drawBoundingBox])

  const handleOperation = useCallback((operation: string) => {
    switch (operation) {
      case 'Bounding Box':
        handleBoundingBox()
        break
      case 'Rotate Mesh':
      case 'Move Mesh':
      case 'Check Convexity': {
        const pointsJSON = getPointsAsJSON()
        console.log(`${operation} operation:`)
        console.log(pointsJSON)
        // TODO: Replace with API call in the future
        break
      }
      default:
        console.log(`Unknown operation: ${operation}`)
    }
  }, [handleBoundingBox, getPointsAsJSON])

  useEffect(() => {
    console.log('Component mounted')
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [updateDimensions])

  useEffect(() => {
    if (!mountRef.current) {
      console.log('Mount ref not ready')
      return
    }

    console.log('Setting up Three.js scene', { dimensions })

    // Set up scene, camera, and renderer
    const scene = new THREE.Scene()
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(75, dimensions.width / dimensions.height, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    rendererRef.current = renderer
    renderer.setSize(dimensions.width, dimensions.height)
    mountRef.current.appendChild(renderer.domElement)

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    // Add grid
    const gridHelper = new THREE.GridHelper(10, 10)
    scene.add(gridHelper)

    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5)
    scene.add(axesHelper)

    // Position camera
    camera.position.set(dispersion, dispersion, dispersion)
    camera.lookAt(dispersion / 2, dispersion / 2, dispersion / 2)

    // Generate initial point cloud
    generatePoints()

    // Animation loop
    let animationFrameId: number
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    console.log('Three.js scene set up complete')

    // Cleanup
    return () => {
      console.log('Cleaning up Three.js scene')
      cancelAnimationFrame(animationFrameId)
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
      if (pointCloudRef.current) {
        pointCloudRef.current.geometry.dispose()
        ;(pointCloudRef.current.material as THREE.Material).dispose()
      }
    }
  }, [dimensions, generatePoints, dispersion])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100vh', backgroundColor: '#f0f0f0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', padding: '20px', gap: '20px' }}>
        <form onSubmit={(e) => { e.preventDefault(); generatePoints(); }} style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div>
            <label htmlFor="numPoints">Number of Points: {numPoints}</label>
            <input
              type="range"
              id="numPoints"
              min="10"
              max="1000"
              value={numPoints}
              onChange={(e) => setNumPoints(parseInt(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="dispersion">Dispersion: {dispersion}</label>
            <input
              type="range"
              id="dispersion"
              min="1"
              max="20"
              step="0.1"
              value={dispersion}
              onChange={(e) => setDispersion(parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="pointColor">Point Color:</label>
            <input
              type="color"
              id="pointColor"
              value={pointColor}
              onChange={(e) => setPointColor(e.target.value)}
            />
          </div>
          <button type="submit">Regenerate Points</button>
        </form>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={() => handleOperation('Bounding Box')}>Bounding Box</button>
          <button onClick={() => handleOperation('Rotate Mesh')}>Rotate Mesh</button>
          <button onClick={() => handleOperation('Move Mesh')}>Move Mesh</button>
          <button onClick={() => handleOperation('Check Convexity')}>Check Convexity</button>
        </div>
      </div>
      <div ref={mountRef} style={{ width: '640px', height: '640px', backgroundColor: '#ffffff' }} />
    </div>
  )
}

export default App
