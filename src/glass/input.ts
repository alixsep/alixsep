import { gsap } from "gsap"

/** Radians of turn per degree the phone tilts. */
const TILT_GAIN = 0.012
const TILT_LIMIT = 0.35
/** How quickly a phone's resting posture becomes the new neutral. */
const RECENTER_SECONDS = 3

export type Point = readonly [x: number, y: number]

/** The pointer on the plane z = 0 of a canvas framed to `view` world units. */
export function pointerInWorld(
  canvas: HTMLCanvasElement,
  view: { width: number; height: number },
  { clientX, clientY }: PointerEvent,
): Point {
  const box = canvas.getBoundingClientRect()
  return [
    ((clientX - box.left) / box.width - 0.5) * view.width,
    (0.5 - (clientY - box.top) / box.height) * view.height,
  ]
}

/** Calls back with the phone's tilt away from how it is being held. iOS asks on the first tap. */
export function watchTilt(signal: AbortSignal, onTilt: (pitch: number, yaw: number) => void) {
  if (!matchMedia("(hover: none)").matches || !("DeviceOrientationEvent" in window)) return

  const listen = () => {
    let neutral: { beta: number; gamma: number; time: number } | null = null
    const handle = ({ beta, gamma }: DeviceOrientationEvent) => {
      if (beta === null || gamma === null) return
      const time = performance.now()
      neutral ??= { beta, gamma, time }
      const settle = Math.min(1, (time - neutral.time) / 1000 / RECENTER_SECONDS)
      neutral = {
        beta: neutral.beta + (beta - neutral.beta) * settle,
        gamma: neutral.gamma + (gamma - neutral.gamma) * settle,
        time,
      }
      onTilt(
        gsap.utils.clamp(-TILT_LIMIT, TILT_LIMIT, (neutral.beta - beta) * TILT_GAIN),
        gsap.utils.clamp(-TILT_LIMIT, TILT_LIMIT, (gamma - neutral.gamma) * TILT_GAIN),
      )
    }
    addEventListener("deviceorientation", handle, { signal })
  }

  const permission = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<PermissionState>
  }
  if (!permission.requestPermission) return listen()
  addEventListener(
    "pointerup",
    () => void permission.requestPermission?.().then((state) => state === "granted" && listen()),
    { once: true, signal },
  )
}
