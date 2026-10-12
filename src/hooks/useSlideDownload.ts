import { useState } from 'react'
import { useThemeStore } from '../store/themeStore'
import type { Presentation } from '../types/presentation'
import { registerFonts } from '../utils/fonts/faces'
import { downloadBlob, presentationFileName } from '../utils/importExport'

export type SlideDownloadFormat = 'pdf' | 'pptx'

/**
 * Baixa os SLIDES (não os resultados) em PDF ou PowerPoint, sem a resposta de
 * ninguém e sem as instruções de votação, no tema da página. Os geradores só
 * são baixados no clique (`import()` dinâmico).
 */
export function useSlideDownload(loadPresentation: () => Promise<Presentation>) {
  const theme = useThemeStore((s) => s.theme)
  const [working, setWorking] = useState<SlideDownloadFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function download(format: SlideDownloadFormat) {
    setWorking(format)
    setError(null)
    try {
      const presentation = await loadPresentation()
      if (format === 'pdf') {
        // O PDF é desenhado em canvas: as fontes embutidas precisam estar prontas.
        await registerFonts(Object.values(presentation.fonts ?? {}))
        const { exportSlidesPdf } = await import('../utils/exportSlidesPdf')
        await exportSlidesPdf(presentation, { theme })
      } else {
        const { exportPptx } = await import('../utils/pptxExport')
        const { blob } = await exportPptx(presentation, { theme, hints: false })
        downloadBlob(blob, presentationFileName(presentation.title, 'pptx'))
      }
    } catch (e) {
      setError(`Não foi possível gerar o arquivo: ${(e as Error).message}`)
    } finally {
      setWorking(null)
    }
  }

  return { download, working, error }
}
