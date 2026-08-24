import { clsx } from 'clsx'
import { Check, Eraser, Lock } from 'lucide-react'
import { useState } from 'react'
import { clearResponse, saveResponse } from '../../lib/responses'
import type { ChoiceSlide, PresentationSettings } from '../../types/presentation'
import { Button } from '../ui/Button'

interface ChoiceInputProps {
  code: string
  slide: ChoiceSlide
  participantUid: string
  participantName: string | null
  current: string[]
  settings: PresentationSettings
}

/** Voto para barras, pizza e alternativas (radio ou checkbox). */
export function ChoiceInput({
  code,
  slide,
  participantUid,
  participantName,
  current,
  settings,
}: ChoiceInputProps) {
  const [busy, setBusy] = useState(false)
  const selected = new Set(current)
  const hasAnswered = current.length > 0
  const size = Math.min(settings.bodyFontSize, 22)

  /**
   * Sem permissão para trocar, a resposta é definitiva — mas o que fica travado
   * depende do tipo de votação. Na escolha única, o primeiro toque encerra. Na
   * múltipla escolha, travar tudo no primeiro toque impediria a pessoa de
   * terminar a própria seleção: aqui o bloqueio é só para DESMARCAR o que já
   * foi enviado; marcar novas opções continua liberado.
   */
  function isBlocked(optionId: string): boolean {
    if (settings.allowChangeAnswer || !hasAnswered) return false
    return slide.allowMultiple ? selected.has(optionId) : true
  }

  async function persist(next: string[]) {
    setBusy(true)
    try {
      await saveResponse(code, slide.id, participantUid, 'choice', next, participantName)
    } finally {
      setBusy(false)
    }
  }

  async function toggle(optionId: string) {
    if (isBlocked(optionId)) return
    if (slide.allowMultiple) {
      const next = new Set(selected)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      await persist([...next])
    } else {
      // Escolha única: substitui a seleção anterior.
      await persist([optionId])
    }
  }

  async function clearVote() {
    setBusy(true)
    try {
      await clearResponse(code, slide.id, participantUid)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p
        className="text-neutral-500 dark:text-neutral-400"
        style={{ fontSize: `${settings.labelFontSize * 0.9}px` }}
      >
        {slide.allowMultiple
          ? 'Você pode escolher mais de uma opção.'
          : 'Escolha uma opção.'}
      </p>

      <ul className="space-y-2">
        {slide.options.map((option) => {
          const isSelected = selected.has(option.id)
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => void toggle(option.id)}
                disabled={busy || isBlocked(option.id)}
                aria-pressed={isSelected}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                  'disabled:opacity-60',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100'
                    : 'border-neutral-300 bg-white hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900',
                )}
                style={{ fontSize: `${size}px` }}
              >
                <span
                  className={clsx(
                    'flex h-5 w-5 shrink-0 items-center justify-center border',
                    slide.allowMultiple ? 'rounded-md' : 'rounded-full',
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-neutral-400',
                  )}
                >
                  {isSelected && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="min-w-0 break-words">{option.label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {hasAnswered && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
            <Check size={16} strokeWidth={3} /> Voto registrado
          </p>
          {settings.allowChangeAnswer ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void clearVote()}>
              <Eraser size={16} /> Limpar resposta
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
              <Lock size={14} />
              {slide.allowMultiple ? 'Não é possível desmarcar' : 'Não é possível trocar'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
