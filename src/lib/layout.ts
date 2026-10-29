import { wrapText } from "@/glass/font"

export const heroFrame = "shell pt-[14vh] sm:pt-[18vh]"
export const headerFrame = "shell pt-[12vh] pb-16 sm:pt-[16vh]"
export const space = {
  section: "not-first-of-type:mt-28 sm:not-first-of-type:mt-36",
  block: "mt-16",
  related: "mt-8",
}
export const titleSize =
  "block w-[min(100%,calc(var(--span)*var(--title-height)))] [--title-height:clamp(40px,42px+1.2vw,59px)]"
export const wipe =
  "relative isolate before:absolute before:inset-0 before:-z-10 before:origin-right before:scale-x-0 before:bg-hover before:transition-transform before:duration-700 before:ease-roll hover:before:origin-left hover:before:scale-x-100"

/** Long titles wrap below lg, so no line is set smaller than the longest single word. */
export function titleMarks(title: string) {
  const wrapped = wrapText(title)
  return wrapped === title
    ? [{ text: title, class: "" }]
    : [
        { text: title, class: "max-lg:hidden" },
        { text: wrapped, class: "lg:hidden" },
      ]
}
