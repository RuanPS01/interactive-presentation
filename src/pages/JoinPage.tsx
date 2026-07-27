import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '../store/themeStore'
import { normalizeRoomCode } from '../lib/roomCode'
import { PageShell } from '../components/layout/PageShell'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export function JoinPage() {
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  const [code, setCode] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalized = normalizeRoomCode(code)
    if (normalized) navigate(`/room/${normalized}`)
  }

  return (
    <PageShell>
      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ChevronLeft size={16} /> Início
        </Button>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <div className="mx-auto max-w-md pt-16">
        <Card className="p-8">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            Entrar em uma sala
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Digite o código exibido pelo apresentador.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex.: ABC123"
              className="text-center text-2xl font-bold tracking-[0.3em]"
              maxLength={10}
              autoFocus
              autoComplete="off"
            />
            <Button type="submit" size="lg" className="w-full" disabled={!code.trim()}>
              Entrar
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  )
}
