import { X } from 'lucide-react'
import { useState } from 'react'
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
    if (!word || reachedLimit) return
    setDraft('')
    await persist([...current, word])
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
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={reachedLimit ? 'Limite atingido' : 'Digite uma palavra'}
          disabled={reachedLimit || busy}
          maxLength={40}
          autoFocus
        />
        <Button type="submit" disabled={reachedLimit || busy || !draft.trim()}>
          Enviar
        </Button>
      </form>

      {current.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Suas palavras:
          </p>
          <ul className="flex flex-wrap gap-2">
            {current.map((word, index) => (
              <li
                key={`${word}-${index}`}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
              >
                {word}
                <button
                  type="button"
                  onClick={() => void removeWord(index)}
                  disabled={busy}
                  className="inline-flex text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-100"
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
