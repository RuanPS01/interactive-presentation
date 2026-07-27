import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { saveResponse } from '../../lib/responses'
import type { WordCloudSlide } from '../../types/presentation'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface WordCloudInputProps {
  code: string
  slide: WordCloudSlide
  participantUid: string
  current: string[]
}

function maxAllowed(slide: WordCloudSlide): number {
  if (slide.wordLimitMode === 'one') return 1
  if (slide.wordLimitMode === 'range') return slide.maxWords
  return Infinity
}

export function WordCloudInput({ code, slide, participantUid, current }: WordCloudInputProps) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const max = maxAllowed(slide)
  const reachedLimit = current.length >= max

  async function persist(next: string[]) {
    setBusy(true)
    try {
      await saveResponse(code, slide.id, participantUid, 'word', next)
    } finally {
      setBusy(false)
    }
  }

  async function addWord() {
    const word = draft.trim()
    if (!word || reachedLimit || busy) return
    // Impede palavras repetidas (comparação sem diferenciar maiúsc./minúsc.,
    // como na contagem da nuvem), evitando que o participante infle o voto de
    // uma mesma palavra quando pode enviar mais de uma.
    const isDuplicate = current.some((w) => w.toLowerCase() === word.toLowerCase())
    if (isDuplicate) {
      setNotice('Você já enviou essa palavra.')
      inputRef.current?.select()
      return
    }
    setNotice(null)
    setDraft('')
    try {
      await persist([...current, word])
    } finally {
      // Devolve o foco ao input para que o participante continue digitando
      // palavras sem precisar clicar no campo novamente.
      inputRef.current?.focus()
    }
  }

  async function removeWord(index: number) {
    await persist(current.filter((_, i) => i !== index))
  }

  const limitLabel =
    slide.wordLimitMode === 'one'
      ? 'Você pode enviar 1 palavra.'
      : slide.wordLimitMode === 'range'
        ? `Você pode enviar até ${slide.maxWords} palavra(s).`
        : 'Você pode enviar quantas palavras quiser.'

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{limitLabel}</p>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void addWord()
        }}
      >
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (notice) setNotice(null)
          }}
          placeholder={reachedLimit ? 'Limite atingido' : 'Digite uma palavra'}
          disabled={reachedLimit}
          maxLength={40}
          autoFocus
        />
        <Button type="submit" disabled={reachedLimit || busy || !draft.trim()}>
          Enviar
        </Button>
      </form>

      {notice && (
        <p className="text-sm text-amber-600 dark:text-amber-400">{notice}</p>
      )}

      {current.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Suas palavras:
          </p>
          <ul className="flex flex-wrap gap-2">
            {current.map((word, index) => (
              <li
                key={`${word}-${index}`}
                className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200"
              >
                {word}
                <button
                  type="button"
                  onClick={() => void removeWord(index)}
                  disabled={busy}
                  className="inline-flex text-blue-500 hover:text-blue-700 dark:hover:text-blue-100"
                  aria-label={`Remover ${word}`}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
