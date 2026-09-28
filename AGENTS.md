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
- Use the workspace's VS Code Integrated Browser MCP for browser verification.
  Before opening or navigating a tab, call `browser_status` to check that the
  bridge is reachable and inspect its capabilities. A reachable bridge with
  `cdp: disconnected` can still open a tab; that alone is not a failure.
  If the bridge is unreachable, report that verification is blocked; do not
  launch another browser or browser runtime as a fallback.
  When reachable, verify in your own MCP-managed tab, then close it.
  No viewport emulation.
- Don't commit or push unless asked ("push progress" = commit everything on
  `main` and push).

## Slide 010: opening portrait

`<OpeningPortrait>` keeps the original photo and adds two reversible steps:
first next draws a handlebar mustache over the upper lip in two strokes;
second next drops white Clawd onto the upper-right crown of the hair, with
its regular two eyes, no antennae and a small settling bounce. Keep its
feet aligned to the hair contour, not the circular photo border. The third
next goes to 020.
The overlays use the photo's 391 × 391 coordinate space; the photo asset
stays intact. The opening slide still has no orb.

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
  orb, the line draws in behind it). Ring numbers are binary like the 020 bullets — `01` · `10` · `11` — everywhere except the 020 bars, which keep their hex (`0x01` …; "do not touch hex"). The orb takes a `target` for the stops;
  the pointer only drifts it a little there.
  Act 1 is `The naive flow.` (incoming push → display the UI → accept /
  decline), act 2 is `<Act title="The naive implementation.">` with the
  former slide 050's shopping list, act 3 is `<Act title="Let's dive deep." />`
  — a title poster with no stops, one breath before the next slide. Eight
  clicks in all.
  Act 2's last ring is `<Stop n={<Munch>11</Munch>} title="" />`: Clawd, the
  Claude Code mascot (Iconify `cbi:claude-clawd`, shared in `ClaudeMark.tsx`, drawn
  in `currentColor` so it takes the ring's white — the orange #d97757 was
  tried and dropped), waits where the ring's label would be, then climbs into
  the ring and eats the `11` in five bites, left to right: each bite snaps
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

## Slide 060: the app is the king

`layout: full`, one page throughout — no title, no Spotlight box, no bars.
`<Unfold hero={<AppWire />} seeds={APP_WIRE.circles} orbAt={APP_WIRE.top}>`
with three `<Stop title>body</Stop>` (the slide imports `APP_WIRE` from
mdxComponents — plain MDX ESM).
Step 0: the whole slide is the gradient, the app's ringing screen as a
wireframe in the middle (phone outline with notch and home bar, the
caller's two lines), and the blob — small, 340 px (`.unfold .orb__glow`;
820 → 260 → 340 were tried) — resting on the top edge of the phone. The
wireframe's three circles (avatar, then the two call buttons) are not in
the SVG: they are the three rings in their folded state, drawn as the same
2.5 px outline with nothing inside.
First click: the phone shrinks to half around its centre and moves up to
(640, 200), and the circles spring down into a row of rings (120 px, on
the 240 / 640 / 1040 line of slide 040, y 470), all on one spring — empty
rings: the number inside (binary, `01` · `10` · `11`, like the 020
bullets) and the title under come with the light, so a
ring shows nothing until the orb reaches it ("the number and subtitle
should appear only after orb highlight the item"). No body ("there should
be no subtitles"; `<Stop>` still takes one). The caller's two lines in the
phone fade
out as the circles leave (`.appwire__caller`, `.unfold--open`) and come
back when it folds. The blob *stays on top of the phone*,
riding its shrink to the same spot on the smaller frame (`orbAt` mapped
through the shrink); "the orb should stay on top, only next tap moves it".
The sheen rides the glow's own spring here (`<Lamp together />`): with the
glow this small the sheen's faster spring read as a second orb running
ahead of the first.
Second click: the blob leaves the phone and flies to ring 01; from there
it is the route rule: a ring brightens as the orb arrives and is held once
reached, the line draws in behind the orb and is held back until the orb
is at the first ring (it arrives from above, off-line). One difference
from the route: only the ring the orb is *heading for* lights by distance
(`aim`) — coming down from the phone it passes within ~280 px of ring 02,
which flickered to 14 % on the way ("why 02 blinks"). Four clicks. Stepping back folds it all up again; nothing
blinks.
The rings read `Emits push token` · `Obtains vendor token` · `Send push to
vendor` (the owner's words). Rejected on the way here: the box shrinking
into the Spotlight layout with bars on the left ("everything should be on
the same page"); a phone drawn without its frame; a content block inside
the phone; the blob centred on the phone instead of on top of it.
`<Spotlight>` still has the `hero` / `heroOrb` / `heroSeeds` opening view
and cards still take a `seed` rect from the Bento context — built for this
slide, now unused anywhere. Five clicks now, not four: the fifth is the
balloon (below).

## The balloon: 060 hands the push to 070

The last step of 060 (a fifth click, `<Unfold launch>`): the ring the orb has
just lit — `Send push to vendor` — becomes a balloon, gathers the light inside
it and rises off the top edge, swaying; the page turns while it is still
rising (`slide.advance` from the choreography, as on 010). 070 picks it up:
the balloon comes back in from below — the camera followed it up — settles,
and the envelope spreads into the vendor's cloud with the light and
"The vendor." inside. The slide's own content waits under that beat
(`.slide--cloud`) and comes in on the next click, which parks the cloud small
in the top-right corner (`<CloudIn>`).

- It is one wireframe, the **vessel**, drawn by `<Traveller>` above the slide
  layer like the orb, so it survives the slide change (`Vessel` in
  Traveller.tsx, `.vessel` in deck.css). `shape` runs 0 ring · 1 balloon ·
  2 cloud and the outline is rebuilt from the lerped points each frame.
- The shapes are **shipped icons**, not drawings: the balloon is Tabler's
  `balloon` (its body; its string too, for once it is free) and the cloud is
  Material Symbols' `cloud`. `fitPath` walks a path and takes its points, so
  what ends up on screen is the icon itself. The ring is the stop's own 120 px
  circle. Hand-drawn shapes were tried twice and were slop both times.
- The ring **inflates**: the balloon swells upward out of the stop's circle
  with its knot left on the line, and only then rises. It does not move while
  it fills.
- The line between the last two stops **is the string** (`<Tether>` in
  mdxComponents, fed by the exported `vessel` motion values). It stays tied to
  the stop before, runs dead straight while the balloon fills, and only sags
  and trails once the balloon climbs. It lets go as the page turns, and from
  there the balloon carries the string that comes with its icon.
- The orb rule is intact: the pink glow rides **inside** the outline (clipped
  to it, `<clipPath>`), never around it.
- On slide #4, the loose end pulls Clawd out of the previous ring and lifts
  it by one hand. Use the shared white mascot from `ClaudeMark.tsx` at 2.5×.
  Its hand follows the string's actual final point in `Traveller.tsx`, including
  the camera motion and reeling into the cloud; do not give it a separate
  position animation. It emerges as the end pulls free and fades into the cloud.
- When the push-token arrow pulls the orb out of the Vendor cloud, Clawd
  comes with it. The white mascot follows the shared orb's actual position
  through the flutter, tension and upward release, staying at its 2.5× size.
  Once Clawd clears the screen's top edge it disappears. The orb falls and
  lands alone; Clawd must not reappear on the descent or the UI hand-off.
- Rejected on the way here: two hand-drawn clouds (a potato and a blob), a
  pink ball behind the outline instead of light clipped inside it, a hot-air
  balloon with a basket ("не аэростат — детский шарик"), and the line simply
  retracting instead of becoming the string.

## Slide 070: the vendor — five looks, one to be picked

`layout: full`. The slide opens on the original look — the vertical
`<Rail>` of four `<Milestone>`s, one `<F>` each, inside `.vendor--plain`
(the default layout's padding and title) — the owner asked for it back
("bring back the original, do not remove the 5 options"). After it come
five other looks for the same four steps (`src/deck/vendor.tsx`, imported
into the MDX), all shown one after another through `<Variants>`: each
`<Variant steps={4} tag="…" label="…">` owns its own run of clicks (its
step 0 … 4), the click after a look's last step switches to the next look,
and a mono tag top-right says which is up (0 · Original, A · Stairs,
B · Dial, C · Ledger, D · Belt, E · Hand-off). `#/4/5` lands on A,
`#/4/10` on B, `#/4/15` on C, `#/4/20` on D, `#/4/25` on E. The five were
shown on 2026-09-26 and the owner's verdict was "miserable slop" — none is
approved, do not build on them without direction. Once the owner picks a
look, delete the others, `<Variants>` and the tag. On 2026-09-27 the owner
asked for the text on A–E to be "unreadable abracadabra": they carry
gibberish of the same lengths (`blah` in the MDX — title, steps, the
ledger's things, the hand-off's machine labels) so only their form reads;
the original keeps the real words. The real steps live in option 0.
The steps live once in the MDX (`export const steps`) and go in as
`stops`; every look also takes `<Stop title>body</Stop>` children.

All five keep the deck's rules: blue base with the one pink glow (340 px
here, like 060), binary numbers `01 · 10 · 11 · 100`, text that comes with
the light, a stop held lit once the orb has reached it, nothing blinking on
the way back. The orb never has blue in it.

- **A · Stairs** — the call bleeds in over the top edge, then drops tread to
  tread down a staircase of hairlines, each starting further right; the
  tread brightens and its text lights as the orb lands at its number.
- **B · Dial** — "The vendor." sits in the hub; the four rings sit on a
  faint track around it. The orb leaves the hub for the top ring and orbits
  clockwise on a polar spring, the arc drawing behind it; the list on the
  right lights with the rings (rows dim at 32 % until then).
- **C · Ledger** — numbered rows on the left, step-lit like the 020 bars;
  a 300 px ring on the right holds the thing in hand — `a call` → `a phone
  number` → `a user` → `a push token` → `a push` — swapping word by word
  (the 040 poster motion, 28 px). The orb sits in the ring, breathes on
  every swap and leaves through the right edge on the last step; the ring
  goes dark behind it.
- **D · Belt** — opens on the 150 px poster with the roaming orb (the 040
  look), then the title goes to the corner and rings on a belt (160 px,
  460 px pitch) slide under the orb, which holds the centre: the world
  moves, the light stays. Rings light by their real on-screen distance;
  only the ring under the orb carries its body (passed rings keep number
  and title, so labels never collide at the 460 px pitch).
- **E · Hand-off** — three wireframes on one line (2.5 px, 62 % white, like
  the app wireframe): the vendor's cloud, your server as a rack with the two
  lookup rows inside, the gateway (`APNs · FCM`). Steps 01 and 100 are
  written on the lines between machines and come with the line as it
  draws; 10 and 11 are the rack rows. The orb flies cloud → rack top,
  shrinks to 200 px to walk the rows, grows back and flies to the gateway.

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

## Slide 100: garlands between Push and UI

Globes (former option A) is approved. The other garland variants and the
option label are removed. The lamps open unlit; the first next click lights
`GET VENDOR TOKEN` from left to right, letter by letter. The second lights
`CONNECT TO VENDOR` from right to left, keeping the first row lit. There are 14 and
15 lamps respectively; spaces have no lamp. Further next brings the falling
endpoints of 110, which destroy this scenery as described below.
Keep capitals centred using the font's cap height (`dy="0.5cap"` with an
alphabetic baseline). Letters are 26 px; rope anchors are at y 230 and 440
(210 px apart), and Clawd uses a 2.5× icon scale.
Clawd runs on each rope as its letters light, using the same clock as the
lamps. Its feet follow the curve and meet each lamp during its warm-up;
it runs from behind Push to UI on the first rope, then UI to Push on the second.
Keep its speed and stride steady through spaces. Lamp timing follows travel
distance, so word gaps take longer than the gaps between adjacent letters.
Reuse the shared Clawd path from `ClaudeMark.tsx`, with white fill and
alternating pixel feet.

## Slide 110: one call, many endpoints

`<Endpoints>` replaces the old two-phone cards. Slides 090, 100 and 110 share
`BetweenScene`, so the devices fall through the actual ropes rather than a
page fade. The first device loads each cord, the cord tears into two loose
halves, its globes lose power and fall with it, and Push / UI pivot outward
around their feet. The stage's bottom rule stays fixed. The entry clock in
`endpointMotion.ts` drives devices, ropes, bulbs and pillars together; back
navigation rebuilds the garlands.

Eight wireframes settle into two loose rows: three iPhones, two Android
phones, a closed iPhone Duo and two web browsers. No device-name labels below
the wireframes; let their silhouettes identify them. Both Android phones,
including the one in the right cluster, have triangle / circle / square
navigation buttons. The upper-left iPhone has a wide notch, and the upper-right
iPhone has a narrower notch; both join the screen's top edge. The lower-right
iPhone keeps its floating camera pill. The Duo stays closed;
use the wider cover-screen proportions, second shell and hinge to identify
it, not two spread screens. Match Apple's closed-device reference: 84.1:117.8
width-to-height, almost square corners on the left hinge edge, rounded right
corners, and the camera in the upper-right corner. No centred camera pill or
generic four-rounded-corner phone outline on the Duo. First next lights all
devices one by one in a freshly shuffled order with incoming-call screens.
Every device gets one turn; keep that order through answering and rewinding.
Starting a new incoming-call sequence shuffles again. Second next randomly picks one endpoint, turns it
green with `Connected` and the shared white Clawd mascot in its screen,
and stops ringing / dims the other seven with
`Call ended`. Fast clicks wait for the fall, then complete the ring wave
before showing the answer. Keep the incoming-call state white and reserve
green for the answered endpoint.

## Slide numbering

010 title · 020 why · 040–130 the talk outline (030 and 050 were merged into
040, both numbers are free). Nothing after 130: the blank 700 and the ten
"why" layouts that followed it (800–890, leftovers of the 020 design round)
have all been deleted.
