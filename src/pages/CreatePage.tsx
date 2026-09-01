import { ChevronLeft, FileDown, FileUp, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParticipant } from '../hooks/useParticipant'
import { useEditorStore } from '../store/editorStore'
import { useThemeStore } from '../store/themeStore'
import { createRoom } from '../lib/rooms'
import { savePresenterSession } from '../lib/presenterSessions'
import { isFirebaseConfigured } from '../lib/firebase'
import { exportPresentation, importPresentationFromFile } from '../utils/importExport'
import { resolveSlideSettings } from '../utils/settings'
import { slideTimerSeconds } from '../utils/timer'
import { AddSlideMenu } from '../components/editor/AddSlideMenu'
import { AiPromptButton } from '../components/editor/AiPromptButton'
import { PresentationSettingsButton } from '../components/editor/PresentationSettingsButton'
import { SlideList } from '../components/editor/SlideList'
import { SlideEditor } from '../components/editor/SlideEditor'
import { SlideDisplay } from '../components/slides/SlideDisplay'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export function CreatePage() {
  const navigate = useNavigate()
  const { uid, error: authError } = useParticipant()

  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const title = useEditorStore((s) => s.title)
  const setTitle = useEditorStore((s) => s.setTitle)
  const slides = useEditorStore((s) => s.slides)
  const settings = useEditorStore((s) => s.settings)
  const selectedIndex = useEditorStore((s) => s.selectedIndex)
  const getPresentation = useEditorStore((s) => s.getPresentation)
  const loadPresentation = useEditorStore((s) => s.loadPresentation)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedSlide = slides[selectedIndex]
  const previewSettings = resolveSlideSettings(settings, selectedSlide)
  // A prévia mostra o cronômetro parado no tempo configurado, para o
  // apresentador conferir como o slide fica com ele na tela.
  const previewTimerSeconds = slideTimerSeconds(selectedSlide, previewSettings)

  async function startPresentation() {
    if (!uid) {
      setError(
        authError
          ? `Não foi possível autenticar no Firebase: ${authError}. Verifique se a Autenticação Anônima está ativada no projeto (veja o README).`
          : 'Conectando ao Firebase… aguarde um instante e tente novamente.',
      )
      return
    }
    if (slides.length === 0) {
      setError('Adicione ao menos um slide antes de iniciar.')
      return
    }
    setStarting(true)
    setError(null)
    try {
      const presentation = getPresentation()
      const { code, token } = await createRoom(uid, presentation)
      // Lembra a sessão neste dispositivo (retomar/reexportar pela tela inicial).
      savePresenterSession({ code, token, title: presentation.title })
      navigate(`/present/${code}/${token}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const result = await importPresentationFromFile(file)
    if (result.ok) {
      loadPresentation(result.presentation)
      setError(null)
    } else {
      setError(result.error)
    }
  }

  return (
    // Em telas grandes o editor ocupa exatamente a altura da janela e cada
    // coluna rola por conta própria — a página não cresce conforme os slides
    // são adicionados. Abaixo de `lg` volta ao empilhamento natural.
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      {/* Barra superior */}
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ChevronLeft size={16} /> Início
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da apresentação"
          className="max-w-xs flex-1"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <PresentationSettingsButton />
          <AiPromptButton />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <FileUp size={16} /> Importar JSON
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportPresentation(getPresentation())}
          >
            <FileDown size={16} /> Exportar JSON
          </Button>
          <Button size="sm" onClick={() => void startPresentation()} disabled={starting}>
            <Play size={16} /> {starting ? 'Iniciando…' : 'Iniciar apresentação'}
          </Button>
        </div>
      </div>

      <div className="shrink-0">
        {!isFirebaseConfigured && (
          <Banner tone="warning">
            Firebase não configurado. Copie <code>.env.example</code> para <code>.env</code> e
            preencha as chaves <code>VITE_FIREBASE_*</code> para iniciar salas (veja o README).
          </Banner>
        )}
        {isFirebaseConfigured && authError && (
          <Banner tone="error">
            Falha na autenticação anônima do Firebase: {authError}. Ative{' '}
            <strong>Authentication → Sign-in method → Anônimo</strong> no console do Firebase.
          </Banner>
        )}
        {error && <Banner tone="error">{error}</Banner>}
      </div>

      {/* Editor em 3 colunas, cada uma com rolagem independente. */}
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Coluna 1: adicionar + lista de slides */}
        <div className="flex flex-col gap-4 lg:min-h-0">
          <Card className="shrink-0 p-3">
            <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              Adicionar slide
            </h2>
            <AddSlideMenu />
          </Card>
          <Card className="flex flex-col p-3 lg:min-h-0 lg:flex-1">
            <h2 className="mb-2 shrink-0 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              Slides ({slides.length})
            </h2>
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
              <SlideList />
            </div>
          </Card>
        </div>

        {/* Coluna 2: configuração do slide */}
        <Card className="flex flex-col p-4 lg:min-h-0">
          <h2 className="mb-4 shrink-0 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            Configuração
          </h2>
          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {selectedSlide ? (
              <SlideEditor slide={selectedSlide} />
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Selecione ou adicione um slide para editar.
              </p>
            )}
          </div>
        </Card>

        {/* Coluna 3: prévia */}
        <Card className="flex flex-col p-4 lg:min-h-0">
          <h2 className="mb-4 shrink-0 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            Prévia
          </h2>
          <div className="min-h-[360px] flex-1 overflow-auto lg:min-h-0">
            {selectedSlide ? (
              <SlideDisplay
                slide={selectedSlide}
                slides={slides}
                responses={[]}
                settings={previewSettings}
                countdown={
                  previewTimerSeconds > 0
                    ? { endsAt: null, remainingMs: previewTimerSeconds * 1000 }
                    : null
                }
              />
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Sem slide.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Banner({
  tone,
  children,
}: {
  tone: 'warning' | 'error'
  children: React.ReactNode
}) {
  const styles =
    tone === 'error'
      ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
      : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
  return (
    <div className={`mb-4 rounded-lg border p-3 text-sm ${styles}`}>{children}</div>
  )
}
