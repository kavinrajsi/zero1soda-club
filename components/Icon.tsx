// Material Symbols (Outlined, weight 400) paths, drawn on the 0 -960 960 960 grid.
const PATHS = {
  menu: 'M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z',
  close:
    'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z',
  arrow_outward: 'm256-240-56-56 384-384H240v-80h480v480h-80v-344L256-240Z',
  remove: 'M200-440v-80h560v80H200Z',
  add: 'M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z',
} as const

type Props = {
  name: keyof typeof PATHS
  size?: number
  className?: string
}

/** Decorative icon; give the surrounding control its accessible name. */
export default function Icon({ name, size = 24, className }: Props) {
  return (
    <svg
      className={className ? `z1-icon ${className}` : 'z1-icon'}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
