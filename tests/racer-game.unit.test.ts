import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BEST_TIME_KEY,
  MAX_SPEED,
  PHYSICS_STEP,
  RACE_DISTANCE,
  TRACK_WIDTH,
  RacerGame,
  formatTime,
  readBestTime,
  type RacerSnapshot,
} from '../src/games/racer/game.ts'

function closeTo(actual: number, expected: number, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
}

function advance(game: RacerGame, seconds: number, hz = 120) {
  const ticks = Math.round(seconds * hz)
  closeTo(ticks / hz, seconds)
  for (let tick = 0; tick < ticks; tick++) game.tick(1 / hz)
}

function firstCollision(game: RacerGame) {
  const before = game.collisions
  for (let tick = 0; tick < 20 / PHYSICS_STEP; tick++) {
    const previousSpeed = game.speed
    game.tick(PHYSICS_STEP)
    if (game.collisions > before) return previousSpeed
  }
  assert.fail('真实驾驶 20 秒内未发生碰撞')
}

function finishRace(game: RacerGame, hz = 120) {
  for (let tick = 0; tick < 60 * hz && game.phase === 'racing'; tick++) game.tick(1 / hz)
  assert.equal(game.phase, 'finished', '真实驾驶应在 60 秒内完成 1000m 比赛')
  return game.snapshot
}

function hasContact(game: RacerGame, obstacle: RacerGame['obstacles'][number]) {
  return game.world.contacts.some((contact) =>
    (contact.bi === game.player && contact.bj === obstacle.body)
    || (contact.bj === game.player && contact.bi === obstacle.body))
}

function readySnapshot(): RacerSnapshot {
  return { phase: 'ready', speed: 0, time: 0, distance: 0, progress: 0, collisions: 0, lateral: 0, impact: 0 }
}

test('初始状态静止，世界包含玩家和 16 个未命中的静态障碍', () => {
  const changes: RacerSnapshot[] = []
  const game = new RacerGame((snapshot) => changes.push(snapshot))
  assert.deepEqual(game.snapshot, readySnapshot())
  assert.equal(game.runId, 1)
  assert.equal(game.steer, 0)
  assert.equal(game.braking, false)
  assert.equal(game.world.time, 0)
  assert.deepEqual(game.world.gravity.toArray(), [0, 0, 0])
  assert.deepEqual(game.player.position.toArray(), [0, 0.45, 0])
  assert.deepEqual(game.player.velocity.toArray(), [0, 0, 0])
  assert.deepEqual(game.player.angularVelocity.toArray(), [0, 0, 0])
  assert.equal(game.obstacles.length, 16)
  assert.equal(game.world.bodies.length, 17)
  assert.equal(new Set(game.world.bodies).size, 17)
  assert.ok(game.world.bodies.includes(game.player))
  for (const [index, obstacle] of game.obstacles.entries()) {
    assert.equal(obstacle.distance, 74 + index * 57 + (index % 3) * 9)
    assert.equal(obstacle.lane, [-2.1, 0, 2.1][index % 3])
    assert.equal(obstacle.hit, false)
    assert.equal(obstacle.body.mass, 0)
    assert.equal(obstacle.body.collisionFilterMask, -1)
    assert.deepEqual(obstacle.body.position.toArray(), [obstacle.lane, 0.5, obstacle.distance])
    assert.ok(game.world.bodies.includes(obstacle.body))
  }
  assert.deepEqual(changes, [readySnapshot()])
  advance(game, 2)
  game.pause()
  game.resume()
  assert.deepEqual(game.snapshot, readySnapshot())
  assert.deepEqual(game.player.position.toArray(), [0, 0.45, 0])
  assert.equal(game.world.time, 0)
  assert.equal(changes.length, 1)
})

test('start 仅接受 ready，resume 仅接受 paused，重复调用不重置比赛', () => {
  const changes: RacerSnapshot[] = []
  const game = new RacerGame((snapshot) => changes.push(snapshot))
  game.resume()
  assert.equal(game.phase, 'ready')
  game.start()
  assert.equal(game.phase, 'racing')
  assert.equal(game.time, 0)
  assert.equal(game.world.time, 0)
  assert.equal(changes.length, 2)
  advance(game, 1)
  const racing = game.snapshot
  const changeCount = changes.length
  game.start()
  game.resume()
  assert.deepEqual(game.snapshot, racing)
  assert.equal(changes.length, changeCount)
  game.pause()
  const paused = game.snapshot
  game.pause()
  game.start()
  assert.deepEqual(game.snapshot, paused)
  assert.equal(changes.length, changeCount + 1)
  game.resume()
  assert.deepEqual(game.snapshot, { ...racing, phase: 'racing' })
  game.resume()
  assert.equal(changes.length, changeCount + 2)
  game.tick(PHYSICS_STEP)
  closeTo(game.time, racing.time + PHYSICS_STEP)
  assert.ok(game.distance > racing.distance)
})

test('tick 推进速度、时间、距离和进度，速度渐近 MAX_SPEED', () => {
  const game = new RacerGame()
  game.start()
  let previous = game.snapshot
  for (let tick = 1; tick <= 240; tick++) {
    game.tick(PHYSICS_STEP)
    assert.ok(game.speed > previous.speed)
    assert.ok(game.speed < MAX_SPEED)
    assert.ok(game.distance > previous.distance)
    closeTo(game.distance - previous.distance, game.speed * PHYSICS_STEP)
    closeTo(game.time, tick * PHYSICS_STEP)
    closeTo(game.world.time, game.time)
    closeTo(game.snapshot.progress, game.distance / RACE_DISTANCE * 100)
    closeTo(game.player.position.z, game.distance)
    assert.equal(game.collisions, 0)
    previous = game.snapshot
  }
  closeTo(game.speed, MAX_SPEED * (1 - Math.exp(-2.1 * 2)))
  assert.ok(game.snapshot.progress > 0)
  assert.ok(game.snapshot.progress < 100)
})

test('左右转向都限制在赛道边界，持续贴边减速且能驶离边界', () => {
  const edge = TRACK_WIDTH / 2 - 0.66
  const straight = new RacerGame()
  straight.start()
  advance(straight, 2)
  for (const direction of [-1, 1]) {
    const game = new RacerGame()
    game.start()
    game.setSteer(direction)
    for (let tick = 0; tick < 240; tick++) {
      game.tick(PHYSICS_STEP)
      assert.ok(game.lateral >= -edge && game.lateral <= edge)
      closeTo(game.player.position.x, game.lateral)
    }
    closeTo(game.lateral, direction * edge)
    assert.ok(game.speed < straight.speed)
    assert.equal(game.collisions, 0)
    game.tick(PHYSICS_STEP)
    closeTo(game.lateral, direction * edge)
    game.setSteer(-direction)
    advance(game, 0.5)
    assert.ok(game.lateral * direction < edge)
    assert.ok(Math.abs(game.lateral) <= edge)
  }
})

test('控制 API 钳制转向并安全清空非法输入，clearControls 不改变比赛状态', () => {
  const game = new RacerGame()
  for (const [input, expected] of [[2, 1], [-2, -1], [0.5, 0.5], [NaN, 0], [Infinity, 0], [-Infinity, 0]]) {
    game.setSteer(input)
    assert.equal(game.steer, expected)
  }
  game.start()
  advance(game, 1)
  const snapshot = game.snapshot
  game.setSteer(1)
  game.setBrake(true)
  game.clearControls()
  assert.equal(game.steer, 0)
  assert.equal(game.braking, false)
  assert.deepEqual(game.snapshot, snapshot)
})

test('刹车以实际 tick 减速至零，停住后时间继续推进，松开后重新加速', () => {
  const game = new RacerGame()
  game.start()
  advance(game, 1)
  const previousSpeed = game.speed
  game.setBrake(true)
  game.tick(PHYSICS_STEP)
  closeTo(game.speed, Math.max(0, previousSpeed - 36 * PHYSICS_STEP))
  assert.ok(game.speed < previousSpeed)
  advance(game, 1)
  assert.equal(game.speed, 0)
  const stoppedDistance = game.distance
  const stoppedTime = game.time
  advance(game, 0.5)
  assert.equal(game.speed, 0)
  assert.equal(game.distance, stoppedDistance)
  closeTo(game.time, stoppedTime + 0.5)
  closeTo(game.world.time, game.time)
  game.setBrake(false)
  game.tick(PHYSICS_STEP)
  assert.ok(game.speed > 0)
  assert.ok(game.distance > stoppedDistance)
})

test('自然驾驶触发 cannon-es 真实接触并减速，同一个障碍仅计一次碰撞', () => {
  const game = new RacerGame()
  game.start()
  const previousSpeed = firstCollision(game)
  const obstacle = game.obstacles[1]
  assert.equal(obstacle.lane, 0)
  assert.equal(game.collisions, 1)
  assert.equal(game.obstacles[0].hit, false)
  assert.equal(obstacle.hit, true)
  assert.equal(obstacle.body.collisionFilterMask, 0)
  assert.ok(hasContact(game, obstacle), '碰撞计数必须对应玩家与障碍的真实接触方程')
  assert.ok(Math.abs(game.distance - obstacle.distance) <= 0.9 + 0.4)
  const acceleratedSpeed = previousSpeed + (MAX_SPEED - previousSpeed) * (1 - Math.exp(-PHYSICS_STEP * 2.1))
  closeTo(game.speed, acceleratedSpeed * 0.45)
  assert.ok(game.speed < previousSpeed)
  assert.equal(game.impact, 1)
  game.tick(PHYSICS_STEP)
  assert.equal(game.collisions, 1)
  assert.equal(hasContact(game, obstacle), false)
  closeTo(game.impact, 1 - PHYSICS_STEP * 1.6)
  advance(game, 1)
  assert.ok(game.distance > obstacle.distance + 0.9 + 0.4)
  assert.equal(game.collisions, 1)
  assert.equal(game.obstacles.filter((item) => item.hit).length, 1)
  assert.equal(game.impact, 0)
})

test('完整真实驾驶 1000m 稳定冲线，结束后 start/resume/pause/tick 均不能推进', () => {
  const times: number[] = []
  for (let run = 0; run < 2; run++) {
    const game = new RacerGame()
    game.start()
    for (let tick = 0; tick < 60 / PHYSICS_STEP; tick++) {
      const before = game.snapshot
      game.tick(PHYSICS_STEP)
      if (game.phase === 'finished') {
        assert.ok(before.distance < RACE_DISTANCE)
        assert.ok(before.speed > 0)
        closeTo(game.time, before.time + PHYSICS_STEP)
        break
      }
    }
    assert.equal(game.phase, 'finished')
    assert.equal(game.distance, RACE_DISTANCE)
    assert.equal(game.snapshot.progress, 100)
    assert.equal(game.speed, 0)
    assert.equal(game.collisions, 5)
    assert.equal(game.obstacles.filter((item) => item.hit).length, 5)
    assert.ok(game.time > RACE_DISTANCE / MAX_SPEED && game.time < 45)
    closeTo(game.time, Math.round(game.time / PHYSICS_STEP) * PHYSICS_STEP)
    closeTo(game.world.time, game.time)
    assert.equal(game.steer, 0)
    assert.equal(game.braking, false)
    const snapshot = game.snapshot
    const position = game.player.position.toArray()
    const worldTime = game.world.time
    game.start()
    game.resume()
    game.pause()
    advance(game, 1)
    assert.deepEqual(game.snapshot, snapshot)
    assert.deepEqual(game.player.position.toArray(), position)
    assert.equal(game.world.time, worldTime)
    times.push(game.time)
  }
  assert.equal(times[0], times[1])
})

test('30Hz 和 120Hz 在转向、刹车、真实碰撞与完整冲线后得到一致结果', () => {
  const games = [new RacerGame(), new RacerGame()]
  const frequencies = [30, 120]
  const segments = [[2, 0, false], [0.5, -1, false], [1, 0, false], [0.5, 1, true], [2, 0, false]] as const
  for (const game of games) game.start()
  for (const [seconds, steer, braking] of segments) {
    for (const [index, game] of games.entries()) {
      game.setSteer(steer)
      game.setBrake(braking)
      advance(game, seconds, frequencies[index])
    }
    assert.deepEqual(games[0].snapshot, games[1].snapshot)
    assert.equal(games[0].world.time, games[1].world.time)
    assert.deepEqual(games[0].player.position.toArray(), games[1].player.position.toArray())
    assert.deepEqual(games[0].obstacles.map((item) => item.hit), games[1].obstacles.map((item) => item.hit))
  }
  assert.ok(games[0].collisions > 0)
  const results = games.map((game, index) => finishRace(game, frequencies[index]))
  assert.deepEqual(results[0], results[1])
  assert.equal(results[0].distance, RACE_DISTANCE)
  assert.equal(results[0].progress, 100)
  assert.equal(games[0].world.time, games[1].world.time)
  assert.deepEqual(games[0].player.position.toArray(), games[1].player.position.toArray())
})

test('暂停冻结物理、时间和快照，并清空控制，恢复后保持原进度继续驾驶', () => {
  const game = new RacerGame()
  game.start()
  advance(game, 1)
  game.setSteer(0.5)
  game.setBrake(true)
  advance(game, 0.1)
  game.pause()
  assert.equal(game.phase, 'paused')
  assert.equal(game.steer, 0)
  assert.equal(game.braking, false)
  const snapshot = game.snapshot
  const position = game.player.position.toArray()
  const velocity = game.player.velocity.toArray()
  const worldTime = game.world.time
  advance(game, 2)
  assert.deepEqual(game.snapshot, snapshot)
  assert.deepEqual(game.player.position.toArray(), position)
  assert.deepEqual(game.player.velocity.toArray(), velocity)
  assert.equal(game.world.time, worldTime)
  game.resume()
  assert.deepEqual(game.snapshot, { ...snapshot, phase: 'racing' })
  assert.equal(game.steer, 0)
  assert.equal(game.braking, false)
  game.tick(PHYSICS_STEP)
  closeTo(game.time, snapshot.time + PHYSICS_STEP)
  closeTo(game.world.time, worldTime + PHYSICS_STEP)
  assert.ok(game.speed > snapshot.speed)
  assert.ok(game.distance > snapshot.distance)
  assert.equal(game.lateral, snapshot.lateral)
})

test('restart 清空状态、控制和累计半步，恢复障碍接触且世界始终保留 17 个刚体', () => {
  const game = new RacerGame()
  const world = game.world
  const bodies = [...game.world.bodies]
  const positions = game.obstacles.map((item) => item.body.position.toArray())
  const runId = game.runId
  game.start()
  firstCollision(game)
  game.setSteer(0.5)
  game.setBrake(true)
  game.tick(PHYSICS_STEP)
  game.tick(PHYSICS_STEP / 2)
  assert.ok(game.time > 0 && game.distance > 0 && game.speed > 0)
  assert.ok(game.lateral > 0 && game.impact > 0)
  assert.equal(game.collisions, 1)
  game.restart()
  assert.deepEqual(game.snapshot, readySnapshot())
  assert.equal(game.runId, runId + 1)
  assert.equal(game.steer, 0)
  assert.equal(game.braking, false)
  assert.equal(game.world, world)
  assert.equal(game.world.time, 0)
  assert.deepEqual(game.player.position.toArray(), [0, 0.45, 0])
  assert.deepEqual(game.player.velocity.toArray(), [0, 0, 0])
  assert.deepEqual(game.player.angularVelocity.toArray(), [0, 0, 0])
  assert.deepEqual(game.world.bodies, bodies)
  assert.equal(game.world.bodies.length, 17)
  assert.equal(new Set(game.world.bodies).size, 17)
  for (const [index, obstacle] of game.obstacles.entries()) {
    assert.equal(obstacle.hit, false)
    assert.equal(obstacle.body.collisionFilterMask, -1)
    assert.deepEqual(obstacle.body.position.toArray(), positions[index])
  }
  game.start()
  game.tick(PHYSICS_STEP / 2)
  assert.equal(game.time, 0)
  assert.equal(game.distance, 0)
  game.tick(PHYSICS_STEP / 2)
  closeTo(game.time, PHYSICS_STEP)
  firstCollision(game)
  assert.equal(game.collisions, 1)
  assert.equal(game.obstacles[1].hit, true)
  assert.ok(hasContact(game, game.obstacles[1]))
  for (let restart = 0; restart < 3; restart++) {
    game.restart()
    assert.deepEqual(game.snapshot, readySnapshot())
    assert.equal(game.runId, runId + 2 + restart)
    assert.deepEqual(game.world.bodies, bodies)
    assert.equal(game.world.bodies.length, 17)
    assert.equal(new Set(game.world.bodies).size, 17)
    assert.ok(game.obstacles.every((item) => !item.hit && item.body.collisionFilterMask === -1))
  }
})

test('非法 dt 不推进或污染累积时间，超大有限 dt 安全限制为 0.1 秒', () => {
  const game = new RacerGame()
  const reference = new RacerGame()
  game.start()
  reference.start()
  advance(game, 1)
  advance(reference, 1)
  game.tick(PHYSICS_STEP / 2)
  reference.tick(PHYSICS_STEP / 2)
  const snapshot = game.snapshot
  const position = game.player.position.toArray()
  const worldTime = game.world.time
  for (const dt of [0, -0, -1, -PHYSICS_STEP, NaN, Infinity, -Infinity]) {
    assert.doesNotThrow(() => game.tick(dt))
    assert.deepEqual(game.snapshot, snapshot)
    assert.deepEqual(game.player.position.toArray(), position)
    assert.equal(game.world.time, worldTime)
  }
  game.tick(PHYSICS_STEP / 2)
  reference.tick(PHYSICS_STEP / 2)
  assert.deepEqual(game.snapshot, reference.snapshot)
  for (const dt of [1, 1000, Number.MAX_VALUE]) {
    const oversized = new RacerGame()
    const capped = new RacerGame()
    oversized.start()
    capped.start()
    assert.doesNotThrow(() => oversized.tick(dt))
    capped.tick(0.1)
    assert.deepEqual(oversized.snapshot, capped.snapshot)
    closeTo(oversized.time, 0.1)
    closeTo(oversized.world.time, 0.1)
    oversized.tick(PHYSICS_STEP)
    capped.tick(PHYSICS_STEP)
    assert.deepEqual(oversized.snapshot, capped.snapshot)
  }
})

test('formatTime 对有效时间输出分秒和截断后的百分秒，负数钳制为零', () => {
  const cases = [
    [0, '00:00.00'], [-1, '00:00.00'], [0.009, '00:00.00'], [0.01, '00:00.01'],
    [1.239, '00:01.23'], [1.13, '00:01.13'], [59.999, '00:59.99'], [60, '01:00.00'],
    [61.239, '01:01.23'], [3599.999, '59:59.99'], [3600, '60:00.00'], [6000, '100:00.00'],
  ] as const
  for (const [seconds, expected] of cases) assert.equal(formatTime(seconds), expected)
})

test('readBestTime 读取有效正数并使用正确存储键', () => {
  const cases = [['12.34', 12.34], ['1', 1], ['0.01', 0.01], ['1e2', 100], [' 12.5 ', 12.5], [String(Number.MAX_VALUE), Number.MAX_VALUE]] as const
  for (const [stored, expected] of cases) {
    assert.equal(readBestTime({
      getItem(key) {
        assert.equal(key, BEST_TIME_KEY)
        return stored
      },
    }), expected)
  }
})

test('readBestTime 对缺失、非法、非正数和存储访问错误返回 null', () => {
  const invalid = [null, '', ' ', 'hello', 'NaN', 'Infinity', '-Infinity', '0', '-0', '-1', '1e309']
  for (const stored of invalid) {
    assert.equal(readBestTime({ getItem: () => stored }), null, `非法存储值：${JSON.stringify(stored)}`)
  }
  assert.equal(readBestTime({
    getItem(key) {
      assert.equal(key, BEST_TIME_KEY)
      throw new Error('storage unavailable')
    },
  }), null)
})
