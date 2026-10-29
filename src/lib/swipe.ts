/** Pixels a press travels before it counts as a swipe rather than a click. */
const SLOP = 10

interface Swipe {
  /** `travel` is the pixels moved rightward since the press. */
  move: (travel: number) => void
  /** `speed` is in pixels per millisecond, and zero when the browser took the gesture over. */
  release: (travel: number, speed: number) => void
}

/** Reports sideways drags across `element` by finger, pen or mouse, leaving vertical ones to scroll the page. */
export function onSwipe(element: HTMLElement, { move, release }: Swipe) {
  let press: { id: number; x: number; y: number } | undefined
  let travel = 0
  let speed = 0
  let time = 0
  let swiped = false

  Object.assign(element.style, { touchAction: "pan-y", userSelect: "none" })

  element.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || press) return
    press = { id: event.pointerId, x: event.clientX, y: event.clientY }
    travel = speed = 0
    time = event.timeStamp
    swiped = false
  })

  element.addEventListener("pointermove", (event) => {
    if (event.pointerId !== press?.id) return
    const moved = event.clientX - press.x
    if (!swiped) {
      const across = Math.abs(moved) > Math.abs(event.clientY - press.y)
      if (Math.abs(moved) < SLOP || !across) return
      swiped = true
      element.setPointerCapture(press.id)
      element.style.cursor = "grabbing"
    }
    if (event.timeStamp > time) speed = (moved - travel) / (event.timeStamp - time)
    time = event.timeStamp
    travel = moved
    move(travel)
  })

  const end = (event: PointerEvent) => {
    if (event.pointerId !== press?.id) return
    press = undefined
    element.style.cursor = ""
    if (swiped) release(travel, event.type === "pointerup" ? speed : 0)
  }
  element.addEventListener("pointerup", end)
  element.addEventListener("pointercancel", end)

  element.addEventListener("dragstart", (event) => event.preventDefault())
  element.addEventListener(
    "click",
    (event) => {
      if (!swiped || event.detail === 0) return
      event.preventDefault()
      event.stopPropagation()
    },
    { capture: true },
  )
}
