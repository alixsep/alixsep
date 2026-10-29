export type Depth = "3d" | "2d"

const STORAGE_KEY = "depth"
const CHANGE = "depthchange"

export const isFlat = () => document.documentElement.classList.contains("flat")

export function setDepth(depth: Depth) {
  try {
    if (depth === "3d") localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, depth)
  } catch {
    // Storage may be blocked; the choice still applies for this visit.
  }
  document.documentElement.classList.toggle("flat", depth === "2d")
  dispatchEvent(new Event(CHANGE))
}

export function onDepthChange(listener: () => void) {
  addEventListener(CHANGE, listener)
}
