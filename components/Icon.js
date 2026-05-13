import { Lock } from '@phosphor-icons/react/Lock'
import { LockOpen } from '@phosphor-icons/react/LockOpen'
import { EyeSlash } from '@phosphor-icons/react/EyeSlash'
import { Briefcase } from '@phosphor-icons/react/Briefcase'
import { Scales } from '@phosphor-icons/react/Scales'
import { CurrencyCircleDollar } from '@phosphor-icons/react/CurrencyCircleDollar'
import { TrendUp } from '@phosphor-icons/react/TrendUp'
import { Fire } from '@phosphor-icons/react/Fire'
import { CalendarDots } from '@phosphor-icons/react/CalendarDots'
import { Clock } from '@phosphor-icons/react/Clock'
import { MapPin } from '@phosphor-icons/react/MapPin'
import { TreePalm } from '@phosphor-icons/react/TreePalm'
import { ClipboardText } from '@phosphor-icons/react/ClipboardText'
import { FirstAidKit } from '@phosphor-icons/react/FirstAidKit'
import { ChartBar } from '@phosphor-icons/react/ChartBar'
import { Check } from '@phosphor-icons/react/Check'
import { X } from '@phosphor-icons/react/X'
import { PencilSimple } from '@phosphor-icons/react/PencilSimple'
import { Star } from '@phosphor-icons/react/Star'
import { Sparkle } from '@phosphor-icons/react/Sparkle'
import { Confetti } from '@phosphor-icons/react/Confetti'
import { Paperclip } from '@phosphor-icons/react/Paperclip'
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass'
import { HourglassMedium } from '@phosphor-icons/react/HourglassMedium'

const map = {
  lock: Lock,
  unlock: LockOpen,
  seeNoEvil: EyeSlash,
  briefcase: Briefcase,
  scale: Scales,
  coins: CurrencyCircleDollar,
  trendUp: TrendUp,
  fire: Fire,
  calendar: CalendarDots,
  clock: Clock,
  mapPin: MapPin,
  palmTree: TreePalm,
  clipboard: ClipboardText,
  hospital: FirstAidKit,
  chart: ChartBar,
  check: Check,
  close: X,
  edit: PencilSimple,
  star: Star,
  sparkle: Sparkle,
  party: Confetti,
  paperclip: Paperclip,
  search: MagnifyingGlass,
  hourglass: HourglassMedium,
}

export default function Icon({ name, size = 24, color = 'currentColor', style, className }) {
  const Comp = map[name]
  if (!Comp) return null

  const hasFill = style?.fill && style.fill !== 'none'
  const weight = hasFill ? 'fill' : 'duotone'

  return (
    <Comp
      size={size}
      color={color}
      weight={weight}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style, fill: undefined }}
      className={className}
    />
  )
}
