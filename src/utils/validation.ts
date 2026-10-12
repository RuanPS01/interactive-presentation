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
    slideAspect: z.enum(['16:9', '4:3']),
    allowDownload: z.boolean(),
  })
  .partial()

/** Sobrescritas por slide (mesmas opções, sem `askName`, `slideAspect` e `allowDownload`). */
export const overridesSchema = settingsSchema.omit({ askName: true, slideAspect: true, allowDownload: true })

/* Slide livre ------------------------------------------------------------ */

/** Cor em `#rrggbb` ou `#rrggbbaa`: o valor vai direto para o CSS. */
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'cor inválida')
const coordSchema = z.number().finite().min(-100_000).max(100_000)
const lengthSchema = z.number().finite().min(0).max(100_000)

const freeTextStyleSchema = z
  .object({
    fontFamily: z.string().max(200),
    fontSize: z.number().finite().min(1).max(2000),
    color: colorSchema,
    bold: z.boolean(),
    italic: z.boolean(),
    underline: z.boolean(),
    strike: z.boolean(),
    highlight: colorSchema,
  })
  .partial()

const freeBulletSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('char'), char: z.string().min(1).max(4), color: colorSchema.optional() }),
  z.object({
    kind: z.literal('number'),
    format: z.enum(['arabic', 'alphaLower', 'alphaUpper', 'romanLower', 'romanUpper']),
    suffix: z.enum(['.', ')']),
    startAt: z.number().int().min(1).max(10_000).optional(),
  }),
])

const freeParagraphSchema = z.object({
  runs: z.array(z.object({ text: z.string().max(20_000), style: freeTextStyleSchema.optional() })),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  style: freeTextStyleSchema.optional(),
  bullet: freeBulletSchema.optional(),
  indent: lengthSchema.optional(),
  hanging: lengthSchema.optional(),
  spaceBefore: lengthSchema.optional(),
  spaceAfter: lengthSchema.optional(),
  lineHeight: z.number().finite().min(0.5).max(5).optional(),
})

const freeElementBase = {
  id: z.string().min(1),
  name: z.string().max(200).optional(),
  x: coordSchema,
  y: coordSchema,
  width: lengthSchema,
  height: lengthSchema,
  rotation: z.number().finite().min(-360).max(360).optional(),
  opacity: z.number().min(0).max(1).optional(),
}

const freeElementSchema = z.discriminatedUnion('kind', [
  z.object({
    ...freeElementBase,
    kind: z.literal('text'),
    paragraphs: z.array(freeParagraphSchema).max(500),
    style: freeTextStyleSchema,
    verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
    padding: z.tuple([lengthSchema, lengthSchema, lengthSchema, lengthSchema]).optional(),
    background: colorSchema.optional(),
    lineHeight: z.number().finite().min(0.5).max(5).optional(),
  }),
  z.object({
    ...freeElementBase,
    kind: z.literal('image'),
    assetId: z.string().min(1),
    fit: z.enum(['fill', 'contain', 'cover']).optional(),
    radius: lengthSchema.optional(),
  }),
])

/** Imagem embutida: só formatos que o navegador desenha, nunca outro esquema. */
export const assetSchema = z.object({
  id: z.string().min(1).max(200),
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/, 'imagem inválida'),
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
})

/**
 * Fonte embutida. O nome vai para o CSS e para o FontFace, então não aceita
 * aspas, sinais de marcação nem caracteres de controle; o arquivo só pode ser
 * uma fonte em base64.
 */
export const fontSchema = z.object({
  id: z.string().min(1).max(200),
  family: z
    .string()
    .min(1)
    .max(200)
    .refine(
      (v) => !/["\\<>;{}]/.test(v) && [...v].every((c) => c.charCodeAt(0) >= 32),
      'nome de fonte inválido',
    ),
  weight: z.enum(['normal', 'bold']),
  style: z.enum(['normal', 'italic']),
  dataUrl: z.string().regex(/^data:font\/(woff|woff2|ttf|otf);base64,[A-Za-z0-9+/=]+$/, 'fonte inválida'),
})

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
  z.object({
    ...baseFields,
    type: z.literal('free'),
    width: z.number().finite().min(100).max(10_000),
    height: z.number().finite().min(100).max(10_000),
    background: colorSchema,
    elements: z.array(freeElementSchema).max(500),
  }),
])

/**
 * Forma da apresentação, sem a conferência das imagens. Serve para o rascunho
 * do editor, que pode voltar sem as imagens (guardadas à parte, no IndexedDB):
 * a imagem que faltar aparece como espaço reservado.
 */
export const presentationShapeSchema = z.object({
  title: z.string(),
  slides: z.array(slideSchema),
  settings: settingsSchema.optional(),
  assets: z.record(z.string(), assetSchema).optional(),
  fonts: z.record(z.string(), fontSchema).optional(),
})

export const presentationSchema = presentationShapeSchema
  .superRefine((presentation, ctx) => {
    // Toda imagem citada por um slide livre precisa vir no arquivo.
    const assets = presentation.assets ?? {}
    presentation.slides.forEach((slide, i) => {
      if (slide.type !== 'free') return
      slide.elements.forEach((element, j) => {
        if (element.kind === 'image' && !assets[element.assetId]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['slides', i, 'elements', j, 'assetId'],
            message: `imagem "${element.assetId}" ausente em "assets"`,
          })
        }
      })
    })
  })

export type PresentationInput = z.infer<typeof presentationSchema>
