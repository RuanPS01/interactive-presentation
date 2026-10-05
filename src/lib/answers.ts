import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import type { Room, Slide } from '../types/presentation'

/**
 * Gabaritos protegidos até a revelação.
 *
 * O documento da sala tem leitura pública (o código é a chave), então um
 * `correctOptionIds` guardado nele poderia ser lido pela plateia, pelas
 * ferramentas do navegador, antes de a resposta aparecer. Por isso a sala
 * guarda as perguntas SEM gabarito, e os gabaritos ficam num documento que só
 * o dono lê: `rooms/{code}/secret/answers`, no formato
 * `{ [idDoQuiz]: idsDasCorretas }`.
 *
 * Quando o suspense de um gabarito termina, o projetor copia as corretas
 * daquela pergunta para `room.revealedAnswers` (público), na mesma escrita que
 * registra a revelação. O celular só conhece o gabarito das perguntas já
 * reveladas.
 */

/** Gabaritos por id do `quiz`. */
export type AnswerKey = Record<string, string[]>

export function answersRef(code: string) {
  return doc(db, 'rooms', code, 'secret', 'answers')
}

/** Separa os gabaritos dos slides: a versão pública vai sem `correctOptionIds`. */
export function splitAnswers(slides: Slide[]): { slides: Slide[]; answers: AnswerKey } {
  const answers: AnswerKey = {}
  const publicSlides = slides.map((slide) => {
    if (slide.type !== 'quiz') return slide
    answers[slide.id] = slide.correctOptionIds
    return { ...slide, correctOptionIds: [] }
  })
  return { slides: publicSlides, answers }
}

/**
 * Slides com os gabaritos de volta (visão do dono). Salas criadas antes da
 * proteção guardam o gabarito no próprio slide: sem registro no documento
 * secreto, vale o do slide.
 */
export function withAnswers(slides: Slide[], answers: AnswerKey | null | undefined): Slide[] {
  if (!answers) return slides
  return slides.map((slide) =>
    slide.type === 'quiz' && answers[slide.id]
      ? { ...slide, correctOptionIds: answers[slide.id] }
      : slide,
  )
}

/**
 * Slides como a plateia pode vê-los: cada pergunta só com o gabarito já
 * revelado. Numa sala antiga (sem `answersHidden`), o gabarito do próprio
 * slide continua valendo.
 */
export function withRevealedAnswers(room: Room): Slide[] {
  if (!room.answersHidden) return room.slides
  const revealed = room.revealedAnswers ?? {}
  return room.slides.map((slide) =>
    slide.type === 'quiz' ? { ...slide, correctOptionIds: revealed[slide.id] ?? [] } : slide,
  )
}

/** O gabarito desta pergunta já chegou à plateia? */
export function isAnswerPublished(room: Room, quizSlideId: string): boolean {
  return !room.answersHidden || Boolean(room.revealedAnswers && quizSlideId in room.revealedAnswers)
}

/** Assina os gabaritos (só o dono da sala consegue ler). */
export function subscribeAnswers(
  code: string,
  onData: (answers: AnswerKey | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    answersRef(code),
    (snap) => onData(snap.exists() ? (snap.data() as AnswerKey) : null),
    (error) => onError?.(error),
  )
}

/** Lê os gabaritos uma vez; sem permissão ou sem documento, devolve `null`. */
export async function fetchAnswers(code: string): Promise<AnswerKey | null> {
  try {
    const snap = await getDoc(answersRef(code))
    return snap.exists() ? (snap.data() as AnswerKey) : null
  } catch {
    return null
  }
}
