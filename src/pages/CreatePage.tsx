import { ChevronLeft, FilePlus2, Play, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParticipant } from '../hooks/useParticipant'
import { defaultEditorStore, useEditorStore } from '../store/editorStore'
import { discardDraft, startDraftPersistence, useDraftStatus } from '../store/editorDraft'
import { createRoom } from '../lib/rooms'
import { savePresenterSession } from '../lib/presenterSessions'
import { isFirebaseConfigured } from '../lib/firebase'
import { EditorToolbar } from '../components/editor/EditorToolbar'
import { EditorWorkspace } from '../components/editor/EditorWorkspace'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

export function CreatePage() {
  // O rascunho desta tela fica no navegador: restaurado na primeira
  // renderização (antes de qualquer leitura do editor, para não piscar o
  // editor vazio) e gravado a cada mudança.
  useState(() => startDraftPersistence(defaultEditorStore))
  const navigate = useNavigate()
  const { uid, error: authError } = useParticipant()

  const title = useEditorStore((s) => s.title)
  const setTitle = useEditorStore((s) => s.setTitle)
  const slideCount = useEditorStore((s) => s.slides.length)
  const getPresentation = useEditorStore((s) => s.getPresentation)

  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const draftStatus = useDraftStatus((s) => s.status)
  const draftLabel =
    draftStatus === 'saving'
      ? 'Salvando…'
      : draftStatus === 'saved'
        ? 'Rascunho salvo neste navegador'
        : draftStatus === 'error'
          ? 'Não foi possível salvar o rascunho'
          : null

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
    // Ocupa a largura inteira da janela: em telas largas a prévia ganha espaço.
    <div className="flex min-h-[100dvh] w-full flex-col px-4 py-4 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      {/* Barra superior */}
      <div className="mb-4 shrink-0">
        <EditorToolbar
          back={
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 px-2 sm:px-3"
              onClick={() => navigate('/')}
              aria-label="Início"
              title="Início"
            >
              <ChevronLeft size={16} /> <span className="hidden sm:inline">Início</span>
            </Button>
          }
          title={title}
          onTitleChange={setTitle}
          onImportError={setError}
          status={draftLabel}
          rareItems={[
            {
              key: 'discard',
              label: 'Começar do zero',
              hint: 'Esvazia o editor e apaga o rascunho deste navegador',
              icon: <FilePlus2 size={16} />,
              danger: true,
              onSelect: () => setConfirmDiscard(true),
            },
          ]}
          primary={
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => void startPresentation()}
              disabled={starting}
            >
              <Play size={16} /> {starting ? 'Iniciando…' : 'Iniciar apresentação'}
            </Button>
          }
        />
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

      <ConfirmDialog
        open={confirmDiscard}
        title="Começar uma apresentação nova?"
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
            <Trash2 size={20} />
          </span>
        }
        tone="danger"
        confirmLabel="Apagar e começar do zero"
        onConfirm={() => {
          setConfirmDiscard(false)
          setError(null)
          void discardDraft(defaultEditorStore)
        }}
        onCancel={() => setConfirmDiscard(false)}
      >
        <p>
          O editor fica vazio e o rascunho guardado neste navegador é apagado. Se quiser
          guardar o que montou, use Exportar antes.
        </p>
      </ConfirmDialog>
    </div>
  )
}
