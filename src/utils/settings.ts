import type {
  PresentationSettings,
  Slide,
  SlideOverrides,
} from '../types/presentation'

/**
 * Valores padrão das opções globais. Também servem de preenchimento para
 * apresentações antigas (JSON exportado antes das opções existirem) e para
 * salas criadas em versões anteriores.
 */
export const DEFAULT_SETTINGS: PresentationSettings = {
  allowChangeAnswer: true,
  askName: false,
  identifyResponses: false,
  titleFontSize: 36,
  labelFontSize: 16,
  bodyFontSize: 24,
}

/** Limites aceitos pelos controles e pela validação do JSON. */
export const FONT_SIZE_RANGE = { min: 10, max: 200 } as const

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.bodyFontSize
  return Math.round(
    Math.max(FONT_SIZE_RANGE.min, Math.min(FONT_SIZE_RANGE.max, value)),
  )
}

/** Completa uma configuração parcial (ou ausente) com os padrões. */
export function withDefaults(
  settings: Partial<PresentationSettings> | undefined,
): PresentationSettings {
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) }
}

/**
 * Configuração efetiva de um slide: global + sobrescritas do próprio slide.
 *
 * Dois ajustes de coerência:
 * - `identifyResponses` só vale se a sala pedir o nome (`askName` é global);
 * - no slide de texto o tamanho do corpo é o próprio `fontSize` do slide, que
 *   já existia antes das opções globais e continua sendo o controle dele.
 */
export function resolveSlideSettings(
  global: Partial<PresentationSettings> | undefined,
  slide: Slide | undefined,
): PresentationSettings {
  const base = withDefaults(global)
  const overrides: SlideOverrides = slide?.overrides ?? {}
  const merged: PresentationSettings = { ...base, ...overrides }
  merged.identifyResponses = merged.identifyResponses && base.askName
  if (slide?.type === 'text') merged.bodyFontSize = slide.fontSize
  return merged
}

/** Rótulos em português para as opções (usados no editor e na documentação). */
export const SETTING_LABELS = {
  allowChangeAnswer: 'Permitir limpar e trocar a resposta',
  askName: 'Solicitar o nome antes de entrar na sala',
  identifyResponses: 'Identificar as respostas com o nome do participante',
  titleFontSize: 'Tamanho do título',
  labelFontSize: 'Tamanho dos rótulos',
  bodyFontSize: 'Tamanho do corpo',
} as const
