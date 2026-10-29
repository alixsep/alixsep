import { getCollection } from "astro:content"

import { releases, studio } from "@/data/music"
import { research } from "@/data/research"
import { getPosts, getWork } from "@/lib/content"
import { formatList, releaseSummary } from "@/lib/format"
import { profiles, site } from "@/site"

import type { APIRoute } from "astro"
import type { CollectionEntry } from "astro:content"

const lines = (...blocks: (string | string[])[]) => blocks.flat().join("\n")
const demoteHeadings = (markdown: string) => markdown.replace(/^#/gm, "##")

export const GET: APIRoute = async ({ site: origin }) => {
  const url = (path: string) => new URL(path, origin).href
  const absoluteLinks = (markdown: string) => markdown.replaceAll("](/", `](${url("/")}`)
  const section = ({ data, body = "" }: CollectionEntry<"pages">) =>
    lines(`## ${data.title}`, "", data.lede, "", absoluteLinks(demoteHeadings(body)).trim())
  const work = await getWork()
  const posts = await getPosts()
  const pages = await getCollection("pages")

  const text = lines(
    `# ${site.fullName} (${site.name})`,
    "",
    `> ${site.description}`,
    "",
    `- Based in: ${site.location}`,
    `- Now: ${site.now}`,
    `- Expertise: ${formatList(site.expertise)}`,
    `- Email: ${site.email}`,
    `- Studio email: ${site.studioEmail}`,
    "",
    pages.map((page) => `${section(page)}\n`),
    "## Research",
    "",
    research.lede,
    "",
    research.interests.map(({ title, text }) => `- ${title}: ${text}`),
    "",
    "Education:",
    research.education.map(
      ({ years, degree, school, details }) =>
        `- ${degree}, ${school} (${years}). ${details.join(" ")}`,
    ),
    "",
    "## Development",
    "",
    work.map(
      ({ id, data }) =>
        `- [${data.title}](${url(`/development/${id}/`)}) (${data.years}): ${data.summary} Built with ${formatList(data.stack)}.`,
    ),
    "",
    "## Music",
    "",
    releases.map(
      (release) =>
        `- [${release.title}](${url(`/music/${release.slug}/`)}): ${releaseSummary(release)}.`,
    ),
    "",
    "## Studio",
    "",
    `Prices are in US dollars. To book, write to ${site.studioEmail}.`,
    studio.map(({ title, services }) =>
      lines(
        "",
        `### ${title}`,
        "",
        services.map(({ title, price, unit, description, includes }) => {
          const extras = includes ? ` Includes: ${includes.join("; ")}.` : ""
          return `- ${title}: $${price} ${unit}. ${description}${extras}`
        }),
      ),
    ),
    "",
    "## Writing",
    "",
    posts.length
      ? posts.map(
          ({ id, data }) => `- [${data.title}](${url(`/writing/${id}/`)}): ${data.description}`,
        )
      : "Nothing published yet.",
    "",
    "## Elsewhere",
    "",
    profiles.map(({ label, href }) => `- [${label}](${href})`),
    "",
  )

  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
