import { useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: ReactNode
  /** Explicação do que vai acontecer. */
  children?: ReactNode
  icon?: ReactNode
  confirmLabel: ReactNode
  cancelLabel?: ReactNode
  /** `danger` pinta o botão de confirmar de vermelho. */
  tone?: 'primary' | 'danger'
  /** Ação em andamento: os botões ficam desativados e o modal não fecha. */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Pergunta de confirmação antes de uma ação com efeito para outras pessoas.
 * O foco começa no botão de confirmar, então Enter confirma e Esc cancela.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  icon,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      open={open}
      onClose={onCancel}
      dismissible={!busy}
      title={title}
      icon={icon}
      size="sm"
      initialFocusRef={confirmRef}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children && (
        <div className="space-y-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
          {children}
        </div>
      )}
    </Modal>
  )
}
