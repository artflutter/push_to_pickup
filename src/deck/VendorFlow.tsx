import { useEffect, useId, useState } from 'react'
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useTransform } from 'motion/react'
import { useSlide } from './slideContext'
import { followVendorPush, vendorCamera } from './Traveller'
import { VendorPush } from './VendorPush'
import { PUSH_ARROW_DURATION, PUSH_END, clamp, pushCamera } from './vendorPushMotion'

const ease = [0.22, 0.61, 0.36, 1] as const
const paths = [
  'M 436 202 H 774',
  'M 774 324 H 436',
]

/** One exchange, progressively annotated; the opening cloud is the same traveller. */
export function VendorFlow({ steps }: { steps: string[] }) {
  const slide = useSlide()
  const present = useIsPresent()
  useState(() => slide.register(6))
  const step = slide.static ? 4 : Math.max(0, Math.min(slide.step - 2, 4))
  const active = Math.max(0, step - 1)
  const arrowId = useId()
  const marker = `url(#${arrowId})`
  const delivery = useMotionValue(step >= 4 ? PUSH_END : 0)
  const cameraX = useTransform(delivery, (p) => pushCamera(p).x)
  const cameraY = useTransform(delivery, (p) => pushCamera(p).y)
  const tokens = useTransform(delivery, (p) => 1 - clamp(p / 0.05))

  useEffect(() => {
    if (slide.static || !present) return
    if (slide.active === false) { delivery.jump(0); return }
    // Re-entering at the deck's last-step sentinel shows the settled pose.
    if (slide.step > 6) delivery.jump(PUSH_END)
    // The arrow holds at 1 while the orb finishes its flight. Back starts
    // retracting immediately, even if the orb had already reached home.
    if (step < 4) delivery.set(Math.min(delivery.get(), 1))
    const releaseOrb = step >= 4 ? followVendorPush(delivery, slide.index) : undefined
    const animation = animate(delivery, step >= 4 ? PUSH_END : 0, {
      duration: step >= 4 ? (PUSH_END - delivery.get()) * PUSH_ARROW_DURATION : 1.35,
      ease: step >= 4 ? 'linear' : ease,
    })
    return () => { animation.stop(); releaseOrb?.() }
  }, [step, slide.step, slide.static, slide.active, slide.index, present, delivery])

  useEffect(() => {
    if (slide.static) return
    if (slide.active === false) {
      vendorCamera.x.jump(0)
      vendorCamera.y.jump(0)
      return
    }
    vendorCamera.x.set(cameraX.get())
    vendorCamera.y.set(cameraY.get())
    const offX = cameraX.on('change', (x) => vendorCamera.x.set(x))
    const offY = cameraY.on('change', (y) => vendorCamera.y.set(y))
    return () => { offX(); offY() }
  }, [slide.static, slide.active, cameraX, cameraY])

  return (
    <div className="vendor-flow">
      <svg className="vendor-flow__map" viewBox="0 0 1280 720">
        <defs>
          <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 2 1 L 7 5 L 2 9" fill="none" stroke="currentColor" strokeWidth="1.3" /></marker>
        </defs>
        <motion.g className="vendor-flow__world" style={{ x: cameraX, y: cameraY }}>
          {paths.map((d, i) => (
            <motion.path key={d} d={d} fill="none" stroke="currentColor" strokeWidth="2" markerEnd={marker}
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: step > i ? 1 : 0, opacity: step > i ? 0.95 : 0 }}
              transition={{ duration: 0.8, ease, delay: i === 0 && step === 1 ? 0.45 : 0 }} />
          ))}
          <motion.g initial={false} animate={{ opacity: step > 0 ? 1 : 0 }} transition={{ duration: 0.5, delay: step === 1 ? 0.45 : 0 }}>
            <text x="960" y="132" textAnchor="middle" className="vendor-flow__name">Backend</text>
            <rect x="790" y="160.54" width="340" height="178.92" rx="16" className="vendor-flow__outline" />
            <text x="612" y="178" textAnchor="middle" className="vendor-flow__packet">incoming call · webhook</text>
          </motion.g>
          {['called number', 'user', 'number owner'].map((label, i) => (
            <motion.g key={label} initial={false}
              animate={{ opacity: step >= 2 ? 1 : 0, y: step >= 2 ? 0 : -6 }}
              transition={{ duration: 0.35, delay: step === 2 ? i * 0.2 : 0 }}>
              {i > 0 && <path d={`M 830 ${196 + (i - 1) * 54 + 19} v 15 m -3 -3 l 3 3 l 3 -3`} className="vendor-flow__server-link" />}
              <g transform={`translate(830 ${196 + i * 54})`} className="vendor-flow__server-icon">
                <rect x="-17" y="-17" width="34" height="34" rx="10" strokeOpacity="0.45" />
                {i === 0 && <path d="M -3 -8 L -5 8 M 5 -8 L 3 8 M -8 -3 H 9 M -9 3 H 8" />}
                {i === 1 && <><circle cy="-5" r="4" /><path d="M -8 9 V 6 Q -8 1 0 1 Q 8 1 8 6 V 9" /></>}
                {i === 2 && <><circle cx="7" cy="0" r="2" /><path d="M 5 0 H -8 M -3 -5 L -8 0 L -3 5" /></>}
              </g>
              <text x="864" y={204 + i * 54} className="vendor-flow__lookup">{label}</text>
            </motion.g>
          ))}
          <motion.g initial={false} animate={{ opacity: step >= 2 ? 1 : 0 }} transition={{ duration: 0.5 }}>
            <text x="612" y="306" textAnchor="middle" className="vendor-flow__packet">ring user</text>
          </motion.g>
          <motion.g initial={false} animate={{ opacity: step >= 3 ? 1 : 0, y: step >= 3 ? 0 : -8 }} transition={{ duration: 0.5 }}>
            <motion.g style={{ opacity: tokens }}>
              <rect x="195" y="412" width="240" height="56" rx="10" className="vendor-flow__rule" />
              <rect x="187" y="420" width="240" height="56" rx="10" className="vendor-flow__rule" />
              <rect x="179" y="428" width="240" height="56" rx="10" className="vendor-flow__outline" />
              <text x="300" y="463" textAnchor="middle" className="vendor-flow__lookup">push tokens</text>
              <text x="300" y="515" textAnchor="middle" className="vendor-flow__packet">registered devices</text>
            </motion.g>
          </motion.g>
          <VendorPush progress={delivery} marker={marker} shown={step >= 3} />
        </motion.g>
      </svg>
      <AnimatePresence mode="wait" initial={false}>
        {step > 0 && step < 4 && <motion.div className="vendor-flow__caption" key={active} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
          <p>{steps[active]}</p>
        </motion.div>}
      </AnimatePresence>
    </div>
  )
}
