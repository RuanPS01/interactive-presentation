import type { AnswerSlide, Slide, SlideType } from '../types/presentation'

/** Gera ids únicos para slides e opções (contexto seguro: localhost/https). */
export function newId(): string {
  return crypto.randomUUID()
}

/**
 * Tipos que o apresentador adiciona manualmente. `answer` fica de fora: ele é
 * criado e removido automaticamente pelo editor junto do `quiz` que revela.
 */
export const CREATABLE_SLIDE_TYPES: SlideType[] = [
  'wordcloud',
  'bar',
  'pie',
  'quiz',
  'text',
]

/** Slide de gabarito, sempre atrelado a um `quiz`. */
export function createAnswerSlide(quizSlideId: string, title: string): AnswerSlide {
  return { id: newId(), type: 'answer', title, quizSlideId }
}

/** Cria um slide novo com valores padrão sensatos para cada tipo. */
export function createDefaultSlide(type: SlideType): Slide {
  switch (type) {
    case 'wordcloud':
      return {
        id: newId(),
        type,
        title: 'Nuvem de palavras',
        // Padrão do requisito: o participante pode escrever quantas quiser.
        wordLimitMode: 'unlimited',
        maxWords: 3,
      }
    case 'bar':
      return {
        id: newId(),
        type,
        title: 'Gráfico de barras',
        allowMultiple: false,
        options: [
          { id: newId(), label: 'Opção 1' },
          { id: newId(), label: 'Opção 2' },
        ],
      }
    case 'pie':
      return {
        id: newId(),
        type,
        title: 'Gráfico de pizza',
        allowMultiple: false,
        options: [
          { id: newId(), label: 'Opção 1' },
          { id: newId(), label: 'Opção 2' },
        ],
      }
    case 'quiz':
      return {
        id: newId(),
        type,
        title: 'Pergunta',
        allowMultiple: false,
        correctOptionIds: [],
        revealAnswer: false,
        options: [
          { id: newId(), label: 'Alternativa 1' },
          { id: newId(), label: 'Alternativa 2' },
        ],
      }
    case 'answer':
      // Sem um `quiz` de origem o slide não tem o que revelar; o editor usa
      // `createAnswerSlide`. Aqui só existe para o switch ser exaustivo.
      return createAnswerSlide('', 'Resposta correta')
    case 'text':
      return {
        id: newId(),
        type,
        title: 'Slide de texto',
        content: 'Escreva seu texto aqui',
        align: 'center',
        fontSize: 40,
      }
  }
}

export const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  wordcloud: 'Nuvem de palavras',
  bar: 'Gráfico de barras',
  pie: 'Gráfico de pizza',
  quiz: 'Alternativas (sem gráfico)',
  answer: 'Resposta correta',
  text: 'Texto simples',
}
