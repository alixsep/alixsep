import { gsap } from "gsap"

import { pointerInWorld, watchTilt } from "./input"

import type { Glyph, Piece } from "./geometry"
import type { Point } from "./input"

const STIFFNESS = 34
const DAMPING = 5.4
const LIMIT = 0.35
/** World units a passing pointer reaches, and radians of spin per unit it moves. */
const REACH = 0.9
const SWEEP_GAIN = 2.2
/** How long a phone's tilt takes to travel across the whole mark. */
const WAVE_SECONDS = 0.35

interface Wobble {
  pitch: number
  yaw: number
}

function distanceToOutline([px, py]: Point, outline: Point[]) {
  const sides = new Set<number>()
  let nearest = Infinity
  outline.forEach(([ax, ay], i) => {
    const [bx, by] = outline[(i + 1) % outline.length]!
    const [ex, ey] = [bx - ax, by - ay]
    const t = Math.min(1, Math.max(0, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)))
    nearest = Math.min(nearest, Math.hypot(px - ax - ex * t, py - ay - ey * t))
    sides.add(Math.sign(ex * (py - ay) - ey * (px - ax)))
  })
  return sides.has(1) && sides.has(-1) ? nearest : 0
}

/** Glyphs on springs: a mouse knocks the ones it sweeps past, a phone's tilt sweeps across them. */
export function createInteraction(
  glyphs: Glyph[],
  pieces: Piece[],
  canvas: HTMLCanvasElement,
  view: { width: number; height: number },
  onChange: () => void,
  signal: AbortSignal,
) {
  const wobble: Wobble[] = glyphs.map(() => ({ pitch: 0, yaw: 0 }))
  const velocity = glyphs.map(() => ({ pitch: 0, yaw: 0 }))
  const delays = glyphs.map(({ center: [x] }) => (x / view.width + 0.5) * WAVE_SECONDS * 1000)
  const distanceTo = (point: Point, { members }: Glyph) =>
    Math.min(...members.map((index) => distanceToOutline(point, pieces[index]!.outline)))
  const sweep = { x: 0, y: 0 }
  const tilts: { time: number; pitch: number; yaw: number }[] = []
  let pointer: Point | null = null
  let running = false

  const tiltAt = (time: number) => {
    for (let i = tilts.length - 1; i >= 0; i--) if (tilts[i]!.time <= time) return tilts[i]!
    return tilts[0] ?? { pitch: 0, yaw: 0 }
  }

  const step = (_time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs / 1000, 1 / 30)
    const now = performance.now()
    let motion = 0

    glyphs.forEach((glyph, i) => {
      const angle = wobble[i]!
      const spin = velocity[i]!
      if (pointer && (sweep.x || sweep.y)) {
        const reach = distanceTo(pointer, glyph) / REACH
        const influence = Math.exp(-reach * reach) * SWEEP_GAIN
        spin.yaw += sweep.x * influence
        spin.pitch -= sweep.y * influence
      }
      const rest = tiltAt(now - delays[i]!)
      spin.pitch += (STIFFNESS * (rest.pitch - angle.pitch) - DAMPING * spin.pitch) * dt
      spin.yaw += (STIFFNESS * (rest.yaw - angle.yaw) - DAMPING * spin.yaw) * dt
      angle.pitch = gsap.utils.clamp(-LIMIT, LIMIT, angle.pitch + spin.pitch * dt)
      angle.yaw = gsap.utils.clamp(-LIMIT, LIMIT, angle.yaw + spin.yaw * dt)
      motion += Math.abs(spin.pitch) + Math.abs(spin.yaw)
      motion += Math.abs(rest.pitch - angle.pitch) + Math.abs(rest.yaw - angle.yaw)
    })
    sweep.x = sweep.y = 0
    onChange()

    if (motion < 1e-3 && now - (tilts.at(-1)?.time ?? 0) > WAVE_SECONDS * 1000) {
      gsap.ticker.remove(step)
      running = false
    }
  }

  signal.addEventListener("abort", () => gsap.ticker.remove(step))

  const wake = () => {
    if (running || signal.aborted) return
    running = true
    gsap.ticker.add(step)
  }

  addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return
      const next = pointerInWorld(canvas, view, event)
      if (pointer) {
        sweep.x += next[0] - pointer[0]
        sweep.y += next[1] - pointer[1]
        wake()
      }
      pointer = next
    },
    { passive: true, signal },
  )
  document.documentElement.addEventListener("pointerleave", () => (pointer = null), { signal })

  watchTilt(signal, (pitch, yaw) => {
    const time = performance.now()
    tilts.push({ time, pitch, yaw })
    while (tilts.length > 1 && time - tilts[1]!.time > WAVE_SECONDS * 1000) tilts.shift()
    wake()
  })

  return wobble
}
