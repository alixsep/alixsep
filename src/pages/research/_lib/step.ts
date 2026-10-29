export interface StepArgument {
  kind: "int" | "float" | "string"
  value: string
}

export interface Step {
  keyword: string
  expression: string
  arguments: StepArgument[]
}

const KEYWORDS = ["Given", "When", "Then", "And", "But"]
const ARGUMENT = /"[^"]*"|(?<![\w.])-?\d+(?:\.\d+)?(?![\w.])/g

/** Reads a Gherkin step the way Cucumber matches it: a keyword, an expression, and its arguments. */
export function parseStep(line: string): Step | undefined {
  const [keyword = "", ...words] = line.trim().split(/\s+/)
  if (!KEYWORDS.includes(keyword)) return
  const found: StepArgument[] = []
  const expression = words.join(" ").replace(ARGUMENT, (value) => {
    const kind = value.startsWith('"') ? "string" : value.includes(".") ? "float" : "int"
    found.push({ kind, value })
    return `{${kind}}`
  })
  return { keyword, expression, arguments: found }
}
