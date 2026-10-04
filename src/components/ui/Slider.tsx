import { clsx } from 'clsx'
import { useId } from 'react'
import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react'

interface SliderProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step'
  > {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  /** Rótulo acima do controle. */
  label?: ReactNode
  /** Valor formatado no canto direito do rótulo (ex.: "36px"). */
  valueLabel?: ReactNode
  /** Texto de apoio abaixo do controle. */
  hint?: ReactNode
}

/**
 * Controle deslizante com a identidade da aplicação: trilho neutro, trecho já
 * percorrido e polegar em azul, nos dois temas.
 *
 * Trilho e polegar são pseudo-elementos diferentes em cada navegador e não
 * aceitam classes utilitárias, por isso o desenho fica em `index.css`
 * (`.ui-slider`). Daqui sai só a porcentagem preenchida, pela variável
 * `--slider-fill`.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  valueLabel,
  hint,
  disabled,
  className,
  id,
  style,
  ...rest
}: SliderProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const span = max - min
  const clamped = Math.min(Math.max(value, min), max)
  const fill = span > 0 ? ((clamped - min) / span) * 100 : 0

  return (
    <div className={clsx('space-y-1.5', disabled && 'opacity-50', className)}>
      {(label || valueLabel) && (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          {label && (
            <label htmlFor={inputId} className="font-medium text-neutral-700 dark:text-neutral-200">
              {label}
            </label>
          )}
          {valueLabel && (
            <span className="ml-auto tabular-nums text-neutral-500 dark:text-neutral-400">
              {valueLabel}
            </span>
          )}
        </div>
      )}
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ui-slider"
        style={{ ...style, '--slider-fill': `${fill}%` } as CSSProperties}
        {...rest}
      />
      {hint && <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  )
}
