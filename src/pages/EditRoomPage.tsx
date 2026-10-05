import { ChevronLeft, Pencil, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from 'zustand'
import { useParticipant } from '../hooks/useParticipant'
import { useParticipants } from '../hooks/useParticipants'
import { usePresenterAccess } from '../hooks/usePresenterAccess'
import { useRoom } from '../hooks/useRoom'
import { saveAndRestartRoom } from '../lib/rooms'
import type { StoredRoomFiles } from '../lib/rooms'
import { fetchAssets } from '../lib/assets'
import { fetchRoomFonts } from '../lib/fonts'
import { fetchAnswers, withAnswers } from '../lib/answers'
import { collectAssetIds } from '../utils/freeSlide'
import { createEditorStore, EditorStoreContext } from '../store/editorStore'
import type { Presentation } from '../types/presentation'
import { EditorToolbar } from '../components/editor/EditorToolbar'
import { EditorWorkspace } from '../components/editor/EditorWorkspace'
import { FullScreenMessage } from '../components/layout/FullScreenMessage'
import { PresenterAccessDenied } from '../components/present/PresenterAccessDenied'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

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
  // Imagens e fontes que a sala já tem: ao salvar, só as novas são enviadas.
  const stored = useRef<StoredRoomFiles>({ assetIds: [], fontDocIds: {} })
  const canLoad = access === 'granted' && room !== null
  useEffect(() => {
    const current = roomRef.current
    if (!canLoad || baseline !== null || !current || !code) return
    let cancelled = false
    // As imagens e as fontes dos slides livres vêm das subcoleções da sala.
    // Sem as fontes (falha de rede), o editor abre assim mesmo.
    // Os gabaritos ficam num documento que só o dono lê (lib/answers.ts).
    void Promise.all([
      fetchAssets(code, collectAssetIds(current.slides)),
      fetchRoomFonts(code, current.revision ?? 0).catch(() => ({ fonts: {}, docIds: {} })),
      fetchAnswers(code),
    ]).then(([assets, roomFonts, answers]) => {
      if (cancelled) return
      const { loadPresentation, getPresentation } = store.getState()
      loadPresentation({
        title: current.title,
        slides: withAnswers(current.slides, answers),
        settings: current.settings,
        assets,
        fonts: roomFonts.fonts,
      })
      stored.current = { assetIds: Object.keys(assets), fontDocIds: roomFonts.docIds }
      setBaseline(snapshot(getPresentation()))
    })
    return () => {
      cancelled = true
    }
  }, [canLoad, baseline, store, code])

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
      await saveAndRestartRoom(code, store.getState().getPresentation(), stored.current)
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
  if (room.status === 'ended') {
    // As regras recusam qualquer gravação numa sala encerrada.
    return (
      <FullScreenMessage>
        Esta apresentação foi encerrada e não pode mais ser editada.
        <span className="mt-2 block max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          Na tela de apresentação, &quot;Apresentar de novo&quot; abre uma sala nova com o mesmo
          conteúdo.
        </span>
        <Button className="mt-4" onClick={() => navigate(presentPath)}>
          Voltar à apresentação
        </Button>
      </FullScreenMessage>
    )
  }
  if (baseline === null) {
    return <FullScreenMessage>Abrindo a apresentação no editor…</FullScreenMessage>
  }

  const count = participants.length

  return (
    <EditorStoreContext.Provider value={store}>
      {/* Mesmo layout da criação: em telas grandes, altura da janela e colunas
          com rolagem própria. */}
      <div className="flex min-h-[100dvh] w-full flex-col px-4 py-4 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
        <div className="mb-4 shrink-0">
          <EditorToolbar
            back={
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 px-2 sm:px-3"
                onClick={leave}
                aria-label="Voltar à apresentação"
                title="Voltar à apresentação"
              >
                <ChevronLeft size={16} /> <span className="hidden sm:inline">Voltar</span>
              </Button>
            }
            title={title}
            onTitleChange={setTitle}
            onImportError={setError}
            primary={
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={requestSave}
                disabled={!dirty || saving}
                title={dirty ? 'Salvar e recomeçar a apresentação' : 'Nenhuma alteração para salvar'}
              >
                <Save size={16} /> Salvar alterações
              </Button>
            }
          />
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
