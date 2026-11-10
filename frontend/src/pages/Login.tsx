import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Emblem } from '../components/layout/Emblem'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { RecordCard } from '../components/ui/Panels'
import { ApiError } from '../lib/api'
import { useAppData } from '../lib/store'

/** Sign-in for server mode. Accounts are created on the server; there is no sign-up. */
export function LoginPage() {
  const { login, auth, notice } = useAppData()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return setError('Enter your username and password.')
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : err.message
          : "Can't reach the server. Check that you're on your home network (or VPN) and try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <RecordCard className="w-full max-w-sm">
        <div className="flex items-center gap-3 px-5 h-14 border-b-2 border-border-strong">
          <Emblem size={26} />
          <span className="font-display text-[14px] font-semibold tracking-[0.14em] text-ink">UNIVERSITY OS</span>
        </div>
        {auth === 'checking' ? (
          <p className="p-6 text-sm text-ink-muted" aria-busy="true">
            Connecting…
          </p>
        ) : (
          <form onSubmit={submit} className="p-5 grid gap-4">
            <div>
              <div className="micro text-accent-strong mb-1">Personnel access</div>
              <h1 className="font-display text-2xl font-medium text-ink">Sign in</h1>
            </div>
            {notice && <p className="text-[13px] text-mustard-ink">{notice}</p>}
            <FormField label="Username" autoComplete="username" autoCapitalize="none" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
            <FormField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              error={error ?? undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="primary" disabled={busy} icon={<LogIn size={16} />}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </RecordCard>
    </div>
  )
}
