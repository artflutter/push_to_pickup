import { motion, useTransform, type MotionValue } from 'motion/react'
import { ANDROID_X, IOS_X, PLATFORM_Y, STEM_END, branchFrame, clamp, stemFrame } from './vendorPushMotion'

// Ionicons v4.6.3, logo-apple / logo-android (MIT).
// https://github.com/ionic-team/ionicons/tree/v4.6.3/src/svg
// License: public/brand/platforms/LICENSE-ionicons.txt
const APPLE = [
  'M333.6,153.9c-33.6,0-47.8,16.5-71.2,16.5c-24,0-42.3-16.4-71.4-16.4c-28.5,0-58.9,17.9-78.2,48.4c-27.1,43-22.5,124,21.4,193c15.7,24.7,36.7,52.4,64.2,52.7c0.2,0,0.3,0,0.5,0c23.9,0,31-16.1,63.9-16.3c0.2,0,0.3,0,0.5,0c32.4,0,38.9,16.2,62.7,16.2c0.2,0,0.3,0,0.5,0c27.5-0.3,49.6-31,65.3-55.6c11.3-17.7,15.5-26.6,24.2-46.6c-63.5-24.8-73.7-117.4-10.9-152.9C385.9,168.2,359,153.9,333.6,153.9L333.6,153.9z',
  'M326.2,64c-20,1.4-43.3,14.5-57,31.6c-12.4,15.5-22.6,38.5-18.6,60.8c0.5,0,1,0,1.6,0c21.3,0,43.1-13.2,55.8-30.1C320.3,110.2,329.6,87.4,326.2,64L326.2,64z',
]
const ANDROID = [
  'M144,268.4V358c0,6.9,4.5,14,11.4,14H184v52c0,13.3,10.7,24,24,24s24-10.7,24-24v-52h49v52c0,7.5,3.4,14.2,8.8,18.6c3.9,3.4,9.1,5.4,14.7,5.4c0.1,0,0.2,0,0.3,0c0.1,0,0.1,0,0.2,0c13.3,0,24-10.7,24-24v-52h27.6c7,0,11.4-7.1,11.4-13.9v-89.6V192H144V268.4z',
  'M408,176c-13.3,0-24,10.7-24,24v96c0,13.3,10.7,24,24,24s24-10.7,24-24v-96C432,186.7,421.3,176,408,176z',
  'M104,176c-13.3,0-24,10.7-24,24v96c0,13.3,10.7,24,24,24s24-10.7,24-24v-96C128,186.7,117.3,176,104,176z',
  'M311.2,89.1l18.5-21.9c0.4-0.5-0.2-1.6-1.3-2.5c-1.1-0.8-2.4-1-2.7-0.4l-19.2,22.8c-13.6-5.4-30.2-8.8-50.6-8.8c-20.5-0.1-37.2,3.2-50.8,8.5l-19-22.4c-0.4-0.5-1.6-0.4-2.7,0.4c-1.1,0.8-1.7,1.8-1.3,2.5l18.3,21.6c-48.2,20.9-55.4,72.2-56.4,87.2h223.6C366.7,161,359.6,110.4,311.2,89.1z M206.8,138.9c-7.4,0-13.5-6-13.5-13.3c0-7.3,6-13.3,13.5-13.3c7.4,0,13.5,6,13.5,13.3C220.3,132.9,214.3,138.9,206.8,138.9z M305.2,138.9c-7.4,0-13.5-6-13.5-13.3c0-7.3,6-13.3,13.5-13.3c7.4,0,13.5,6,13.5,13.3C318.7,132.9,312.6,138.9,305.2,138.9z',
]

function Platform({ progress, kind, x }: { progress: MotionValue<number>; kind: 'ios' | 'android'; x: number }) {
  const outline = useTransform(progress, (p) => clamp((p - 0.76) / 0.18))
  const label = useTransform(progress, (p) => clamp((p - 0.94) / 0.06))
  const paths = kind === 'ios' ? APPLE : ANDROID
  return (
    <g className={`vendor-flow__platform vendor-flow__platform--${kind}`} aria-label={kind === 'ios' ? 'iOS: VoIP push' : 'Android: FCM push'}
      transform={`translate(${x} ${PLATFORM_Y + 108}) scale(1.5) translate(${-x} ${-PLATFORM_Y - 108})`}>
      <motion.g style={{ opacity: outline }}>
        <g transform={`translate(${x - 144} ${PLATFORM_Y - 144}) scale(0.5625)`} className="vendor-flow__os-logo">
          {paths.map((d, i) => <path key={i} d={d} />)}
        </g>
      </motion.g>
      <motion.text x={x} y={PLATFORM_Y + (kind === 'ios' ? 20 : 7)} textAnchor="middle"
        className="vendor-flow__push-kind" style={{ opacity: label }}>
        <tspan x={x}>{kind === 'ios' ? 'VoIP' : 'FCM'}</tspan>
        <tspan x={x} dy="32">push</tspan>
      </motion.text>
    </g>
  )
}

/** The token-lookup arrow itself grows into the delivery to both platforms. */
export function VendorPush({ progress, marker, shown }: { progress: MotionValue<number>; marker: string; shown: boolean }) {
  const stem = useTransform(progress, (p) => stemFrame(p).d)
  const headPath = useTransform(progress, (p) => {
    const { x, y, angle } = stemFrame(p)
    const dx = Math.cos(angle * Math.PI / 180)
    const dy = Math.sin(angle * Math.PI / 180)
    return `M ${x - 8 * dx - 6 * dy} ${y - 8 * dy + 6 * dx} L ${x} ${y} L ${x - 8 * dx + 6 * dy} ${y - 8 * dy - 6 * dx}`
  })
  const visible = useTransform(progress, (p) => clamp(p / 0.025))
  const head = useTransform(progress, (p) => p <= STEM_END ? 1 : 0)
  const packet = useTransform(progress, (p) => clamp((stemFrame(p).x - 600) / 100))
  const branches = useTransform(progress, (p) => p > STEM_END ? 1 : 0)
  const ios = useTransform(progress, (p) => branchFrame(p, IOS_X).d)
  const android = useTransform(progress, (p) => branchFrame(p, ANDROID_X).d)
  return (
    <motion.g className="vendor-flow__delivery" initial={false} animate={{ opacity: shown ? 1 : 0 }} transition={{ duration: 0.5 }}>
      <motion.path d={stem} className="vendor-flow__push-path" initial={{ pathLength: 0 }} animate={{ pathLength: shown ? 1 : 0 }} transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }} />
      <motion.path d={headPath} className="vendor-flow__push-path" style={{ opacity: head }} />
      <motion.g style={{ opacity: branches }}>
        <motion.path d={ios} className="vendor-flow__push-path" markerEnd={marker} />
        <motion.path d={android} className="vendor-flow__push-path" markerEnd={marker} />
      </motion.g>
      <motion.text x="650" y="568" textAnchor="middle" className="vendor-flow__packet" style={{ opacity: packet }}>push</motion.text>
      <motion.g style={{ opacity: visible }}>
        <Platform progress={progress} kind="ios" x={IOS_X} />
        <Platform progress={progress} kind="android" x={ANDROID_X} />
      </motion.g>
    </motion.g>
  )
}
