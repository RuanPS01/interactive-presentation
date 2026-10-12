import type { Presentation, ThemeMode } from '../types/presentation'
import { renderFreeSlide } from './freeSlideRaster'
import { presentationFileName } from './importExport'
import { toStaticSlides } from './staticSlides'

/** Largura da página em pontos; a altura segue a proporção da apresentação. */
const PAGE_WIDTH_PT = 960

/**
 * PDF dos SLIDES (não dos resultados): uma página por slide, na proporção da
 * apresentação, desenhado em canvas pelo mesmo caminho do relatório
 * (`freeSlideRaster`). Os slides comuns saem na versão estática (enunciado e
 * alternativas, o gabarito destacado no slide de resposta), sem a resposta de
 * ninguém. As fontes embutidas precisam estar registradas antes (canvas usa
 * as fontes do documento). A jsPDF é carregada sob demanda.
 */
export async function exportSlidesPdf(
  presentation: Presentation,
  { theme = 'light' }: { theme?: ThemeMode } = {},
): Promise<void> {
  const slides = toStaticSlides(presentation, { theme, hints: false })
  if (slides.length === 0) throw new Error('A apresentação não tem slides.')
  const { jsPDF } = await import('jspdf')
  const ratio = slides[0].height / slides[0].width
  const width = PAGE_WIDTH_PT
  const height = Math.round(width * ratio)
  const doc = new jsPDF({ unit: 'pt', format: [width, height], orientation: 'landscape' })
  const assets = presentation.assets ?? {}

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) doc.addPage([width, height], 'landscape')
    const canvas = await renderFreeSlide(slides[i], assets, 1)
    doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, width, height)
  }
  doc.save(presentationFileName(presentation.title, 'pdf'))
}
