import {
  ArrowLeftRight,
  Check,
  Copy,
  Loader2,
  Maximize2,
  RefreshCw,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import { displayShortUrl, getCachedShortUrl, shortenUrl } from '../../lib/shortUrl'
import { Button } from '../ui/Button'

interface ShareRoomProps {
  code: string
  joinUrl: string
}

// O QR é sempre renderizado em preto sobre branco (independente do tema) para
// máxima legibilidade da câmera.
const QR_FG = '#111827'
const QR_BG = '#ffffff'

/**
 * Miniatura do QR Code da sala na barra do apresentador. Clicar abre um modal
 * com o QR ampliado, o código da sala e o link de entrada.
 *
 * O link tem UM lugar só na tela: enquanto encurta mostra o progresso, ao
 * terminar mostra a versão curta em letra grande (para a plateia digitar de
 * longe) e um botão alterna para a URL completa. Antes eram dois blocos —
 * o curto e o completo — e o modal passava da altura da tela.
 */
export function ShareRoom({ code, joinUrl }: ShareRoomProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shortUrl, setShortUrl] = useState<string | null>(() => getCachedShortUrl(joinUrl))
  const [shortening, setShortening] = useState(false)
  const [shortError, setShortError] = useState<string | null>(null)
  // Alterna entre o link curto e a URL completa (só faz sentido com o curto).
  const [showFull, setShowFull] = useState(false)
  // URL cujo encurtamento já foi disparado, para não pedir duas vezes.
  const requestedFor = useRef<string | null>(null)

  // Fecha o modal com Esc.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Sem flag de cancelamento: o `requestedFor` já garante uma requisição por
  // URL, e cancelar no cleanup descartaria o resultado quando o próprio efeito
  // reexecuta (o que acontece no StrictMode e a cada mudança de estado daqui).
  const runShorten = useCallback(() => {
    requestedFor.current = joinUrl
    setShortening(true)
    setShortError(null)
    shortenUrl(joinUrl)
      .then(setShortUrl)
      .catch((e: Error) => setShortError(e.message))
      .finally(() => setShortening(false))
  }, [joinUrl])

  // Encurta ao abrir o modal (só uma vez por link: o resultado fica em cache).
  useEffect(() => {
    if (!open || shortUrl || requestedFor.current === joinUrl) return
    runShorten()
  }, [open, joinUrl, shortUrl, runShorten])

  // O que está em destaque agora, e o que o botão de copiar leva.
  const showingShort = Boolean(shortUrl) && !showFull
  const currentUrl = showingShort ? (shortUrl as string) : joinUrl

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(currentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard indisponível: o usuário pode copiar manualmente */
    }
  }

  const label = shortening ? 'Link de entrada' : showingShort ? 'Link curto' : 'Link completo'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1.5 transition hover:border-blue-400 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-blue-500"
        title="Expandir QR Code da sala"
        aria-label="Expandir QR Code da sala"
      >
        <QRCode value={joinUrl} size={40} bgColor={QR_BG} fgColor={QR_FG} />
        <Maximize2
          size={14}
          className="text-neutral-500 group-hover:text-blue-600 dark:text-neutral-400 dark:group-hover:text-blue-400"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="QR Code da sala"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[95vh] w-full max-w-3xl flex-col items-center overflow-auto rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-neutral-900 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              aria-label="Fechar"
            >
              <X size={24} />
            </button>

            <p className="text-base text-neutral-500 dark:text-neutral-400 md:text-lg">
              Aponte a câmera do celular para entrar
            </p>

            {/* O QR codifica sempre a URL COMPLETA: não depende do encurtador.
                A altura é limitada por vh para o modal caber na tela junto do
                código e do link, sem rolagem. */}
            <div className="my-5 w-[min(80vw,42vh,26rem)] rounded-xl bg-white p-4">
              <QRCode
                value={joinUrl}
                size={512}
                bgColor={QR_BG}
                fgColor={QR_FG}
                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              />
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Código da sala
              </p>
              <p className="text-5xl font-extrabold tracking-[0.25em] text-neutral-900 dark:text-neutral-50 md:text-6xl">
                {code}
              </p>
            </div>

            <div className="w-full max-w-2xl">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <p className="text-left text-sm font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  {label}
                </p>
                {shortUrl && (
                  <button
                    type="button"
                    onClick={() => setShowFull((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  >
                    <ArrowLeftRight size={12} />
                    {showFull ? 'Ver link curto' : 'Ver link completo'}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
                {shortening ? (
                  <span className="flex flex-1 items-center gap-2 text-left text-base text-neutral-500 dark:text-neutral-400">
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    Encurtando o link…
                  </span>
                ) : (
                  <span
                    className={clsx(
                      'min-w-0 flex-1 break-all text-left',
                      showingShort
                        ? // Curto: em destaque, para ser digitado do fundo da sala.
                          'text-3xl font-extrabold leading-tight text-neutral-900 dark:text-neutral-50 md:text-4xl'
                        : 'text-sm text-neutral-700 dark:text-neutral-200 md:text-base',
                    )}
                  >
                    {showingShort ? displayShortUrl(currentUrl) : currentUrl}
                  </span>
                )}

                <Button
                  variant="secondary"
                  onClick={() => void copyLink()}
                  disabled={shortening}
                  aria-label={`Copiar ${label.toLowerCase()}`}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>

              {shortError && !shortening && (
                <p className="mt-2 flex items-center justify-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                  Não foi possível encurtar o link agora.
                  <Button variant="ghost" size="sm" onClick={runShorten}>
                    <RefreshCw size={14} /> Tentar de novo
                  </Button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
