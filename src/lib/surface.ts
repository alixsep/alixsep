const MAX_LEVEL = 8

const backgrounds = [
  "bg-surface-1",
  "bg-surface-2",
  "bg-surface-3",
  "bg-surface-4",
  "bg-surface-5",
  "bg-surface-6",
  "bg-surface-7",
  "bg-surface-8",
]

const shadows = [
  "shadow-surface-1",
  "shadow-surface-2",
  "shadow-surface-3",
  "shadow-surface-4",
  "shadow-surface-5",
  "shadow-surface-6",
  "shadow-surface-7",
  "shadow-surface-8",
]

export const clampLevel = (level: number) => Math.round(Math.min(Math.max(level, 1), MAX_LEVEL))

export function surfaceClasses(level: number, shadowLevel?: number) {
  const background = backgrounds[clampLevel(level) - 1]!
  return shadowLevel ? `${background} ${shadows[clampLevel(shadowLevel) - 1]}` : background
}

export const card = surfaceClasses(2)
