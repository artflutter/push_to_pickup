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
- Bar numbers are hex with the prefix: `0x01` … `0x05`. No icons on the bars.
- The gradient box reacts to the pointer **only while it is inside the box**:
  the base is blue only, all the pink is one blob that rests in the
  bottom-left corner and chases the cursor on a slow spring; a white sheen
  follows faster; the base tilts up to 17° toward the pointer. When the blob
  is away the corner is blue — nothing else may sit there. Leaving the box
  sends the blob home.
- The tail is a notch in the box skin's clip-path (not a separate element), so
  gradient and glow run into it. It travels only while it is out, bar to
  bar. When it appears it grows out in place — at bar 01 on the first click,
  at the last bar when the deck steps back into the slide — never sliding
  there from the middle ("it animates its position vertically when it
  initially appears" was the complaint). Retracting leaves it where it is.
- The poster look (approved on the old slide 030, `Let's dive deep.`):
  `layout: full`, the orb as the whole background (blob and sheen scaled up,
  `.orb .orb__glow`), the title alone at 150 px bottom-left. No eyebrow.
  Four other looks (centred + pill, split, orb box, chapter number) were
  shown and rejected. `<div className="sec sec--poster"><Orb /><div
  className="sec__title">…</div></div>` still renders it on its own; slide
  030 itself was merged into 040.
- To offer design options, wrap them in `<Pick>` inside the slide: one child
  per click. Never add variant slides.
- Slide 040 is a `<Route title="The naive flow.">` in three acts (the former
  030, 040 and 050 merged, so those numbers are free). An act opens on its
  own title poster — the 150 px bottom-left look, where the orb roams with
  the pointer and the path layer is hidden — and the next click carries that
  title into the corner and brings its rings in; then each click the orb
  flies to the next `<Stop>` (rings on a line, the lit ring is behind the
  orb, the line draws in behind it). The orb takes a `target` for the stops;
  the pointer only drifts it a little there.
  Act 1 is `The naive flow.` (incoming push → display the UI → accept /
  decline), act 2 is `<Act title="The naive implementation.">` with the
  former slide 050's shopping list, act 3 is `<Act title="Let's dive deep." />`
  — a title poster with no stops, one breath before the next slide. Eight
  clicks in all.
  Act 2's last ring is `<Stop n={<Munch>03</Munch>} title="" />`: Clawd, the
  Claude Code mascot (Iconify `cbi:claude-clawd`, the path in `CLAWD`, drawn
  in `currentColor` so it takes the ring's white — the orange #d97757 was
  tried and dropped), waits where the ring's label would be, then climbs into
  the ring and eats the `03` in five bites, left to right: each bite snaps
  shut over the next fifth and clips it away (`CHEW`, built once — keyframes
  and times have to line up). It is cued by the ring's own light through
  `StopLit`, not by the click, so it starts when the orb really arrives and
  the number comes back if the deck steps away. Stepping to the next act lifts the whole frame — title, line
  and rings — out of the top of the slide while the new title rises in its
  place; stepping back brings the old act down with its rings still lit.
  Each act is two layers (`.route__act--lines` / `.route__act--stops`, either
  side of the blob's `.lamp`) so the light keeps running above the line and
  below the rings while the act moves.
  `<Route poster="…">` (an opening title that swaps word by word into the
  route title — old words lift out, new words rise in, staggered,
  `.route__word`; stepping back runs the swap downward) still works but is
  not used here any more: `Let's dive deep.` now closes the slide instead of
  opening it.
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

## The travelling orb (Traveller.tsx)

The orb is the key piece of the deck and travels between slides. **The orb
is the pink glow and nothing else** — the same `radial-gradient` as
`.orb__glow`. Never give it a skin, a ring or any blue; drawing it as a
blue ball with a pink spot got "the orb has no blue accents".

There is one orb for the whole deck: `<Traveller>` in Deck.tsx draws it
above the slide layer (`.ball-layer`, z-index 10 inside the stage) and its
position, squash and opacity are module-level motion values in stage px, so
a slide change never resets it. Slides only cue it; nothing inside a slide
renders the orb itself.

- Slide 010 has **no orb**: the whole `<OrbLaunch />` choreography below was
  built, shown and removed at the owner's request ("remove the orb from the
  first slide"). The component still exists in Traveller.tsx, unused. Do
  not put it back unless asked. What it did, for reference: two steps that
  chained on one click.
  Step 1: lights out — a `.lights` layer dims the card to ink while the
  pink condenses (wide faint haze → bright orb) over the avatar; the orb
  takes a breath up, falls under gravity to the floor, splashes flat,
  springs back, one soft hop, settles; then it advances by itself
  (`slide.advance`, wired from `deck.next`). Step 2: it hops into the
  bottom-left corner of the 020 gradient box (72, 648), where that box's own
  blob rests, and its light spreads: 020 is revealed through an iris
  (a `clip-path: circle()` on the incoming `.deck__slide`, a pink
  `.iris-ring` leading it) while the orb fades into the box blob.
  Re-entering 010 at a step shows that step's rest state (lights down, orb
  on the floor / in the corner), no replay, no auto-advance; step 0 turns
  the lights back on.
- The iris is deck-level: `useReveal()` / `useIrisClip()` from
  Traveller.tsx. `AnimatePresence` runs in `sync` mode (crossfade with a
  small lift by default); while a reveal targets the incoming slide it is
  clipped and stacked on top, and the outgoing slide holds until covered.
- Hand-off between slides goes through `hooks.onLeaveForward/onLeaveBack`
  in Traveller.tsx: the slide that owns the orb sets them while mounted,
  `<Traveller>` calls the right one when the slide index changes, and with
  no hook the orb fades out (so an overview jump never strands it). A
  reveal moves the deck itself and sets `hooks.skipNext` so the hooks stay
  out of that change.
- Choreographies take a ticket (`take()` / `live(t)`); a newer cue (a click
  mid-drop) makes the older continuation stop after its current await.
- Slides 020+ have not been converted yet: they still render their own orb
  (Spotlight box blob, `<Orb />`, `<Route>`). Convert one slide at a time,
  as the owner directs.

## Slide numbering

010 title · 020 why · 040–130 the talk outline (030 and 050 were merged into
040, both numbers are free) · 700 blank · 800–890 unused "why" layouts kept
for reference.
