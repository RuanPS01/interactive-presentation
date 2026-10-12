import { clsx } from 'clsx'
import { Maximize2 } from 'lucide-react'
import QRCode from 'react-qr-code'
import { QR_BG, QR_FG } from './RoomCodeDialog'

interface ShareRoomProps {
  joinUrl: string
  /** Abre o modal do código da sala (montado uma vez só, na página). */
  onOpen: () => void
  /** Inclua a exibição (`inline-flex`, ou `hidden sm:inline-flex`). Padrão: `inline-flex`. */
  className?: string
}

/**
 * Miniatura do QR Code da sala na barra do apresentador. Clicar abre o modal
 * "Código da sala" (`RoomCodeDialog`), o mesmo que o código no cabeçalho e o
 * item do menu abrem. O modal fica na página, e não aqui, para continuar
 * aberto (e a projeção também) quando o cabeçalho é ocultado.
 */
export function ShareRoom({ joinUrl, onOpen, className }: ShareRoomProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Código da sala"
      aria-label="Código da sala"
      className={clsx(
        // A exibição vem toda de fora: `inline-flex` aqui brigaria com um `hidden`.
        className ?? 'inline-flex',
        'group shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1 transition hover:border-blue-400 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-blue-500',
      )}
    >
      <span className="rounded-sm p-0.5" style={{ backgroundColor: QR_BG }}>
        <QRCode value={joinUrl} size={32} bgColor={QR_BG} fgColor={QR_FG} />
      </span>
      <Maximize2
        size={14}
        className="text-neutral-500 group-hover:text-blue-600 dark:text-neutral-400 dark:group-hover:text-blue-400"
      />
    </button>
  )
}
