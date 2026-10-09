import { Body, Box, Vec3, World } from 'cannon-es'

export type RacerPhase = 'ready' | 'racing' | 'paused' | 'finished'
export interface RacerSnapshot {
  phase: RacerPhase
  speed: number
  time: number
  distance: number
  progress: number
  collisions: number
  lateral: number
  impact: number
}

export const RACE_DISTANCE = 1000
export const MAX_SPEED = 30
export const TRACK_WIDTH = 7.2
export const PHYSICS_STEP = 1 / 120
export const BEST_TIME_KEY = 'my-web.racer.best.v1'

export function roadCenter(distance: number): number {
  return Math.sin(distance * 0.014) * 1.45 + Math.sin(distance * 0.031 + 1.2) * 0.55
}
export function readBestTime(storage: Pick<Storage, 'getItem'>): number | null {
  try {
    const value = Number(storage.getItem(BEST_TIME_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}
export function formatTime(seconds: number): string {
  const centiseconds = Math.floor(Math.max(0, seconds) * 100 + 0.00001)
  const minutes = Math.floor(centiseconds / 6000)
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`
}
export interface RacerObstacle {
  distance: number
  lane: number
  hit: boolean
  body: Body
}

export class RacerGame {
  phase: RacerPhase = 'ready'
  speed = 0
  time = 0
  distance = 0
  collisions = 0
  lateral = 0
  steer = 0
  braking = false
  impact = 0
  runId = 0
  readonly world = new World({ gravity: new Vec3(0, 0, 0) })
  readonly player = new Body({ mass: 1, shape: new Box(new Vec3(0.5, 0.3, 0.9)), linearDamping: 0, fixedRotation: true, collisionResponse: false })
  readonly obstacles: RacerObstacle[]
  private previousSnapshot = ''
  private readonly onChange: (snapshot: RacerSnapshot) => void
  private accumulator = 0

  constructor(onChange: (snapshot: RacerSnapshot) => void = () => {}) {
    this.onChange = onChange
    this.world.addBody(this.player)
    this.obstacles = Array.from({ length: 16 }, (_, index) => {
      const distance = 74 + index * 57 + (index % 3) * 9
      const lane = [-2.1, 0, 2.1][index % 3]
      const body = new Body({ mass: 0, shape: new Box(new Vec3(0.4, 0.5, 0.4)), position: new Vec3(lane, 0.5, distance) })
      this.world.addBody(body)
      return { distance, lane, hit: false, body }
    })
    this.restart()
  }

  get snapshot(): RacerSnapshot {
    return {
      phase: this.phase,
      speed: this.speed,
      time: this.time,
      distance: this.distance,
      progress: Math.min(100, this.distance / RACE_DISTANCE * 100),
      collisions: this.collisions,
      lateral: this.lateral,
      impact: this.impact,
    }
  }

  start() {
    if (this.phase !== 'ready') return
    this.phase = 'racing'
    this.emit()
  }
  pause() {
    if (this.phase !== 'racing') return
    this.phase = 'paused'
    this.clearControls()
    this.emit()
  }
  resume() {
    if (this.phase !== 'paused') return
    this.phase = 'racing'
    this.emit()
  }
  restart() {
    this.runId++
    this.phase = 'ready'
    this.speed = 0
    this.time = 0
    this.distance = 0
    this.collisions = 0
    this.lateral = 0
    this.impact = 0
    this.accumulator = 0
    this.clearControls()
    this.world.time = 0
    this.player.position.set(0, 0.45, 0)
    this.player.velocity.setZero()
    this.player.angularVelocity.setZero()
    for (const obstacle of this.obstacles) {
      obstacle.hit = false
      obstacle.body.collisionFilterMask = -1
      obstacle.body.aabbNeedsUpdate = true
    }
    this.emit()
  }
  clearControls() {
    this.steer = 0
    this.braking = false
  }
  setSteer(value: number) {
    this.steer = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0
  }
  setBrake(value: boolean) {
    this.braking = value
  }
  tick(dt: number) {
    if (this.phase !== 'racing' || !Number.isFinite(dt) || dt <= 0) return
    this.accumulator += Math.min(0.1, dt)
    while (this.accumulator + 1e-9 >= PHYSICS_STEP && this.phase === 'racing') {
      this.step()
      this.accumulator -= PHYSICS_STEP
    }
    this.emit()
  }

  private step() {
    this.time += PHYSICS_STEP
    this.impact = Math.max(0, this.impact - PHYSICS_STEP * 1.6)
    if (this.braking) this.speed = Math.max(0, this.speed - 36 * PHYSICS_STEP)
    else this.speed += (MAX_SPEED - this.speed) * (1 - Math.exp(-PHYSICS_STEP * 2.1))
    this.lateral += this.steer * (3 + this.speed * 0.09) * PHYSICS_STEP
    const edge = TRACK_WIDTH / 2 - 0.66
    if (Math.abs(this.lateral) > edge) {
      this.lateral = Math.max(-edge, Math.min(edge, this.lateral))
      this.speed *= Math.exp(-PHYSICS_STEP * 2.4)
    }
    this.distance += this.speed * PHYSICS_STEP

    // 驾驶是自动油门的街机模型；车辆与路障的形状接触由 Cannon 求解。
    this.player.position.set(this.lateral, 0.45, this.distance)
    this.player.velocity.setZero()
    this.player.aabbNeedsUpdate = true
    this.world.step(PHYSICS_STEP)
    for (const contact of this.world.contacts) {
      const other = contact.bi === this.player ? contact.bj : contact.bj === this.player ? contact.bi : null
      if (!other) continue
      const obstacle = this.obstacles.find((item) => item.body === other)
      if (!obstacle || obstacle.hit) continue
      obstacle.hit = true
      obstacle.body.collisionFilterMask = 0
      this.collisions++
      this.speed *= 0.45
      this.impact = 1
    }
    if (this.distance >= RACE_DISTANCE) {
      this.distance = RACE_DISTANCE
      this.speed = 0
      this.phase = 'finished'
      this.clearControls()
    }
  }
  private emit() {
    const snapshot = this.snapshot
    const key = JSON.stringify(snapshot)
    if (key === this.previousSnapshot) return
    this.previousSnapshot = key
    this.onChange(snapshot)
  }
}
