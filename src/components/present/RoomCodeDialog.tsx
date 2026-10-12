import { clsx } from 'clsx'
import {
  BarChart3,
  Check,
  Copy,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  RefreshCw,
  Sun,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'react-qr-code'
import { displayShortUrl, getCachedShortUrl, shortenUrl } from '../../lib/shortUrl'
import { useThemeStore } from '../../store/themeStore'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

// Sempre preto sobre branco puro, em qualquer tema: é o que as câmeras leem melhor.
export const QR_FG = '#111111'
export const QR_BG = '#ffffff'

interface RoomCodeDialogProps {
  code: string
  joinUrl: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * O código da sala, com o QR Code e o link curto, e a projeção em tela cheia
 * para a turma: o link curto no lugar do endereço do site, o código grande e
 * o QR ao lado, menor. Tocar no QR o amplia para a tela inteira.
 *
 * O código é o caminho principal de entrada; o QR é a alternativa para quem
 * aponta a câmera, e o link curto, para quem prefere digitar o endereço.
 */
export function RoomCodeDialog({ code, joinUrl, open, onOpenChange }: RoomCodeDialogProps) {
  const appDark = useThemeStore((s) => s.theme === 'dark')
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [projector, setProjector] = useState(false)
  const [projectorDark, setProjectorDark] = useState(false)
  const [qrZoom, setQrZoom] = useState(false)
  const [shortUrl, setShortUrl] = useState<string | null>(() => getCachedShortUrl(joinUrl))
  const [shortening, setShortening] = useState(false)
  const [shortFailed, setShortFailed] = useState(false)
  // A tela cheia foi pedida por esta projeção? Só então o fim da tela cheia
  // (o Esc do navegador, que a página não recebe) fecha a projeção.
  const fullscreenRef = useRef(false)
  // URL cujo encurtamento já foi pedido, para não pedir duas vezes.
  const requested = useRef<string | null>(null)

  // Sem flag de cancelamento: o `requested` já garante um pedido por URL, e
  // cancelar no cleanup descartaria o resultado quando o efeito reexecuta.
  const runShorten = useCallback(() => {
    requested.current = joinUrl
    setShortening(true)
    setShortFailed(false)
    shortenUrl(joinUrl)
      .then(setShortUrl)
      .catch(() => setShortFailed(true))
      .finally(() => setShortening(false))
  }, [joinUrl])

  // O link curto só é pedido quando alguém vai vê-lo.
  useEffect(() => {
    if ((open || projector) && !shortUrl && requested.current !== joinUrl) runShorten()
  }, [open, projector, shortUrl, joinUrl, runShorten])

  // Endereço do site para a projeção quando não há link curto: com o caminho
  // do GitHub Pages e sem a barra final.
  const siteLabel = (window.location.host + window.location.pathname)
    .replace(/^www\./, '')
    .replace(/\/$/, '')
  const projectedUrl = shortUrl ? displayShortUrl(shortUrl) : siteLabel
  const linkShown = shortUrl ?? joinUrl

  async function copy(text: string, what: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      // Área de transferência indisponível: o código e o link estão na tela.
    }
  }

  function openProjector() {
    // O Modal prende o Tab e o foco: aberto por trás da projeção, ele
    // engoliria o primeiro clique nos botões dela. Fecha antes de projetar.
    onOpenChange(false)
    setProjectorDark(appDark)
    setQrZoom(false)
    setProjector(true)
    const target = document.documentElement
    if (!document.fullscreenElement && target.requestFullscreen) {
      target
        .requestFullscreen()
        .then(() => {
          fullscreenRef.current = true
        })
        .catch(() => {
          // Recusada (iframe, iPhone): a sobreposição ocupa a janela e serve igual.
        })
    }
  }

  const closeProjector = useCallback(() => {
    setProjector(false)
    setQrZoom(false)
    if (fullscreenRef.current && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    }
    fullscreenRef.current = false
  }, [])

  // Teclado preso à projeção, na fase de CAPTURA: o Esc fecha o QR ampliado
  // e, sem ele, a projeção; as outras teclas param aqui, para o passador de
  // slides (setas, Page Down, espaço) não trocar o slide escondido atrás.
  useEffect(() => {
    if (!projector) return
    function onKey(e: KeyboardEvent) {
      e.stopPropagation()
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (qrZoom) setQrZoom(false)
      else closeProjector()
    }
    function onFullscreenChange() {
      if (fullscreenRef.current && !document.fullscreenElement) closeProjector()
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [projector, qrZoom, closeProjector])

  // Tema próprio da projeção. Sem `dark:`, que segue a classe do <html>.
  const tone = projectorDark
    ? {
        page: 'bg-neutral-950 text-neutral-100',
        muted: 'text-neutral-400',
        box: 'border-neutral-700 bg-neutral-900',
        icon: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
        logo: 'text-blue-400',
      }
    : {
        page: 'bg-white text-neutral-900',
        muted: 'text-neutral-500',
        box: 'border-neutral-200 bg-neutral-100',
        icon: 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900',
        logo: 'text-blue-600',
      }

  return (
    <>
      <Modal
        open={open}
        onClose={() => onOpenChange(false)}
        title="Código da sala"
        description={<>Os participantes entram com este código em &quot;Entrar em uma sala&quot;, na página inicial.</>}
        size="sm"
      >
        <div className="flex flex-col items-center gap-4 pb-1">
          <span className="select-all font-mono text-5xl font-bold tracking-[0.3em] text-blue-600 sm:text-6xl dark:text-blue-400">
            {code}
          </span>
          <div className="rounded-lg p-3 ring-1 ring-neutral-200 dark:ring-neutral-700" style={{ backgroundColor: QR_BG }}>
            <QRCode value={joinUrl} size={168} bgColor={QR_BG} fgColor={QR_FG} />
          </div>
          <p className="-mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
            Ou aponte a câmera do celular para o QR Code
          </p>

          <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-950">
            <Link2 size={16} className="shrink-0 text-neutral-500" aria-hidden="true" />
            {shortening ? (
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Encurtando o link...
              </span>
            ) : (
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-100"
                title={linkShown}
              >
                {displayShortUrl(linkShown)}
              </span>
            )}
            <button
              type="button"
              disabled={shortening}
              onClick={() => void copy(linkShown, 'link')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-200 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
              aria-label={copied === 'link' ? 'Link copiado' : 'Copiar link'}
              title={copied === 'link' ? 'Link copiado' : 'Copiar link'}
            >
              {copied === 'link' ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          {shortFailed && !shortening && (
            <p className="-mt-2 flex flex-wrap items-center justify-center gap-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Não foi possível encurtar o link agora.
              <Button variant="ghost" size="sm" onClick={runShorten}>
                <RefreshCw size={12} /> Tentar de novo
              </Button>
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void copy(code, 'code')}>
              {copied === 'code' ? <Check size={16} /> : <Copy size={16} />}
              {copied === 'code' ? 'Copiado!' : 'Copiar código'}
            </Button>
            <Button size="sm" onClick={openProjector}>
              <Maximize2 size={16} /> Projetar em tela cheia
            </Button>
          </div>
        </div>
      </Modal>

      {projector &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Código da sala em tela cheia"
            className={clsx(
              'fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto px-6 py-6',
              tone.page,
            )}
          >
            <div className="absolute right-4 top-4 flex items-center gap-2">
              <button
                type="button"
                className={clsx('rounded-lg p-2', tone.icon)}
                onClick={() => setProjectorDark((v) => !v)}
                aria-label="Alternar tema claro/escuro"
                title="Alternar tema claro/escuro"
              >
                {projectorDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                type="button"
                className={clsx('rounded-lg p-2', tone.icon)}
                onClick={closeProjector}
                aria-label="Sair da tela cheia"
                title="Sair da tela cheia"
              >
                <Minimize2 size={20} />
              </button>
            </div>

            <BarChart3
              aria-hidden="true"
              strokeWidth={1.5}
              className={clsx('mb-[3vh] h-[clamp(3rem,9vh,8rem)] w-[clamp(3rem,9vh,8rem)] shrink-0', tone.logo)}
            />

            <div className="mb-[3vh] max-w-full text-center">
              <p className={clsx('text-[clamp(1rem,2.2vw,2.25rem)] font-medium', tone.muted)}>1. Acesse:</p>
              <p className="mt-2 break-all text-[clamp(1.25rem,5.5vw,5rem)] font-bold leading-none tracking-tight">
                {projectedUrl}
              </p>
            </div>

            {/* O código é o caminho principal: o QR fica ao lado, menor. */}
            <div className="mb-[3vh] flex flex-col items-center gap-[3vh] md:flex-row md:items-end md:gap-[4vw]">
              <div className="text-center">
                <p className={clsx('text-[clamp(1rem,2.2vw,2.25rem)] font-medium', tone.muted)}>
                  2. Use o código da sala:
                </p>
                <div
                  className={clsx(
                    'mt-3 inline-block rounded-3xl border-2 px-[clamp(1.5rem,4vw,4rem)] py-[clamp(0.75rem,2.5vh,2.5rem)]',
                    tone.box,
                  )}
                >
                  <span className="select-all font-mono text-[clamp(3rem,11vw,12rem)] font-black leading-none tracking-[0.12em]">
                    {code}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrZoom(true)}
                aria-label="Ampliar o QR Code"
                title="Ampliar o QR Code"
                className="group flex flex-col items-center gap-2 rounded-2xl"
              >
                <span
                  className="block w-[clamp(7rem,26vh,20rem)] rounded-2xl p-[clamp(0.4rem,1.2vh,1rem)] ring-1 ring-neutral-300"
                  style={{ backgroundColor: QR_BG }}
                >
                  <QRCode
                    value={joinUrl}
                    size={512}
                    bgColor={QR_BG}
                    fgColor={QR_FG}
                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  />
                </span>
                <span className={clsx('text-[clamp(0.8rem,1.4vw,1.25rem)]', tone.muted)}>
                  Toque no QR Code para ampliar
                </span>
              </button>
            </div>

            <p className={clsx('max-w-[min(90vw,60rem)] text-center text-[clamp(0.95rem,2vw,2rem)]', tone.muted)}>
              3. Responda pelo celular enquanto a apresentação estiver no ar.
            </p>
          </div>,
          document.body,
        )}

      {projector &&
        qrZoom &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="QR Code ampliado"
            className="fixed inset-0 z-[110] flex items-center justify-center"
            style={{ backgroundColor: QR_BG }}
          >
            <button type="button" onClick={() => setQrZoom(false)} aria-label="Voltar ao código">
              <QRCode
                value={joinUrl}
                size={1024}
                bgColor={QR_BG}
                fgColor={QR_FG}
                style={{ height: 'auto', width: 'min(92vw, 92vh)' }}
              />
            </button>
            <button
              type="button"
              onClick={() => setQrZoom(false)}
              aria-label="Voltar ao código"
              title="Voltar ao código"
              className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-lg text-neutral-900 hover:bg-neutral-100"
            >
              <X size={28} />
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
