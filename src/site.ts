import type { SculptureName } from "@/glass/sculptures"

export const site = {
  name: "Alixsep",
  fullName: "Ali Sepahvand",
  nickname: "Alix",
  url: "https://alixsep.com",
  description:
    "Ali Sepahvand (Alixsep) is a frontend engineer and software engineering researcher in Tehran, who also writes and makes music.",
  city: "Tehran",
  location: "Tehran, Iran",
  timeZone: "Asia/Tehran",
  email: "alixsep@outlook.com",
  studioEmail: "alixsep.music@gmail.com",
  now: "Open to doctoral positions and research collaborations.",
  expertise: [
    "Frontend engineering",
    "Software engineering methodology",
    "Discrete mathematics",
    "Music production",
    "Mixing and mastering",
  ],
  contact: "mailto:alixsep@outlook.com",
}

export const writing = {
  lede: "For anyone who wonders what I think.",
  pending: "Silence has the page, until the words are ready.",
}

export const nav = [
  { href: "/development/", label: "Development" },
  { href: "/research/", label: "Research" },
  { href: "/music/", label: "Music" },
  { href: "/studio/", label: "Studio" },
  { href: "/writing/", label: "Writing" },
  { href: "/about/", label: "About" },
]

export const listen = [
  {
    href: "https://open.spotify.com/artist/3kWMn1CfirJ7VCsyKHkkd0",
    label: "Spotify",
    sculpture: "spotify",
  },
  { href: "https://soundcloud.com/alixsep", label: "SoundCloud", sculpture: "soundcloud" },
  {
    href: "https://music.apple.com/us/artist/alixsep/1492787708",
    label: "Apple Music",
    sculpture: "appleMusic",
  },
  {
    href: "https://www.youtube.com/channel/UCastwuXz7jXiGEPS3yvVQpQ",
    label: "YouTube",
    sculpture: "youtube",
  },
] satisfies { href: string; label: string; sculpture: SculptureName }[]

export const profiles = [
  { href: "https://github.com/alixsep", label: "GitHub" },
  ...listen,
  { href: "https://www.deviantart.com/alixsep", label: "DeviantArt" },
]

export const tour = [{ href: "/", label: "Alix" }, ...nav]
