export type UnfoldCircle = { x: number; y: number; r: number }

export const UNFOLD_DURATION = 1.12
export const UNFOLD_CONTACT = 0.36

const clamp = (t: number) => Math.max(0, Math.min(1, t))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const coast = (t: number) => 1 - (1 - t) ** 3

/** The falling avatar touches both stationary buttons at this centre point. */
export function unfoldContact(avatar: UnfoldCircle, button: UnfoldCircle, radius: number) {
  const dx = avatar.x - button.x
  const reach = radius + button.r
  return { x: avatar.x, y: button.y - Math.sqrt(Math.max(0, reach * reach - dx * dx)) }
}

/** One reversible clock: drop, transfer the impulse at contact, then coast. */
export function unfoldCircleAt(
  progress: number,
  seed: UnfoldCircle,
  target: UnfoldCircle,
  contact?: { x: number; y: number },
): UnfoldCircle {
  const t = clamp(progress)
  if (t === 0) return seed
  if (t === 1) return target
  if (!contact) {
    const p = coast(t)
    return { x: mix(seed.x, target.x, p), y: mix(seed.y, target.y, p), r: mix(seed.r, target.r, p) }
  }

  const avatar = seed.x === contact.x
  if (t <= UNFOLD_CONTACT) {
    if (!avatar) return seed
    const drop = t / UNFOLD_CONTACT
    return {
      x: seed.x,
      y: mix(seed.y, contact.y, drop * drop),
      r: mix(seed.r, target.r, smooth(drop)),
    }
  }

  const flight = (t - UNFOLD_CONTACT) / (1 - UNFOLD_CONTACT)
  if (avatar) {
    // Most of the drop's momentum went into the buttons; the avatar settles centrally.
    return { x: target.x, y: mix(contact.y, target.y, coast(flight)), r: target.r }
  }
  return {
    x: mix(seed.x, target.x, coast(flight)),
    // The first impulse points down and out, then the circles settle onto the row.
    y: mix(seed.y, target.y, smooth(flight)) + 22 * Math.sin(Math.PI * flight) * (1 - flight) ** 2,
    r: mix(seed.r, target.r, coast(flight)),
  }
}
