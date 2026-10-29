import rss from "@astrojs/rss"

import { getPosts } from "@/lib/content"
import { site } from "@/site"

import type { APIRoute } from "astro"

export const GET: APIRoute = async (context) => {
  const posts = await getPosts()
  return rss({
    title: site.name,
    description: site.description,
    site: context.site!,
    items: posts.map(({ id, data }) => ({
      title: data.title,
      description: data.description,
      pubDate: data.published,
      link: `/writing/${id}/`,
    })),
  })
}
