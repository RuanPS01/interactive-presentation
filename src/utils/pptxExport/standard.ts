import type {
  ChoiceOption,
  FreeSlide,
  FreeTextElement,
  FreeTextRun,
  PresentationSettings,
  Slide,
  ThemeMode,
} from '../../types/presentation'
import { paragraphsFromText } from '../freeSlide'
import { resolveSlideSettings } from '../settings'
import { findQuizSlide } from '../slides'

/**
 * Versão estática dos slides comuns, montada como um slide livre para usar o
 * mesmo caminho da exportação. As perguntas viram o enunciado com as
 * alternativas (sem resultados: a exportação sai do editor); o gabarito
 * destaca as corretas. As cores seguem o tema escolhido na página (claro ou
 * escuro), como esses slides aparecem no projetor.
 */

const PAD = 64
const GAP = 24

/** Cores de cada tema, as mesmas do projetor (escala "neutral" do Tailwind). */
interface Palette {
  background: string
  ink: string
  muted: string
  card: string
  letter: string
  correctCard: string
  correctInk: string
  correctMark: string
  placeholder: string
}

const PALETTES: Record<ThemeMode, Palette> = {
  light: {
    background: '#ffffff',
    ink: '#171717',
    muted: '#737373',
    card: '#f3f4f6',
    letter: '#2563eb',
    correctCard: '#dcfce7',
    correctInk: '#14532d',
    correctMark: '#16a34a',
    placeholder: '#a3a3a3',
  },
  dark: {
    background: '#0a0a0a',
    ink: '#fafafa',
    muted: '#a3a3a3',
    card: '#262626',
    letter: '#60a5fa',
    correctCard: '#052e16',
    correctInk: '#bbf7d0',
    correctMark: '#4ade80',
    placeholder: '#525252',
  },
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Tamanhos mínimos (px da moldura; metade disso em pontos). Os padrões da
 * plataforma foram pensados para a tela do projetor, com a pergunta como
 * destaque; num arquivo de PowerPoint eles ficariam pequenos demais.
 */
const MIN_TITLE = 60
const MIN_BODY = 40
const MIN_HINT = 28

interface Frame {
  width: number
  height: number
}

function textBox(
  id: string,
  name: string,
  box: { x: number; y: number; width: number; height: number },
  text: string,
  style: FreeTextElement['style'],
  lineHeight?: number,
): FreeTextElement {
  return {
    id,
    name,
    kind: 'text',
    ...box,
    style,
    paragraphs: [{ runs: [{ text }], align: 'center' }],
    verticalAlign: 'middle',
    ...(lineHeight ? { lineHeight } : {}),
  }
}

function hintSize(settings: PresentationSettings): number {
  return Math.max(settings.labelFontSize, MIN_HINT)
}

function hint(frame: Frame, text: string, settings: PresentationSettings, palette: Palette): FreeTextElement {
  const size = hintSize(settings)
  return {
    id: 'dica',
    name: 'Instrução',
    kind: 'text',
    x: PAD,
    y: frame.height - PAD - size * 1.6,
    width: frame.width - 2 * PAD,
    height: size * 1.6,
    style: { fontFamily: 'Arial', fontSize: size, color: palette.muted, italic: true },
    paragraphs: [{ runs: [{ text }], align: 'center' }],
    verticalAlign: 'middle',
  }
}

/** Alternativas em cartões: uma coluna até 4 opções, duas acima disso. */
function optionCards(
  options: ChoiceOption[],
  area: { top: number; bottom: number },
  frame: Frame,
  fontSize: number,
  mode: { letters: boolean; correct?: string[] },
  palette: Palette,
): FreeTextElement[] {
  if (options.length === 0) return []
  const cols = options.length > 4 ? 2 : 1
  const rows = Math.ceil(options.length / cols)
  const width = (frame.width - 2 * PAD - GAP * (cols - 1)) / cols
  const available = area.bottom - area.top
  const height = Math.max(fontSize * 1.6, Math.min(fontSize * 2.8, (available - GAP * (rows - 1)) / rows))
  const blockHeight = rows * height + (rows - 1) * GAP
  const top = area.top + Math.max(0, (available - blockHeight) / 2)
  return options.map((option, i) => {
    const col = cols === 2 ? i % 2 : 0
    const row = cols === 2 ? Math.floor(i / 2) : i
    const isCorrect = mode.correct?.includes(option.id) ?? false
    const dimmed = mode.correct !== undefined && !isCorrect
    const runs: FreeTextRun[] = []
    if (mode.letters) {
      runs.push({
        text: `${LETTERS[i] ?? i + 1}   `,
        style: { bold: true, color: isCorrect ? palette.correctMark : palette.letter },
      })
    }
    runs.push({ text: option.label || `Opção ${i + 1}` })
    if (isCorrect) runs.push({ text: '   (correta)', style: { bold: true, color: palette.correctMark } })
    return {
      id: `opcao-${i + 1}`,
      name: `Alternativa ${LETTERS[i] ?? i + 1}`,
      kind: 'text',
      x: PAD + col * (width + GAP),
      y: top + row * (height + GAP),
      width,
      height,
      style: {
        fontFamily: 'Arial',
        fontSize,
        color: isCorrect ? palette.correctInk : dimmed ? palette.muted : palette.ink,
        bold: isCorrect,
      },
      paragraphs: [{ runs }],
      verticalAlign: 'middle',
      padding: [0, 32, 0, 32],
      background: isCorrect ? palette.correctCard : palette.card,
    } satisfies FreeTextElement
  })
}

export function standardSlideToFree(
  slide: Exclude<Slide, FreeSlide>,
  slides: Slide[],
  globalSettings: Partial<PresentationSettings> | undefined,
  frame: Frame,
  theme: ThemeMode = 'light',
): FreeSlide {
  const palette = PALETTES[theme]
  const settings = resolveSlideSettings(globalSettings, slide)
  const quiz = findQuizSlide(slide, slides)
  const titleText = slide.type === 'answer' ? (quiz?.title ?? slide.title) : slide.title
  const titleSize = Math.max(settings.titleFontSize, MIN_TITLE)
  const titleHeight = titleSize * 1.15 * 2
  const elements: FreeTextElement[] = []
  if (titleText.trim()) {
    elements.push(
      textBox(
        'titulo',
        'Título',
        { x: PAD, y: PAD, width: frame.width - 2 * PAD, height: titleHeight },
        titleText,
        { fontFamily: 'Arial', fontSize: titleSize, color: palette.ink, bold: true },
        1.15,
      ),
    )
  }
  const bodyTop = PAD + titleHeight + GAP
  const bodyBottom = frame.height - PAD
  const hintSpace = hintSize(settings) * 1.6 + GAP
  const fontSize = Math.max(settings.bodyFontSize, MIN_BODY)

  switch (slide.type) {
    case 'text':
      elements.push({
        id: 'conteudo',
        name: 'Conteúdo',
        kind: 'text',
        x: PAD,
        y: bodyTop,
        width: frame.width - 2 * PAD,
        height: bodyBottom - bodyTop,
        style: { fontFamily: 'Arial', fontSize: Math.max(slide.fontSize, MIN_BODY), color: palette.ink },
        paragraphs: paragraphsFromText(slide.content).map((p) => ({ ...p, align: slide.align })),
        verticalAlign: 'middle',
        lineHeight: 1.25,
      })
      break
    case 'wordcloud':
      elements.push(
        textBox(
          'conteudo',
          'Nuvem de palavras',
          { x: PAD, y: bodyTop, width: frame.width - 2 * PAD, height: bodyBottom - bodyTop - hintSpace },
          'Nuvem de palavras',
          { fontFamily: 'Arial', fontSize: Math.max(titleSize, 72), color: palette.placeholder },
        ),
        hint(frame, 'Envie sua resposta pelo celular: as palavras aparecem ao vivo na apresentação.', settings, palette),
      )
      break
    case 'bar':
    case 'pie':
    case 'quiz':
      elements.push(
        ...optionCards(
          slide.options,
          { top: bodyTop, bottom: bodyBottom - hintSpace },
          frame,
          fontSize,
          { letters: slide.type === 'quiz' },
          palette,
        ),
        hint(
          frame,
          slide.type === 'quiz'
            ? 'Responda pelo celular.'
            : 'Vote pelo celular: o resultado aparece ao vivo na apresentação.',
          settings,
          palette,
        ),
      )
      break
    case 'answer':
      elements.push(
        ...optionCards(
          quiz?.options ?? [],
          { top: bodyTop, bottom: bodyBottom },
          frame,
          fontSize,
          { letters: true, correct: quiz?.correctOptionIds ?? [] },
          palette,
        ),
      )
      break
  }

  return {
    id: slide.id,
    type: 'free',
    title: titleText,
    width: frame.width,
    height: frame.height,
    background: palette.background,
    elements,
  }
}
