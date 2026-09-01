import { clsx } from 'clsx'
import { clampTimerSeconds, FONT_SIZE_RANGE, QUIZ_TIMER_RANGE } from '../../utils/settings'

/** Interruptor simples (usado nas opções globais). */
export function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label
      className={clsx(
        'flex cursor-pointer items-start gap-2 text-sm',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="text-neutral-700 dark:text-neutral-200">{label}</span>
        {hint && (
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">{hint}</span>
        )}
      </span>
    </label>
  )
}

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
    <div className={clsx('space-y-1', disabled && 'opacity-50')}>
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {label}: {value}px
      </span>
      <input
        type="range"
        min={FONT_SIZE_RANGE.min}
        max={FONT_SIZE_RANGE.max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

/**
 * Tempo do cronômetro, em segundos. É um campo numérico (e não um controle
 * deslizante como o das fontes) porque o professor pensa em valores exatos —
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
  return (
    <div className={clsx('space-y-1', disabled && 'opacity-50')}>
      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={QUIZ_TIMER_RANGE.min}
          max={QUIZ_TIMER_RANGE.max}
          step={1}
          value={value}
          disabled={disabled}
          // Um valor fora da faixa aqui viraria um JSON que a própria
          // importação recusa: o limite é aplicado na origem.
          onChange={(e) => onChange(clampTimerSeconds(Number(e.target.value)))}
          className="w-24 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">segundos</span>
      </div>
      {hint && (
        <span className="block text-xs text-neutral-500 dark:text-neutral-400">{hint}</span>
      )}
    </div>
  )
}

const INHERIT = '__inherit__'

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
  return (
    <div className={clsx('space-y-1', disabled && 'opacity-50')}>
      <span className="block text-sm text-neutral-700 dark:text-neutral-200">{label}</span>
      <select
        value={value === undefined ? INHERIT : value ? 'yes' : 'no'}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === INHERIT ? undefined : e.target.value === 'yes')
        }
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        <option value={INHERIT}>
          Herdar da apresentação ({inherited ? 'sim' : 'não'})
        </option>
        <option value="yes">Sim</option>
        <option value="no">Não</option>
      </select>
      {hint && (
        <span className="block text-xs text-neutral-500 dark:text-neutral-400">{hint}</span>
      )}
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
  return (
    <div className={clsx('space-y-1', disabled && 'opacity-50')}>
      <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
        <input
          type="checkbox"
          checked={custom}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? inherited : undefined)}
        />
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={QUIZ_TIMER_RANGE.min}
          max={QUIZ_TIMER_RANGE.max}
          step={1}
          value={custom ? value : inherited}
          disabled={disabled || !custom}
          onChange={(e) => onChange(clampTimerSeconds(Number(e.target.value)))}
          className="w-24 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          segundos{custom ? '' : ' (herdado)'}
        </span>
      </div>
      {hint && (
        <span className="block text-xs text-neutral-500 dark:text-neutral-400">{hint}</span>
      )}
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
    <div className={clsx('space-y-1', disabled && 'opacity-50')}>
      <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
        <input
          type="checkbox"
          checked={custom}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? inherited : undefined)}
        />
        {label}: {custom ? `${value}px` : `${inherited}px (herdado)`}
      </label>
      <input
        type="range"
        min={FONT_SIZE_RANGE.min}
        max={FONT_SIZE_RANGE.max}
        step={1}
        value={custom ? value : inherited}
        disabled={disabled || !custom}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full disabled:opacity-40"
      />
    </div>
  )
}
