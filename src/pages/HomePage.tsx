import { BarChart3, Presentation, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '../store/themeStore'
import { PageShell } from '../components/layout/PageShell'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export function HomePage() {
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  return (
    <PageShell>
      <div className="flex justify-end">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <header className="mx-auto mb-12 max-w-2xl pt-8 text-center">
        <div className="mb-4 flex justify-center">
          <BarChart3 size={56} strokeWidth={1.5} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 md:text-5xl">
          Apresentação Interativa
        </h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
          Crie enquetes, nuvens de palavras e gráficos ao vivo. A plateia participa
          pelo celular, sem instalar nada e sem criar conta.
        </p>
      </header>

      <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <Presentation size={40} strokeWidth={1.5} className="text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
              Criar apresentação
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Monte seus slides e apresente.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={() => navigate('/create')}>
            Criar sala
          </Button>
        </Card>

        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <Users size={40} strokeWidth={1.5} className="text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
              Entrar em uma sala
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Tenha o código em mãos e participe.
            </p>
          </div>
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/join')}
          >
            Entrar na sala
          </Button>
        </Card>
      </div>
    </PageShell>
  )
}
