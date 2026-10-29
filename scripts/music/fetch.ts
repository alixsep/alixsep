import { existsSync, writeFileSync } from "node:fs"

import { openProfile } from "./browser.ts"

const ARTIST = {
  name: "Alixsep",
  apple: 1492787708,
  spotify: "3kWMn1CfirJ7VCsyKHkkd0",
  soundcloud: "alixsep",
  genius: 1907218,
  youtube: "UCastwuXz7jXiGEPS3yvVQpQ",
}
const HIDDEN = new Set(["Daylight"])
const SOUNDCLOUD_ELSEWHERE = new Map([
  ["The Statement", "https://soundcloud.com/prokyonmusic/thestatement"],
])
const DATA = new URL("../../src/data/releases.json", import.meta.url).pathname
const COVERS = new URL("../../src/assets/music/", import.meta.url).pathname

interface Item {
  wrapperType: string
  collectionType: string
  collectionId: number
  collectionName: string
  collectionViewUrl: string
  artistName: string
  artworkUrl100: string
  releaseDate: string
  discNumber: number
  trackNumber: number
  trackName: string
  trackTimeMillis: number
}
interface Lookup {
  results: Item[]
}
interface GeniusPage {
  response: { songs: { title: string; url: string }[]; next_page: number | null }
}
const lookup = async (query: string): Promise<Lookup> =>
  (await fetch(`https://itunes.apple.com/lookup?${query}`)).json() as Promise<Lookup>

const key = (title: string) =>
  title
    .replace(/\*\*/g, "uc")
    .replace(/\s*\[.*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
const slugOf = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const context = await openProfile(true)
await context.addCookies([{ name: "SOCS", value: "CAI", domain: ".youtube.com", path: "/" }])
const page = context.pages()[0] ?? (await context.newPage())

const harvest = async (url: string, pattern: string, rounds = 30) => {
  await page.goto(url, { waitUntil: "load" })
  await page.waitForTimeout(6000)
  const found = new Map<string, string>()
  for (let round = 0; round < rounds; round++) {
    for (const [title, href] of await page.evaluate(pick, pattern)) found.set(key(title), href)
    await page.mouse.move(650, 600)
    await page.mouse.wheel(0, 1200)
    await page.waitForTimeout(500)
  }
  return found
}

const pick = (pattern: string) =>
  [...document.querySelectorAll("a")]
    .filter((anchor) => new RegExp(pattern).test(anchor.href))
    .map((anchor): [string, string] => [
      (anchor.title || anchor.textContent || "").trim(),
      anchor.href,
    ])

const spotify = await harvest(
  `https://open.spotify.com/artist/${ARTIST.spotify}/discography/all`,
  "/album/",
)
const soundcloudTracks = await harvest(
  `https://soundcloud.com/${ARTIST.soundcloud}/tracks`,
  `soundcloud.com/${ARTIST.soundcloud}/[a-z0-9-]+$`,
)
const soundcloudSets = await harvest(`https://soundcloud.com/${ARTIST.soundcloud}/albums`, "/sets/")
const youtube = await harvest(
  `https://www.youtube.com/channel/${ARTIST.youtube}/releases`,
  "watch\\?v=.*list=OLAK",
  8,
)

await page.goto("https://genius.com/artists/" + ARTIST.name)
await page.waitForTimeout(6000)
const lyrics = new Map<string, string>()
for (let next: number | null = 1; next;) {
  const { response }: GeniusPage = await page.evaluate(
    async ([id, number]): Promise<GeniusPage> =>
      (
        await fetch(`/api/artists/${id}/songs?per_page=50&page=${number}`)
      ).json() as Promise<GeniusPage>,
    [ARTIST.genius, next],
  )
  for (const song of response.songs) lyrics.set(key(song.title), song.url)
  next = response.next_page
}
await context.close()

const { results } = await lookup(`id=${ARTIST.apple}&entity=album&limit=200`)
const albums = results
  .filter((result) => result.collectionType === "Album")
  .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))

const releases = []
for (const album of albums) {
  const title = album.collectionName.replace(/ - Single$/, "")
  if (HIDDEN.has(title)) continue
  const slug = slugOf(title)
  const songs = (await lookup(`id=${album.collectionId}&entity=song`)).results
    .filter((result) => result.wrapperType === "track")
    .sort((a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber)
  const youtubeLink = youtube.get(key(title))
  const links = [
    ["Spotify", spotify.get(key(title))],
    ["Apple Music", album.collectionViewUrl.replace(/\?.*/, "")],
    [
      "SoundCloud",
      soundcloudSets.get(key(title)) ??
        (songs.length === 1 ? soundcloudTracks.get(key(title)) : undefined) ??
        SOUNDCLOUD_ELSEWHERE.get(title),
    ],
    [
      "YouTube",
      youtubeLink &&
        "https://www.youtube.com/playlist?list=" + new URL(youtubeLink).searchParams.get("list"),
    ],
  ]
    .filter((link): link is [string, string] => Boolean(link[1]))
    .map(([label, href]) => ({ label, href }))
  releases.push({
    slug,
    title,
    artists: album.artistName.split(/, | & /),
    type: album.collectionName.endsWith(" - Single") ? "Single" : "Album",
    date: album.releaseDate.slice(0, 10),
    links,
    tracks: songs.map((song) => ({
      title: song.trackName,
      seconds: Math.round(song.trackTimeMillis / 1000),
      ...(lyrics.has(key(song.trackName)) && { lyrics: lyrics.get(key(song.trackName)) }),
    })),
  })
  if (!existsSync(`${COVERS}${slug}.jpg`)) {
    const cover = await fetch(album.artworkUrl100.replace("100x100bb", "1200x1200bb"))
    writeFileSync(`${COVERS}${slug}.jpg`, Buffer.from(await cover.arrayBuffer()))
  }
}

writeFileSync(DATA, JSON.stringify(releases, null, 2) + "\n")
console.log(`${releases.length} releases written to src/data/releases.json`)
