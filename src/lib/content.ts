import { getCollection } from "astro:content"

export async function getWork() {
  const entries = await getCollection("work")
  return entries.sort((a, b) => a.data.order - b.data.order)
}

export async function getPosts() {
  const posts = await getCollection("writing", ({ data }) => import.meta.env.DEV || !data.draft)
  return posts.sort((a, b) => b.data.published.getTime() - a.data.published.getTime())
}
