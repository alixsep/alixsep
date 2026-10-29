import type { SculptureName } from "@/glass/sculptures"

interface Education {
  years: string
  degree: string
  school: string
  details: string[]
  sculpture?: SculptureName
}

const education: Education[] = [
  {
    years: "2023–2026",
    degree: "MSc in Computer Engineering, Software Engineering",
    school: "Amirkabir University of Technology (Tehran Polytechnic)",
    details: [
      "Supervised by Dr. Alireza Bagheri, and co-supervised by Prof. Mohammad Reza Razzazi.",
      "Teaching assistant for Advanced Software Engineering, Fall 2023, where I led hands-on sessions on React, TypeScript, and software testing.",
      "Teaching assistant for Database Design, Winter 2024.",
    ],
    sculpture: "gate",
  },
  {
    years: "2019–2023",
    degree: "BSc in Computer Engineering",
    school: "Azad University, Khorramabad",
    details: [
      "Received the Top Student Award in 2022 for the top rank in the Computer Engineering program.",
    ],
    sculpture: "mortarboard",
  },
  {
    years: "2011–2018",
    degree: "High school diploma, Experimental Sciences",
    school: "NODET (Sampad) Shahid Beheshti School, Khorramabad",
    details: [
      "Middle and high school at NODET, Iran’s schools for exceptionally talented students.",
      "Admitted with the top rank in Lorestan Province in the final round of the national entrance exam.",
    ],
    sculpture: "sampad",
  },
]

export const research = {
  lede: "Often the hard part is not finding the answer, but asking the right question.",
  interests: [
    {
      id: "methodology",
      title: "Software engineering methodology",
      text: "How intent becomes working software, and which practices hold up when they are examined rather than assumed.",
    },
    {
      id: "specifications",
      title: "Executable specifications",
      text: "Specifications that people can read, that run as tests, and that yield formal models from the same source.",
    },
    {
      id: "mathematics",
      title: "Discrete mathematics",
      text: "Graph theory and finite-state machines, the structures underneath processes, workflows, and programs.",
    },
  ],
  current: "",
  education,
} as const
