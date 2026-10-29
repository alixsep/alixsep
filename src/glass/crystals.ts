import { gsap } from "gsap"

import { CRYSTAL, CRYSTAL_RADIUS, crystalFrame, cutCrystal, restingX, rotation } from "./geometry"
import { pointerInWorld, watchTilt } from "./input"
import { createRenderer } from "./renderer"
import { prefersStill, scrollLight, stage } from "./stage"

import type { Point } from "./input"
import type { PoseBuffers } from "./renderer"

/** Springs towards the centre, weaker sideways so the pile spreads into a line. */
const PULL = { x: 0.9, y: 6.5, z: 14 }
const DAMPING = 2.6
/** How far a stone may move towards or away from the camera. */
const DEPTH = 0.16
const ASPECT = 2.1
/** Radians per second a resting stone keeps turning, and the fastest it may spin. */
const DRIFT = 0.175
const SPIN_LIMIT = 3
const SETTLE_SECONDS = 2
const RESTING_FPS = 30
/** Furthest any point of a stone reaches from its centre, whichever way it turns. */
const EXTENT = Math.max(CRYSTAL.top, CRYSTAL.bottom, CRYSTAL.radius)
/** The page stones emerge through, beyond anything a stone at rest can reach. */
const PAGE = -(DEPTH + EXTENT) - 0.05
const SUNK = PAGE - EXTENT - DEPTH

const CURSOR = { reach: 1.6, push: 7, sweep: 0.55, torque: 1.8 }
/** World units the pile slides per radian a phone tilts. */
const TILT_SLIDE = { x: 3, y: 1.5 }

interface Stone {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  yaw: number
  spin: number
  drift: number
  lean: number
  /** Depth below the page, rising to zero as the stone emerges through it. */
  rise: number
}

function spawn(index: number, count: number, box: { width: number; height: number }): Stone {
  const direction = Math.random() < 0.5 ? -1 : 1
  return {
    x: restingX(index, count),
    y: box.height * 0.5,
    z: (Math.random() - 0.5) * DEPTH,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: Math.random() * Math.PI * 2,
    spin: direction * (2.6 + Math.random() * 2.4),
    drift: direction * DRIFT * (0.7 + Math.random() * 0.6),
    lean: (Math.random() - 0.5) * 0.3,
    rise: SUNK,
  }
}

/** A spin bleeds back to the stone's drift more slowly the harder it was knocked. */
function easeSpin(stone: Stone, dt: number) {
  stone.spin = gsap.utils.clamp(-SPIN_LIMIT, SPIN_LIMIT, stone.spin)
  const rate = 3 / (1 + Math.abs(stone.spin - stone.drift) * 1.1)
  stone.spin += (stone.drift - stone.spin) * Math.min(1, rate * dt)
}

/** Aborting `signal` stops the stones and releases their GPU context. */
export async function mountCrystals(pile: HTMLElement, signal: AbortSignal) {
  const canvas = pile.querySelector("canvas")!
  const count = Number(pile.dataset.crystals)
  const { box, view } = crystalFrame(count)
  const walls = {
    x: view.width / 2 - 0.55,
    top: view.height / 2 - 0.95,
    bottom: 1.2 - view.height / 2,
  }
  const pieces = Array.from({ length: count }, () => cutCrystal())
  const renderer = await createRenderer(canvas, pieces, view, {
    partners: pieces.map(() => []),
    backdropRange: [-0.3, 1],
  })
  if (!renderer || signal.aborted) return renderer?.dispose()

  const still = prefersStill()
  const stones = pieces.map((_, index) => spawn(index, count, box))
  const center = { x: 0, y: 0 }
  const cursor: { point: Point | null; vx: number; vy: number; time: number } = {
    point: null,
    vx: 0,
    vy: 0,
    time: 0,
  }
  const buffers: PoseBuffers = {
    rotations: new Float32Array(count * 9),
    placements: new Float32Array(count * 4),
  }
  let shown = 0
  let calm = 0
  let resting = 0

  const depthOf = (stone: Stone) => stone.z + stone.rise
  const draw = () => {
    stones.forEach((stone, i) => {
      buffers.rotations.set(rotation(stone.lean, stone.yaw), i * 9)
      buffers.placements.set([stone.x, stone.y, depthOf(stone), 1], i * 4)
    })
    const crossing = stones.some((stone) => depthOf(stone) - EXTENT < PAGE)
    renderer.draw(buffers, scrollLight(), crossing ? PAGE : undefined)
  }
  const { invalidate, isVisible } = stage(canvas, renderer, draw, signal)
  const standing = () => stones.slice(0, shown)

  const push = (dt: number) => {
    if (!cursor.point || performance.now() - cursor.time > 900) return
    const [px, py] = cursor.point
    const speed = Math.hypot(cursor.vx, cursor.vy)
    for (const stone of standing()) {
      const dx = stone.x - px
      const dy = (stone.y - py) / ASPECT
      const distance = Math.hypot(dx, dy)
      if (distance > CURSOR.reach) continue
      const falloff = 1 - distance / CURSOR.reach
      const inverse = distance > 1e-4 ? 1 / distance : 0
      const shove = (CURSOR.push + speed * 2.5) * falloff * dt
      stone.vx += dx * inverse * shove + cursor.vx * falloff * CURSOR.sweep * dt
      stone.vy += dy * inverse * shove + cursor.vy * falloff * CURSOR.sweep * dt
      stone.spin += (dx * cursor.vy - dy * cursor.vx) * falloff * CURSOR.torque * dt
    }
    const bleed = 1 - Math.min(1, 7 * dt)
    cursor.vx *= bleed
    cursor.vy *= bleed
  }

  const collide = (fade: number) => {
    const active = standing()
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i]!
        const b = active[j]!
        const sx = b.x - a.x
        const sy = (b.y - a.y) / ASPECT
        const reach = CRYSTAL_RADIUS * 2
        const distance = Math.hypot(sx, sy)
        if (distance > reach || distance < 1e-4) continue
        const overlap = (reach - distance) / 2
        const [nx, ny] = [sx / distance, sy / distance / ASPECT]
        a.x -= nx * overlap
        a.y -= ny * overlap
        b.x += nx * overlap
        b.y += ny * overlap
        a.vx -= nx * overlap * 7
        a.vy -= ny * overlap * 7
        b.vx += nx * overlap * 7
        b.vy += ny * overlap * 7
        a.spin -= overlap * 2.6 * fade
        b.spin += overlap * 2.6 * fade
      }
    }
  }

  const step = (dt: number) => {
    if (calm > SETTLE_SECONDS) {
      for (const stone of stones) {
        easeSpin(stone, dt)
        stone.yaw += stone.spin * dt
      }
      return
    }
    let moved = 0
    stones.forEach((stone, i) => {
      const rise = stone.rise
      stone.rise += ((i < shown ? 0 : SUNK) - rise) * Math.min(1, 5 * dt)
      moved = Math.max(moved, Math.abs(stone.rise - rise) / dt)
      if (i >= shown) return
      const [x, y] = [stone.x, stone.y]
      stone.vx += -PULL.x * (stone.x - center.x) * dt
      stone.vy += -PULL.y * (stone.y - center.y) * dt
      stone.vz += -PULL.z * stone.z * dt
      const damp = 1 - Math.min(1, DAMPING * dt)
      stone.vx *= damp
      stone.vy *= damp
      stone.vz *= damp
      stone.x += stone.vx * dt
      stone.y += stone.vy * dt
      stone.z = gsap.utils.clamp(-DEPTH, DEPTH, stone.z + stone.vz * dt)
      if (Math.abs(stone.x) > walls.x) {
        stone.x = Math.sign(stone.x) * walls.x
        stone.vx *= -0.4
      }
      if (stone.y > walls.top || stone.y < walls.bottom) {
        stone.y = gsap.utils.clamp(walls.bottom, walls.top, stone.y)
        stone.vy *= -0.4
      }
      stone.yaw += stone.spin * dt
      easeSpin(stone, dt)
      moved = Math.max(moved, Math.hypot(stone.x - x, stone.y - y) / dt)
    })
    push(dt)
    collide(Math.min(1, moved))
    calm = moved < 0.02 ? calm + dt : 0
  }

  const wake = () => {
    calm = 0
  }

  /** Plays everything through at once, for stones that should already be at rest. */
  const settle = () => {
    for (let i = 0; i < 900; i++) step(1 / 60)
    if (still) for (const stone of stones) stone.spin = 0
    invalidate()
  }

  const tick = (_time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs / 1000, 1 / 30)
    step(dt / 2)
    step(dt / 2)
    resting += dt
    if (calm <= SETTLE_SECONDS || resting >= 1 / RESTING_FPS) {
      resting = 0
      invalidate()
    }
  }

  addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse" || !isVisible()) return
      const point = pointerInWorld(canvas, view, event)
      const now = performance.now()
      if (cursor.point) {
        const seconds = Math.max((now - cursor.time) / 1000, 1 / 240)
        cursor.vx = gsap.utils.clamp(-30, 30, (point[0] - cursor.point[0]) / seconds)
        cursor.vy = gsap.utils.clamp(-30, 30, (point[1] - cursor.point[1]) / seconds)
      }
      cursor.point = point
      cursor.time = now
      wake()
    },
    { passive: true, signal },
  )
  document.documentElement.addEventListener("pointerleave", () => (cursor.point = null), { signal })

  watchTilt(signal, (pitch, yaw) => {
    center.x = yaw * TILT_SLIDE.x
    center.y = -pitch * TILT_SLIDE.y
    wake()
  })

  if (!still) {
    const onScreen = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) gsap.ticker.add(tick)
      else gsap.ticker.remove(tick)
    })
    onScreen.observe(canvas)
    signal.addEventListener("abort", () => {
      onScreen.disconnect()
      gsap.ticker.remove(tick)
    })
  }

  return {
    show: (next: number) => {
      if (next === shown) return
      shown = gsap.utils.clamp(0, count, next)
      wake()
      if (still) settle()
    },
  }
}
