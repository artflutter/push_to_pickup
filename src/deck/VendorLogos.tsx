import { useId } from 'react'
import { animate, motion, motionValue, useTransform, type MotionValue } from 'motion/react'

const logos = [
  { name: 'Twilio', file: 'twilio', x: 25, y: 110, width: 190, height: 68.6 },
  { name: 'Telnyx', file: 'telnyx', x: 260, y: 20, width: 180, height: 56.25 },
  { name: 'Vonage', file: 'vonage', x: 495, y: 110, width: 200, height: 43.25 },
].map(logo => ({ ...logo, reveal: motionValue(0) }))

/** Separate springs stagger the rise and remain reversible during a fast click. */
export function cueVendorLogos(shown: boolean, immediate = false) {
  const animations = logos.map((logo, i) => {
    logo.reveal.stop()
    if (immediate) {
      logo.reveal.jump(shown ? 1 : 0)
      return
    }
    return animate(logo.reveal, shown ? 1 : 0, {
      type: 'spring', stiffness: shown ? 110 : 150, damping: shown ? 16 : 22,
      delay: shown ? i * 0.1 : (logos.length - 1 - i) * 0.04,
      restDelta: 0.001, restSpeed: 0.01,
    })
  })
  return () => animations.forEach(animation => animation?.stop())
}

function VendorLogo({ logo }: { logo: typeof logos[number] }) {
  // Allow the settling bounce above the cloud, but never overshoot the hidden
  // position and emerge from its lower edge when a spring is interrupted.
  const progress = useTransform(logo.reveal, p => Math.max(0, Math.min(1.06, p)))
  const x = useTransform(progress, p => 260 + (logo.x - 260) * p)
  const y = useTransform(progress, p => 280 + (logo.y - 280) * p)
  return (
    <motion.g style={{ x, y }} data-vendor={logo.file}>
      <image href={`${import.meta.env.BASE_URL}brand/vendors/${logo.file}.svg`}
        x={-logo.width / 2} y={-logo.height / 2} width={logo.width} height={logo.height}>
        <title>{logo.name}</title>
      </image>
    </motion.g>
  )
}

/** The inverse of the vessel's actual outline hides the artwork behind its skin. */
export function VendorLogos({ outline, opacity }: { outline: MotionValue<string>; opacity: MotionValue<number> }) {
  const mask = useId()
  return (
    <motion.svg className="vessel__logos" viewBox="0 0 520 520" style={{ opacity }} aria-label="Twilio, Telnyx, Vonage">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="-400" y="-400" width="1320" height="1320" style={{ maskType: 'luminance' }}>
          <rect x="-400" y="-400" width="1320" height="1320" fill="white" />
          <motion.path d={outline} fill="black" stroke="black" strokeWidth="3" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`}>
        {logos.map(logo => <VendorLogo key={logo.file} logo={logo} />)}
      </g>
    </motion.svg>
  )
}
