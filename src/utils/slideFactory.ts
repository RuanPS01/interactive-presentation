import type { Slide, SlideType } from '../types/presentation'

/** Gera ids únicos para slides e opções (contexto seguro: localhost/https). */
export function newId(): string {
  return crypto.randomUUID()
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
  text: 'Texto simples',
}
