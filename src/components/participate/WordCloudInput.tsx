import { Eraser, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { clearResponse, saveResponse } from '../../lib/responses'
import type { PresentationSettings, WordCloudSlide } from '../../types/presentation'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface WordCloudInputProps {
  code: string
  slide: WordCloudSlide
  participantUid: string
  participantName: string | null
  current: string[]
  settings: PresentationSettings
}

/**
 * Limite de envios por participante. O texto enviado pode ser uma palavra ou
 * uma frase — o campo nunca sugere que precise ser uma única palavra.
 */
const MAX_TEXT_LENGTH = 80

function maxAllowed(slide: WordCloudSlide): number {
  if (slide.wordLimitMode === 'one') return 1
  if (slide.wordLimitMode === 'range') return slide.maxWords
  return Infinity
}

export function WordCloudInput({
  code,
  slide,
  participantUid,
  participantName,
  current,
  settings,
}: WordCloudInputProps) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const max = maxAllowed(slide)
  const reachedLimit = current.length >= max
  const canEdit = settings.allowChangeAnswer

  async function persist(next: string[]) {
    setBusy(true)
    try {
      await saveResponse(code, slide.id, participantUid, 'word', next, participantName)
    } finally {
      setBusy(false)
    }
  }

  async function addText() {
    const text = draft.trim()
    if (!text || reachedLimit || busy) return
    // Impede envios repetidos (comparação sem diferenciar maiúsc./minúsc., como
    // na contagem da nuvem), evitando que o participante infle o próprio voto.
    const isDuplicate = current.some((w) => w.toLowerCase() === text.toLowerCase())
    if (isDuplicate) {
      setNotice('Você já enviou esse texto.')
      inputRef.current?.select()
      return
    }
    setNotice(null)
    setDraft('')
    try {
      await persist([...current, text])
    } finally {
      // Devolve o foco ao input para continuar digitando sem clicar no campo.
      inputRef.current?.focus()
    }
  }

  async function removeAt(index: number) {
    await persist(current.filter((_, i) => i !== index))
  }

  async function clearAll() {
    setBusy(true)
    try {
      await clearResponse(code, slide.id, participantUid)
    } finally {
      setBusy(false)
    }
  }

  const limitLabel =
    slide.wordLimitMode === 'one'
      ? 'Você pode enviar 1 resposta (palavra ou frase).'
      : slide.wordLimitMode === 'range'
        ? `Você pode enviar até ${slide.maxWords} resposta(s) — palavra ou frase.`
        : 'Você pode enviar quantas respostas quiser (palavra ou frase).'

  return (
    <div className="space-y-4">
      <p
        className="text-neutral-500 dark:text-neutral-400"
        style={{ fontSize: `${settings.labelFontSize * 0.9}px` }}
      >
        {limitLabel}
      </p>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void addText()
        }}
      >
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (notice) setNotice(null)
          }}
          placeholder={reachedLimit ? 'Limite atingido' : 'Entre com seu texto'}
          disabled={reachedLimit}
          maxLength={MAX_TEXT_LENGTH}
          autoFocus
        />
        <Button type="submit" disabled={reachedLimit || busy || !draft.trim()}>
          Enviar
        </Button>
      </form>

      {notice && <p className="text-sm text-amber-600 dark:text-amber-400">{notice}</p>}

      {current.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              Suas respostas:
            </p>
            {canEdit && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void clearAll()}>
                <Eraser size={16} /> Limpar tudo
              </Button>
            )}
          </div>
          <ul className="flex flex-wrap gap-2">
            {current.map((text, index) => (
              <li
                key={`${text}-${index}`}
                className="inline-flex max-w-full items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200"
              >
                <span className="min-w-0 break-words">{text}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void removeAt(index)}
                    disabled={busy}
                    className="inline-flex shrink-0 text-blue-500 hover:text-blue-700 dark:hover:text-blue-100"
                    aria-label={`Remover ${text}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
