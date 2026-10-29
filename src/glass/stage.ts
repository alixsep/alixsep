import type { Renderer } from "./renderer"

/** Radians the studio lights turn per viewport height scrolled. */
const LIGHT_PER_SCREEN = 1.6
/** Twice the CSS pixels on every screen: on DPR 1 this supersamples shading that otherwise aliases. */
const PIXEL_RATIO = 2
/** Reallocating a canvas is costly, so while a window is dragged the last frame stretches instead. */
const RESIZE_SETTLES_MS = 150

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
const darkScheme = matchMedia("(prefers-color-scheme: dark)")

export const prefersStill = () => reducedMotion.matches

// Measured once per scroll, since reading scrollY after other handlers write styles forces a layout.
let screensScrolled = scrollY / innerHeight
addEventListener("scroll", () => (screensScrolled = scrollY / innerHeight), { passive: true })

export const scrollLight = () => (prefersStill() ? 0 : screensScrolled * LIGHT_PER_SCREEN)

/** Entrances only play for what arrives from below; scrolled back up to, it is already there. */
export function onFirstSight(
  element: Element,
  options: IntersectionObserverInit,
  callback: (fromAbove: boolean) => void,
) {
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return
    observer.disconnect()
    callback(entry.boundingClientRect.top < 0)
  }, options)
  observer.observe(element)
  return observer
}

function isNight() {
  const root = document.documentElement.classList
  return root.contains("dark") || (!root.contains("light") && darkScheme.matches)
}

/**
 * Keeps a renderer in step with its canvas and the page: theme, size, visibility and, while
 * `followScroll` is on, scroll light. Aborting `signal` tears it down and releases the GPU context.
 */
export function stage(
  canvas: HTMLCanvasElement,
  renderer: Renderer,
  draw: () => void,
  signal: AbortSignal,
  { followScroll = true } = {},
) {
  let visible = true
  let scheduled = false
  const observers: { disconnect: () => void }[] = []

  const render = () => {
    scheduled = false
    if (visible) draw()
  }
  const invalidate = () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(render)
  }

  const applyTheme = () => {
    const [r = 0, g = 0, b = 0] = getComputedStyle(document.body)
      .backgroundColor.match(/[\d.]+/g)!
      .map((channel) => Number(channel) / 255)
    renderer.setPage([r, g, b], !isNight())
    invalidate()
  }
  applyTheme()
  const themeWatch = new MutationObserver(applyTheme)
  themeWatch.observe(document.documentElement, { attributeFilter: ["class"] })
  darkScheme.addEventListener("change", applyTheme, { signal })

  let sized = false
  let pendingSize: [width: number, height: number] | null = null
  let settling = 0
  const applySize = () => {
    if (!pendingSize) return
    const [width, height] = pendingSize
    pendingSize = null
    if (width === canvas.width && height === canvas.height) return
    renderer.resize(width, height)
    render()
  }
  const sizeWatch = new ResizeObserver(([entry]) => {
    if (!entry) return
    const { width, height } = entry.contentRect
    pendingSize = [Math.round(width * PIXEL_RATIO), Math.round(height * PIXEL_RATIO)]
    clearTimeout(settling)
    if (!sized) {
      sized = true
      return applySize()
    }
    settling = window.setTimeout(() => visible && applySize(), RESIZE_SETTLES_MS)
  })
  sizeWatch.observe(canvas)

  // Wakes before the canvas scrolls back into view, so its first visible frame is already current.
  const viewWatch = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) {
        applySize()
        invalidate()
      }
    },
    { rootMargin: "50% 0px" },
  )
  viewWatch.observe(canvas)
  observers.push(themeWatch, sizeWatch, viewWatch, { disconnect: () => clearTimeout(settling) })

  if (followScroll && !prefersStill())
    addEventListener("scroll", invalidate, { passive: true, signal })

  const release = () => {
    for (const observer of observers) observer.disconnect()
    renderer.dispose()
  }
  if (signal.aborted) release()
  else signal.addEventListener("abort", release)

  return {
    invalidate,
    /** Sizes the canvas now, for a change that cannot stretch while resizing settles. */
    fit: () => {
      const { width, height } = canvas.getBoundingClientRect()
      pendingSize = [Math.round(width * PIXEL_RATIO), Math.round(height * PIXEL_RATIO)]
      applySize()
    },
    isVisible: () => visible,
    onRelease: (observer: { disconnect: () => void }) => observers.push(observer),
  }
}
