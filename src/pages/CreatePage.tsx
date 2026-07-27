import { ChevronLeft, FileDown, FileUp, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParticipant } from '../hooks/useParticipant'
import { useEditorStore } from '../store/editorStore'
import { useThemeStore } from '../store/themeStore'
import { createRoom } from '../lib/rooms'
import { isFirebaseConfigured } from '../lib/firebase'
import { exportPresentation, importPresentationFromFile } from '../utils/importExport'
import { AddSlideMenu } from '../components/editor/AddSlideMenu'
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
  const selectedIndex = useEditorStore((s) => s.selectedIndex)
  const getPresentation = useEditorStore((s) => s.getPresentation)
  const loadPresentation = useEditorStore((s) => s.loadPresentation)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedSlide = slides[selectedIndex]

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
      const code = await createRoom(uid, getPresentation())
      navigate(`/present/${code}`)
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
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Barra superior */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
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

      {/* Editor em 3 colunas */}
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Coluna 1: slides */}
        <div className="space-y-4">
          <Card className="p-3">
            <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              Adicionar slide
            </h2>
            <AddSlideMenu />
          </Card>
          <Card className="p-3">
            <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              Slides ({slides.length})
            </h2>
            <SlideList />
          </Card>
        </div>

        {/* Coluna 2: configuração do slide */}
        <Card className="p-4">
          <h2 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            Configuração
          </h2>
          {selectedSlide ? (
            <SlideEditor slide={selectedSlide} />
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Selecione ou adicione um slide para editar.
            </p>
          )}
        </Card>

        {/* Coluna 3: prévia */}
        <Card className="flex flex-col p-4">
          <h2 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            Prévia
          </h2>
          <div className="min-h-[360px] flex-1">
            {selectedSlide ? (
              <SlideDisplay slide={selectedSlide} responses={[]} />
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
