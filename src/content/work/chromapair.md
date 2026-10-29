---
title: Chromapair
summary: Reference-based image color-matching CLI tool
years: "2026"
stack: [Python, Color science, CIEDE2000]
links:
  - { label: Source, href: "https://github.com/alixsep/chromapair" }
order: 3
---

## The problem

Matching an image’s color to a reference is usually done by eye, one image at a time. It rests on
judgment, so the result cannot be measured, repeated, or reused.

## The approach

Chromapair learns a fixed transform from the areas that line up between a source image and a
reference. It tries two kinds of model, three 256-entry lookup tables or a regularized RGB
polynomial, and keeps whichever has the lower error under four-fold cross-validation, measured in
CIEDE2000.

It does not depend on what the images show or how they are laid out. A smaller source can sit inside
a larger reference, several separate areas can be fitted at once, and the tile size used for
averaging is chosen for you.

## The result

What comes out is a validated JSON file that can be applied from the command line or from Python, to
one image or a whole batch. A color decision becomes something you can version, share, and use
again.
