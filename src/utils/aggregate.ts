import type { ChoiceOption, ResponseDoc } from '../types/presentation'

export interface WordCount {
  text: string
  value: number
}

/** Conta a frequência de cada palavra (case-insensitive, mantendo a 1ª grafia). */
export function aggregateWords(responses: ResponseDoc[]): WordCount[] {
  const counts = new Map<string, number>()
  const display = new Map<string, string>()

  for (const r of responses) {
    for (const raw of r.value) {
      const word = String(raw).trim()
      if (!word) continue
      const key = word.toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
      if (!display.has(key)) display.set(key, word)
    }
  }

  return [...counts.entries()]
    .map(([key, value]) => ({ text: display.get(key) ?? key, value }))
    .sort((a, b) => b.value - a.value)
}

export interface ChoiceTally {
  id: string
  label: string
  votes: number
}

/** Conta os votos por opção, na ordem definida pelo apresentador. */
export function aggregateChoices(
  responses: ResponseDoc[],
  options: ChoiceOption[],
): ChoiceTally[] {
  const counts = new Map<string, number>()
  for (const r of responses) {
    for (const optionId of r.value) {
      counts.set(optionId, (counts.get(optionId) ?? 0) + 1)
    }
  }
  return options.map((o) => ({ id: o.id, label: o.label, votes: counts.get(o.id) ?? 0 }))
}

export function totalVotes(tallies: ChoiceTally[]): number {
  return tallies.reduce((sum, t) => sum + t.votes, 0)
}

/** Nº de participantes distintos que responderam. */
export function participantCount(responses: ResponseDoc[]): number {
  return new Set(responses.map((r) => r.participantUid)).size
}
