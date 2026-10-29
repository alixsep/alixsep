import { chromium } from "playwright"

declare global {
  interface Window {
    perf: { frames: number[]; longTasks: number[]; gpu: number[] }
  }
}

export const baseUrl = process.argv[2] ?? "http://localhost:4321/"
export const pixelRatio = Number(process.argv[3] ?? 1)

/** Chromium on the machine's real GPU, which headless mode otherwise swaps for a software one. */
export const launch = () =>
  chromium.launch({ args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist"] })

export function summarize(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b)
  const at = (quantile: number) => sorted[Math.floor(quantile * (sorted.length - 1))] ?? 0
  return `p50 ${at(0.5).toFixed(1)} p95 ${at(0.95).toFixed(1)} max ${at(1).toFixed(1)} (n ${sorted.length})`
}

/** Records frame intervals, long tasks and, when `timeGpu` is set, GPU time per WebGL draw. */
export function instrument({ timeGpu }: { timeGpu: boolean }) {
  window.perf = { frames: [], longTasks: [], gpu: [] }
  let last = performance.now()
  const frame = (time: number) => {
    window.perf.frames.push(time - last)
    last = time
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.perf.longTasks.push(Math.round(entry.duration))
  }).observe({ type: "longtask", buffered: true })

  if (!timeGpu) return
  const TIME_ELAPSED = 0x88bf
  // eslint-disable-next-line @typescript-eslint/unbound-method -- re-invoked with its own `this`
  const draw = WebGL2RenderingContext.prototype.drawArrays
  WebGL2RenderingContext.prototype.drawArrays = function (...args) {
    if (!this.getExtension("EXT_disjoint_timer_query_webgl2")) return draw.apply(this, args)
    const query = this.createQuery()
    this.beginQuery(TIME_ELAPSED, query)
    draw.apply(this, args)
    this.endQuery(TIME_ELAPSED)
    const collect = () => {
      if (!this.getQueryParameter(query, this.QUERY_RESULT_AVAILABLE))
        return requestAnimationFrame(collect)
      window.perf.gpu.push(Number(this.getQueryParameter(query, this.QUERY_RESULT)) / 1e6)
    }
    requestAnimationFrame(collect)
  }
}
