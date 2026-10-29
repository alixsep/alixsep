import { gsap } from "gsap"

import { ease } from "@/lib/motion"

import { cutSlab, RECORD_ART, RECORD_MARGIN, rotation } from "./geometry"
import { createRenderer, nextFrame } from "./renderer"
import { onFirstSight, prefersStill, scrollLight, stage } from "./stage"

import type { PoseBuffers } from "./renderer"

const TILE = 512

export const record = cutSlab(1, 1, 0, { depth: 0.04, bevel: 0.008, rise: 0.012, inset: 0.035 })

/** Bakes the covers into one texture for the renderer's `inlay`, a tile each in reading order. */
export async function bakeInlay(covers: HTMLImageElement[]) {
  await Promise.all(covers.map((cover) => cover.decode().catch(() => undefined)))
  const columns = Math.ceil(Math.sqrt(covers.length))
  const rows = Math.ceil(covers.length / columns)
  const atlas = document.createElement("canvas")
  atlas.width = columns * TILE
  atlas.height = rows * TILE
  const context = atlas.getContext("2d")!
  covers.forEach((cover, i) =>
    context.drawImage(cover, (i % columns) * TILE, Math.floor(i / columns) * TILE, TILE, TILE),
  )
  return { atlas, grid: [columns, rows] as const, size: [RECORD_ART, RECORD_ART] as const }
}

/** Narrow, so each record is seen square on from in front of its own centre. */
const FIELD_OF_VIEW = 0.1
const VIEW = { width: 1 + 2 * RECORD_MARGIN, height: 1 + 2 * RECORD_MARGIN }
const PAGE = -0.2
const SUNK = { pitch: 0.6, depth: PAGE - 1.1 }
const RISE = { duration: 1.6, ease: ease.arrive }
/** Seconds the rise waits per viewport width from the left, so a row sweeps up in order. */
const SWEEP = 0.3
const HOVER = { lift: 0.08, tilt: 0.2 }
const FOLLOW = { duration: 0.6, ease: ease.arrive }

/** Aborting `signal` stops the record and releases its GPU context. */
export async function mountRecord(frame: HTMLElement, signal: AbortSignal) {
  const canvas = frame.querySelector("canvas")!
  const item = frame.closest<HTMLElement>("[data-record]") ?? frame
  const renderer = await createRenderer(canvas, [record], VIEW, {
    partners: [[]],
    fieldOfView: FIELD_OF_VIEW,
    inlay: await bakeInlay([frame.querySelector("img")!]),
  })
  if (!renderer) {
    canvas.toggleAttribute("data-fallback", true)
    return
  }
  if (signal.aborted) return renderer.dispose()

  const still = prefersStill()
  const pose = { lift: 0, pitch: 0, yaw: 0 }
  const rise = still ? { depth: 0, pitch: 0 } : { ...SUNK }
  const buffers: PoseBuffers = { rotations: new Float32Array(9), placements: new Float32Array(4) }
  const draw = () => {
    buffers.rotations.set(rotation(pose.pitch + rise.pitch, pose.yaw))
    buffers.placements.set([0, 0, pose.lift + rise.depth, 1])
    renderer.draw(buffers, scrollLight(), PAGE)
  }
  const { invalidate, onRelease } = stage(canvas, renderer, draw, signal)

  const follow = (["lift", "pitch", "yaw"] as const).map((key) =>
    gsap.quickTo(pose, key, { ...FOLLOW, onUpdate: invalidate }),
  )
  const tip = (lift: number, pitch: number, yaw: number) => {
    ;[lift, pitch, yaw].forEach((value, k) => {
      follow[k]!(value)
    })
  }
  const options = { signal, passive: true }
  item.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return
      const { left, top, width, height } = frame.getBoundingClientRect()
      const across = gsap.utils.clamp(-0.5, 0.5, (event.clientX - left) / width - 0.5)
      const down = gsap.utils.clamp(-0.5, 0.5, (event.clientY - top) / height - 0.5)
      tip(HOVER.lift, down * HOVER.tilt, across * HOVER.tilt)
    },
    options,
  )
  item.addEventListener("pointerleave", () => tip(0, 0, 0), options)
  onRelease({ disconnect: () => gsap.killTweensOf([pose, rise]) })

  await nextFrame()
  await nextFrame()
  if (signal.aborted) return
  canvas.removeAttribute("data-fallback")
  gsap.set(canvas, { opacity: 1 })
  if (still) return
  onRelease(
    onFirstSight(canvas, { threshold: 0.3 }, (fromAbove) => {
      if (fromAbove) return void gsap.set(rise, { depth: 0, pitch: 0, onComplete: invalidate })
      const delay = (SWEEP * frame.getBoundingClientRect().left) / innerWidth
      gsap.to(rise, { ...RISE, delay, depth: 0, pitch: 0, onUpdate: invalidate })
    }),
  )
}
