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
layout: default        # title | card | section | default | full | quote | end
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
`Bento`, `Orb`, `Route`/`Stop`, `Pick`, `Tiles`/`Tile`, `Hops`, `List`/`Item`, `Split`/`Panel`, `Rail`/`Milestone`,
`Checklist`/`Check`, `Deadline`, `Phones`, `Note`, `Hl`, `Pill`, `Speaker`,
`ConfBar`, `Logo`, `HeroArt`, `Brick`, `BrickGallery`, and the speaker-card
pieces `Brand`, `Avatar`, `Byline`, `ConfStrip`, `Gate`.

The talk runs 010–130. After it: 700 is a blank, 710–712 the brick pick list,
and 800–890 ten other designs of the "why this is interesting" content, kept
for reference.

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

- `<Spotlight title="…" eyebrow="…" box="left|right">` (no frontmatter
  `title`): a fixed gradient box on one side, the cards as fixed bars on the
  other. The box
  opens with the slide title; the first step hands the title to the top of
  the slide, lights bar 01 and shows its `detail` in the box; each step walks
  the highlight down. Nothing moves. Give the cards `bullets={[…]}` and the
  Spotlight `bullets="list|numbered|ticks|chips|steps|rail|big|hero"` to show
  them in the box under the detail (`big` and `hero` replace it; `steps`
  reveals one per click, so space the cards' `at` values: 1, 5, 9 …). A card's
  own `bulletStyle="…"` overrides the Spotlight's. The box background is a
  pointer-chasing pink blob on a blue base; `<Orb />` puts the same thing
  behind a whole section slide, and `<Route title>` with `<Stop title>` children
  makes the orb fly from ring to ring, one click each, after a poster opening,
  under a fog of war (`Fog`) with the blob riding above it (`Lamp`).
  `<Pick>` shows one child per click, for choosing between designs in place.
- `<Bento>` variants for the same cards: `stack="right"` (square left, bars
  right, two cards swap per step), one row (default, an accordion) or
  `rows={[3, 2]}` (the lit card grows out of its own spot). Small cards show only number +
  title; give a card `detail="…"` for the copy that fades in once it has
  finished growing.
- Any `<Card brick="slope 2x2" />` gets an isometric LEGO-brick outline at its
  right end, every shape scaled to the same square. Names are the catalogue in
  [src/deck/Brick.tsx](src/deck/Brick.tsx) (`brick 2x4`, `plate 4x4`, `round 2x2`,
  `cone 1x1`, `dome 2x2`, `slope 1x3`, `corner 2x2`, `arch 1x4`, `wheel`,
  `minifig head` … 90 in all) or plain `WxL` / `WxLp`. Slides 031–033 are a
  numbered pick list (`<BrickGallery from to />`); drop them once chosen.
- In a `<Cards>` grid nothing moves; a single gradient slab springs from card
  to card and the lit card pops a little. `height={250}` stops the grid from
  taking the whole slide when the cards are short. `<Card art={<Phones />}>`
  puts an illustration between the title and the body.
- `<Tiles cols="1fr 1fr" rows="1fr 1fr">` is the same slab on a free-form
  grid: wrap each card in `<Tile area="1 / 2 / 3 / 3">` (grid-area) — the UI
  slide's tall iOS card next to two Android ones, or the push → steps → UI
  layout. `<Hops>` is a row of cards with a chevron between each pair.
- `<Checklist>` / `<Check>`: big lines whose box ticks with the gradient on
  its click. `<Deadline laps={3} value="30 s" label="then voicemail" />`: a
  track that fills one lap per click and lights the figure on its own click.

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
  (bold-caps eyebrows) — plus Inter for the `card` layout, all self-hosted as
  variable woff2 in `public/fonts/`, so nothing is fetched on conference wi-fi.
- The `card` layout is the official speaker card (`speaker-card-landscape-
  1200x628.png` from the organisers) rebuilt on the stage: ink boxes were
  measured on the PNG, x and sizes scale by 1280/1200, y positions by 720/628.
  Type is Inter Bold 44.8/40.7/38.4 px and Inter Medium 31.3 px in the strip.
  `<Brand />`, `<Avatar src />`, `<Byline first last role />` (optional `company`),
  `<ConfStrip />` and `<Gate />` are absolutely positioned; the frontmatter
  `title` is the headline. `public/brand/speaker-vasyl.png` (round halftone
  portrait) and `brandenburg-gate.png` (white dots with alpha) are cropped out
  of the card itself.
- The `title` / `end` layouts recreate the site hero: `<ConfBar />`,
  `<Logo />`, `<HeroArt />` and `<Speaker name role />` are absolutely
  positioned, the frontmatter `subtitle` becomes the eyebrow above the title.
  Brand images live in `public/brand/`.
