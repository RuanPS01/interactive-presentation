import type { jsPDF } from 'jspdf'
import type {
  ChoiceSlide,
  QuizSlide,
  ResponseDoc,
  Room,
  Slide,
  TextSlide,
} from '../types/presentation'
import { isInteractiveSlide } from '../types/presentation'
import {
  aggregateChoices,
  aggregateWords,
  answeredCount,
  responseSummary,
  totalVotes,
} from './aggregate'
import { SLIDE_TYPE_LABELS } from './slideFactory'
import { CHART_COLORS } from '../components/charts/palette'

const MARGIN = 48

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code < 0x300 || code > 0x36f
    })
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Gera um PDF com os resultados da apresentação (dados enviados pelos
 * participantes), desenhado de forma vetorial. Roda 100% no navegador;
 * a jsPDF é carregada sob demanda para não pesar no bundle inicial.
 */
export async function exportResultsPdf(room: Room, responses: ResponseDoc[]): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  drawCover(doc, room, responses, W)

  // Slides de gabarito não viram página: a pergunta já sai com a resposta
  // correta destacada, então uma página extra só repetiria a mesma informação.
  const pages = room.slides.filter((s) => s.type !== 'answer')

  pages.forEach((slide, i) => {
    doc.addPage()
    const slideResponses = responses.filter((r) => r.slideId === slide.id)
    drawSlidePage(doc, slide, slideResponses, i + 1, pages.length, W, H)

    // Página seguinte: quem respondeu o quê, em tabela. Só para slides que
    // recebem resposta e que tenham pelo menos uma.
    if (isInteractiveSlide(slide) && slideResponses.length > 0) {
      doc.addPage()
      drawResponsesTable(doc, slide, slideResponses, i + 1, pages.length, W, H)
    }
  })

  doc.save(`${slugify(room.title) || 'apresentacao'}-resultados.pdf`)
}

function drawCover(doc: jsPDF, room: Room, responses: ResponseDoc[], W: number): void {
  doc.setFillColor(37, 99, 235) // blue-600, cor primária
  doc.rect(0, 0, W, 130, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text('Relatório de resultados', MARGIN, 52)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text(doc.splitTextToSize(room.title || 'Apresentação', W - 2 * MARGIN), MARGIN, 84)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(60, 60, 60)
  const generatedAt = new Date().toLocaleString('pt-BR')
  doc.text(`Gerado em: ${generatedAt}`, MARGIN, 172)
  doc.text(`Slides: ${room.slides.length}`, MARGIN, 194)
  doc.text(`Participantes que responderam: ${answeredCount(responses)}`, MARGIN, 216)
}

function drawSlidePage(
  doc: jsPDF,
  slide: Slide,
  responses: ResponseDoc[],
  index: number,
  count: number,
  W: number,
  H: number,
): void {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(140, 140, 140)
  doc.text(`Slide ${index}/${count} · ${SLIDE_TYPE_LABELS[slide.type]}`, MARGIN, MARGIN)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(20, 20, 20)
  const titleLines = doc.splitTextToSize(
    slide.title || SLIDE_TYPE_LABELS[slide.type],
    W - 2 * MARGIN,
  )
  doc.text(titleLines, MARGIN, MARGIN + 26)

  const contentTop = MARGIN + 26 + titleLines.length * 22 + 24
  doc.setFont('helvetica', 'normal')

  switch (slide.type) {
    case 'bar':
    case 'pie':
      drawChoice(doc, slide, responses, contentTop, W, H)
      drawFooter(doc, responseSummary(slide, responses), H)
      break
    case 'quiz':
      drawChoice(doc, slide, responses, contentTop, W, H, slide.correctOptionIds)
      drawFooter(doc, responseSummary(slide, responses), H)
      break
    case 'wordcloud':
      drawWordCloud(doc, responses, contentTop, W, H)
      drawFooter(doc, responseSummary(slide, responses), H)
      break
    case 'text':
      drawText(doc, slide, contentTop, W)
      return
    case 'answer':
      // Filtrado antes de chegar aqui (ver `exportResultsPdf`).
      return
  }
}

/**
 * Barras horizontais com os votos. Com `correctIds` (slide de alternativas), a
 * opção correta ganha um marcador — é o gabarito dentro do relatório.
 * Devolve a coordenada Y final.
 */
function drawChoice(
  doc: jsPDF,
  slide: ChoiceSlide | QuizSlide,
  responses: ResponseDoc[],
  top: number,
  W: number,
  H: number,
  correctIds?: string[],
): number {
  const tallies = aggregateChoices(responses, slide.options)
  const total = totalVotes(tallies)
  const correct = new Set(correctIds ?? [])
  const trackW = W - 2 * MARGIN
  const rowH = 50
  let y = top

  tallies.forEach((t, idx) => {
    if (y + rowH > H - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
    const [r, g, b] = hexToRgb(CHART_COLORS[idx % CHART_COLORS.length])
    const pct = total > 0 ? t.votes / total : 0
    const isCorrect = correct.has(t.id)

    doc.setFontSize(12)
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', isCorrect ? 'bold' : 'normal')
    const label = isCorrect ? `[correta] ${t.label}` : t.label
    doc.text(doc.splitTextToSize(label, trackW - 120)[0] ?? label, MARGIN, y)
    doc.setFont('helvetica', 'normal')

    const barY = y + 8
    const barH = 16
    doc.setFillColor(230, 230, 230)
    doc.roundedRect(MARGIN, barY, trackW, barH, 4, 4, 'F')
    if (isCorrect) doc.setFillColor(34, 197, 94)
    else doc.setFillColor(r, g, b)
    doc.roundedRect(MARGIN, barY, Math.max(2, trackW * pct), barH, 4, 4, 'F')

    doc.setFontSize(10)
    doc.setTextColor(90, 90, 90)
    doc.text(`${t.votes} voto(s) · ${(pct * 100).toFixed(0)}%`, MARGIN, barY + barH + 14)

    y += rowH
  })

  if (total === 0) {
    doc.setFontSize(11)
    doc.setTextColor(140, 140, 140)
    doc.text('Nenhum voto registrado.', MARGIN, y + 8)
    y += 24
  }
  return y
}

function drawWordCloud(
  doc: jsPDF,
  responses: ResponseDoc[],
  top: number,
  W: number,
  H: number,
): number {
  const words = aggregateWords(responses)
  if (words.length === 0) {
    doc.setFontSize(11)
    doc.setTextColor(140, 140, 140)
    doc.text('Nenhuma resposta enviada.', MARGIN, top)
    return top + 20
  }

  const values = words.map((w) => w.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const sizeOf = (v: number): number =>
    max === min ? 22 : 14 + ((v - min) / (max - min)) * 26

  let x = MARGIN
  let y = top + 24
  let lineMax = 0

  for (const w of words.slice(0, 120)) {
    const fs = sizeOf(w.value)
    doc.setFontSize(fs)
    doc.setFont('helvetica', 'bold')
    const width = doc.getTextWidth(w.text)

    if (x !== MARGIN && x + width > W - MARGIN) {
      y += lineMax * 1.25 + 8
      x = MARGIN
      lineMax = 0
      if (y > H - MARGIN) {
        doc.addPage()
        y = MARGIN + 24
      }
    }
    lineMax = Math.max(lineMax, fs)

    const idx = words.indexOf(w)
    const [r, g, b] = hexToRgb(CHART_COLORS[idx % CHART_COLORS.length])
    doc.setTextColor(r, g, b)
    doc.text(w.text, x, y)
    x += width + 14
  }
  doc.setFont('helvetica', 'normal')
  return y + lineMax * 0.4 + 12
}

interface TableRow {
  participante: string
  resposta: string
  /** Só em perguntas com gabarito. */
  resultado?: string
}

const ROW_PADDING = 6
const LINE_H = 13
const HEADER_H = 24

/**
 * Monta as linhas da tabela de respostas.
 *
 * Quando a sala pediu o nome, cada linha é identificada por ele. Sem nome, cai
 * para "Participante N" — numerado pela ordem em que as respostas chegaram,
 * para a tabela continuar útil (dá para ver o padrão individual) sem inventar
 * uma identidade que ninguém informou.
 */
function buildRows(slide: Slide, responses: ResponseDoc[]): TableRow[] {
  const labels = new Map<string, string>()
  if ('options' in slide) {
    for (const option of slide.options) labels.set(option.id, option.label)
  }
  const correct = slide.type === 'quiz' ? new Set(slide.correctOptionIds) : null

  const porChegada = [...responses].sort((a, b) => a.createdAt - b.createdAt)
  const numero = new Map(porChegada.map((r, i) => [r.participantUid, i + 1]))

  const rows = porChegada.map((r) => {
    const respostas = r.value.map((v) => labels.get(v) ?? v).filter(Boolean)
    const nome = r.participantName?.trim()
    const row: TableRow = {
      participante: nome || `Participante ${numero.get(r.participantUid)}`,
      resposta: respostas.length > 0 ? respostas.join(', ') : '—',
    }
    if (correct && correct.size > 0) {
      const escolhidas = new Set(r.value)
      const acertou =
        escolhidas.size === correct.size && [...correct].every((id) => escolhidas.has(id))
      row.resultado = acertou ? 'Correta' : 'Incorreta'
    }
    return row
  })

  // Com nomes, a ordem alfabética facilita procurar alguém na lista.
  const temNomes = responses.some((r) => r.participantName?.trim())
  return temNomes
    ? rows.sort((a, b) => a.participante.localeCompare(b.participante, 'pt-BR'))
    : rows
}

/**
 * Página com a tabela "quem respondeu o quê", logo depois da página do slide.
 * Quebra em quantas páginas forem necessárias, repetindo o cabeçalho.
 */
function drawResponsesTable(
  doc: jsPDF,
  slide: Slide,
  responses: ResponseDoc[],
  index: number,
  count: number,
  W: number,
  H: number,
): void {
  const rows = buildRows(slide, responses)
  const temResultado = rows.some((r) => r.resultado !== undefined)
  const trackW = W - 2 * MARGIN

  // Larguras: nome, resposta e (opcional) acerto.
  const colNome = 150
  const colResultado = temResultado ? 80 : 0
  const colResposta = trackW - colNome - colResultado

  let y = MARGIN

  function drawTitle(): void {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(140, 140, 140)
    doc.text(`Slide ${index}/${count} · Respostas por participante`, MARGIN, y)
    y += 22

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(20, 20, 20)
    const titulo = doc.splitTextToSize(
      slide.title || SLIDE_TYPE_LABELS[slide.type],
      trackW,
    )
    doc.text(titulo, MARGIN, y)
    y += titulo.length * 17 + 14
  }

  function drawHeader(): void {
    doc.setFillColor(37, 99, 235)
    doc.rect(MARGIN, y, trackW, HEADER_H, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text('Participante', MARGIN + ROW_PADDING, y + 16)
    doc.text('Resposta', MARGIN + colNome + ROW_PADDING, y + 16)
    if (temResultado) {
      doc.text('Resultado', MARGIN + colNome + colResposta + ROW_PADDING, y + 16)
    }
    y += HEADER_H
  }

  drawTitle()
  drawHeader()

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  rows.forEach((row, i) => {
    const nomeLines = doc.splitTextToSize(row.participante, colNome - ROW_PADDING * 2)
    const respLines = doc.splitTextToSize(row.resposta, colResposta - ROW_PADDING * 2)
    const rowH = Math.max(nomeLines.length, respLines.length) * LINE_H + ROW_PADDING * 2

    if (y + rowH > H - MARGIN) {
      doc.addPage()
      y = MARGIN
      drawHeader()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
    }

    // Zebra: facilita seguir a linha em tabelas longas.
    if (i % 2 === 1) {
      doc.setFillColor(245, 245, 245)
      doc.rect(MARGIN, y, trackW, rowH, 'F')
    }

    const textoY = y + ROW_PADDING + 10
    doc.setTextColor(30, 30, 30)
    doc.text(nomeLines, MARGIN + ROW_PADDING, textoY)
    doc.text(respLines, MARGIN + colNome + ROW_PADDING, textoY)

    if (row.resultado) {
      if (row.resultado === 'Correta') doc.setTextColor(21, 128, 61)
      else doc.setTextColor(180, 83, 9)
      doc.text(row.resultado, MARGIN + colNome + colResposta + ROW_PADDING, textoY)
    }

    y += rowH
  })

  doc.setDrawColor(225, 225, 225)
  doc.line(MARGIN, y, MARGIN + trackW, y)

  drawFooter(doc, `${rows.length} participante(s) responderam este slide`, H)
}

function drawText(doc: jsPDF, slide: TextSlide, top: number, W: number): void {
  const fs = Math.min(Math.max(slide.fontSize, 12), 28)
  doc.setFontSize(fs)
  doc.setTextColor(25, 25, 25)
  const maxW = W - 2 * MARGIN
  const lines = doc.splitTextToSize(slide.content || '', maxW)
  const x = slide.align === 'center' ? W / 2 : slide.align === 'right' ? W - MARGIN : MARGIN
  doc.text(lines, x, top + 20, { align: slide.align })
}

function drawFooter(doc: jsPDF, text: string, H: number): void {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120, 120, 120)
  doc.text(text, MARGIN, H - 32)
}
