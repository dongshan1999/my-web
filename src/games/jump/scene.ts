import * as THREE from 'three'
import { PLATFORM_HEIGHT, PLAYER_RADIUS, type JumpGame, type Platform } from './game'

export interface JumpScene {
  canvas: HTMLCanvasElement
  render: (dt: number, time: number) => void
  dispose: () => void
}

export function createJumpScene(host: HTMLElement, game: JumpGame, invalidate: () => void): JumpScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.setClearColor(0xedf5f5, 1)
  renderer.domElement.dataset.testid = 'jump-canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 90)
  const lookAt = new THREE.Vector3(1.6, 0.4, 0)
  const cameraOffset = new THREE.Vector3(8, 11, 8)
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const meshes = new Map<string, THREE.Group>()
  const colors = [0x88b9ad, 0x83aecd, 0xd69688, 0xd0be83]

  function geometry<T extends THREE.BufferGeometry>(value: T): T {
    geometries.add(value)
    return value
  }
  function material<T extends THREE.Material>(value: T): T {
    materials.add(value)
    return value
  }
  function releaseGroup(group: THREE.Group) {
    group.traverse((object) => {
      if (!('geometry' in object)) return
      const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
      if (geometries.delete(mesh.geometry)) mesh.geometry.dispose()
      for (const value of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (materials.delete(value)) value.dispose()
      }
    })
    scene.remove(group)
  }

  const ambient = new THREE.HemisphereLight(0xf2faff, 0x7b8d83, 2.4)
  scene.add(ambient)
  const light = new THREE.DirectionalLight(0xfff5e9, 3)
  light.position.set(7, 12, 5)
  light.castShadow = true
  light.shadow.mapSize.set(1024, 1024)
  light.shadow.camera.left = -9
  light.shadow.camera.right = 9
  light.shadow.camera.top = 9
  light.shadow.camera.bottom = -9
  light.shadow.camera.near = 0.1
  light.shadow.camera.far = 35
  light.shadow.normalBias = 0.025
  scene.add(light, light.target)

  const groundMaterial = material(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }))
  const ground = new THREE.Mesh(geometry(new THREE.PlaneGeometry(100, 100)), groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.04
  ground.receiveShadow = true
  scene.add(ground)
  const grid = new THREE.GridHelper(100, 70, 0x78999c, 0x78999c)
  grid.position.y = -0.035
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
  for (const value of gridMaterials) {
    value.transparent = true
    value.opacity = 0.13
    value.depthWrite = false
    materials.add(value)
  }
  geometries.add(grid.geometry)
  scene.add(grid)

  const avatar = new THREE.Group()
  const graphite = material(new THREE.MeshStandardMaterial({ color: 0x232c32, roughness: 0.32, metalness: 0.2 }))
  const body = new THREE.Mesh(geometry(new THREE.CylinderGeometry(0.145, 0.205, 0.48, 24)), graphite)
  body.position.y = 0.26
  body.castShadow = true
  const head = new THREE.Mesh(geometry(new THREE.SphereGeometry(0.165, 24, 16)), graphite)
  head.position.y = 0.64
  head.castShadow = true
  const band = new THREE.Mesh(
    geometry(new THREE.CylinderGeometry(0.18, 0.185, 0.06, 24)),
    material(new THREE.MeshStandardMaterial({ color: 0xe2f5e9, roughness: 0.45 })),
  )
  band.position.y = 0.22
  const stripe = new THREE.Mesh(
    geometry(new THREE.BoxGeometry(0.045, 0.21, 0.02)),
    material(new THREE.MeshStandardMaterial({ color: 0xa2d7c4, roughness: 0.5 })),
  )
  stripe.position.set(0, 0.37, 0.17)
  avatar.add(body, head, band, stripe)
  scene.add(avatar)

  const pulseMaterial = material(new THREE.MeshBasicMaterial({ color: 0x65bb9d, transparent: true, depthWrite: false }))
  const pulse = new THREE.Mesh(geometry(new THREE.TorusGeometry(0.3, 0.018, 8, 48)), pulseMaterial)
  pulse.rotation.x = -Math.PI / 2
  scene.add(pulse)

  function platformMesh(platform: Platform): THREE.Group {
    const group = new THREE.Group()
    const side = material(new THREE.MeshStandardMaterial({ color: colors[platform.color], roughness: 0.52 }))
    const top = material(new THREE.MeshStandardMaterial({ color: 0xecf6f1, roughness: 0.65 }))
    const cube = new THREE.Mesh(
      geometry(new THREE.BoxGeometry(platform.size, PLATFORM_HEIGHT, platform.size)),
      [side, side, top, side, side, side],
    )
    cube.position.y = PLATFORM_HEIGHT / 2
    cube.castShadow = true
    cube.receiveShadow = true
    const rim = new THREE.LineSegments(
      geometry(new THREE.EdgesGeometry(cube.geometry)),
      material(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 })),
    )
    rim.position.y = PLATFORM_HEIGHT / 2
    const ring = new THREE.Mesh(
      geometry(new THREE.TorusGeometry(0.21, 0.014, 8, 40)),
      material(new THREE.MeshBasicMaterial({ color: 0x718b89, transparent: true, opacity: 0.75 })),
    )
    ring.name = 'target-ring'
    ring.rotation.x = -Math.PI / 2
    ring.position.y = PLATFORM_HEIGHT + 0.008
    const dot = new THREE.Mesh(
      geometry(new THREE.CircleGeometry(0.04, 20)),
      material(new THREE.MeshBasicMaterial({ color: 0x718b89 })),
    )
    dot.rotation.x = -Math.PI / 2
    dot.position.y = PLATFORM_HEIGHT + 0.01
    group.add(cube, rim, ring, dot)
    group.position.set(platform.x, 0, platform.z)
    scene.add(group)
    return group
  }

  const systemTheme = matchMedia('(prefers-color-scheme: dark)')
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)')
  function updateTheme() {
    const theme = document.documentElement.dataset.theme
    const dark = theme === 'dark' || (theme !== 'light' && systemTheme.matches)
    const background = new THREE.Color(dark ? 0x17232a : 0xedf5f5)
    scene.background = background
    scene.fog = new THREE.Fog(background, 26, 65)
    groundMaterial.color.copy(background)
    ambient.intensity = dark ? 1.9 : 2.4
    invalidate()
  }
  const observer = new MutationObserver(updateTheme)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  systemTheme.addEventListener('change', updateTheme)
  updateTheme()

  function resize() {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    renderer.setSize(width, height)
    const aspect = width / height
    const viewWidth = Math.max(6.8, aspect * 7.2)
    camera.left = -viewWidth / 2
    camera.right = viewWidth / 2
    camera.top = viewWidth / aspect / 2
    camera.bottom = -camera.top
    camera.updateProjectionMatrix()
    invalidate()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()
  let previousRun = game.runId

  function render(dt: number, time: number) {
    if (renderer.getContext().isContextLost()) return
    const desired = new THREE.Vector3((game.current.x + game.target.x) / 2, 0.4, (game.current.z + game.target.z) / 2)
    if (previousRun !== game.runId) {
      lookAt.copy(desired)
      previousRun = game.runId
    } else {
      lookAt.lerp(desired, 1 - Math.exp(-dt * 5))
    }
    camera.position.copy(lookAt).add(cameraOffset)
    camera.lookAt(lookAt)
    light.position.copy(lookAt).add(new THREE.Vector3(7, 12, 5))
    light.target.position.copy(lookAt)
    ground.position.set(lookAt.x, -0.04, lookAt.z)
    grid.position.set(Math.round(lookAt.x / (100 / 70)) * (100 / 70), -0.035, Math.round(lookAt.z / (100 / 70)) * (100 / 70))

    const activeKeys = new Set(game.platforms.map((platform) => `${game.runId}:${platform.id}`))
    for (const [key, mesh] of meshes) {
      if (!activeKeys.has(key)) {
        releaseGroup(mesh)
        meshes.delete(key)
      }
    }
    for (const platform of game.platforms) {
      const key = `${game.runId}:${platform.id}`
      let mesh = meshes.get(key)
      if (!mesh) {
        mesh = platformMesh(platform)
        meshes.set(key, mesh)
      }
      const ring = mesh.getObjectByName('target-ring') as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
      const target = platform === game.target
      ring.material.color.setHex(target ? 0xd39754 : 0x718b89)
      ring.material.opacity = target ? 0.9 : 0.3
      const ripple = target && !game.paused && !motionPreference.matches ? 1 + Math.sin(time * 2.7) * 0.05 : 1
      ring.scale.setScalar(ripple)
    }
    avatar.position.set(game.player.position.x, game.player.position.y - PLAYER_RADIUS, game.player.position.z)
    const power = game.phase === 'charging' ? game.chargeTime / 1.2 : 0
    avatar.scale.set(1 + power * 0.12, 1 - power * 0.28, 1 + power * 0.12)
    avatar.rotation.z = game.phase === 'falling' || game.phase === 'gameover' ? Math.min(1.2, Math.max(0, (PLATFORM_HEIGHT - game.player.position.y) * 0.7)) : 0
    if (game.phase === 'flying' && !game.paused) avatar.rotation.y += dt * 3.5
    if (game.phase === 'ready') avatar.rotation.y = 0
    pulse.visible = game.landingPulse > 0.02
    pulse.position.set(game.player.position.x, PLATFORM_HEIGHT + 0.015, game.player.position.z)
    pulse.scale.setScalar(1 + (1 - game.landingPulse) * 2.5)
    pulseMaterial.opacity = game.landingPulse * 0.7
    renderer.render(scene, camera)
  }

  return {
    canvas: renderer.domElement,
    render,
    dispose() {
      resizeObserver.disconnect()
      observer.disconnect()
      systemTheme.removeEventListener('change', updateTheme)
      for (const value of geometries) value.dispose()
      for (const value of materials) value.dispose()
      light.shadow.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
