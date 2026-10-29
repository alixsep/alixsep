import { isFlat, onDepthChange } from "@/lib/depth"

import { nextFrame } from "./renderer"

/** GPU contexts the page holds at once, short of where browsers start dropping the oldest. */
const BUDGET = matchMedia("(pointer: coarse)").matches ? 6 : 12
/** Glass comes up this far ahead of the viewport, and beyond it is first to give its context up. */
const NEAR = "100% 0px"

interface Live {
  retreat?: () => Promise<void>
}

export interface Glass<T extends object> {
  /** Brings the glass up; aborting `signal` must release its GPU context. */
  mount: (signal: AbortSignal) => Promise<T | undefined | void>
  /** Shows the flat look again once the glass is gone. */
  restore: () => void
}

interface Tenant {
  element: Element
  glass: Glass<object>
  near: boolean
  controller?: AbortController | undefined
  live?: Live | undefined
}

const tenants = new Map<Element, Tenant>()
let draining = false

const idle = () => new Promise((resolve) => requestIdleCallback(resolve, { timeout: 300 }))

/** How far the element sits outside the viewport; zero once any of it is in view. */
const distance = ({ element }: Tenant) => {
  const { top, bottom } = element.getBoundingClientRect()
  return Math.max(top - innerHeight, -bottom, 0)
}

const holding = () => [...tenants.values()].filter((tenant) => tenant.controller)

function release(tenant: Tenant) {
  const { controller } = tenant
  if (!controller) return
  tenant.controller = undefined
  tenant.live = undefined
  controller.abort()
  tenant.glass.restore()
}

/** Frees a context for `tenant` if the budget is spent, taking it from glass farther out of view. */
function makeRoom(tenant: Tenant) {
  const held = holding()
  if (held.length < BUDGET) return true
  const farthest = held.sort((a, b) => distance(b) - distance(a))[0]!
  if (distance(farthest) <= distance(tenant)) return false
  release(farthest)
  return true
}

async function mount(tenant: Tenant) {
  const controller = (tenant.controller = new AbortController())
  try {
    const live = await tenant.glass.mount(controller.signal)
    if (tenant.controller === controller) tenant.live = live ?? undefined
  } catch {
    release(tenant)
    tenant.near = false
  }
}

/**
 * Bringing glass up costs a GPU context, a shader link and a first trace. Mounts therefore run
 * one at a time in idle moments, nearest the viewport first, so no frame pays for two.
 */
async function drain() {
  if (draining) return
  draining = true
  for (;;) {
    await idle()
    const next = [...tenants.values()]
      .filter((tenant) => tenant.near && !tenant.controller && !isFlat())
      .sort((a, b) => distance(a) - distance(b))[0]
    if (!next || !makeRoom(next)) break
    await mount(next)
    await nextFrame()
  }
  draining = false
}

const watch = new IntersectionObserver(
  (entries) => {
    for (const { target, isIntersecting } of entries) tenants.get(target)!.near = isIntersecting
    void drain()
  },
  { rootMargin: NEAR },
)

onDepthChange(() => {
  if (!isFlat()) return void drain()
  for (const tenant of tenants.values()) {
    const { controller, live } = tenant
    if (!controller) continue
    void Promise.resolve(live?.retreat?.()).then(() => {
      if (tenant.controller !== controller) return
      release(tenant)
      void drain()
    })
  }
})

/**
 * Keeps glass on `element` while it is near the viewport, the page is in 3D and the GPU budget
 * allows; otherwise the element shows its flat look.
 */
export function holdGlass<T extends object>(element: Element, glass: Glass<T>) {
  const tenant: Tenant = { element, glass, near: false }
  tenants.set(element, tenant)
  watch.observe(element)

  // A context the browser takes back stays flat until the element next comes near.
  element.addEventListener(
    "webglcontextlost",
    () => {
      if (!tenant.controller) return
      release(tenant)
      tenant.near = false
      void drain()
    },
    { capture: true },
  )

  return {
    live: () => tenant.live as T | undefined,
    /** Rebuilds the glass, for when what it is cut from has changed. */
    reset() {
      if (tenant.controller) release(tenant)
      else glass.restore()
      void drain()
    },
  }
}
