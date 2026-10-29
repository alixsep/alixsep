import { CAP_HEIGHT, setText } from "./font"
import { framePad } from "./geometry"
import { sketchStrokes } from "./sketch"

import type { Mark } from "./font"

/** One group per glyph: its pieces filled for flat type, and its outline for drawing on. */
export function flatMarkup(mark: Mark) {
  return mark.glyphs
    .map((glyph) => {
      const pieces = glyph.map((polygon) => `<polygon points="${polygon.join(" ")}"/>`).join("")
      const strokes = sketchStrokes(glyph)
        .map((path) => `<path class="sketch" pathLength="1" d="${path}"/>`)
        .join("")
      return `<g>${pieces}${strokes}</g>`
    })
    .join("")
}

export const markRatio = (text: string) => {
  const { width, height } = setText(text)
  return width / height
}

export function figureLayout(mark: Mark) {
  const padX = (framePad / mark.width) * 100
  const padY = (framePad / mark.height) * 100
  return {
    ratio: mark.width / mark.height,
    span: mark.width / CAP_HEIGHT,
    viewBox: `0 0 ${mark.width} ${mark.height}`,
    markup: flatMarkup(mark),
    canvas: {
      left: `${-padX}%`,
      top: `${-padY}%`,
      width: `${100 + padX * 2}%`,
      height: `${100 + padY * 2}%`,
    },
  }
}

/** Sets the figure's proportions, flat mark and canvas frame to `text`, keeping the canvas. */
export function relayout(figure: HTMLElement, text: string) {
  const layout = figureLayout(setText(text))
  figure.dataset.text = text
  figure.style.setProperty("--ratio", String(layout.ratio))
  figure.style.setProperty("--span", String(layout.span))

  const flat = figure.querySelector("svg")!
  flat.setAttribute("viewBox", layout.viewBox)
  flat.innerHTML = layout.markup
  Object.assign(figure.querySelector("canvas")!.style, layout.canvas)
}

/** The canvas is replaced because the old mount released its context; mount again afterwards. */
export function recut(figure: HTMLElement, text: string) {
  relayout(figure, text)
  figure.querySelector("svg")!.removeAttribute("style")
  const canvas = figure.querySelector("canvas")!
  const fresh = canvas.cloneNode() as HTMLCanvasElement
  fresh.style.opacity = ""
  canvas.replaceWith(fresh)
}
