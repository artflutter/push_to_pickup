# Working on this deck

Vite + React + MDX slides for the FlutterCon Berlin 2026 talk "From Push to
Pickup". `npm run dev` → http://localhost:5273. See README.md for the MDX
components; this file is for decisions the owner has already made.

## How the owner works

- One slide at a time. "Slide #2" is `src/slides/020-why.mdx`. Every follow-up
  applies to the slide under discussion until told otherwise.
- Show design options *inside* that slide (per item, per step). Never add
  variant slides to present options.
- Feedback comes as a screenshot plus a one-line directive. Change exactly
  what was pointed at, nothing next to it.
- Verify in your own browser tab, then close it. No viewport emulation.
- Don't commit or push unless asked ("push progress" = commit everything on
  `main` and push).

## Approved: bullets in the Spotlight box (slide 020)

Chosen style: `bullets="numbered"` on `<Spotlight>` (per-card override is
`bulletStyle`). It looks like this and should stay this way:

- No lead sentence — the box shows only the bullet rows.
- Index in **binary** (`01`, `10`, `11`), Familjen Grotesk **regular** (400),
  26 px, vertically centred on its row, 50 px column.
- Hairline (`rgba(255,255,255,.28)`) above every row and below the last.
- Row text 22 px, rows vertically centred in the box.

Other cuts (`list`, `ticks`, `chips`, `steps`, `rail`, `big`, `hero`) exist in
`src/deck/mdxComponents.tsx` / `deck.css` (`.sb--*`) but are not used.

## Other approved details on slide 020

- Title: `What makes a ring special?` — with the question mark.
- Bar numbers are hex with the prefix: `0x01` … `0x05`. No brick icons on the bars.
- The gradient box reacts to the pointer **only while it is inside the box**:
  the base is blue only, all the pink is one blob that rests in the
  bottom-left corner and chases the cursor on a slow spring; a white sheen
  follows faster; the base tilts up to 17° toward the pointer. When the blob
  is away the corner is blue — nothing else may sit there. Leaving the box
  sends the blob home.
- The tail is a notch in the box skin's clip-path (not a separate element), so
  gradient and glow run into it.
- Slide 030 (`Let's dive deep.`) is the poster look: `layout: full`, `<Orb />`
  as the whole background (blob and sheen scaled up, `.orb .orb__glow`), the
  title alone at 150 px bottom-left. No eyebrow. Four other looks (centred +
  pill, split, orb box, chapter number) were shown and rejected.
- To offer design options, wrap them in `<Pick>` inside the slide: one child
  per click. Never add variant slides.
- Slide 040 (`The naive flow.`) is a `<Route>`: opens as the same poster as
  030, then each click the orb flies to the next `<Stop>` (rings on a line,
  the lit ring is behind the orb, the line draws in behind it). The orb
  takes a `target` for this; the pointer only drifts it a little there.
  On the poster (step 0) the path layer is hidden — the orb roams with the
  pointer there and must not paint the connecting lines.
  Ring highlight, text opacity and the line are driven by the orb's real
  position (motion values), not by the click: a ring brightens as the orb
  arrives and is then held lit for as long as it is at or before the
  current stop; nothing snaps. Stepping back must not blink: the ring the
  orb returns to stays held (it was reached), the ring it leaves goes back
  to distance lighting and fades as the orb moves off.
  Orb on this slide is 30% smaller than the poster's, stops have no body
  lines. No fog of war: the base stays bright the whole time. A fog layer
  with holes under visited stops (`<Fog>`, `--fog-hN`) was tried and
  removed — any clearing under or behind the blob read as a second orb or
  as a highlight popping in. `<Fog>` / `<Lamp>` and the `.fog` CSS remain
  available but unused on this slide; the blob still rides on `<Lamp>`
  (`Orb glow={false}`), a transform-only layer above the line and below
  the rings. Performance rule: never rebuild a multi-layer mask string per
  frame — that was the cause of the "steppy" transitions.

## Slide numbering

010 title · 020 why · 030–130 the talk outline · 700 blank · 710–712 brick
pick list · 800–890 unused "why" layouts kept for reference.
