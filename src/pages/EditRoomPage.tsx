import { ChevronLeft, Pencil, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from 'zustand'
import { useParticipant } from '../hooks/useParticipant'
import { useParticipants } from '../hooks/useParticipants'
import { usePresenterAccess } from '../hooks/usePresenterAccess'
import { useRoom } from '../hooks/useRoom'
import { saveAndRestartRoom } from '../lib/rooms'
import { createEditorStore, EditorStoreContext } from '../store/editorStore'
import { useThemeStore } from '../store/themeStore'
import type { Presentation } from '../types/presentation'
import { AiPromptButton } from '../components/editor/AiPromptButton'
import { EditorWorkspace } from '../components/editor/EditorWorkspace'
import { ImportExportButtons } from '../components/editor/ImportExportButtons'
import { PresentationSettingsButton } from '../components/editor/PresentationSettingsButton'
import { FullScreenMessage } from '../components/layout/FullScreenMessage'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { PresenterAccessDenied } from '../components/present/PresenterAccessDenied'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Input } from '../components/ui/Input'

/** Forma comparável da apresentação, para saber se algo mudou desde a carga. */
function snapshot(presentation: Presentation): string {
  const { title, settings, slides } = presentation
  return JSON.stringify({ title, settings, slides })
}

/**
 * Edição de uma sala já iniciada: o mesmo editor da criação, carregado com o
 * que está no ar (título, opções globais, slides e opções de cada slide).
 *
 * Salvar recomeça a apresentação do primeiro slide para todos (ver
 * `saveAndRestartRoom`), por isso pede confirmação dizendo quantas pessoas
 * serão levadas de volta ao início. Enquanto o apresentador edita, a plateia
 * continua no slide em que estava.
 *
 * O editor desta tela é só dela (`createEditorStore`): o rascunho da tela de
 * criação não é tocado, e sair sem salvar não deixa rastro.
 */
export function EditRoomPage() {
  const { code, token } = useParams<{ code: string; token?: string }>()
  const navigate = useNavigate()
  const { room, loading, error: roomError } = useRoom(code)
  const { uid } = useParticipant()
  const access = usePresenterAccess(code, token, room, uid)
  const participants = useParticipants(code)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  const [store] = useState(createEditorStore)
  const title = useStore(store, (s) => s.title)
  const setTitle = useStore(store, (s) => s.setTitle)
  const slides = useStore(store, (s) => s.slides)
  const settings = useStore(store, (s) => s.settings)

  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'save' | 'discard' | null>(null)
  const [saving, setSaving] = useState(false)

  // A sala é carregada no editor uma única vez. Os snapshots seguintes (o
  // documento muda a cada troca de slide ou cronômetro) não podem atropelar o
  // que o apresentador está editando; por isso a leitura é pela referência.
  const roomRef = useRef(room)
  roomRef.current = room
  const [baseline, setBaseline] = useState<string | null>(null)
  const canLoad = access === 'granted' && room !== null
  useEffect(() => {
    const current = roomRef.current
    if (!canLoad || baseline !== null || !current) return
    const { loadPresentation, getPresentation } = store.getState()
    loadPresentation({
      title: current.title,
      slides: current.slides,
      settings: current.settings,
    })
    setBaseline(snapshot(getPresentation()))
  }, [canLoad, baseline, store])

  const dirty = baseline !== null && snapshot({ title, slides, settings }) !== baseline
  const presentPath = `/present/${code}${token ? `/${token}` : ''}`

  function requestSave() {
    if (slides.length === 0) {
      setError('A apresentação precisa de ao menos um slide.')
      return
    }
    setError(null)
    setDialog('save')
  }

  async function save() {
    if (!code) return
    setSaving(true)
    try {
      await saveAndRestartRoom(code, store.getState().getPresentation())
      // O apresentador também volta ao início: a tela de apresentação já abre
      // no primeiro slide, que é o que a sala diz agora.
      navigate(presentPath)
    } catch (e) {
      setError(`Não foi possível salvar as alterações: ${(e as Error).message}`)
      setSaving(false)
      setDialog(null)
    }
  }

  function leave() {
    if (dirty) setDialog('discard')
    else navigate(presentPath)
  }

  if (loading) {
    return <FullScreenMessage>Carregando sala…</FullScreenMessage>
  }
  if (roomError) {
    return <FullScreenMessage>Erro ao carregar a sala: {roomError}</FullScreenMessage>
  }
  if (!room || !code) {
    return (
      <FullScreenMessage>
        Sala não encontrada.
        <Button className="mt-4" onClick={() => navigate('/')}>
          Voltar ao início
        </Button>
      </FullScreenMessage>
    )
  }
  if (access === 'checking') {
    return <FullScreenMessage>Verificando acesso de apresentador…</FullScreenMessage>
  }
  if (access === 'denied') {
    return <PresenterAccessDenied code={code} />
  }
  if (baseline === null) {
    return <FullScreenMessage>Abrindo a apresentação no editor…</FullScreenMessage>
  }

  const count = participants.length

  return (
    <EditorStoreContext.Provider value={store}>
      {/* Mesmo layout da criação: em telas grandes, altura da janela e colunas
          com rolagem própria. */}
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
        <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={leave}>
            <ChevronLeft size={16} /> Voltar à apresentação
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
            <Button
              size="sm"
              onClick={requestSave}
              disabled={!dirty || saving}
              title={dirty ? 'Salvar e recomeçar a apresentação' : 'Nenhuma alteração para salvar'}
            >
              <Save size={16} /> Salvar alterações
            </Button>
          </div>
        </div>

        <div className="shrink-0">
          <Banner tone="info" icon={<Pencil size={16} />} className="mb-4">
            Editando a sala <strong className="tracking-widest">{code}</strong>, que já está em
            andamento. Ao salvar, a apresentação recomeça do primeiro slide para todos.
          </Banner>
          {error && (
            <Banner tone="error" className="mb-4">
              {error}
            </Banner>
          )}
        </div>

        <EditorWorkspace />
      </div>

      <ConfirmDialog
        open={dialog === 'save'}
        title="Salvar e voltar ao início?"
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <RotateCcw size={20} />
          </span>
        }
        confirmLabel={saving ? 'Salvando…' : 'Salvar e reiniciar'}
        busy={saving}
        onConfirm={() => void save()}
        onCancel={() => setDialog(null)}
      >
        <p>
          {count === 0 ? (
            <>
              Ninguém entrou na sala ainda. Ao salvar, a apresentação volta para o
              primeiro slide, inclusive para você.
            </>
          ) : count === 1 ? (
            <>
              Há <strong>1 participante</strong> nesta sala. Ao salvar, essa pessoa será
              redirecionada para o início da apresentação, assim como você.
            </>
          ) : (
            <>
              Há <strong>{count} participantes</strong> nesta sala. Ao salvar, todos serão
              redirecionados para o início da apresentação, assim como você.
            </>
          )}
        </p>
        <p>
          Os cronômetros das perguntas recomeçam e os gabaritos voltam a ter o
          suspense da revelação. As respostas já enviadas continuam guardadas.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'discard'}
        title="Descartar as alterações?"
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
            <Trash2 size={20} />
          </span>
        }
        tone="danger"
        confirmLabel="Descartar e voltar"
        cancelLabel="Continuar editando"
        onConfirm={() => navigate(presentPath)}
        onCancel={() => setDialog(null)}
      >
        <p>
          O que foi mudado aqui ainda não foi salvo. Voltando agora, a sala continua
          como estava e ninguém é redirecionado.
        </p>
      </ConfirmDialog>
    </EditorStoreContext.Provider>
  )
}
