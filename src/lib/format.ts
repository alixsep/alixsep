const WORDS_PER_MINUTE = 230

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

const listFormat = new Intl.ListFormat("en-US")

export const formatDate = (date: Date) => dateFormat.format(date)

export const formatList = (items: string[]) => listFormat.format(items)

export const readingMinutes = (text = "") =>
  Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE))

export const utcOffset = (timeZone: string) =>
  new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts()
    .find((part) => part.type === "timeZoneName")!.value

export const releaseYear = (date: string) => new Date(date).getUTCFullYear()

export const releaseKind = ({ type, date }: { type: string; date: string }) =>
  `${type}, ${releaseYear(date)}`

export const releaseSummary = (release: {
  type: string
  date: string
  artists: string[]
  tracks: unknown[]
}) => {
  const { type, date, artists, tracks } = release
  const count = tracks.length > 1 ? ` with ${tracks.length} tracks` : ""
  return `a ${releaseYear(date)} ${type.toLowerCase()} by ${formatList(artists)}${count}`
}

export const releaseLength = ({ tracks }: { tracks: { seconds: number }[] }) => {
  const seconds = tracks.reduce((total, track) => total + track.seconds, 0)
  const minutes = `${Math.max(1, Math.round(seconds / 60))} min`
  return tracks.length > 1 ? `${tracks.length} tracks · ${minutes}` : minutes
}

export const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

export const isoDuration = (seconds: number) => `PT${Math.floor(seconds / 60)}M${seconds % 60}S`
