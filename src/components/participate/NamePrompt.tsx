import { UserRound } from 'lucide-react'
import { useState } from 'react'
import { MAX_NAME_LENGTH } from '../../lib/participantName'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface NamePromptProps {
  roomTitle: string
  onConfirm: (name: string) => void
}

/**
 * Pedido de nome antes de entrar na sala. Só aparece quando o apresentador
 * ativa "Solicitar o nome" nas opções da apresentação.
 */
export function NamePrompt({ roomTitle, onConfirm }: NamePromptProps) {
  const [name, setName] = useState('')
  const trimmed = name.trim()

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (trimmed) onConfirm(trimmed)
      }}
    >
      <div className="flex items-center gap-3">
        <UserRound size={28} className="text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            {roomTitle}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Informe seu nome para entrar na sala.
          </p>
        </div>
      </div>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Seu nome"
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        autoComplete="name"
      />

      <Button type="submit" size="lg" className="w-full" disabled={!trimmed}>
        Entrar
      </Button>
    </form>
  )
}
