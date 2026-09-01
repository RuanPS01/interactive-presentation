import { z } from 'zod'
import { FONT_SIZE_RANGE, QUIZ_TIMER_RANGE } from './settings'

/** Schemas Zod usados para validar apresentações importadas via JSON. */

export const choiceOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
})

const fontSizeSchema = z
  .number()
  .int()
  .min(FONT_SIZE_RANGE.min)
  .max(FONT_SIZE_RANGE.max)

/** Opções globais. Tudo opcional: o que faltar recebe o padrão na importação. */
export const settingsSchema = z
  .object({
    allowChangeAnswer: z.boolean(),
    askName: z.boolean(),
    identifyResponses: z.boolean(),
    titleFontSize: fontSizeSchema,
    labelFontSize: fontSizeSchema,
    bodyFontSize: fontSizeSchema,
    quizTimerSeconds: z
      .number()
      .int()
      .min(QUIZ_TIMER_RANGE.min)
      .max(QUIZ_TIMER_RANGE.max),
  })
  .partial()

/** Sobrescritas por slide (mesmas opções, sem `askName`). */
export const overridesSchema = settingsSchema.omit({ askName: true })

/** Campos comuns a todos os slides. */
const baseFields = {
  id: z.string().min(1),
  title: z.string(),
  overrides: overridesSchema.optional(),
}

export const slideSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseFields,
    type: z.literal('wordcloud'),
    wordLimitMode: z.enum(['one', 'range', 'unlimited']),
    maxWords: z.number().int().min(1).max(50),
  }),
  z.object({
    ...baseFields,
    type: z.literal('bar'),
    options: z.array(choiceOptionSchema).min(1),
    allowMultiple: z.boolean(),
  }),
  z.object({
    ...baseFields,
    type: z.literal('pie'),
    options: z.array(choiceOptionSchema).min(1),
    allowMultiple: z.boolean(),
  }),
  z.object({
    ...baseFields,
    type: z.literal('quiz'),
    options: z.array(choiceOptionSchema).min(1),
    allowMultiple: z.boolean(),
    correctOptionIds: z.array(z.string()).default([]),
    revealAnswer: z.boolean().default(false),
    showResponses: z.boolean().default(false),
  }),
  z.object({
    ...baseFields,
    type: z.literal('answer'),
    quizSlideId: z.string().min(1),
  }),
  z.object({
    ...baseFields,
    type: z.literal('text'),
    content: z.string(),
    align: z.enum(['left', 'center', 'right']),
    fontSize: z.number().int().min(8).max(200),
  }),
])

export const presentationSchema = z.object({
  title: z.string(),
  slides: z.array(slideSchema),
  settings: settingsSchema.optional(),
})

export type PresentationInput = z.infer<typeof presentationSchema>
