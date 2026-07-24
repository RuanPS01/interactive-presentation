import { z } from 'zod'

/** Schemas Zod usados para validar apresentações importadas via JSON. */

export const choiceOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
})

export const slideSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    type: z.literal('wordcloud'),
    title: z.string(),
    wordLimitMode: z.enum(['one', 'range', 'unlimited']),
    maxWords: z.number().int().min(1).max(50),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('bar'),
    title: z.string(),
    options: z.array(choiceOptionSchema).min(1),
    allowMultiple: z.boolean(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('pie'),
    title: z.string(),
    options: z.array(choiceOptionSchema).min(1),
    allowMultiple: z.boolean(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('text'),
    title: z.string(),
    content: z.string(),
    align: z.enum(['left', 'center', 'right']),
    fontSize: z.number().int().min(8).max(200),
  }),
])

export const presentationSchema = z.object({
  title: z.string(),
  theme: z.enum(['light', 'dark']),
  slides: z.array(slideSchema),
})

export type PresentationInput = z.infer<typeof presentationSchema>
