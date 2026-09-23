import type { StaffSession } from '@/lib/auth/session'

type Props = {
  session: StaffSession
  title: string
  /** Rendered on the right of the title row, e.g. a back link. */
  action?: React.ReactNode
}

export default function StaffBar({ session, title, action }: Props) {
  return (
    <header className="staff-bar">
      <div className="staff-bar__row">
        <p className="staff-bar__kicker">CLUB ZERO1 · {session.role.toUpperCase()}</p>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="staff-bar__signout">
            Sign out
          </button>
        </form>
      </div>
      <div className="staff-bar__row staff-bar__row--title">
        <h1 className="staff-bar__title">{title}</h1>
        {action}
      </div>
      <p className="staff-bar__who">{session.displayName}</p>
    </header>
  )
}
