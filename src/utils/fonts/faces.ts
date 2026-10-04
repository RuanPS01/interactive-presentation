import type { PresentationFont, PresentationFonts, Slide } from '../../types/presentation'

/**
 * Fontes da apresentação no navegador: registrar no documento (FontFace) e
 * escolher as que os slides usam. A conversão de arquivos fica em
 * `convert.ts`, carregada só pelo importador e pelo exportador.
 *
 * Uma fonte registrada com o mesmo nome de família que os textos usam passa
 * na frente de uma fonte instalada com esse nome, então o texto aparece com
 * a fonte do arquivo em qualquer aparelho, no HTML e nos canvas (PDF).
 */

export function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** Nome de família seguro para o CSS e o FontFace (a mesma limpeza do `fontStack`). */
export function cleanFamily(name: string): string {
  return [...name.replace(/["\\<>;{}]/g, '')]
    .filter((c) => c.charCodeAt(0) >= 32)
    .join('')
    .trim()
}

export async function fontId(font: Omit<PresentationFont, 'id'>): Promise<string> {
  const bytes = new TextEncoder().encode(`${font.family}|${font.weight}|${font.style}|${font.dataUrl}`)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `font_${hex.slice(0, 24)}`
}

/** Registros feitos neste documento, pelo id da fonte. */
const registry = new Map<string, Promise<FontFace | null>>()

/** Marca uma fonte já registrada (por quem a criou a partir do arquivo). */
export function markRegistered(id: string, face: FontFace): void {
  registry.set(id, Promise.resolve(face))
}

export function descriptors(font: Pick<PresentationFont, 'weight' | 'style'>): FontFaceDescriptors {
  return { weight: font.weight, style: font.style }
}

/** Registra as fontes (uma vez por id) e espera que estejam prontas para desenhar. */
export async function registerFonts(fonts: Iterable<PresentationFont>): Promise<void> {
  const pending: Promise<FontFace | null>[] = []
  for (const font of fonts) {
    let entry = registry.get(font.id)
    if (!entry) {
      const face = new FontFace(font.family, toBuffer(dataUrlToBytes(font.dataUrl)), descriptors(font))
      entry = face
        .load()
        .then(() => {
          document.fonts.add(face)
          return face
        })
        // Uma fonte que não carrega não pode travar a tela: o texto usa a próxima da lista.
        .catch(() => null)
      registry.set(font.id, entry)
    }
    pending.push(entry)
  }
  await Promise.all(pending)
}

/** Famílias citadas pelos textos dos slides livres, em minúsculas. */
export function usedFontFamilies(slides: Slide[]): Set<string> {
  const families = new Set<string>()
  const add = (family: string | undefined) => {
    if (family) families.add(family.toLowerCase())
  }
  for (const slide of slides) {
    if (slide.type !== 'free') continue
    for (const element of slide.elements) {
      if (element.kind !== 'text') continue
      add(element.style.fontFamily)
      for (const p of element.paragraphs) {
        add(p.style?.fontFamily)
        for (const run of p.runs) add(run.style?.fontFamily)
      }
    }
  }
  return families
}

/** Só as fontes de famílias que algum slide usa. */
export function pickFonts(fonts: PresentationFonts, slides: Slide[]): PresentationFonts {
  const used = usedFontFamilies(slides)
  const picked: PresentationFonts = {}
  for (const [id, font] of Object.entries(fonts)) {
    if (used.has(font.family.toLowerCase())) picked[id] = font
  }
  return picked
}
