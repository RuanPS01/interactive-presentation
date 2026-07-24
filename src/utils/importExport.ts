import type { Presentation } from '../types/presentation'
import { presentationSchema } from './validation'

/** Serializa a apresentação e dispara o download de um arquivo .json. */
export function exportPresentation(presentation: Presentation, filename?: string): void {
  const data = JSON.stringify(presentation, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `${slugify(presentation.title) || 'apresentacao'}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type ImportResult =
  | { ok: true; presentation: Presentation }
  | { ok: false; error: string }

/** Lê e valida um arquivo JSON de apresentação. */
export async function importPresentationFromFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    const parsed = presentationSchema.safeParse(json)
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || 'raiz'}: ${i.message}`)
        .join('; ')
      return { ok: false, error: `JSON inválido - ${detail}` }
    }
    return { ok: true, presentation: parsed.data as Presentation }
  } catch (e) {
    return { ok: false, error: `Não foi possível ler o arquivo: ${(e as Error).message}` }
  }
}

/** Gera um nome de arquivo seguro a partir do título (remove acentos e símbolos). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      // Remove marcas de acentuação combinantes (U+0300–U+036F).
      return code < 0x300 || code > 0x36f
    })
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
