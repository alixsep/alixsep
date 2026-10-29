const TAKEOVER = ["pointerdown", "keydown", "focusin"] as const
const START_MS = 700

/**
 * Plays a figure on its own while it is on screen, so what it does is seen before anyone tries it.
 * Each step yields how long to wait before the next. Any touch or key hands the figure over.
 */
export function demo(figure: HTMLElement, steps: Iterator<number>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const next = () => {
    const step = steps.next()
    if (!step.done) timer = setTimeout(next, step.value)
  }
  const observer = new IntersectionObserver(
    ([entry]) => {
      clearTimeout(timer)
      if (entry!.isIntersecting) timer = setTimeout(next, START_MS)
    },
    { threshold: 0.5 },
  )
  const stop = () => {
    clearTimeout(timer)
    observer.disconnect()
    for (const type of TAKEOVER) figure.removeEventListener(type, stop)
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return stop
  observer.observe(figure)
  for (const type of TAKEOVER) figure.addEventListener(type, stop)
  return stop
}
