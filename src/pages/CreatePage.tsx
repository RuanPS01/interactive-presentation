import { ChevronLeft, Play } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParticipant } from '../hooks/useParticipant'
import { useEditorStore } from '../store/editorStore'
import { useThemeStore } from '../store/themeStore'
import { createRoom } from '../lib/rooms'
import { savePresenterSession } from '../lib/presenterSessions'
import { isFirebaseConfigured } from '../lib/firebase'
import { AiPromptButton } from '../components/editor/AiPromptButton'
import { EditorWorkspace } from '../components/editor/EditorWorkspace'
import { ImportExportButtons } from '../components/editor/ImportExportButtons'
import { PresentationSettingsButton } from '../components/editor/PresentationSettingsButton'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function CreatePage() {
  const navigate = useNavigate()
  const { uid, error: authError } = useParticipant()

  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const title = useEditorStore((s) => s.title)
  const setTitle = useEditorStore((s) => s.setTitle)
  const slideCount = useEditorStore((s) => s.slides.length)
  const getPresentation = useEditorStore((s) => s.getPresentation)

  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startPresentation() {
    if (!uid) {
      setError(
        authError
          ? `Não foi possível autenticar no Firebase: ${authError}. Verifique se a Autenticação Anônima está ativada no projeto (veja o README).`
          : 'Conectando ao Firebase… aguarde um instante e tente novamente.',
      )
      return
    }
    if (slideCount === 0) {
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

  return (
    // Em telas grandes o editor ocupa exatamente a altura da janela e cada
    // coluna rola por conta própria (ver `EditorWorkspace`).
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
          aria-label="Título da apresentação"
          className="max-w-xs flex-1"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <PresentationSettingsButton />
          <AiPromptButton />
          <ImportExportButtons onError={setError} />
          <Button size="sm" onClick={() => void startPresentation()} disabled={starting}>
            <Play size={16} /> {starting ? 'Iniciando…' : 'Iniciar apresentação'}
          </Button>
        </div>
      </div>

      <div className="shrink-0">
        {!isFirebaseConfigured && (
          <Banner tone="warning" className="mb-4">
            Firebase não configurado. Copie <code>.env.example</code> para <code>.env</code> e
            preencha as chaves <code>VITE_FIREBASE_*</code> para iniciar salas (veja o README).
          </Banner>
        )}
        {isFirebaseConfigured && authError && (
          <Banner tone="error" className="mb-4">
            Falha na autenticação anônima do Firebase: {authError}. Ative{' '}
            <strong>Authentication → Sign-in method → Anônimo</strong> no console do Firebase.
          </Banner>
        )}
        {error && (
          <Banner tone="error" className="mb-4">
            {error}
          </Banner>
        )}
      </div>

      <EditorWorkspace />
    </div>
  )
}
