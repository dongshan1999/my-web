import { Body, Box, Sphere, Vec3, World } from 'cannon-es'

export const CHARGE_SECONDS = 1.2
export const GRAVITY = 22
export const JUMP_SPEED = 8.5
export const MIN_SPEED = 0.7
export const MAX_SPEED = 9.8
export const PLAYER_RADIUS = 0.22
export const PLATFORM_HEIGHT = 0.65
export const BEST_SCORE_KEY = 'my-web.jump.best.v1'

export type GamePhase = 'ready' | 'charging' | 'flying' | 'falling' | 'gameover' | 'paused'
export interface Platform {
  id: number
  x: number
  z: number
  size: number
  color: number
  body: Body
}
export interface GameSnapshot {
  phase: GamePhase
  score: number
  best: number
  streak: number
  charge: number
  feedback: string
  runId: number
}

export function readBestScore(storage: Pick<Storage, 'getItem'>): number {
  try {
    const value = Number(storage.getItem(BEST_SCORE_KEY))
    return Number.isSafeInteger(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

export class JumpGame {
  world!: World
  player!: Body
  platforms: Platform[] = []
  current!: Platform
  target!: Platform
  runId = 0
  score = 0
  best: number
  streak = 0
  chargeTime = 0
  paused = false
  phase: Exclude<GamePhase, 'paused'> = 'ready'
  feedback = ''
  landingPulse = 0
  private flightTime = 0
  private feedbackTime = 0
  private random: () => number
  private onChange: (state: GameSnapshot) => void
  private previousSnapshot = ''

  constructor(options: { best?: number; random?: () => number; onChange?: (state: GameSnapshot) => void } = {}) {
    this.best = options.best ?? 0
    this.random = options.random ?? Math.random
    this.onChange = options.onChange ?? (() => {})
    this.restart()
  }

  get snapshot(): GameSnapshot {
    return {
      phase: this.paused ? 'paused' : this.phase,
      score: this.score,
      best: this.best,
      streak: this.streak,
      charge: Math.round(this.chargeTime / CHARGE_SECONDS * 100),
      feedback: this.feedback,
      runId: this.runId,
    }
  }

  restart() {
    this.runId++
    this.world = new World({ gravity: new Vec3(0, -GRAVITY, 0) })
    this.world.defaultContactMaterial.friction = 0.8
    this.world.defaultContactMaterial.restitution = 0
    this.platforms = []
    this.score = 0
    this.streak = 0
    this.chargeTime = 0
    this.paused = false
    this.phase = 'ready'
    this.feedback = ''
    this.feedbackTime = 0
    this.flightTime = 0
    this.landingPulse = 0
    this.current = this.addPlatform(0, 0, 1.8, 0)
    this.target = this.addPlatform(3.2, 0, 1.8, 1)
    this.player = new Body({
      mass: 1,
      type: Body.KINEMATIC,
      shape: new Sphere(PLAYER_RADIUS),
      position: new Vec3(0, PLATFORM_HEIGHT + PLAYER_RADIUS + 0.005, 0),
      linearDamping: 0,
      angularDamping: 1,
      fixedRotation: true,
      allowSleep: false,
    })
    this.world.addBody(this.player)
    this.emit()
  }

  beginCharge(): boolean {
    if (this.paused || this.phase !== 'ready') return false
    this.phase = 'charging'
    this.chargeTime = 0
    this.emit()
    return true
  }

  cancelCharge() {
    if (this.phase !== 'charging') return
    this.chargeTime = 0
    this.phase = 'ready'
    this.emit()
  }

  release(): boolean {
    if (this.paused || this.phase !== 'charging') return false
    const direction = new Vec3(this.target.x - this.player.position.x, 0, this.target.z - this.player.position.z)
    direction.normalize()
    const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * this.chargeTime / CHARGE_SECONDS
    this.player.type = Body.DYNAMIC
    this.player.collisionResponse = true
    this.player.updateMassProperties()
    this.player.velocity.set(direction.x * speed, JUMP_SPEED, direction.z * speed)
    this.player.wakeUp()
    this.phase = 'flying'
    this.flightTime = 0
    this.chargeTime = 0
    this.emit()
    return true
  }

  pause() {
    if (this.phase === 'gameover' || this.paused) return
    this.cancelCharge()
    this.paused = true
    this.emit()
  }

  resume() {
    if (!this.paused) return
    this.paused = false
    this.emit()
  }

  tick(seconds: number) {
    if (this.paused || this.phase === 'gameover') return
    const dt = Math.min(0.05, Math.max(0, seconds))
    this.landingPulse = Math.max(0, this.landingPulse - dt * 1.8)
    this.feedbackTime = Math.max(0, this.feedbackTime - dt)
    if (!this.feedbackTime) this.feedback = ''
    if (this.phase === 'charging') this.chargeTime = Math.min(CHARGE_SECONDS, this.chargeTime + dt)
    if (this.phase === 'flying' || this.phase === 'falling') {
      this.flightTime += dt
      // 固定步长由 cannon-es 执行重力积分与碰撞求解，帧率不改变跳跃距离。
      this.world.step(1 / 120, dt, 8)
      if (this.phase === 'flying' && this.flightTime > 0.12) this.checkLanding()
      if (this.phase === 'flying' && this.player.position.y < PLATFORM_HEIGHT - 0.12) {
        this.phase = 'falling'
        this.player.collisionResponse = false
      }
      if (this.player.position.y < -2.5 || this.flightTime > 2.5) {
        this.phase = 'gameover'
        this.streak = 0
        this.feedback = ''
      }
    }
    this.emit()
  }

  private checkLanding() {
    if (this.player.velocity.y > 0.5) return
    for (const contact of this.world.contacts) {
      const playerIsA = contact.bi === this.player
      if (!playerIsA && contact.bj !== this.player) continue
      const upwardNormal = playerIsA ? -contact.ni.y : contact.ni.y
      if (upwardNormal < 0.65) continue
      const body = playerIsA ? contact.bj : contact.bi
      const platform = this.platforms.find((item) => item.body === body)
      if (!platform) continue
      const dx = Math.abs(this.player.position.x - platform.x)
      const dz = Math.abs(this.player.position.z - platform.z)
      if (dx > platform.size / 2 - 0.04 || dz > platform.size / 2 - 0.04) {
        this.phase = 'falling'
        this.player.collisionResponse = false
        return
      }
      if (platform !== this.current && platform !== this.target) {
        this.phase = 'falling'
        this.player.collisionResponse = false
        return
      }
      this.player.type = Body.KINEMATIC
      this.player.velocity.setZero()
      this.player.angularVelocity.setZero()
      this.player.position.y = PLATFORM_HEIGHT + PLAYER_RADIUS + 0.005
      this.player.updateMassProperties()
      this.phase = 'ready'
      this.flightTime = 0
      if (platform === this.current) return

      const perfect = Math.hypot(dx, dz) <= platform.size * 0.14
      this.streak = perfect ? this.streak + 1 : 0
      const points = perfect ? this.streak * 2 : 1
      this.score += points
      this.best = Math.max(this.best, this.score)
      this.feedback = perfect ? `正中中心 +${points}` : `落地 +${points}`
      this.feedbackTime = 1.3
      this.landingPulse = 1
      this.current = platform
      this.createNextPlatform()
      return
    }
  }

  private addPlatform(x: number, z: number, size: number, color: number): Platform {
    const body = new Body({
      mass: 0,
      shape: new Box(new Vec3(size / 2, PLATFORM_HEIGHT / 2, size / 2)),
      position: new Vec3(x, PLATFORM_HEIGHT / 2, z),
    })
    this.world.addBody(body)
    const platform = { id: this.platforms.length ? this.platforms[this.platforms.length - 1].id + 1 : 0, x, z, size, color, body }
    this.platforms.push(platform)
    return platform
  }

  private createNextPlatform() {
    const difficulty = Math.min(1, this.score / 35)
    const gap = 2.65 + this.random() * 1.05 + difficulty * 0.8
    const size = 1.8 - difficulty * 0.45 + this.random() * 0.1
    const alongX = this.random() >= 0.5
    this.target = this.addPlatform(
      this.current.x + (alongX ? gap : 0),
      this.current.z + (alongX ? 0 : gap),
      size,
      (this.current.color + 1) % 4,
    )
    // 长时间游玩仍只保留附近的平台与物理刚体。
    while (this.platforms.length > 7) {
      const old = this.platforms.shift()!
      this.world.removeBody(old.body)
    }
  }

  private emit() {
    const state = this.snapshot
    const key = JSON.stringify(state)
    if (key === this.previousSnapshot) return
    this.previousSnapshot = key
    this.onChange(state)
  }
}
