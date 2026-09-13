# From Push to Pickup — The Anatomy of a Flutter VoIP Call

Slides for FlutterCon Berlin, Oct 2026. No deck framework — Vite + React + MDX +
Motion + Shiki, which is where the React ecosystem actually landed for talks.

```bash
npm install
npm run dev        # http://localhost:5273
```

## Writing slides

One file per slide in [src/slides/](src/slides/), ordered by filename. Numbers
step by 10 so you can insert without renaming everything.

```mdx
---
title: Android has no contract
subtitle: …which is worse
layout: default        # title | section | default | full | quote | end
theme: dark            # dark | light — light is the site's white section
notes: |
  Only the presenter window sees this.
---

<F>Revealed on the first click.</F>
<F>Then this one.</F>
```

Everything in [src/deck/mdxComponents.tsx](src/deck/mdxComponents.tsx) is
available in MDX without an import: `F`, `Cols`, `Box`, `Big`, `Stat`, `Tag`,
`Flow`, `Step`, `Code`, `CodeMorph`, plus the site-style layouts `Cards`/`Card`,
`Bento`, `List`/`Item`, `Split`/`Panel`, `Rail`/`Milestone`, `Note`, `Hl`,
`Pill`, `Speaker`, `ConfBar`, `Logo`, `HeroArt`.

Slides 030–120 are ten designs of the same "why this is interesting" content —
keep one, delete the rest (or mark them `draft: true`).

### Fragments

`<F>` auto-numbers in document order. Pin several to the same click with `at`:

```mdx
<F at={1}>left</F>
<F at={1}>right — same click</F>
```

Modes: `enter` (default, slides up), `fade` (dims in place, keeps layout),
`hide` (unmounts until revealed).

Cards can step without `<F>`: give each `<Card at={n}>`. Everything stays on
screen — cards ahead of the current step are dimmed, the current one carries
the brand gradient, cards behind it are plain.

- In a `<Bento rows={[3, 2]}>` the current card also *grows in place* into a
  square spanning the block's full height (at the left edge, right edge or
  centre, matching its place in the row); the other cards re-pack, in order,
  into an even grid beside it. Nothing changes order. Small cards show only number +
  title; give a card `detail="…"` for the copy that fades in once it has
  finished growing.
- In a `<Cards>` grid nothing moves; a single gradient slab springs from card
  to card and the lit card pops a little.

### Code

Plain fences are highlighted with Shiki. For a walkthrough, focus line ranges
one click at a time:

```mdx
<Code lang="swift" title="AppDelegate.swift" marks="1-6|8-13|15-17" code={`…`} />
```

For a refactor that morphs token by token, give `CodeMorph` one string per
state — each state after the first costs a click:

```mdx
<CodeMorph lang="dart" steps={[`before`, `after`, `final`]} />
```

Languages are bundled explicitly in
[src/deck/highlighter.ts](src/deck/highlighter.ts) — add yours there.

## Presenting

| key | |
| --- | --- |
| `→` `space` `n` | next step / slide |
| `←` `p` | back |
| `s` | open the presenter window (notes, next slide, timer) |
| `o` | slide overview, click to jump |
| `b` or `.` | blackout |
| `f` | fullscreen |
| `Home` / `End` | first / last slide |

The presenter window and the audience window stay in sync over
`BroadcastChannel` — put one on each screen. The position also lives in the URL
hash (`#/6/2`), so a reload lands you exactly where you were.

## Export

```bash
npm run pdf                       # needs: npm i -D playwright
```

Or open `/?print` and use the browser's Save as PDF — landscape, no margins,
background graphics on.

## Design notes

- The stage is a fixed **1280×720** canvas scaled to fit, so every size is in
  real px and the projector renders exactly what your laptop did.
- Brand palette lives in [src/styles/theme.css](src/styles/theme.css) and is
  lifted from [nextappcon.com/fluttercon](https://www.nextappcon.com/fluttercon):
  pink `#ff55e7`, blue `#008bff`, ink `#171717`.
- Fonts match the site — Wix Madefor Display (headlines) and Familjen Grotesk
  (bold-caps eyebrows) — self-hosted as variable woff2 in `public/fonts/`, so
  nothing is fetched on conference wi-fi.
- The `title` / `end` layouts recreate the site hero: `<ConfBar />`,
  `<Logo />`, `<HeroArt />` and `<Speaker name role />` are absolutely
  positioned, the frontmatter `subtitle` becomes the eyebrow above the title.
  Brand images live in `public/brand/`.
