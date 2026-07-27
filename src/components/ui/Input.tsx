import { clsx } from 'clsx'
import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const FIELD_STYLES =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'

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
