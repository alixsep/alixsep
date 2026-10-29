import { gsap } from "gsap"

import { ease } from "@/lib/motion"

import { cutSlab, halfDepth, rotation, waist } from "./geometry"
import { createRenderer, nextFrame } from "./renderer"
import { prefersStill, scrollLight, stage } from "./stage"

import type { PoseBuffers } from "./renderer"

/** World units the slab stands tall, which keeps its cut in the proportions of a keycap. */
const HEIGHT = 4 / 3
const CUT = { depth: 0.4, bevel: 0.05, rise: 0.085, inset: 0.14 }
const CORNER = 0.16
/** CSS pixels the canvas overhangs the button, so a tilted slab is never clipped. */
const OVERHANG = 12
const LEAN = { pitch: 0.12, yaw: 0.17 }
const PRESS_DEPTH = 0.12
/** Narrow, so the camera looks square onto the slab rather than along its sides. */
const FIELD_OF_VIEW = 0.15
const PRINT_SCALE = 4
/** How the slab is turned while it waits behind the page. */
const TILT = { pitch: 0.45, yaw: -0.3 }

function printLabel(button: HTMLElement) {
  const label = button.querySelector("[data-label]")!
  const { font, letterSpacing } = getComputedStyle(label)
  const canvas = document.createElement("canvas")
  canvas.width = button.offsetWidth * PRINT_SCALE
  canvas.height = button.offsetHeight * PRINT_SCALE
  const context = canvas.getContext("2d")!
  context.scale(PRINT_SCALE, PRINT_SCALE)
  context.font = font
  context.letterSpacing = letterSpacing
  const text = label.textContent.trim()
  const ink = context.measureText(text)
  context.fillText(
    text,
    (button.offsetWidth - ink.actualBoundingBoxRight + ink.actualBoundingBoxLeft) / 2,
    (button.offsetHeight + ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2,
  )
  return canvas
}

/** Aborting `signal` stops the button and releases its GPU context. */
export async function mountGlassButton(
  button: HTMLElement,
  signal: AbortSignal,
  { entrance = true } = {},
) {
  const canvas = button.querySelector("canvas")!
  const flat = button.querySelectorAll(":scope > :not(canvas)")
  const unit = HEIGHT / button.offsetHeight
  const width = button.offsetWidth * unit
  const slab = cutSlab(width, HEIGHT, CORNER, CUT)
  const view = {
    width: (button.offsetWidth + OVERHANG * 2) * unit,
    height: (button.offsetHeight + OVERHANG * 2) * unit,
  }
  const reach = (pitch: number, yaw: number) =>
    (width / 2) * Math.sin(Math.abs(yaw)) + (HEIGHT / 2) * Math.sin(Math.abs(pitch))
  /** The page the slab emerges through, beyond anything a pressed and leaning slab reaches. */
  const page = -waist(CUT) - halfDepth(CUT) - PRESS_DEPTH - reach(LEAN.pitch, LEAN.yaw)
  const sunk = { ...TILT, depth: page - CUT.depth - CUT.rise - reach(TILT.pitch, TILT.yaw) }

  await document.fonts.ready
  const renderer = await createRenderer(canvas, [slab], view, {
    partners: [[]],
    fieldOfView: FIELD_OF_VIEW,
    print: { image: printLabel(button), size: [width, HEIGHT] },
  })
  if (!renderer) {
    button.toggleAttribute("data-fallback", true)
    return
  }
  if (signal.aborted) return renderer.dispose()

  const still = prefersStill()
  const rises = entrance && !still
  const rise = rises ? { ...sunk } : { pitch: 0, yaw: 0, depth: 0 }
  const pose = { pitch: 0, yaw: 0, press: 0 }
  const buffers: PoseBuffers = { rotations: new Float32Array(9), placements: new Float32Array(4) }
  const draw = () => {
    buffers.rotations.set(rotation(pose.pitch + rise.pitch, pose.yaw + rise.yaw))
    buffers.placements.set([0, 0, rise.depth - waist(CUT) - pose.press, 1])
    renderer.draw(buffers, scrollLight(), page)
  }
  const { invalidate } = stage(canvas, renderer, draw, signal)

  const settle = { duration: 0.5, ease: ease.settle, onUpdate: invalidate }
  const pitch = gsap.quickTo(pose, "pitch", settle)
  const yaw = gsap.quickTo(pose, "yaw", settle)
  const press = gsap.quickTo(pose, "press", { ...settle, duration: 0.2 })
  const lean = (x: number, y: number) => {
    pitch(y * LEAN.pitch)
    yaw(x * LEAN.yaw)
  }

  const options = { signal, passive: true }
  button.addEventListener(
    "pointermove",
    (event) => {
      const bounds = button.getBoundingClientRect()
      lean(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
      )
    },
    options,
  )
  button.addEventListener(
    "pointerleave",
    () => {
      lean(0, 0)
      press(0)
    },
    options,
  )
  button.addEventListener("pointerdown", () => void press(PRESS_DEPTH), options)
  button.addEventListener("pointerup", () => void press(0), options)

  const retreat = () =>
    new Promise<void>((resolve) => {
      gsap.killTweensOf(rise)
      if (still) {
        gsap.set(flat, { opacity: 1 })
        return resolve()
      }
      gsap
        .timeline({ onUpdate: invalidate, onComplete: resolve })
        .to(rise, { ...sunk, duration: 0.5, ease: ease.depart })
        .to(flat, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.25)
    })

  await nextFrame()
  await nextFrame()
  if (signal.aborted) return
  button.toggleAttribute("data-cut", true)
  signal.addEventListener("abort", () => button.removeAttribute("data-cut"))
  gsap.to(flat, { opacity: 0, duration: 0.5, ease: "power1.inOut", delay: rises ? 0.2 : 0 })
  if (rises) {
    gsap.to(rise, {
      pitch: 0,
      yaw: 0,
      depth: 0,
      duration: 1.4,
      ease: ease.arrive,
      onUpdate: invalidate,
    })
  }
  return { retreat }
}
