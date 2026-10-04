import { clsx } from 'clsx'
import { useState } from 'react'
import { FIELD_STYLES } from './fieldStyles'

/** Cores rápidas: neutros e os tons de destaque da interface. */
const PRESETS = [
  '#000000',
  '#404040',
  '#a3a3a3',
  '#ffffff',
  '#dc2626',
  '#f59e0b',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#db2777',
]

const HEX = /^#?([0-9a-fA-F]{6})$/

interface ColorInputProps {
  /** `#rrggbb` (ou `#rrggbbaa`); `undefined` = nenhuma cor. */
  value: string | undefined
  onChange: (value: string | undefined) => void
  'aria-label': string
  /** Mostra a opção "Nenhuma" (fundo transparente, sem realce...). */
  allowNone?: boolean
  /** O trecho selecionado mistura cores. */
  mixed?: boolean
  disabled?: boolean
}

/**
 * Escolha de cor: amostra que abre o seletor do sistema, campo hexadecimal
 * para digitar o valor exato e uma fileira de cores rápidas.
 */
export function ColorInput({
  value,
  onChange,
  allowNone,
  mixed,
  disabled,
  'aria-label': ariaLabel,
}: ColorInputProps) {
  const [draft, setDraft] = useState(value ?? '')
  const [shown, setShown] = useState(value)
  // A cor pode mudar por fora (outra seleção, desfazer): o campo acompanha.
  if (value !== shown) {
    setShown(value)
    setDraft(value ?? '')
  }

  function commit() {
    const match = draft.trim().match(HEX)
    if (match) onChange(`#${match[1].toLowerCase()}`)
    else setDraft(value ?? '')
  }

  return (
    <div className={clsx('space-y-1.5', disabled && 'pointer-events-none opacity-50')}>
      <div className="flex items-center gap-2">
        <label
          className="relative h-9 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700"
          style={{
            background:
              value && !mixed
                ? value
                : 'repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 12px 12px',
          }}
          title={ariaLabel}
        >
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={value?.slice(0, 7) ?? '#000000'}
            disabled={disabled}
            aria-label={ariaLabel}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
        <input
          className={clsx(FIELD_STYLES, 'w-28 font-mono uppercase')}
          value={mixed ? '' : draft}
          placeholder={mixed ? 'Misto' : allowNone ? 'Nenhuma' : '#000000'}
          disabled={disabled}
          aria-label={`${ariaLabel} (hexadecimal)`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
        />
        {allowNone && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(undefined)}
            aria-pressed={!value}
            className={clsx(
              'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
              !value
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                : 'border-neutral-300 text-neutral-600 hover:border-blue-300 dark:border-neutral-700 dark:text-neutral-300',
            )}
          >
            Nenhuma
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${ariaLabel}: cores rápidas`}>
        {PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={color}
            // Mantém a seleção do texto em edição.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(color)}
            className={clsx(
              'h-5 w-5 rounded-full border transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
              value?.toLowerCase() === color && !mixed
                ? 'border-blue-500 ring-2 ring-blue-500/40'
                : 'border-neutral-300 dark:border-neutral-600',
            )}
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  )
}
