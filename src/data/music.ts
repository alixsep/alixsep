import data from "./releases.json"

import type { ImageMetadata } from "astro"

interface Service {
  title: string
  short?: string
  featured?: boolean
  price: number
  unit: string
  description: string
  includes?: string[]
}

export const studio: { title: string; services: Service[] }[] = [
  {
    title: "Creation",
    services: [
      {
        title: "Song review",
        price: 15,
        unit: "per song",
        description: "Timestamped feedback on your song, with the most important fixes first.",
        includes: [
          "Notes on writing and arrangement",
          "Notes on sound and production",
          "Clear next steps",
          "Usually delivered within three days",
        ],
      },
      {
        title: "Live song review",
        price: 25,
        unit: "per song",
        description:
          "We listen to your song together on a call, and I talk you through what to change.",
        includes: ["Everything in Song review", "A 30-minute call", "Your questions answered"],
      },
      {
        title: "EP review",
        price: 50,
        unit: "for up to five songs",
        description: "Feedback on your EP as one record: every song, and how they work together.",
        includes: [
          "Everything in Song review, for each song",
          "Notes on order and flow",
          "Usually delivered within a week",
        ],
      },
      {
        title: "Mix and master",
        featured: true,
        price: 150,
        unit: "per song",
        description: "Bringing your music to its full potential, ready for release.",
        includes: [
          "Full mix",
          "Final master",
          "Three rounds of revisions",
          "Usually delivered within a week",
        ],
      },
      {
        title: "Vocal production",
        price: 100,
        unit: "per song",
        description: "From raw takes to fully refined vocals, with precision in every detail.",
        includes: [
          "Comping the best takes",
          "Timing and pitch correction",
          "Doubles and harmonies",
          "Three rounds of revisions",
          "Usually delivered within a week",
        ],
      },
      {
        title: "Production",
        price: 250,
        unit: "per song",
        description:
          "Turning your demos and ideas into rich, detailed, and expressive productions.",
        includes: [
          "Arrangement and sound design",
          "Drums, bass, and instruments",
          "Stems for every part",
          "Three rounds of revisions",
          "Usually delivered within two weeks",
        ],
      },
    ],
  },
  {
    title: "Packages",
    services: [
      {
        title: "Full song",
        featured: true,
        price: 425,
        unit: "per song",
        description: "From the first spark of inspiration to a complete, finished release.",
        includes: [
          "Production",
          "Vocal production",
          "Mix and master",
          "Two rounds of revisions at each stage",
          "Usually delivered within four weeks",
        ],
      },
      {
        title: "EP",
        price: 2000,
        unit: "for five songs",
        description: "Five songs brought together into one cohesive, meaningful record.",
        includes: [
          "Five full songs",
          "One master session for the whole record",
          "Three calls to shape the record",
          "Two rounds of revisions at each stage",
          "Usually delivered within three months",
        ],
      },
    ],
  },
  {
    title: "Collaboration",
    services: [
      {
        title: "Feature (on your track)",
        short: "Feature",
        featured: true,
        price: 400,
        unit: "per verse or hook",
        description: "A vocal part written and recorded for your song, as Alixsep.",
        includes: [
          "Original verse or hook",
          "Dry and processed vocal stems",
          "Credit as feat. Alixsep",
          "Usually delivered within two weeks",
        ],
      },
      {
        title: "Feature (on my track)",
        price: 800,
        unit: "per verse or hook",
        description:
          "Your verse on one of my songs, refined together over several rounds. Half is paid to begin, and the rest only once the verse is right for the song and released.",
        includes: ["Several rounds of review", "Credit as a featured artist"],
      },
    ],
  },
  {
    title: "Mastery",
    services: [
      {
        title: "Lesson",
        price: 50,
        unit: "per hour",
        description:
          "Production, mixing, vocals, arrangement, or songwriting, worked on your own music, one to one.",
      },
      {
        title: "Session teardown",
        price: 100,
        unit: "per song",
        description:
          "Send your project file. I fix the weak points on a recorded call and explain every change.",
        includes: ["The fixed session", "The recording of the call"],
      },
      {
        title: "Mentorship",
        featured: true,
        price: 2000,
        unit: "for six months",
        description: "Ongoing guidance for artists and producers building a body of work.",
        includes: [
          "Weekly one-to-one calls",
          "Feedback between calls",
          "A session teardown every month",
          "Release and project planning",
        ],
      },
    ],
  },
]

const images = import.meta.glob<{ default: ImageMetadata }>("../assets/music/*.jpg", {
  eager: true,
})

export interface Track {
  title: string
  seconds: number
  lyrics?: string
}

export interface Release {
  slug: string
  title: string
  artists: string[]
  type: "Album" | "Single"
  date: string
  cover: ImageMetadata
  links: { label: string; href: string }[]
  tracks: Track[]
}

export const releases = (data as Omit<Release, "cover">[]).map((release): Release => ({
  ...release,
  cover: images[`../assets/music/${release.slug}.jpg`]!.default,
}))

function release(slug: string) {
  const found = releases.find((release) => release.slug === slug)
  if (!found) throw new Error(`No release with the slug "${slug}"`)
  return found
}

/** Leave empty to feature the latest release. */
const PICK = ""

export const pick = PICK ? release(PICK) : releases[0]!

export const shelf = releases.slice(0, 5)
