import { gsap } from "gsap"

import { ease } from "@/lib/motion"

const HIDDEN = { opacity: 0, y: 28 }
const RISE = {
  opacity: 1,
  y: 0,
  duration: 1.1,
  ease: ease.arrive,
  stagger: 0.07,
  clearProps: "transform",
}
const DRAW = { duration: 1.2, ease: "expo.inOut" }

const targets = document.querySelectorAll<HTMLElement>(
  "[data-reveal], [data-reveal-children] > *, [data-reveal-line]",
)
const below = [...targets].filter((element) => element.getBoundingClientRect().top > innerHeight)
const isLine = (element: Element) => element.hasAttribute("data-reveal-line")

/** GSAP warns on an empty target, so a group with nothing in it is skipped. */
function animate(elements: Element[], line: gsap.TweenVars, block: gsap.TweenVars) {
  const lines = elements.filter(isLine)
  const blocks = elements.filter((element) => !isLine(element))
  if (lines.length) gsap.to(lines, line)
  if (blocks.length) gsap.to(blocks, block)
}

if (below.length && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const instantly = { duration: 0, immediateRender: true }
  animate(below, { scaleX: 0, ...instantly }, { ...HIDDEN, ...instantly })

  const observer = new IntersectionObserver(
    (entries) => {
      const arrived = entries
        .filter(({ isIntersecting }) => isIntersecting)
        .map(({ target }) => target)
      for (const target of arrived) observer.unobserve(target)
      animate(arrived, { scaleX: 1, ...DRAW }, RISE)
    },
    { rootMargin: "0px 0px -8% 0px" },
  )
  for (const element of below) observer.observe(element)
}
