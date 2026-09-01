import type {
  ChoiceOption,
  ChoiceSlide,
  ResponseDoc,
  Slide,
  WordCloudSlide,
} from '../types/presentation'

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

/**
 * Nº de participantes distintos que RESPONDERAM este slide.
 *
 * Não confundir com o total de participantes da sala: quem só entrou (e ainda
 * não respondeu) não aparece aqui — esse número vem da coleção `participants`
 * (ver `lib/participants.ts`).
 */
export function answeredCount(responses: ResponseDoc[]): number {
  return new Set(responses.map((r) => r.participantUid)).size
}

/** Total de itens enviados numa nuvem de palavras. */
export function totalWords(responses: ResponseDoc[]): number {
  return aggregateWords(responses).reduce((sum, w) => sum + w.value, 0)
}

/**
 * Rodapé de contagem de um slide interativo.
 *
 * O total de envios só entra quando pode ser diferente de quem respondeu: numa
 * escolha única, ou numa nuvem de um envio por pessoa, os dois números são
 * sempre iguais e repeti-los ("8 responderam · 8 voto(s)") só polui a tela.
 */
export function responseSummary(
  slide: WordCloudSlide | ChoiceSlide,
  responses: ResponseDoc[],
): string {
  const answered = `${answeredCount(responses)} responderam`
  if (slide.type === 'wordcloud') {
    if (slide.wordLimitMode === 'one') return answered
    return `${answered} · ${totalWords(responses)} resposta(s) enviada(s)`
  }
  if (!slide.allowMultiple) return answered
  return `${answered} · ${totalVotes(aggregateChoices(responses, slide.options))} voto(s)`
}

export interface NamedResponse {
  uid: string
  name: string
  /** Texto legível do que a pessoa respondeu (palavras ou rótulos). */
  answers: string[]
}

/**
 * Respostas com o nome de quem respondeu, para os slides que pedem
 * identificação. Ids de opção são traduzidos para o rótulo correspondente.
 */
export function namedResponses(
  responses: ResponseDoc[],
  slide: Slide | undefined,
): NamedResponse[] {
  const labels = new Map<string, string>()
  if (slide && 'options' in slide) {
    for (const option of slide.options) labels.set(option.id, option.label)
  }

  return responses
    .map((r) => ({
      uid: r.participantUid,
      name: r.participantName?.trim() || 'Anônimo',
      answers: r.value.map((v) => labels.get(v) ?? v).filter(Boolean),
    }))
    .filter((r) => r.answers.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
