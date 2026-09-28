/** Shared geometry and timing for the arrow, camera and the orb it pulls. */
export const PUSH_ARROW_DURATION = 3.2
export const PUSH_END = 1.72
export const PUSH_HOME = { x: 72, y: 648 }
const PULL_SCALE = 340 / 820
const FORK = { x: 1600, y: -80 }
export const PLATFORM_Y = -290
const END_Y = -155
export const IOS_X = 1280
export const ANDROID_X = 1920
export const STEM_END = 0.68
export const clamp = (n: number) => Math.max(0, Math.min(1, n))
const branchAt = (p: number) => clamp((p - STEM_END) / (1 - STEM_END))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }

const TOKEN_TIP = { x: 300, y: 420 }
const RUN_Y = 590
const FIRST_RADIUS = 40
const DROP = RUN_Y - FIRST_RADIUS - TOKEN_TIP.y
const FIRST_BEND = Math.PI * FIRST_RADIUS / 2
const RUN_START = TOKEN_TIP.x + FIRST_RADIUS
const TURN_X = FORK.x - 240
const RUN = TURN_X - RUN_START
const LAST_BEND = Math.PI * 240 / 2
const CLIMB_Y = RUN_Y - 240
const STEM_LENGTH = DROP + FIRST_BEND + RUN + LAST_BEND + CLIMB_Y - FORK.y

/** A small first tug lets the token stack clear before the tip passes through it. */
function stemDistance(p: number) {
  if (p < 0.055) return 8 * smooth(p / 0.055)
  const t = clamp((p - 0.055) / (STEM_END - 0.055))
  const accelerate = (t - (1 - Math.exp(-8 * t)) / 8) / (1 - (1 - Math.exp(-8)) / 8)
  return 8 + (STEM_LENGTH - 8) * accelerate
}

/** Continue the existing downward arrow, turn right, then climb to the fork. */
function stemPoint(distance: number) {
  const start = 'M 300 340'
  if (distance <= DROP) {
    const y = TOKEN_TIP.y + distance
    return { d: `${start} V ${y}`, x: TOKEN_TIP.x, y, angle: 90 }
  }
  const down = `${start} V ${RUN_Y - FIRST_RADIUS}`
  if (distance < DROP + FIRST_BEND) {
    const angle = (distance - DROP) / FIRST_RADIUS
    const x = RUN_START - FIRST_RADIUS * Math.cos(angle)
    const y = RUN_Y - FIRST_RADIUS + FIRST_RADIUS * Math.sin(angle)
    return { d: `${down} A 40 40 0 0 0 ${x} ${y}`, x, y, angle: 90 - angle * 180 / Math.PI }
  }
  const across = `${down} A 40 40 0 0 0 ${RUN_START} ${RUN_Y}`
  const along = distance - DROP - FIRST_BEND
  if (along <= RUN) {
    const x = RUN_START + along
    return { d: `${across} H ${x}`, x, y: RUN_Y, angle: 0 }
  }
  const radius = 240
  const turn = `${across} H ${TURN_X}`
  if (along < RUN + LAST_BEND) {
    const angle = (along - RUN) / radius
    const x = TURN_X + radius * Math.sin(angle)
    const y = CLIMB_Y + radius * Math.cos(angle)
    return { d: `${turn} A 240 240 0 0 0 ${x} ${y}`, x, y, angle: -angle * 180 / Math.PI }
  }
  const y = CLIMB_Y - (along - RUN - LAST_BEND)
  return { d: `${turn} A 240 240 0 0 0 1600 ${CLIMB_Y} V ${y}`, x: FORK.x, y, angle: -90 }
}

export function stemFrame(p: number) {
  return stemPoint(stemDistance(p))
}

/** The camera follows the growing tip, with a little room ahead of it. */
export function pushCamera(p: number) {
  const stem = stemFrame(p)
  const tipY = p <= STEM_END ? stem.y : branchFrame(p, IOS_X).y
  return {
    x: -960 * smooth((stem.x - 760) / (FORK.x - 760)),
    y: stem.x < TURN_X ? 0 : 700 * smooth((RUN_Y - tipY) / (RUN_Y - END_Y)),
  }
}

/** Two rounded right-angle turns; grow the actual path so its arrowhead travels. */
export function branchFrame(p: number, x: number) {
  const radius = 20
  const direction = Math.sign(x - FORK.x)
  const sweep = direction > 0 ? 1 : 0
  const corner = Math.PI * radius / 2
  const horizontal = Math.abs(x - FORK.x) - 2 * radius
  const levelY = FORK.y - radius
  const riseY = levelY - radius
  const distance = branchAt(p) * (2 * corner + horizontal + riseY - END_Y)
  const start = `M ${FORK.x} ${FORK.y}`

  if (distance < corner) {
    const angle = distance / radius
    const tipX = FORK.x + direction * radius * (1 - Math.cos(angle))
    const y = FORK.y - radius * Math.sin(angle)
    return { d: `${start} A ${radius} ${radius} 0 0 ${sweep} ${tipX} ${y}`, y }
  }
  const firstX = FORK.x + direction * radius
  const firstTurn = `${start} A ${radius} ${radius} 0 0 ${sweep} ${firstX} ${levelY}`
  if (distance < corner + horizontal) {
    return { d: `${firstTurn} H ${firstX + direction * (distance - corner)}`, y: levelY }
  }
  const lastX = x - direction * radius
  const across = `${firstTurn} H ${lastX}`
  if (distance < 2 * corner + horizontal) {
    const angle = (distance - corner - horizontal) / radius
    const tipX = lastX + direction * radius * Math.sin(angle)
    const y = riseY + radius * Math.cos(angle)
    return { d: `${across} A ${radius} ${radius} 0 0 ${1 - sweep} ${tipX} ${y}`, y }
  }
  const y = riseY - (distance - 2 * corner - horizontal)
  return { d: `${across} A ${radius} ${radius} 0 0 ${1 - sweep} ${x} ${riseY} V ${y}`, y }
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const CATCH_START = 0.54
const PINNED = 0.58
const PIN = { x: 640, y: 680 }
const TENSION_SCALE = 0.18
const APEX = 0.93
const EXIT = { x: 560, y: -360 }
const FALL_START = 1.06
const LAND = 1.4
const BOUNCE_END = 1.58

/** Trail the tip with enough slack to flutter across the line like a flag. */
function pulledOrb(p: number) {
  const flutter = smooth((p - 0.08) / 0.1) * (1 - smooth((p - 0.5) / (PINNED - 0.5)))
  const phase = (p - 0.08) * 2 * Math.PI / 0.15
  const lag = mix(TOKEN_TIP.y - 255.6, 180, smooth((p - 0.08) / 0.24))
    + 16 * flutter * Math.sin(phase - 0.8)
  const point = stemPoint(stemDistance(p) - lag)
  const angle = point.angle * Math.PI / 180
  // A broad wave carries the orb; a smaller ripple keeps the tow from
  // reading as regular hops on a floor. The normal turns with the arrow.
  const lift = flutter * (24 + 48 * Math.sin(phase) + 10 * Math.sin(2 * phase - 0.7))
  return {
    ...point,
    x: point.x + Math.sin(angle) * lift,
    y: point.y - Math.cos(angle) * lift,
    ripple: flutter * Math.sin(phase + 0.7),
  }
}

/**
 * The line finishes at 1; the same clock continues through the orb's landing.
 * Pulling happens in world coordinates. Before the fork the orb catches on
 * the screen's bottom edge and compresses as the arrow pulls away. Everything
 * from that catch onward uses stage coordinates, independent of the camera.
 */
export function vendorOrbFrame(p: number) {
  const transfer = smooth((p - 0.02) / 0.06)
  const base = { scale: PULL_SCALE, sx: 1, sy: 1, opacity: transfer, cloudGlow: 1 - transfer, passengerOpacity: p < APEX ? 1 : 0 }
  const camera = pushCamera(p)
  if (p < STEM_END) {
    const orb = pulledOrb(p)
    const direction = Math.cos(orb.angle * Math.PI / 180) ** 2
    const pull = smooth((p - 0.04) / 0.12)
    const caught = smooth((p - CATCH_START) / (PINNED - CATCH_START))
    const tension = smooth((p - PINNED) / (STEM_END - PINNED))
    return {
      ...base,
      x: mix(orb.x + camera.x, PIN.x, caught),
      y: mix(orb.y + camera.y, PIN.y, caught),
      scale: mix(PULL_SCALE, TENSION_SCALE, tension),
      sx: mix(1 + pull * (0.24 * direction - 0.08) + 0.08 * orb.ripple, mix(1, 0.86, tension), caught),
      sy: mix(1 + pull * (0.16 - 0.24 * direction) - 0.08 * orb.ripple, mix(1, 0.72, tension), caught),
    }
  }
  // One uninterrupted growth curve starts on release and reaches full size
  // on landing. Squash only compresses it, so no axis exceeds the final form.
  const growth = clamp((p - STEM_END) / (LAND - STEM_END))
  const flight = { ...base, scale: mix(TENSION_SCALE, 1, 1 - (1 - growth) ** 1.4) }
  if (p < APEX) {
    const t = clamp((p - STEM_END) / (APEX - STEM_END))
    const stretch = Math.sin(Math.PI * t)
    const y = mix(PIN.y, EXIT.y, 1 - (1 - t) ** 2)
    return {
      ...flight,
      x: mix(PIN.x, EXIT.x, smooth(t)),
      y,
      // Let the whole 60px mascot clear the top, then leave it off for the fall.
      passengerOpacity: y > -30 ? 1 : 0,
      sx: mix(0.86, 1, smooth(t)) - 0.12 * stretch,
      sy: mix(0.72, 1, smooth(t / 0.2)),
    }
  }
  if (p < FALL_START) {
    return { ...flight, x: mix(EXIT.x, PUSH_HOME.x, smooth((p - APEX) / (FALL_START - APEX))), y: EXIT.y }
  }
  if (p < LAND) {
    const t = clamp((p - FALL_START) / (LAND - FALL_START))
    return { ...flight, x: PUSH_HOME.x, y: mix(EXIT.y, PUSH_HOME.y, t * t), sx: 1 - 0.08 * Math.sin(Math.PI * t) }
  }
  if (p >= PUSH_END) return { ...base, ...PUSH_HOME, scale: 1 }
  const bounce = clamp((p - LAND) / (BOUNCE_END - LAND))
  const seconds = (p - LAND) * PUSH_ARROW_DURATION
  const squash = Math.cos(seconds * 26) * Math.exp(-seconds * 8)
  return {
    ...flight,
    x: PUSH_HOME.x,
    y: PUSH_HOME.y - 4 * 46 * bounce * (1 - bounce),
    sy: 1 - 0.28 * Math.abs(squash),
  }
}
