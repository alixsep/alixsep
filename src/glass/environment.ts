const WIDTH = 512
const HEIGHT = 256

const tone = { base: "#4e4e4e", deep: "#1c1c1c", bar: "#d8d8d8", hot: "#ffffff", dim: "#2e2e2e" }

/**
 * An equirectangular studio the glass refracts but never shows. Hard-edged bands give the
 * interior something to break apart; vertical bars give upright faces structure as they turn.
 */
function paintStudio() {
  const canvas = document.createElement("canvas")
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext("2d")!

  const sky = context.createLinearGradient(0, 0, 0, HEIGHT)
  sky.addColorStop(0, tone.bar)
  sky.addColorStop(0.38, tone.base)
  sky.addColorStop(0.52, tone.dim)
  sky.addColorStop(1, tone.deep)
  context.fillStyle = sky
  context.fillRect(0, 0, WIDTH, HEIGHT)

  const band = (y: number, height: number, color: string) => {
    context.fillStyle = color
    context.fillRect(0, y, WIDTH, height)
  }
  band(18, 26, tone.hot)
  band(70, 10, tone.bar)
  band(120, 5, tone.bar)
  band(150, 34, tone.deep)
  band(205, 8, tone.dim)
  band(210, 26, tone.bar)

  const glow = (x: number, y: number, radius: number, alpha: number) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgb(255 255 255 / ${alpha})`)
    gradient.addColorStop(1, "rgb(255 255 255 / 0)")
    context.fillStyle = gradient
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  glow(120, 40, 78, 1)
  glow(390, 96, 52, 0.9)
  glow(250, 20, 40, 1)
  glow(300, 226, 66, 0.5)

  const bars: [x: number, width: number, color: string][] = [
    [26, 62, tone.hot],
    [150, 30, tone.bar],
    [232, 78, tone.hot],
    [338, 22, tone.bar],
    [402, 54, tone.deep],
    [476, 26, tone.bar],
  ]
  context.globalAlpha = 0.85
  for (const [x, width, color] of bars) {
    const gradient = context.createLinearGradient(x, 0, x + width, 0)
    gradient.addColorStop(0, "rgb(255 255 255 / 0)")
    gradient.addColorStop(0.5, color)
    gradient.addColorStop(1, "rgb(255 255 255 / 0)")
    context.fillStyle = gradient
    context.fillRect(x, 0, width, HEIGHT)
  }

  return canvas
}

let studio: HTMLCanvasElement | undefined

export function bakeEnvironment() {
  studio ??= paintStudio()
  return studio
}
