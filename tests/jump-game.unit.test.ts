import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BEST_SCORE_KEY,
  CHARGE_SECONDS,
  GRAVITY,
  JUMP_SPEED,
  MAX_SPEED,
  MIN_SPEED,
  PLAYER_RADIUS,
  PLATFORM_HEIGHT,
  JumpGame,
  readBestScore,
} from '../src/games/jump/game.ts'

const STEP = 1 / 120

function createGame(best = 0) {
  return new JumpGame({ best, random: () => 0.7 })
}

function advance(game: JumpGame, seconds: number) {
  for (let step = 0; step < Math.ceil(seconds / STEP); step++) game.tick(STEP)
}

function closeTo(actual: number, expected: number, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

function holdForTarget(game: JumpGame, offset = 0) {
  const distance = Math.hypot(game.target.x - game.player.position.x, game.target.z - game.player.position.z) + offset
  // 同高抛物线只用于估算蓄力，落地仍由真实接触判定。
  const speed = distance / (2 * JUMP_SPEED / GRAVITY)
  assert.ok(speed >= MIN_SPEED && speed <= MAX_SPEED)
  return CHARGE_SECONDS * (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)
}

function finishJump(game: JumpGame) {
  const phases = new Set([game.phase])
  for (let step = 0; step < Math.ceil(3 / STEP); step++) {
    if (game.phase !== 'flying' && game.phase !== 'falling') return phases
    game.tick(STEP)
    phases.add(game.phase)
  }
  assert.fail(`跳跃未结束：${game.phase}`)
}

function jump(game: JumpGame, holdSeconds: number) {
  assert.equal(game.beginCharge(), true)
  advance(game, holdSeconds)
  assert.equal(game.release(), true)
  assert.equal(game.phase, 'flying')
  assert.equal(game.chargeTime, 0)
  closeTo(game.player.velocity.y, JUMP_SPEED)
  return finishJump(game)
}

test('初始状态包含玩家、当前平台和目标平台', () => {
  const game = createGame()
  assert.deepEqual(game.snapshot, {
    phase: 'ready', score: 0, best: 0, streak: 0, charge: 0, feedback: '', runId: 1,
  })
  assert.equal(game.paused, false)
  assert.equal(game.landingPulse, 0)
  assert.equal(game.platforms.length, 2)
  assert.equal(game.world.bodies.length, 3)
  assert.deepEqual(game.world.gravity.toArray(), [0, -GRAVITY, 0])
  assert.equal(game.current, game.platforms[0])
  assert.equal(game.target, game.platforms[1])
  assert.deepEqual([game.current.x, game.current.z, game.current.size], [0, 0, 1.8])
  assert.deepEqual([game.target.x, game.target.z, game.target.size], [3.2, 0, 1.8])
  assert.deepEqual(game.player.position.toArray(), [0, PLATFORM_HEIGHT + PLAYER_RADIUS + 0.005, 0])
  assert.deepEqual(game.player.velocity.toArray(), [0, 0, 0])
  assert.ok(game.world.bodies.includes(game.player))
  for (const platform of game.platforms) assert.ok(game.world.bodies.includes(platform.body))
  assert.equal(game.release(), false)
  assert.equal(createGame(12).best, 12)
})

test('蓄力封顶，释放速度不超过最大速度', () => {
  const game = createGame()
  const position = game.player.position.toArray()
  assert.equal(game.beginCharge(), true)
  assert.equal(game.beginCharge(), false)
  advance(game, CHARGE_SECONDS * 2)
  assert.equal(game.phase, 'charging')
  assert.equal(game.chargeTime, CHARGE_SECONDS)
  assert.equal(game.snapshot.charge, 100)
  assert.deepEqual(game.player.position.toArray(), position)
  assert.equal(game.release(), true)
  assert.equal(game.phase, 'flying')
  assert.equal(game.chargeTime, 0)
  assert.equal(game.snapshot.charge, 0)
  closeTo(Math.hypot(game.player.velocity.x, game.player.velocity.z), MAX_SPEED)
  closeTo(game.player.velocity.y, JUMP_SPEED)
  assert.equal(game.release(), false)
})

test('取消蓄力恢复就绪，不跳跃也不计分', () => {
  const game = createGame()
  const position = game.player.position.toArray()
  assert.equal(game.beginCharge(), true)
  advance(game, CHARGE_SECONDS / 3)
  assert.ok(game.chargeTime > 0)
  game.cancelCharge()
  assert.equal(game.phase, 'ready')
  assert.equal(game.chargeTime, 0)
  assert.equal(game.snapshot.charge, 0)
  assert.equal(game.score, 0)
  assert.deepEqual(game.player.position.toArray(), position)
  assert.deepEqual(game.player.velocity.toArray(), [0, 0, 0])
  assert.equal(game.release(), false)
  game.cancelCharge()
  assert.equal(game.beginCharge(), true)
  game.tick(STEP)
  closeTo(game.chargeTime, STEP)
})

test('精准中心落地连续加分为 2、4、6、8', () => {
  const game = createGame()
  let expectedScore = 0
  for (let streak = 1; streak <= 4; streak++) {
    const target = game.target
    const phases = jump(game, holdForTarget(game))
    expectedScore += streak * 2
    assert.equal(phases.has('ready'), true)
    assert.equal(game.phase, 'ready')
    assert.equal(game.current, target)
    assert.ok(Math.hypot(game.player.position.x - target.x, game.player.position.z - target.z) <= target.size * 0.14)
    assert.equal(game.streak, streak)
    assert.equal(game.score, expectedScore)
    assert.equal(game.best, expectedScore)
    assert.equal(game.feedback, `正中中心 +${streak * 2}`)
    assert.equal(game.landingPulse, 1)
    assert.deepEqual(game.player.velocity.toArray(), [0, 0, 0])
  }
  assert.equal(game.score, 20)
})

test('普通边缘落地只加 1 分，并清空精准连击', () => {
  const game = createGame()
  jump(game, holdForTarget(game))
  assert.equal(game.streak, 1)
  const target = game.target
  const previousScore = game.score
  jump(game, holdForTarget(game, target.size * 0.32))
  const distance = Math.hypot(game.player.position.x - target.x, game.player.position.z - target.z)
  assert.equal(game.phase, 'ready')
  assert.equal(game.current, target)
  assert.ok(distance > target.size * 0.14)
  assert.ok(Math.abs(game.player.position.x - target.x) <= target.size / 2 - 0.04)
  assert.ok(Math.abs(game.player.position.z - target.z) <= target.size / 2 - 0.04)
  assert.equal(game.score, previousScore + 1)
  assert.equal(game.best, game.score)
  assert.equal(game.streak, 0)
  assert.equal(game.feedback, '落地 +1')
})

test('过短跳跃落回当前平台，不计分且不生成新平台', () => {
  const game = createGame()
  const current = game.current
  const target = game.target
  const platforms = [...game.platforms]
  jump(game, 0)
  assert.equal(game.phase, 'ready')
  assert.equal(game.current, current)
  assert.equal(game.target, target)
  assert.deepEqual(game.platforms, platforms)
  assert.equal(game.world.bodies.length, 3)
  assert.ok(game.player.position.x > current.x)
  assert.ok(game.player.position.x < current.x + current.size / 2 - 0.04)
  assert.equal(game.score, 0)
  assert.equal(game.best, 0)
  assert.equal(game.streak, 0)
  assert.equal(game.feedback, '')
  assert.deepEqual(game.player.velocity.toArray(), [0, 0, 0])
})

test('过长跳跃跳空，经历下落后游戏结束', () => {
  const game = createGame()
  const target = game.target
  const phases = jump(game, CHARGE_SECONDS)
  assert.equal(phases.has('falling'), true)
  assert.equal(game.phase, 'gameover')
  assert.equal(game.snapshot.phase, 'gameover')
  assert.ok(game.player.position.x > target.x + target.size / 2 + PLAYER_RADIUS)
  assert.ok(game.player.position.y < -2.5)
  assert.equal(game.score, 0)
  assert.equal(game.best, 0)
  assert.equal(game.streak, 0)
  assert.equal(game.beginCharge(), false)
  assert.equal(game.release(), false)
  const position = game.player.position.toArray()
  const time = game.world.time
  advance(game, 1)
  assert.deepEqual(game.player.position.toArray(), position)
  assert.equal(game.world.time, time)
})

test('飞行中暂停冻结物理与蓄力，恢复后继续真实落地', () => {
  const game = createGame()
  assert.equal(game.beginCharge(), true)
  advance(game, holdForTarget(game))
  assert.equal(game.release(), true)
  advance(game, 0.15)
  assert.equal(game.phase, 'flying')
  game.pause()
  assert.equal(game.snapshot.phase, 'paused')
  const state = game.snapshot
  const position = game.player.position.toArray()
  const velocity = game.player.velocity.toArray()
  const time = game.world.time
  advance(game, CHARGE_SECONDS * 2)
  assert.deepEqual(game.snapshot, state)
  assert.deepEqual(game.player.position.toArray(), position)
  assert.deepEqual(game.player.velocity.toArray(), velocity)
  assert.equal(game.world.time, time)
  assert.equal(game.chargeTime, 0)
  assert.equal(game.beginCharge(), false)
  assert.equal(game.release(), false)
  game.resume()
  assert.equal(game.snapshot.phase, 'flying')
  game.tick(STEP)
  assert.ok(game.world.time > time)
  assert.notDeepEqual(game.player.position.toArray(), position)
  finishJump(game)
  assert.equal(game.phase, 'ready')
  assert.equal(game.score, 2)
})

test('蓄力时暂停取消蓄力，暂停期间不能重新蓄力或释放', () => {
  const game = createGame()
  assert.equal(game.beginCharge(), true)
  advance(game, CHARGE_SECONDS / 3)
  assert.ok(game.snapshot.charge > 0)
  game.pause()
  assert.equal(game.paused, true)
  assert.equal(game.phase, 'ready')
  assert.equal(game.snapshot.phase, 'paused')
  assert.equal(game.chargeTime, 0)
  assert.equal(game.snapshot.charge, 0)
  const position = game.player.position.toArray()
  const time = game.world.time
  advance(game, CHARGE_SECONDS * 2)
  assert.equal(game.chargeTime, 0)
  assert.deepEqual(game.player.position.toArray(), position)
  assert.equal(game.world.time, time)
  assert.equal(game.beginCharge(), false)
  assert.equal(game.release(), false)
  game.resume()
  assert.equal(game.snapshot.phase, 'ready')
  assert.equal(game.release(), false)
  assert.equal(game.beginCharge(), true)
  game.tick(STEP)
  closeTo(game.chargeTime, STEP)
})

test('重开清空本局状态和物理世界，保留真实获得的最高分', () => {
  const game = createGame()
  jump(game, holdForTarget(game))
  jump(game, holdForTarget(game))
  assert.equal(game.score, 6)
  assert.equal(game.best, 6)
  jump(game, CHARGE_SECONDS)
  assert.equal(game.phase, 'gameover')
  assert.equal(game.streak, 0)
  const world = game.world
  const player = game.player
  const runId = game.runId
  game.restart()
  assert.deepEqual(game.snapshot, {
    phase: 'ready', score: 0, best: 6, streak: 0, charge: 0, feedback: '', runId: runId + 1,
  })
  assert.equal(game.paused, false)
  assert.equal(game.landingPulse, 0)
  assert.notEqual(game.world, world)
  assert.notEqual(game.player, player)
  assert.equal(game.platforms.length, 2)
  assert.equal(game.world.bodies.length, 3)
  assert.equal(game.world.bodies.includes(player), false)
  assert.deepEqual(game.player.position.toArray(), [0, PLATFORM_HEIGHT + PLAYER_RADIUS + 0.005, 0])
  assert.deepEqual([game.current.x, game.current.z, game.target.x, game.target.z], [0, 0, 3.2, 0])
})

test('连续真实游玩回收旧平台刚体，世界仅保留七个平台和玩家', () => {
  const game = createGame()
  const retired = new Set<JumpGame['player']>()
  const jumps = 30
  for (let index = 0; index < jumps; index++) {
    const previousPlatforms = [...game.platforms]
    const target = game.target
    jump(game, holdForTarget(game))
    assert.equal(game.phase, 'ready')
    assert.equal(game.current, target)
    assert.equal(game.streak, index + 1)
    assert.equal(game.platforms.length, Math.min(index + 3, 7))
    assert.equal(game.world.bodies.length, game.platforms.length + 1)
    assert.equal(new Set(game.world.bodies).size, game.world.bodies.length)
    assert.ok(game.platforms.includes(game.current))
    assert.ok(game.platforms.includes(game.target))
    assert.ok(game.world.bodies.includes(game.player))
    for (const platform of previousPlatforms) {
      if (!game.platforms.includes(platform)) retired.add(platform.body)
    }
    for (const platform of game.platforms) assert.ok(game.world.bodies.includes(platform.body))
    for (const body of retired) assert.equal(game.world.bodies.includes(body), false)
  }
  assert.equal(retired.size, jumps + 2 - 7)
  assert.equal(game.platforms.length, 7)
  assert.equal(game.world.bodies.length, 8)
  assert.equal(game.target.id, jumps + 1)
  assert.equal(game.score, jumps * (jumps + 1))
  assert.equal(game.best, game.score)
})

test('readBestScore 读取有效非负安全整数，并使用正确存储键', () => {
  for (const [stored, expected] of [[null, 0], ['0', 0], ['23', 23], [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER]] as const) {
    assert.equal(readBestScore({
      getItem(key) {
        assert.equal(key, BEST_SCORE_KEY)
        return stored
      },
    }), expected)
  }
})

test('readBestScore 对非法数据返回 0', () => {
  const invalid = ['', ' ', 'hello', 'NaN', 'Infinity', '-Infinity', '-1', '1.5', '1e99', String(Number.MAX_SAFE_INTEGER + 1)]
  for (const stored of invalid) {
    assert.equal(readBestScore({ getItem: () => stored }), 0, `非法存储值：${JSON.stringify(stored)}`)
  }
})

test('readBestScore 在存储访问抛出异常时返回 0', () => {
  assert.equal(readBestScore({
    getItem() {
      throw new Error('storage unavailable')
    },
  }), 0)
})
