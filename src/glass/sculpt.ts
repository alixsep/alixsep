import { gsap } from "gsap"

import { ease } from "@/lib/motion"

import { centroid, multiply, rotation, subtract, transform } from "./geometry"
import { createRenderer, nextFrame } from "./renderer"
import { sculpture, SCULPTURE_FIELD_OF_VIEW, sculptureView } from "./sculptures"
import { onFirstSight, prefersStill, scrollLight, stage } from "./stage"

import type { PoseBuffers } from "./renderer"
import type { SculptureName } from "./sculptures"

const LEAN = { pitch: 0.28, yaw: 0.5 }
const TILT = { pitch: 0.7, yaw: -0.5 }
const RISE = { duration: 1.7, spread: 0.5 }
const ETCHING_FADES = 0.2
const TILE_IN_VIEW_BEFORE_RISE = 300

/** Aborting `signal` stops the sculpture and releases its GPU context. */
export async function mountSculpture(figure: HTMLElement, signal: AbortSignal) {
  const canvas = figure.querySelector("canvas")!
  const shape = sculpture(figure.dataset.sculpture as SculptureName)
  const size = sculptureView(shape)
  const renderer = await createRenderer(
    canvas,
    shape.pieces,
    { width: size, height: size },
    { partners: shape.partners, backdropRange: [-0.3, 1], fieldOfView: SCULPTURE_FIELD_OF_VIEW },
  )
  if (!renderer || signal.aborted) return renderer?.dispose()

  const still = prefersStill()
  const { radius } = shape
  const eye = size / 2 / Math.tan(SCULPTURE_FIELD_OF_VIEW / 2)
  /**
   * Grows the sculpture as it sinks by exactly what perspective takes away, so from any depth it
   * projects onto its etching and only the page, slicing through it, shows how far it has risen.
   */
  const scaleAt = (depth: number) => (eye - depth) / eye
  const page = -radius - 0.05
  const parts = shape.parts.map((members) => {
    const corners = members.flatMap((index) =>
      shape.pieces[index]!.faces.flatMap(({ corners }) => corners),
    )
    const centre = centroid(corners)
    const reach = Math.max(...corners.map((corner) => Math.hypot(...subtract(corner, centre))))
    const nearest = centre[2] + reach
    return { members, centre, sunk: (page - nearest) / (1 - nearest / eye) - 0.05 }
  })
  const rises = parts.map(({ sunk }) =>
    still ? { pitch: 0, yaw: 0, depth: 0 } : { ...TILT, depth: sunk },
  )
  const lean = { pitch: 0, yaw: 0 }
  let risen = still
  /** Heavy to trace, so it is lit once and redrawn only while it moves, never on scroll. */
  const light = scrollLight()
  const count = shape.pieces.length
  const buffers: PoseBuffers = {
    rotations: new Float32Array(count * 9),
    placements: new Float32Array(count * 4),
  }
  // Each part turns about its own centre, then the whole sculpture leans about its middle.
  const draw = () => {
    const leaning = rotation(lean.pitch, lean.yaw)
    rises.forEach(({ pitch, yaw, depth }, i) => {
      const turn = multiply(leaning, rotation(pitch, yaw))
      const { centre, members } = parts[i]!
      const [dx, dy, dz] = subtract(transform(leaning, centre), transform(turn, centre))
      const scale = scaleAt(depth)
      for (const index of members) {
        buffers.rotations.set(turn, index * 9)
        buffers.placements.set([dx * scale, dy * scale, depth + dz * scale, scale], index * 4)
      }
    })
    renderer.draw(buffers, light, page)
  }
  const { invalidate, onRelease } = stage(canvas, renderer, draw, signal, { followScroll: false })

  const settle = { duration: 0.9, ease: ease.settle, onUpdate: invalidate }
  const pitch = gsap.quickTo(lean, "pitch", settle)
  const yaw = gsap.quickTo(lean, "yaw", settle)
  const tile = figure.closest("article") ?? figure
  const options = { signal, passive: true }
  tile.addEventListener(
    "pointermove",
    (event) => {
      if (!risen) return
      const bounds = figure.getBoundingClientRect()
      const reach = tile.getBoundingClientRect()
      pitch(((event.clientY - bounds.top - bounds.height / 2) / reach.height) * 2 * LEAN.pitch)
      yaw(((event.clientX - bounds.left - bounds.width / 2) / reach.width) * 2 * LEAN.yaw)
    },
    options,
  )
  tile.addEventListener(
    "pointerleave",
    () => {
      pitch(0)
      yaw(0)
    },
    options,
  )

  await nextFrame()
  await nextFrame()
  if (signal.aborted) return
  gsap.set(canvas, { opacity: 1 })

  const surface = () => {
    risen = true
    figure.toggleAttribute("data-risen", true)
  }
  const intro = gsap
    .timeline({ paused: true, onUpdate: invalidate })
    .call(surface, [], ETCHING_FADES)
  const order = parts.map((_, i) => i).sort((a, b) => parts[a]!.centre[0] - parts[b]!.centre[0])
  order.forEach((part, n) => {
    intro.to(
      rises[part]!,
      { depth: 0, pitch: 0, yaw: 0, duration: RISE.duration, ease: ease.arrive },
      (n / Math.max(parts.length - 1, 1)) * RISE.spread,
    )
  })
  onRelease({ disconnect: () => void intro.kill() })

  const retreat = () =>
    new Promise<void>((resolve) => {
      intro.kill()
      risen = false
      figure.removeAttribute("data-risen")
      if (still) return resolve()
      gsap.to(lean, { pitch: 0, yaw: 0, duration: 0.6, ease: ease.depart, overwrite: true })
      gsap.to(rises, {
        depth: (i: number) => parts[i]!.sunk,
        ...TILT,
        duration: 0.6,
        ease: ease.depart,
        stagger: 0.2 / parts.length,
        onUpdate: invalidate,
        onComplete: resolve,
      })
    })

  if (still) {
    surface()
    return { retreat }
  }
  onRelease(
    onFirstSight(
      tile,
      { rootMargin: `0px 0px -${TILE_IN_VIEW_BEFORE_RISE}px 0px` },
      (fromAbove) => void (fromAbove ? intro.progress(1) : intro).play(),
    ),
  )
  return { retreat }
}
