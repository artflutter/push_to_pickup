import { useLayoutEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useTransform, type MotionStyle, type MotionValue } from 'motion/react'
import { useSlide } from './slideContext'
import { useEndpointEntry } from './endpointContext'
import { CLAWD } from './ClaudeMark'
import { useRainbow } from './rainbowContext'
import { ANSWER_DURATION, ENDPOINT_ENTRY_DURATION, ENDPOINTS, RING_DURATION, endpointCallAt, endpointPoseAt, shuffleEndpointOrder, type EndpointSpec } from './endpointMotion'

// Tabler's phone handset, shared by the small incoming-call screens.
const HANDSET = 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2'
const randomEndpoint = () => Math.floor(Math.random() * ENDPOINTS.length)

/** Closed Duo: straight hinge edge, rounded outer edge, corner camera.
 * Reference: apple.com/v/iphone-duo/a/images/overview/product-viewer/closed__3le61imm1w2e_large.jpg
 */
function DuoFrame({ w, h }: { w: number; h: number }) {
  const left = -w / 2
  const right = w / 2
  const top = -h / 2
  const bottom = h / 2
  const face = left + 4
  const outline = (x: number, y: number, r: number, b: number, radius: number) =>
    `M ${x + 2} ${y} H ${r - radius} Q ${r} ${y} ${r} ${y + radius} V ${b - radius} Q ${r} ${b} ${r - radius} ${b} H ${x + 2} Q ${x} ${b} ${x} ${b - 2} V ${y + 2} Q ${x} ${y} ${x + 2} ${y} Z`
  return <>
    <path className="endpoint__body" d={outline(left, top + 2, right - 3, bottom - 1, 23)} />
    <path className="endpoint__body" d={outline(face, top, right, bottom, 23)} />
    <path className="endpoint__screen" d={outline(face + 5, top + 5, right - 5, bottom - 5, 18)} />
    <g className="endpoint__hardware">
      <circle cx={right - 17} cy={top + 17} r="4.2" fill="#191a1d" />
      <circle cx={right - 17} cy={top + 17} r="1.4" fill="currentColor" stroke="none" />
      <path d={`M ${left + 2} ${top + 6} V ${bottom - 6}`} opacity="0.6" />
      <path d={`M -5 ${top - 1.5} H 10 M 17 ${top - 1.5} H 33 M ${right + 1.5} -41 V -13`} />
    </g>
  </>
}

/** Cut the notch into the screen's top edge so it joins the phone's bezel. */
function NotchedScreen({ w, h, notch }: { w: number; h: number; notch: 'wide' | 'narrow' }) {
  const left = -w / 2 + 7
  const right = w / 2 - 7
  const top = -h / 2 + 7
  const bottom = h / 2 - 7
  const half = notch === 'wide' ? 29 : 18
  const depth = notch === 'wide' ? 13 : 11
  return <path className="endpoint__screen" d={`
    M ${left + 14} ${top} H ${-half - 2}
    Q ${-half} ${top} ${-half} ${top + 2} V ${top + depth - 5}
    Q ${-half} ${top + depth} ${-half + 5} ${top + depth} H ${half - 5}
    Q ${half} ${top + depth} ${half} ${top + depth - 5} V ${top + 2}
    Q ${half} ${top} ${half + 2} ${top} H ${right - 14}
    Q ${right} ${top} ${right} ${top + 14} V ${bottom - 14}
    Q ${right} ${bottom} ${right - 14} ${bottom} H ${left + 14}
    Q ${left} ${bottom} ${left} ${bottom - 14} V ${top + 14}
    Q ${left} ${top} ${left + 14} ${top} Z
  `} />
}

function DeviceFrame({ device }: { device: EndpointSpec }) {
  const { w, h, kind } = device
  if (kind === 'duo') return <DuoFrame w={w} h={h} />
  const x = -w / 2
  const y = -h / 2
  const web = kind === 'web'
  return <>
    <rect className="endpoint__body" x={x} y={y} width={w} height={h} rx={web ? 10 : 20} />
    {device.notch ? <NotchedScreen w={w} h={h} notch={device.notch} /> :
      <rect className="endpoint__screen" x={x + 7} y={y + (web ? 32 : 7)} width={w - 14} height={h - (web ? 39 : 14)} rx={web ? 4 : 14} />}
    {web ? <g className="endpoint__hardware">
      <path d={`M ${x} ${y + 26} H ${-x}`} />
      {[12, 22, 32].map(dx => <circle key={dx} cx={x + dx} cy={y + 13} r="2" fill="currentColor" stroke="none" />)}
      <rect x={x + 51} y={y + 7} width={w - 95} height="12" rx="4" opacity="0.5" />
    </g> : <g className="endpoint__hardware">
      {kind === 'android' ? <circle cx="0" cy={y + 15} r="3" /> : device.notch ? <>
        <path d={`M -8 ${y + 12} H 5`} strokeWidth="2" />
        <circle cx={device.notch === 'wide' ? 17 : 10} cy={y + 12} r="1.5" fill="currentColor" stroke="none" />
      </> : <rect x="-17" y={y + 11} width="34" height="6" rx="3" fill="currentColor" stroke="none" />}
      {device.navigation === 'three-button' ? <g className="endpoint__nav-buttons" transform={`translate(0 ${-y - 17})`}>
        <path d="M -26 -4 L -33 0 L -26 4 Z" />
        <circle cx="0" cy="0" r="3.8" />
        <rect x="25" y="-3.5" width="7" height="7" rx="0.7" />
      </g> : <path d={`M -19 ${-y - 11} H 19`} strokeWidth="3" />}
    </g>}
  </>
}

function Endpoint({ device, index, entry, calls, winner, ringOrder }: {
  device: EndpointSpec; index: number; entry: MotionValue<number>; calls: MotionValue<number>; winner: number; ringOrder: readonly number[]
}) {
  const flight = useRainbow()
  const idle = useMotionValue(0)
  const mascotOpacity = useTransform(flight?.clock ?? idle, t => t > 0 ? 0 : 1)
  const pose = useTransform(entry, clock => endpointPoseAt(clock, index))
  const transform = useTransform(pose, p => `translate(${p.x}px, ${p.y}px) rotate(${p.angle}deg)`)
  const state = useTransform(calls, clock => endpointCallAt(clock, index, winner, ringOrder))
  const light = useTransform(state, s => s.light)
  const ring = useTransform(state, s => s.ring * (1 - s.answered))
  const connected = useTransform(state, s => s.picked ? s.answered : 0)
  const ended = useTransform(state, s => s.picked ? 0 : s.answered)
  const opacity = useTransform(state, s => 1 - (s.picked ? 0 : s.answered * 0.62))
  const color = useTransform(state, s => {
    const t = s.picked ? s.answered : 0
    return `rgb(${Math.round(207 - 89 * t)}, ${Math.round(226 + 14 * t)}, ${Math.round(243 - 76 * t)})`
  })
  const ringing = useTransform(state, s => s.ring > 0.1 && s.answered < 0.05 ? 'running' : 'paused')
  const web = device.kind === 'web'
  const iconY = web ? -5 : -17
  return <motion.g className={`endpoint endpoint--${device.kind}`}
    style={{ transform, opacity, color, originX: 0, originY: 0, transformBox: 'view-box', '--endpoint-light': light, '--ringing': ringing } as MotionStyle}>
    <DeviceFrame device={device} />
    <motion.g style={{ opacity: ring }}>
      <g className="endpoint__ring-pulse" transform={`translate(0 ${iconY})`}>
        <circle r="30" /><circle r="38" opacity="0.3" />
      </g>
      <g transform={`translate(-12 ${iconY - 12})`}><path className="endpoint__handset" d={HANDSET} /></g>
      <text className="endpoint__status" y={iconY + 61}>Incoming call</text>
    </motion.g>
    <motion.g style={{ opacity: connected }}>
      <motion.g className="endpoint__mascot" style={{ opacity: mascotOpacity }} transform={`translate(-38.4 ${iconY - 38.4}) scale(3.2)`}>
        <path d={CLAWD} fill="white" />
      </motion.g>
      <text className="endpoint__status" y={iconY + 61}>Connected</text>
    </motion.g>
    <motion.g style={{ opacity: ended }}>
      <g transform={`translate(-12 ${iconY - 12})`}><path className="endpoint__handset" d={HANDSET} /><path className="endpoint__handset" d="M 3 21 L 21 3" /></g>
      <text className="endpoint__status" y={iconY + 61}>Call ended</text>
    </motion.g>
  </motion.g>
}

/** Arrival destroys the previous slide; two clicks ring, then answer once. */
export function Endpoints() {
  const slide = useSlide()
  const flight = useRainbow()
  useState(() => slide.register(2))
  const entry = useEndpointEntry(ENDPOINT_ENTRY_DURATION)
  const phase = slide.static ? 2 : Math.min(slide.step, 2)
  const [winner, setWinner] = useState(() => slide.static ? 2 : randomEndpoint())
  const [ringOrder, setRingOrder] = useState(() => slide.static ? ENDPOINTS.map((_, i) => i) : shuffleEndpointOrder())
  const previous = useRef(phase)
  const target = phase === 0 ? 0 : RING_DURATION + (phase === 2 ? ANSWER_DURATION : 0)
  const calls = useMotionValue(target)
  const titleOpacity = useTransform(entry, clock => Math.max(0, Math.min(1, (clock - 2.2) / 0.5)))
  const show = useTransform(entry, clock => clock > 0 ? 'visible' : 'hidden')

  useLayoutEffect(() => {
    if (!flight) return
    flight.winner.set(winner)
    const sync = () => flight.ready.set(entry.get() >= ENDPOINT_ENTRY_DURATION && calls.get() >= RING_DURATION + ANSWER_DURATION)
    sync()
    const stopEntry = entry.on('change', sync)
    const stopCalls = calls.on('change', sync)
    return () => { stopEntry(); stopCalls() }
  }, [flight, winner, calls, entry])

  useLayoutEffect(() => {
    if (phase > 0 && previous.current === 0 && !slide.static) {
      calls.jump(0)
      setRingOrder(shuffleEndpointOrder())
    }
    if (phase === 2 && previous.current < 2 && !slide.static) setWinner(randomEndpoint())
    previous.current = phase
  }, [calls, phase, slide.static])

  useLayoutEffect(() => {
    if (slide.static) { calls.jump(target); return }
    let animation: ReturnType<typeof animate> | undefined
    let stopWaiting = () => {}
    const start = () => {
      stopWaiting()
      animation = animate(calls, target, { duration: Math.abs(target - calls.get()), ease: 'linear' })
    }
    // Fast clicks queue behind the falling devices, then behind the ring wave.
    if (target > calls.get() && entry.get() < ENDPOINT_ENTRY_DURATION) {
      stopWaiting = entry.on('change', clock => { if (clock >= ENDPOINT_ENTRY_DURATION) start() })
    } else start()
    return () => { stopWaiting(); animation?.stop() }
  }, [calls, entry, slide.static, target])

  return <motion.div className="endpoints" style={{ visibility: show }}>
    <motion.h1 className="endpoints__title" style={{ opacity: titleOpacity }}>One call. Many endpoints.</motion.h1>
    <svg className="endpoints__devices" viewBox="0 0 1280 720">
      {ENDPOINTS.map((device, i) => <Endpoint key={device.id} device={device} index={i} entry={entry} calls={calls} winner={winner} ringOrder={ringOrder} />)}
    </svg>
  </motion.div>
}
