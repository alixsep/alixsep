import { gsap } from "gsap"

import { ease } from "@/lib/motion"

import { rotation, SHELF_STEP, shelfFrame as VIEW } from "./geometry"
import { bakeInlay, record as slab } from "./record"
import { createRenderer, nextFrame } from "./renderer"
import { onFirstSight, prefersStill, scrollLight, stage } from "./stage"

import type { Piece, Vector } from "./geometry"
import type { PoseBuffers } from "./renderer"

const FIELD_OF_VIEW = 0.4
const SHELF = { step: 0.18, depth: -0.3, turn: 0.72, hover: 0.14 }
/** The page the slabs emerge through, just behind the deepest one at rest. */
const PAGE = -0.8
/** How each slab waits behind the page, tipped back and sunk beyond its reach. */
const SUNK = { pitch: 0.6, depth: PAGE - 1.1 }
const RISE = { duration: 1.6, ease: ease.arrive, stagger: 0.08 }
/** How far from rest, in world units or radians, a slab still counts as settled. */
const SETTLED = 0.01
const MOVE = { duration: 0.8, ease: ease.arrive }

interface Pose {
  x: number
  z: number
  yaw: number
}

interface Rise {
  depth: number
  pitch: number
}

const resting = (offset: number, hovered: boolean): Pose => {
  if (offset === 0) return { x: 0, z: 0, yaw: 0 }
  const side = Math.sign(offset)
  const spread = SHELF_STEP + (Math.abs(offset) - 1) * SHELF.step
  return {
    x: side * spread,
    z: SHELF.depth + (hovered ? SHELF.hover : 0),
    yaw: side * SHELF.turn * (hovered ? 0.8 : 1),
  }
}

/** The pose between two resting places, for a shelf held part way by a finger. */
const between = (offset: number): Pose => {
  const near = Math.floor(offset)
  const [from, to] = [resting(near, false), resting(near + 1, false)]
  const share = offset - near
  return {
    x: gsap.utils.interpolate(from.x, to.x, share),
    z: gsap.utils.interpolate(from.z, to.z, share),
    yaw: gsap.utils.interpolate(from.yaw, to.yaw, share),
  }
}

const placement = (pose: Pose, rise: Rise) => ({
  turn: rotation(rise.pitch, pose.yaw),
  centre: [pose.x, 0, pose.z + rise.depth] as const,
})

/** Distance along the ray to the slab's surface, or Infinity when it misses. */
function hit(origin: Vector, direction: Vector, pose: Pose, rise: Rise, planes: Piece["planes"]) {
  const { turn, centre } = placement(pose, rise)
  const local = (v: Vector): Vector => [
    turn[0] * v[0] + turn[1] * v[1] + turn[2] * v[2],
    turn[3] * v[0] + turn[4] * v[1] + turn[5] * v[2],
    turn[6] * v[0] + turn[7] * v[1] + turn[8] * v[2],
  ]
  const o = local([origin[0] - centre[0], origin[1] - centre[1], origin[2] - centre[2]])
  const d = local(direction)
  let [near, far] = [-Infinity, Infinity]
  for (const [nx, ny, nz, w] of planes) {
    const along = nx * d[0] + ny * d[1] + nz * d[2]
    const gap = w - (nx * o[0] + ny * o[1] + nz * o[2])
    if (along < 0) near = Math.max(near, gap / along)
    else if (along > 0) far = Math.min(far, gap / along)
    else if (gap < 0) return Infinity
  }
  return near <= far ? near : Infinity
}

/** Aborting `signal` stops the shelf and releases its GPU context. */
export async function mountShelf(
  canvas: HTMLCanvasElement,
  covers: HTMLImageElement[],
  signal: AbortSignal,
  { current = 0, onPick }: { current?: number; onPick: (index: number) => void },
) {
  const pieces = covers.map(() => slab)
  const renderer = await createRenderer(canvas, pieces, VIEW, {
    partners: pieces.map(() => []),
    fieldOfView: FIELD_OF_VIEW,
    inlay: await bakeInlay(covers),
  })
  if (!renderer) {
    canvas.toggleAttribute("data-fallback", true)
    return
  }
  if (signal.aborted) return renderer.dispose()

  const still = prefersStill()
  let hovered: number | undefined
  const poses = covers.map((_, i) => resting(i - current, false))
  const rise: Rise[] = covers.map(() => (still ? { depth: 0, pitch: 0 } : { ...SUNK }))
  const buffers: PoseBuffers = {
    rotations: new Float32Array(pieces.length * 9),
    placements: new Float32Array(pieces.length * 4),
  }
  const light = scrollLight()
  const draw = () => {
    poses.forEach((pose, i) => {
      const { turn, centre } = placement(pose, rise[i]!)
      buffers.rotations.set(turn, i * 9)
      buffers.placements.set([...centre, 1], i * 4)
    })
    renderer.draw(buffers, light, PAGE)
  }
  const { invalidate, onRelease } = stage(canvas, renderer, draw, signal, { followScroll: false })

  const arrange = (duration = MOVE.duration) =>
    gsap.to(poses, {
      ...MOVE,
      duration,
      x: (i: number) => resting(i - current, i === hovered).x,
      z: (i: number) => resting(i - current, i === hovered).z,
      yaw: (i: number) => resting(i - current, i === hovered).yaw,
      overwrite: true,
      onUpdate: invalidate,
    })

  const eye = VIEW.height / 2 / Math.tan(FIELD_OF_VIEW / 2)
  const pick = (event: PointerEvent | MouseEvent) => {
    const bounds = canvas.getBoundingClientRect()
    const target: Vector = [
      ((event.clientX - bounds.left) / bounds.width - 0.5) * VIEW.width,
      (0.5 - (event.clientY - bounds.top) / bounds.height) * VIEW.height,
      -eye,
    ]
    const length = Math.hypot(...target)
    const direction: Vector = [target[0] / length, target[1] / length, target[2] / length]
    const distances = poses.map((pose, i) =>
      hit([0, 0, eye], direction, pose, rise[i]!, slab.planes),
    )
    const nearest = Math.min(...distances)
    return nearest < Infinity ? distances.indexOf(nearest) : undefined
  }

  const options = { signal, passive: true }
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return
      const index = pick(event)
      canvas.style.cursor = index === undefined ? "" : "pointer"
      if (index === hovered) return
      hovered = index
      arrange(0.5)
    },
    options,
  )
  canvas.addEventListener(
    "pointerleave",
    (event) => {
      if (event.pointerType !== "mouse") return
      hovered = undefined
      arrange(0.5)
    },
    options,
  )
  canvas.addEventListener(
    "click",
    (event) => {
      const index = pick(event)
      if (index !== undefined) onPick(index)
    },
    options,
  )

  await nextFrame()
  await nextFrame()
  if (signal.aborted) return
  canvas.removeAttribute("data-fallback")
  gsap.set(canvas, { opacity: 1 })
  if (!still) {
    const intro = gsap.to(rise, {
      ...RISE,
      depth: 0,
      pitch: 0,
      paused: true,
      stagger: { each: RISE.stagger, from: current },
      onUpdate: invalidate,
    })
    onRelease({ disconnect: () => void intro.kill() })
    onRelease(
      onFirstSight(
        canvas,
        { threshold: 0.4 },
        (fromAbove) => void (fromAbove ? intro.progress(1) : intro).play(),
      ),
    )
  }

  return {
    show: (index: number) => {
      current = index
      arrange()
    },
    /** Holds the shelf at a fractional `position`, following a finger. */
    slide: (position: number) => {
      gsap.killTweensOf(poses)
      poses.forEach((pose, i) => Object.assign(pose, between(i - position)))
      invalidate()
    },
    /** Whether the slab has settled at the front, risen and square to the viewer. */
    faces: (index: number) => {
      const { x, z, yaw } = poses[index]!
      const { depth, pitch } = rise[index]!
      return [x, z, yaw, depth, pitch].every((value) => Math.abs(value) < SETTLED)
    },
  }
}
