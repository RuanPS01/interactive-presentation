import { clsx } from 'clsx'
import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { FIELD_STYLES } from './fieldStyles'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={clsx(FIELD_STYLES, className)} {...rest} />
  },
)

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(FIELD_STYLES, 'resize-y', className)} {...rest} />
}

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}

/** Rótulo + controle + dica, para os formulários do editor. */
export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-500 dark:text-neutral-400">{hint}</span>}
    </label>
  )
}
