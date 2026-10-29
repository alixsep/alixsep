import { baseUrl, instrument, launch, pixelRatio, summarize } from "./browser.ts"

const browser = await launch()

for (const throttle of [1, 4, 16]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: pixelRatio,
  })
  const page = await context.newPage()
  const devtools = await context.newCDPSession(page)
  await devtools.send("Performance.enable")
  await devtools.send("Emulation.setCPUThrottlingRate", { rate: throttle })
  await page.addInitScript(instrument, { timeGpu: throttle === 1 })

  await page.goto(baseUrl, { waitUntil: "load" })
  await page.waitForTimeout(3000)
  const loading = await page.evaluate(() => window.perf.longTasks.splice(0))
  await page.evaluate(() => window.perf.frames.splice(0))

  const distance = await page.evaluate(
    () => document.documentElement.scrollHeight - innerHeight * 3,
  )
  const steps = 90
  for (let step = 0; step < steps; step++) {
    await page.mouse.wheel(0, distance / steps)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(800)

  const scrolling = await page.evaluate(() => window.perf)
  const { metrics } = await devtools.send("Performance.getMetrics")
  const heap = metrics.find((metric) => metric.name === "JSHeapUsedSize")!.value / 1e6

  console.log(`CPU ${throttle}x, pixel ratio ${pixelRatio}`)
  console.log(`  frames while scrolling  ${summarize(scrolling.frames)}`)
  console.log(`  long tasks at load      ${JSON.stringify(loading)}`)
  console.log(`  long tasks scrolling    ${JSON.stringify(scrolling.longTasks)}`)
  if (scrolling.gpu.length) console.log(`  GPU ms per draw         ${summarize(scrolling.gpu)}`)
  console.log(`  JS heap                 ${heap.toFixed(1)} MB`)
  await context.close()
}

await browser.close()
