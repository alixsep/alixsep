import { gsap } from "gsap"

import { ease } from "@/lib/motion"

import { relayout } from "./figure"
import { setText } from "./font"
import { cutMark, framePad, halfDepth, rotation, waist } from "./geometry"
import { createInteraction } from "./interaction"
import { createRenderer, FIELD_OF_VIEW, nextFrame } from "./renderer"
import { onFirstSight, prefersStill, scrollLight, stage } from "./stage"

import type { Mark } from "./font"
import type { PoseBuffers } from "./renderer"

/** Seconds the pencil takes to outline a glyph, and between one glyph and the next. */
const PEN = { duration: 0.42, stagger: 0.07 }
/** How each glyph is tilted while it waits behind the page. */
const TILT = { pitch: 0.7, yaw: -0.5 }
/** The page the glass emerges through, just behind the glass at rest. */
const PAGE = -0.9
/** No mark is seen across a wider angle than ALIX, so long titles keep its perspective. */
const WIDEST = Math.tan((36 * Math.PI) / 180)
const AT_REST = { depth: 0, pitch: 0, yaw: 0 }

/** Arriving through a page transition, the page holds still until its title has surfaced. */
const releaseScroll = () => document.documentElement.classList.remove("held")

/** The glass pieces of `mark`, and the view and perspective that frame them. */
function cutGlass(mark: Mark) {
  const { pieces, glyphs } = cutMark(mark)
  const view = { width: mark.width + framePad * 2, height: mark.height + framePad * 2 }
  const tangent = Math.min(Math.tan(FIELD_OF_VIEW / 2), (WIDEST * view.height) / view.width)
  const outlines = glyphs.map(({ center: [gx, gy], members }) =>
    members.flatMap((index) => pieces[index]!.outline.map(([x, y]) => [x - gx, y - gy] as const)),
  )
  const buffers: PoseBuffers = {
    rotations: new Float32Array(pieces.length * 9),
    placements: new Float32Array(pieces.length * 4),
  }
  return { mark, pieces, glyphs, view, fieldOfView: 2 * Math.atan(tangent), outlines, buffers }
}

/** How many leading glyphs two marks draw identically, and so can keep across a change of text. */
const sharedGlyphs = (before: Mark, after: Mark) => {
  const same = (i: number) => JSON.stringify(before.glyphs[i]) === JSON.stringify(after.glyphs[i])
  let count = 0
  while (count < Math.min(before.glyphs.length, after.glyphs.length) && same(count)) count++
  return count
}

/** Aborting `signal` stops the figure and releases its GPU context. */
export async function mountGlass(
  figure: HTMLElement,
  signal = new AbortController().signal,
  { entrance = true } = {},
) {
  const canvas = figure.querySelector("canvas")
  const flat = figure.querySelector("svg")
  const text = figure.dataset.text
  if (!canvas || !flat || text === undefined) return

  const mark = setText(text)
  const showFlat = () => {
    figure.dataset.flat = ""
    releaseScroll()
  }
  if (!mark.glyphs.length) return showFlat()
  let cut = cutGlass(mark)
  const renderer = await createRenderer(canvas, cut.pieces, cut.view, {
    fieldOfView: cut.fieldOfView,
  })
  if (!renderer) return showFlat()
  if (signal.aborted) return renderer.dispose()
  signal.addEventListener("abort", releaseScroll)

  const still = prefersStill()
  const appears = entrance && !still
  const surfacing =
    document.documentElement.classList.contains("arriving") || "flat" in figure.dataset
  const behind = (i: number) => {
    const reach = Math.max(...cut.outlines[i]!.map(([x, y]) => Math.hypot(x, y)))
    return { ...TILT, depth: PAGE - reach - halfDepth() }
  }
  const waiting = (i: number) => (appears ? behind(i) : { ...AT_REST })
  let rise = cut.glyphs.map((_, i) => waiting(i))
  /** The deepest point of glyph `i` as it rises, before any wobble. */
  const deepest = (i: number) => {
    const { depth, pitch, yaw } = rise[i]!
    const turn = rotation(pitch, yaw)
    const nearest = Math.min(...cut.outlines[i]!.map(([x, y]) => turn[2] * x + turn[5] * y))
    return nearest - Math.abs(turn[8]) * halfDepth() - waist() + depth
  }
  const sweep = { light: 0 }
  // The page exists only while glass is crossing it, and the glyphs stay still until it is gone.
  let crossing = appears
  const response = { weight: appears ? 0 : 1 }
  let shaping = new AbortController()
  const respond = () =>
    still
      ? cut.glyphs.map(() => ({ pitch: 0, yaw: 0 }))
      : createInteraction(
          cut.glyphs,
          cut.pieces,
          canvas,
          cut.view,
          () => invalidate(),
          AbortSignal.any([signal, shaping.signal]),
        )
  let wobble = respond()

  const draw = () => {
    if (!cut.pieces.length) return renderer.clear()
    cut.glyphs.forEach(({ center: [gx, gy], members }, i) => {
      const { depth, pitch, yaw } = rise[i]!
      const { weight } = response
      const turn = rotation(wobble[i]!.pitch * weight + pitch, wobble[i]!.yaw * weight + yaw)
      for (const index of members) {
        const [dx, dy] = [cut.pieces[index]!.center[0] - gx, cut.pieces[index]!.center[1] - gy]
        cut.buffers.rotations.set(turn, index * 9)
        cut.buffers.placements.set(
          [
            gx + turn[0] * dx + turn[3] * dy,
            gy + turn[1] * dx + turn[4] * dy,
            turn[2] * dx + turn[5] * dy - waist() + depth,
            1,
          ],
          index * 4,
        )
      }
    })
    renderer.draw(cut.buffers, scrollLight() + sweep.light, crossing ? PAGE : undefined)
  }

  const { invalidate, fit, onRelease } = stage(canvas, renderer, draw, signal)

  // The first draws, still hidden, let the GPU finish its work before anything moves.
  await nextFrame()
  await nextFrame()
  if (signal.aborted) return
  gsap.set(canvas, { opacity: 1 })

  /** A timeline that lifts the page away once every glyph has crossed it, then lets them wobble. */
  const rising = (options: gsap.TimelineVars = {}) => {
    const timeline: gsap.core.Timeline = gsap.timeline({
      ...options,
      onUpdate: () => {
        if (crossing && rise.every((_, i) => deepest(i) >= PAGE)) {
          crossing = false
          releaseScroll()
          timeline.to(response, { weight: 1, duration: 0.8, ease: "power2.inOut" }, timeline.time())
        }
        invalidate()
      },
    })
    onRelease({ disconnect: () => void timeline.kill() })
    return timeline
  }

  const surface = (timeline: gsap.core.Timeline, i: number, at: number) =>
    timeline.to(rise[i]!, { ...AT_REST, duration: 1.7, ease: ease.arrive }, at)

  /** Glyphs from `first` on rise through the page, outlined by the pencil unless they surface. */
  const enter = (timeline: gsap.core.Timeline, first = 0) => {
    cut.glyphs.slice(first).forEach((_, n) => {
      const i = first + n
      if (surfacing) return void surface(timeline, i, n * 0.05)
      const strokes = flat.querySelectorAll("g")[i]!.querySelectorAll(".sketch")
      const start = n * PEN.stagger
      timeline.to(
        strokes,
        { strokeDashoffset: 0, duration: PEN.duration, ease: "power1.inOut", autoRound: false },
        start,
      )
      surface(timeline, i, start + PEN.duration * 0.5)
      timeline.to(
        strokes,
        { opacity: 0, duration: 0.5, ease: "power1.out" },
        start + PEN.duration + 0.25,
      )
    })
  }

  const intro = appears ? rising({ paused: true }) : undefined

  const retreat = () =>
    new Promise<void>((resolve) => {
      intro?.kill()
      gsap.killTweensOf(rise)
      if (still) {
        gsap.set(flat, { opacity: 1 })
        return resolve()
      }
      crossing = true
      gsap
        .timeline({ onUpdate: invalidate, onComplete: resolve })
        .to(response, { weight: 0, duration: 0.25, ease: "power1.out" }, 0)
        .to(
          rise,
          {
            depth: (i: number) => behind(i).depth,
            ...TILT,
            duration: 0.6,
            ease: ease.depart,
            stagger: 0.04,
          },
          0,
        )
        .fromTo(flat, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.3)
    })

  let typing = Promise.resolve()
  let latest = ""
  /**
   * Changes the text in place: glyphs drawn the same as before stay where they are, and only the
   * rest rise. Text superseded while waiting is skipped.
   */
  const retext = (next: string) => {
    latest = next
    typing = typing.then(async () => {
      if (next !== latest) return
      const mark = setText(next)
      const kept = sharedGlyphs(cut.mark, mark)
      const recut = cutGlass(mark)
      const swap = recut.pieces.length
        ? await renderer.reshape(recut.pieces, recut.view, recut.fieldOfView)
        : undefined
      if (signal.aborted) return
      relayout(figure, next)
      cut = recut
      rise = cut.glyphs.map((_, i) => (i < kept ? rise[i]! : waiting(i)))
      shaping.abort()
      shaping = new AbortController()
      wobble = respond()
      swap?.()
      fit()
      invalidate()
      if (!appears || kept === cut.glyphs.length) return
      crossing = true
      enter(rising())
    })
  }

  if (!intro) {
    gsap.set(flat, { opacity: 0 })
    return { retreat, retext }
  }
  if (surfacing) intro.to(flat, { opacity: 0, duration: 0.7, ease: "power1.inOut" }, 0.35)
  else intro.fromTo(sweep, { light: 1.2 }, { light: 0, duration: 2.2, ease: ease.arrive }, 0)
  enter(intro)

  onRelease(
    onFirstSight(
      figure,
      { threshold: 0.4 },
      (fromAbove) => void (fromAbove ? intro.progress(1) : intro).play(),
    ),
  )
  return { retreat, retext }
}
