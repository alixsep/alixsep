---
title: Yugilife
summary: High-quality online Yu-Gi-Oh! card maker
years: 2021–now
stack: [TypeScript, React, WebAssembly, SVG]
links:
  - { label: Open Yugilife, href: "https://alixsep.github.io/yugilife/" }
  - { label: Source, href: "https://github.com/alixsep/yugilife" }
order: 1
---

## The problem

How far can a Yu-Gi-Oh! card maker be taken? It looks simple until you try. Konami has been printing
cards for decades, and the details have piled up: layouts, layers, alignment, colors, textures, the
exact place of every element, and the way text sits in its box. A card maker also has to edit images,
keep its templates versioned, and prepare the catalog of official cards, all while staying
customizable and pleasant to use.

Most people still make cards by hand in Photoshop, which is slow and easy to get wrong. Image
generators are no answer either. They rarely give the same result twice, a prompt cannot be trusted
to change one detail and leave the rest, and retraining a model is not something a user can or
should do. Making a decent card maker is easy. Making an exceptional one is not.

## The approach

The renderer knows nothing about Yu-Gi-Oh!. Every card is described by a template, as data, so
correcting a template never means changing code. The website and the command-line tool share that
one renderer, so a script, or an AI agent, can make cards as precisely as a person can.

Cards are drawn as SVG, with the text kept as vector outlines, so a card stays sharp on a laser
printer at any size. At the time of writing, no other Yu-Gi-Oh! card maker exports its text as
vectors.

Card text needs more than plain words: italics, ruby, fine spacing, and deliberate line breaks. A
small markup covers all of them, so the preview and every export render the same.

Printed cards rarely shrink a whole box of text to fit one long line. They condense that line
slightly and leave the rest alone. Yugilife does the same: effect text takes the largest size that
fits, and a line that runs a little long is condensed instead.

Masking artwork for full-art cards runs on your own machine, in WebAssembly. Your images are never
uploaded, and the tool does not depend on a service that could disappear.

## The result

The official catalog is built in, so any existing card can be opened and changed in a moment.
There is no account and no server, and your cards never leave the browser. What I value most is the
community around it, which kept writing to me until I came back to the project.
