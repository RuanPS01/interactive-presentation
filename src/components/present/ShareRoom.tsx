import { Check, Copy, Link2, Maximize2, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import {
  displayShortUrl,
  getCachedShortUrl,
  shortenUrl,
} from '../../lib/shortUrl'
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
 * com o QR ampliado, o código da sala e o link de entrada — em versão curta,
 * grande o suficiente para a plateia digitar do fundo da sala.
 */
export function ShareRoom({ code, joinUrl }: ShareRoomProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shortUrl, setShortUrl] = useState<string | null>(() => getCachedShortUrl(joinUrl))
  const [shortening, setShortening] = useState(false)
  const [shortError, setShortError] = useState<string | null>(null)

  // Fecha o modal com Esc.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Encurta ao abrir o modal (só uma vez por link: o resultado fica em cache).
  useEffect(() => {
    if (!open || shortUrl || shortening) return
    let cancelled = false
    setShortening(true)
    setShortError(null)
    shortenUrl(joinUrl)
      .then((short) => {
        if (!cancelled) setShortUrl(short)
      })
      .catch((e: Error) => {
        if (!cancelled) setShortError(e.message)
      })
      .finally(() => {
        if (!cancelled) setShortening(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, joinUrl, shortUrl, shortening])

  // Link exibido em destaque: o curto quando existir, senão o completo.
  const highlighted = shortUrl ?? joinUrl

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(highlighted)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard indisponível: o usuário pode copiar manualmente */
    }
  }

  function retryShorten() {
    setShortError(null)
    setShortening(true)
    shortenUrl(joinUrl)
      .then(setShortUrl)
      .catch((e: Error) => setShortError(e.message))
      .finally(() => setShortening(false))
  }

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
            className="relative flex max-h-[95vh] w-full max-w-3xl flex-col items-center overflow-auto rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-neutral-900 md:p-10"
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

            {/* O QR codifica sempre a URL COMPLETA: não depende do encurtador. */}
            <div className="my-6 w-[min(88vw,52vh,30rem)] rounded-xl bg-white p-4">
              <QRCode
                value={joinUrl}
                size={512}
                bgColor={QR_BG}
                fgColor={QR_FG}
                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              />
            </div>

            {/* Link curto em texto grande, para quem prefere digitar. */}
            <div className="mb-6 w-full">
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {shortUrl ? 'Link curto' : 'Link de entrada'}
              </p>
              <p className="break-all text-3xl font-extrabold text-neutral-900 dark:text-neutral-50 md:text-5xl">
                {shortening && !shortUrl ? 'encurtando…' : displayShortUrl(highlighted)}
              </p>
              {shortError && (
                <p className="mt-2 flex items-center justify-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                  Não foi possível encurtar o link agora.
                  <Button variant="ghost" size="sm" onClick={retryShorten} disabled={shortening}>
                    <RefreshCw size={14} /> Tentar de novo
                  </Button>
                </p>
              )}
            </div>

            <div className="mb-6">
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Código da sala
              </p>
              <p className="text-5xl font-extrabold tracking-[0.25em] text-neutral-900 dark:text-neutral-50 md:text-6xl">
                {code}
              </p>
            </div>

            <div className="w-full max-w-2xl">
              <p className="mb-1 flex items-center gap-1.5 text-left text-sm font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                <Link2 size={14} /> Link completo
              </p>
              <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
                <span className="flex-1 break-all text-left text-sm text-neutral-700 dark:text-neutral-200 md:text-base">
                  {joinUrl}
                </span>
                <Button variant="secondary" onClick={() => void copyLink()}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
