import * as THREE from 'three'
import { MAX_SPEED, RACE_DISTANCE, TRACK_WIDTH, RacerGame, roadCenter } from './game'

export interface RacerScene {
  canvas: HTMLCanvasElement
  render: (dt: number, time: number) => void
  dispose: () => void
}

function toonMaterial(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color })
}

export function createRacerScene(host: HTMLElement, game: RacerGame, invalidate: () => void): RacerScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.setClearColor(0xdfe9e2, 1)
  renderer.domElement.dataset.testid = 'racer-canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 180)
  const cameraTarget = new THREE.Vector3()
  const cameraPosition = new THREE.Vector3()
  const root = new THREE.Group()
  scene.add(root)
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const roadPieces: THREE.Mesh[] = []
  const lanePieces: THREE.Mesh[] = []
  const shoulderPieces: THREE.Mesh[] = []
  const treePieces: THREE.Group[] = []
  const obstaclePieces: THREE.Group[] = []
  let disposed = false

  const sky = new THREE.Color(0xdfe9e2)
  const paperGreen = toonMaterial(0x8bbba5)
  const paperGreenLight = toonMaterial(0xb8d7bf)
  const paperBlue = toonMaterial(0x9bc8d4)
  const paperYellow = toonMaterial(0xf3d98c)
  const roadMaterial = toonMaterial(0x5b6870)
  const shoulderMaterial = toonMaterial(0xf4f0de)
  const treeTrunkMaterial = toonMaterial(0xcba976)
  const treeTopMaterial = toonMaterial(0x8fba9e)
  const treeTopLightMaterial = toonMaterial(0xb7d7be)
  const carBodyMaterial = toonMaterial(0xe07163)
  const carDarkMaterial = toonMaterial(0x405a67)
  const carWindowMaterial = toonMaterial(0xd9f1ee)
  const obstacleMaterial = toonMaterial(0xe4a454)
  const obstacleStripeMaterial = toonMaterial(0xf8eac5)
  const finishMaterial = toonMaterial(0x33444d)
  const finishLightMaterial = toonMaterial(0xf3ede0)
  for (const material of [paperGreen, paperGreenLight, paperBlue, paperYellow, roadMaterial, shoulderMaterial, treeTrunkMaterial, treeTopMaterial, treeTopLightMaterial, carBodyMaterial, carDarkMaterial, carWindowMaterial, obstacleMaterial, obstacleStripeMaterial, finishMaterial, finishLightMaterial]) materials.add(material)

  function geo<T extends THREE.BufferGeometry>(value: T): T {
    geometries.add(value)
    return value
  }
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    const object = new THREE.Mesh(geometry, material)
    object.castShadow = true
    object.receiveShadow = true
    return object
  }

  const ambient = new THREE.HemisphereLight(0xf9fff8, 0x71817e, 2.4)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(0xfff2d7, 3.2)
  sun.position.set(-8, 16, 10)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -16
  sun.shadow.camera.right = 16
  sun.shadow.camera.top = 20
  sun.shadow.camera.bottom = -8
  sun.shadow.camera.far = 70
  sun.shadow.normalBias = 0.035
  scene.add(sun, sun.target)

  const ground = mesh(geo(new THREE.PlaneGeometry(200, 220)), paperGreenLight)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.22
  root.add(ground)
  const groundCut = mesh(geo(new THREE.PlaneGeometry(200, 220)), paperGreen)
  groundCut.rotation.x = -Math.PI / 2
  groundCut.position.set(0, -0.21, -8)
  groundCut.scale.set(0.99, 1, 0.68)
  root.add(groundCut)

  for (let index = 0; index < 42; index++) {
    const road = mesh(geo(new THREE.BoxGeometry(TRACK_WIDTH, 0.16, 5.95)), roadMaterial)
    roadPieces.push(road)
    root.add(road)
    const shoulderLeft = mesh(geo(new THREE.BoxGeometry(0.34, 0.21, 5.95)), shoulderMaterial)
    const shoulderRight = mesh(geo(new THREE.BoxGeometry(0.34, 0.21, 5.95)), shoulderMaterial)
    shoulderPieces.push(shoulderLeft, shoulderRight)
    root.add(shoulderLeft, shoulderRight)
    if (index % 2 === 0) {
      const lane = mesh(geo(new THREE.BoxGeometry(0.09, 0.018, 1.3)), paperYellow)
      lanePieces.push(lane)
      root.add(lane)
    }
  }

  function createTree() {
    const group = new THREE.Group()
    const trunk = mesh(geo(new THREE.BoxGeometry(0.24, 1.05, 0.24)), treeTrunkMaterial)
    trunk.position.y = 0.35
    const layerBottom = mesh(geo(new THREE.ConeGeometry(0.95, 1.25, 5)), treeTopMaterial)
    layerBottom.position.y = 1.1
    const layerTop = mesh(geo(new THREE.ConeGeometry(0.68, 1.15, 5)), treeTopLightMaterial)
    layerTop.position.y = 1.85
    group.add(trunk, layerBottom, layerTop)
    root.add(group)
    return group
  }
  for (let i = 0; i < 22; i++) treePieces.push(createTree())

  function createCar() {
    const car = new THREE.Group()
    const body = mesh(geo(new THREE.BoxGeometry(1.2, 0.38, 2.1)), carBodyMaterial)
    body.position.y = 0.42
    const hood = mesh(geo(new THREE.BoxGeometry(1.04, 0.18, 0.58)), carBodyMaterial)
    hood.position.set(0, 0.66, -0.65)
    const cabin = mesh(geo(new THREE.BoxGeometry(0.85, 0.36, 0.9)), carDarkMaterial)
    cabin.position.set(0, 0.78, 0.18)
    const windshield = mesh(geo(new THREE.BoxGeometry(0.67, 0.16, 0.04)), carWindowMaterial)
    windshield.position.set(0, 0.88, -0.25)
    windshield.rotation.x = -0.22
    const stripe = mesh(geo(new THREE.BoxGeometry(0.13, 0.02, 2.06)), paperYellow)
    stripe.position.y = 0.63
    const bumper = mesh(geo(new THREE.BoxGeometry(1.22, 0.13, 0.16)), carDarkMaterial)
    bumper.position.set(0, 0.3, -1.04)
    car.add(body, hood, cabin, windshield, stripe, bumper)
    return car
  }
  const car = createCar()
  root.add(car)

  function createObstacle() {
    const group = new THREE.Group()
    const cone = mesh(geo(new THREE.ConeGeometry(0.45, 1.0, 5)), obstacleMaterial)
    cone.position.y = 0.5
    const stripe = mesh(geo(new THREE.CylinderGeometry(0.37, 0.43, 0.14, 5)), obstacleStripeMaterial)
    stripe.position.y = 0.45
    group.add(cone, stripe)
    root.add(group)
    return group
  }
  for (let i = 0; i < game.obstacles.length; i++) obstaclePieces.push(createObstacle())

  const finish = new THREE.Group()
  const finishLeft = mesh(geo(new THREE.BoxGeometry(0.16, 3.2, 0.16)), finishMaterial)
  const finishRight = mesh(geo(new THREE.BoxGeometry(0.16, 3.2, 0.16)), finishMaterial)
  finishLeft.position.set(-TRACK_WIDTH / 2 + 0.25, 1.6, 0)
  finishRight.position.set(TRACK_WIDTH / 2 - 0.25, 1.6, 0)
  const finishTop = mesh(geo(new THREE.BoxGeometry(TRACK_WIDTH - 0.5, 0.16, 0.16)), finishMaterial)
  finishTop.position.y = 3.18
  for (const item of [finishLeft, finishRight, finishTop]) finish.add(item)
  for (let i = 0; i < 8; i++) {
    const flag = mesh(geo(new THREE.BoxGeometry(0.66, 0.28, 0.05)), i % 2 ? finishMaterial : finishLightMaterial)
    flag.position.set(-TRACK_WIDTH / 2 + 0.55 + (i % 4) * 0.68, 2.68 - Math.floor(i / 4) * 0.3, 0.02)
    finish.add(flag)
  }
  root.add(finish)

  const clouds: THREE.Group[] = []
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group()
    const cloudMaterial = toonMaterial(0xf8f5e9)
    materials.add(cloudMaterial)
    for (let part = 0; part < 3; part++) {
      const puff = mesh(geo(new THREE.CircleGeometry(0.75 + part * 0.18, 16)), cloudMaterial)
      puff.rotation.x = -Math.PI / 2
      puff.rotation.z = part * 0.7
      puff.position.x = part * 0.75 - 0.75
      cloud.add(puff)
    }
    root.add(cloud)
    clouds.push(cloud)
  }

  const theme = matchMedia('(prefers-color-scheme: dark)')
  function applyTheme() {
    const attr = document.documentElement.dataset.theme
    const dark = attr === 'dark' || (attr !== 'light' && theme.matches)
    sky.set(dark ? 0x17252b : 0xdfe9e2)
    scene.background = sky
    scene.fog = new THREE.Fog(sky, 32, 115)
    groundMaterialColor(dark)
    ambient.intensity = dark ? 1.8 : 2.4
    invalidate()
  }
  function groundMaterialColor(dark: boolean) {
    const target = new THREE.Color(dark ? 0x304d43 : 0xb8d7bf)
    paperGreenLight.color.copy(target)
    paperGreen.color.copy(new THREE.Color(dark ? 0x527361 : 0x8fba9e))
    roadMaterial.color.copy(new THREE.Color(dark ? 0x34444a : 0x5b6870))
  }
  const observer = new MutationObserver(applyTheme)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  theme.addEventListener('change', applyTheme)
  applyTheme()

  const resizeObserver = new ResizeObserver(() => {
    const width = Math.max(host.clientWidth, 1)
    const height = Math.max(host.clientHeight, 1)
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    invalidate()
  })
  resizeObserver.observe(host)

  function render(dt: number, time: number) {
    if (renderer.getContext().isContextLost() || disposed) return
    const current = game.distance
    const playerCenter = roadCenter(current)
    cameraPosition.set(playerCenter + game.lateral * 0.18, 4.3, 8.2)
    camera.position.lerp(cameraPosition, 1 - Math.exp(-dt * 6))
    cameraTarget.set(playerCenter + game.lateral * 0.08, 0.5, -10)
    camera.lookAt(cameraTarget)
    sun.position.set(playerCenter - 8, 16, 10)
    sun.target.position.set(playerCenter, 0, -18)
    car.position.set(playerCenter + game.lateral, 0, 1.4)
    car.rotation.y = -game.steer * 0.14
    car.rotation.z = -game.steer * 0.045
    car.position.y = 0.04 + Math.sin(time * 8) * Math.min(0.035, game.speed / MAX_SPEED * 0.02)

    for (let i = 0; i < roadPieces.length; i++) {
      const distance = Math.floor(current / 6) * 6 + i * 6 - 18
      const z = -(distance - current) + 1
      const center = roadCenter(distance)
      const road = roadPieces[i]
      road.position.set(center, -0.13, z)
      road.rotation.y = Math.atan2(roadCenter(distance + 3) - center, 3)
      const left = shoulderPieces[i * 2]
      const right = shoulderPieces[i * 2 + 1]
      left.position.set(center - TRACK_WIDTH / 2 - 0.22, -0.08, z)
      right.position.set(center + TRACK_WIDTH / 2 + 0.22, -0.08, z)
      left.rotation.y = road.rotation.y
      right.rotation.y = road.rotation.y
      if (lanePieces[i / 2]) {
        const lane = lanePieces[i / 2]
        lane.position.set(center, -0.035, z)
        lane.rotation.y = road.rotation.y
      }
    }

    for (let i = 0; i < treePieces.length; i++) {
      const distance = Math.floor(current / 11) * 11 + i * 11 + 13
      const z = -(distance - current) + 1
      const center = roadCenter(distance)
      const side = i % 2 ? 1 : -1
      const tree = treePieces[i]
      tree.position.set(center + side * (5.2 + (i % 3) * 1.3), -0.1, z)
      tree.scale.setScalar(0.8 + (i % 4) * 0.1)
      tree.rotation.y = Math.sin(i * 2.8) * 0.18
    }

    for (let i = 0; i < obstaclePieces.length; i++) {
      const obstacle = game.obstacles[i]
      const object = obstaclePieces[i]
      const z = -(obstacle.distance - current) + 1
      object.visible = !obstacle.hit && z > -92 && z < 15
      object.position.set(roadCenter(obstacle.distance) + obstacle.lane, -0.06, z)
      object.rotation.y = Math.sin(time * 0.7 + i) * 0.05
    }
    const finishZ = -(RACE_DISTANCE - current) + 1
    finish.visible = finishZ > -100 && finishZ < 15
    finish.position.set(roadCenter(RACE_DISTANCE), -0.05, finishZ)
    finish.rotation.y = Math.atan2(roadCenter(RACE_DISTANCE + 3) - roadCenter(RACE_DISTANCE), 3)

    clouds.forEach((cloud, index) => {
      const distance = (index * 28) % 150 + 24
      cloud.position.set(roadCenter(current + distance) + (index % 2 ? 10 : -10), 7 + (index % 3), -(distance) - 16)
      cloud.scale.setScalar(0.8 + (index % 3) * 0.16)
    })
    renderer.render(scene, camera)
  }

  const initialWidth = Math.max(host.clientWidth, 1)
  const initialHeight = Math.max(host.clientHeight, 1)
  renderer.setSize(initialWidth, initialHeight)
  camera.aspect = initialWidth / initialHeight
  camera.updateProjectionMatrix()
  render(0, 0)

  function dispose() {
    if (disposed) return
    disposed = true
    resizeObserver.disconnect()
    observer.disconnect()
    theme.removeEventListener('change', applyTheme)
    geometries.forEach((value) => value.dispose())
    materials.forEach((value) => value.dispose())
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }
  return { canvas: renderer.domElement, render, dispose }
}
