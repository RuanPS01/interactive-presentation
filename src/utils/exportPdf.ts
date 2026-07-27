import type { jsPDF } from 'jspdf'
import type {
  ChoiceSlide,
  ResponseDoc,
  Room,
  Slide,
  TextSlide,
} from '../types/presentation'
import {
  aggregateChoices,
  aggregateWords,
  participantCount,
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

  room.slides.forEach((slide, i) => {
    doc.addPage()
    const slideResponses = responses.filter((r) => r.slideId === slide.id)
    drawSlidePage(doc, slide, slideResponses, i + 1, room.slides.length, W, H)
  })

  doc.save(`${slugify(room.title) || 'apresentacao'}-resultados.pdf`)
}

function drawCover(doc: jsPDF, room: Room, responses: ResponseDoc[], W: number): void {
  doc.setFillColor(99, 102, 241)
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
  doc.text(`Participantes: ${participantCount(responses)}`, MARGIN, 216)
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
      drawFooter(doc, `${participantCount(responses)} participante(s) · ${totalVotes(aggregateChoices(responses, slide.options))} voto(s)`, H)
      break
    case 'wordcloud': {
      const total = aggregateWords(responses).reduce((s, w) => s + w.value, 0)
      drawWordCloud(doc, responses, contentTop, W, H)
      drawFooter(doc, `${participantCount(responses)} participante(s) · ${total} palavra(s)`, H)
      break
    }
    case 'text':
      drawText(doc, slide, contentTop, W)
      break
  }
}

function drawChoice(
  doc: jsPDF,
  slide: ChoiceSlide,
  responses: ResponseDoc[],
  top: number,
  W: number,
  H: number,
): void {
  const tallies = aggregateChoices(responses, slide.options)
  const total = totalVotes(tallies)
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

    doc.setFontSize(12)
    doc.setTextColor(30, 30, 30)
    doc.text(doc.splitTextToSize(t.label, trackW - 120)[0] ?? t.label, MARGIN, y)

    const barY = y + 8
    const barH = 16
    doc.setFillColor(230, 230, 230)
    doc.roundedRect(MARGIN, barY, trackW, barH, 4, 4, 'F')
    doc.setFillColor(r, g, b)
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
  }
}

function drawWordCloud(
  doc: jsPDF,
  responses: ResponseDoc[],
  top: number,
  W: number,
  H: number,
): void {
  const words = aggregateWords(responses)
  if (words.length === 0) {
    doc.setFontSize(11)
    doc.setTextColor(140, 140, 140)
    doc.text('Nenhuma palavra enviada.', MARGIN, top)
    return
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
