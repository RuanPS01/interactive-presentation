import type { AnswerSlide, Slide, SlideAspect, SlideType } from '../types/presentation'
import { createFreeSlide } from './freeSlide'
import { SLIDE_FRAMES } from './settings'

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
  'free',
]

/** Slide de gabarito, sempre atrelado a um `quiz`. */
export function createAnswerSlide(quizSlideId: string, title: string): AnswerSlide {
  return { id: newId(), type: 'answer', title, quizSlideId }
}

/**
 * Cria um slide novo com valores padrão sensatos para cada tipo. O formato só
 * importa para o slide livre, que nasce do tamanho da moldura da apresentação.
 */
export function createDefaultSlide(type: SlideType, aspect: SlideAspect = '16:9'): Slide {
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
        // Pergunta e resposta: por padrão as respostas ficam ocultas.
        showResponses: false,
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
    case 'free':
      return createFreeSlide(SLIDE_FRAMES[aspect], newId())
  }
}

export const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  wordcloud: 'Nuvem de palavras',
  bar: 'Gráfico de barras',
  pie: 'Gráfico de pizza',
  quiz: 'Alternativas (sem gráfico)',
  answer: 'Resposta correta',
  text: 'Texto simples',
  free: 'Slide livre',
}
