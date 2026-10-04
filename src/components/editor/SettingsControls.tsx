import { clsx } from 'clsx'
import { useId } from 'react'
import { clampTimerSeconds, FONT_SIZE_RANGE, QUIZ_TIMER_RANGE } from '../../utils/settings'
import { Checkbox } from '../ui/Checkbox'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Slider } from '../ui/Slider'

const HINT_STYLES = 'block text-xs text-neutral-500 dark:text-neutral-400'

/** Controle de tamanho de fonte com valor visível. */
export function FontSizeRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <Slider
      label={label}
      valueLabel={`${value}px`}
      min={FONT_SIZE_RANGE.min}
      max={FONT_SIZE_RANGE.max}
      value={value}
      disabled={disabled}
      onChange={onChange}
    />
  )
}

/** Campo de segundos do cronômetro, já limitado à faixa aceita. */
function SecondsInput({
  id,
  value,
  disabled,
  onChange,
  label,
}: {
  id?: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
  /** Nome acessível quando não há um `<label>` apontando para o campo. */
  label?: string
}) {
  return (
    <div className="w-24">
      <Input
        id={id}
        type="number"
        min={QUIZ_TIMER_RANGE.min}
        max={QUIZ_TIMER_RANGE.max}
        step={1}
        value={value}
        disabled={disabled}
        aria-label={label}
        // Um valor fora da faixa aqui viraria um JSON que a própria
        // importação recusa: o limite é aplicado na origem.
        onChange={(e) => onChange(clampTimerSeconds(Number(e.target.value)))}
      />
    </div>
  )
}

/**
 * Tempo do cronômetro, em segundos. É um campo numérico (e não um controle
 * deslizante como o das fontes) porque o professor pensa em valores exatos:
 * "20 segundos", não "por volta de 20".
 */
export function TimerRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const id = useId()
  // O campo desativado já se esmaece sozinho; aqui só os textos em volta.
  const dim = disabled && 'opacity-50'
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className={clsx('block text-sm font-medium text-neutral-700 dark:text-neutral-200', dim)}
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <SecondsInput id={id} value={value} disabled={disabled} onChange={onChange} />
        <span className={clsx('text-sm text-neutral-500 dark:text-neutral-400', dim)}>segundos</span>
      </div>
      {hint && <span className={clsx(HINT_STYLES, dim)}>{hint}</span>}
    </div>
  )
}

const INHERIT = 'herdar'
type OverrideChoice = typeof INHERIT | 'sim' | 'nao'

/**
 * Opção booleana de um slide com três estados: herdar do global, sim ou não.
 * `inherited` é o valor que vale quando o slide herda.
 */
export function OverrideToggleRow({
  label,
  hint,
  inherited,
  value,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  inherited: boolean
  value: boolean | undefined
  disabled?: boolean
  onChange: (value: boolean | undefined) => void
}) {
  const labelId = useId()
  const dim = disabled && 'opacity-50'
  return (
    <div className="space-y-1">
      <span id={labelId} className={clsx('block text-sm text-neutral-700 dark:text-neutral-200', dim)}>
        {label}
      </span>
      <Select<OverrideChoice>
        aria-labelledby={labelId}
        value={value === undefined ? INHERIT : value ? 'sim' : 'nao'}
        disabled={disabled}
        options={[
          { value: INHERIT, label: `Herdar da apresentação (${inherited ? 'sim' : 'não'})` },
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
        ]}
        onChange={(choice) => onChange(choice === INHERIT ? undefined : choice === 'sim')}
      />
      {hint && <span className={clsx(HINT_STYLES, dim)}>{hint}</span>}
    </div>
  )
}

/** Cronômetro de um slide: herda o tempo global ou usa um próprio. */
export function OverrideTimerRow({
  label,
  hint,
  inherited,
  value,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  inherited: number
  value: number | undefined
  disabled?: boolean
  onChange: (value: number | undefined) => void
}) {
  const custom = value !== undefined
  const dim = disabled && 'opacity-50'
  return (
    <div className="space-y-1.5">
      <Checkbox
        label={label}
        checked={custom}
        disabled={disabled}
        onChange={(checked) => onChange(checked ? inherited : undefined)}
      />
      <div className="flex items-center gap-2 pl-7">
        <SecondsInput
          value={value ?? inherited}
          disabled={disabled || !custom}
          onChange={onChange}
          label={label}
        />
        <span className={clsx('text-sm text-neutral-500 dark:text-neutral-400', dim)}>
          segundos{custom ? '' : ' (herdado)'}
        </span>
      </div>
      {hint && <span className={clsx(HINT_STYLES, dim)}>{hint}</span>}
    </div>
  )
}

/** Tamanho de fonte de um slide: herda o global ou usa um valor próprio. */
export function OverrideFontRow({
  label,
  inherited,
  value,
  disabled,
  onChange,
}: {
  label: string
  inherited: number
  value: number | undefined
  disabled?: boolean
  onChange: (value: number | undefined) => void
}) {
  const custom = value !== undefined
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <Checkbox
          label={label}
          checked={custom}
          disabled={disabled}
          onChange={(checked) => onChange(checked ? inherited : undefined)}
        />
        <span
          className={clsx(
            'shrink-0 text-sm tabular-nums text-neutral-500 dark:text-neutral-400',
            disabled && 'opacity-50',
          )}
        >
          {custom ? `${value}px` : `${inherited}px (herdado)`}
        </span>
      </div>
      <Slider
        aria-label={label}
        min={FONT_SIZE_RANGE.min}
        max={FONT_SIZE_RANGE.max}
        value={value ?? inherited}
        disabled={disabled || !custom}
        onChange={onChange}
      />
    </div>
  )
}
