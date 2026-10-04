import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'

type Tone = 'primary' | 'success'
type Shape = 'square' | 'round'

const CHECKED: Record<Tone, string> = {
  primary: 'border-blue-600 bg-blue-600 text-white',
  success: 'border-green-600 bg-green-600 text-white',
}

const FOCUS_RING: Record<Tone, string> = {
  primary: 'peer-focus-visible:ring-blue-500/40',
  success: 'peer-focus-visible:ring-green-500/40',
}

interface ChoiceMarkProps {
  checked: boolean
  /** `square` na múltipla escolha, `round` na escolha única. */
  shape?: Shape
  /** `success` marca a alternativa correta no editor de perguntas. */
  tone?: Tone
  className?: string
}

/**
 * O desenho da marcação, sem comportamento: quadrado (ou círculo) que vira azul
 * com um visto quando marcado. É o mesmo nos controles do editor e nos botões
 * de voto do participante, que já são botões e só precisam do desenho.
 */
export function ChoiceMark({
  checked,
  shape = 'square',
  tone = 'primary',
  className,
}: ChoiceMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'flex h-5 w-5 shrink-0 items-center justify-center border transition',
        shape === 'square' ? 'rounded-md' : 'rounded-full',
        checked
          ? CHECKED[tone]
          : 'border-neutral-400 bg-white dark:border-neutral-500 dark:bg-neutral-900',
        className,
      )}
    >
      {checked && <Check size={14} strokeWidth={3} />}
    </span>
  )
}

interface ChoiceControlProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange' | 'children'> {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Texto ao lado da marcação. Sem ele, passe `aria-label`. */
  label?: ReactNode
  /** Explicação menor, abaixo do rótulo. */
  hint?: ReactNode
  tone?: Tone
}

/**
 * Base comum de `Checkbox` e `Radio`. O `<input>` nativo continua no DOM (fora
 * da vista) e é ele que recebe o foco, o teclado e os leitores de tela; o que
 * aparece é o `ChoiceMark`, que acompanha o foco pelo `peer`.
 */
function ChoiceControl({
  type,
  checked,
  onChange,
  label,
  hint,
  tone = 'primary',
  disabled,
  className,
  title,
  ...rest
}: ChoiceControlProps & { type: 'checkbox' | 'radio' }) {
  return (
    // O `title` fica no rótulo: no <input> escondido a dica nunca apareceria.
    <label
      title={title}
      className={clsx(
        'group flex items-start gap-2 text-sm',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative flex shrink-0">
        <input
          type={type}
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          {...rest}
        />
        <ChoiceMark
          checked={checked}
          shape={type === 'radio' ? 'round' : 'square'}
          tone={tone}
          className={clsx(
            'ring-offset-1 ring-offset-white peer-focus-visible:ring-2 dark:ring-offset-neutral-900',
            FOCUS_RING[tone],
            !checked && !disabled && 'group-hover:border-blue-400',
          )}
        />
      </span>
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="text-neutral-700 dark:text-neutral-200">{label}</span>}
          {hint && (
            <span className="block text-xs text-neutral-500 dark:text-neutral-400">{hint}</span>
          )}
        </span>
      )}
    </label>
  )
}

type CheckboxProps = ChoiceControlProps

/** Caixa de seleção com rótulo e dica opcionais. */
export function Checkbox(props: CheckboxProps) {
  return <ChoiceControl type="checkbox" {...props} />
}

type RadioProps = ChoiceControlProps

/**
 * Botão de opção (escolha única). Agrupe pelo mesmo `name`; o `onChange`
 * recebe `true` quando esta opção passa a ser a escolhida.
 */
export function Radio(props: RadioProps) {
  return <ChoiceControl type="radio" {...props} />
}
