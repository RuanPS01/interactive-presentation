import type { PresentationFont } from '../../types/presentation'
import { eotToSfnt } from '../fonts/eot'
import { createPresentationFont } from '../fonts/convert'
import { cleanFamily } from '../fonts/faces'
import { sniffFontFormat } from '../fonts/sfnt'
import { woffToSfnt } from '../fonts/woff'
import type { PptxPackage } from './package'
import { attr, child, children, relAttr } from './xml'

const SLOTS: { tag: string; weight: PresentationFont['weight']; style: PresentationFont['style'] }[] = [
  { tag: 'regular', weight: 'normal', style: 'normal' },
  { tag: 'bold', weight: 'bold', style: 'normal' },
  { tag: 'italic', weight: 'normal', style: 'italic' },
  { tag: 'boldItalic', weight: 'bold', style: 'italic' },
]

/** Converte o conteúdo de um `.fntdata` em TrueType/OpenType. */
function toSfnt(bytes: Uint8Array): Uint8Array {
  switch (sniffFontFormat(bytes)) {
    case 'truetype':
    case 'opentype':
      return bytes
    case 'woff':
      return woffToSfnt(bytes)
    case 'eot':
      return eotToSfnt(bytes)
    default:
      throw new Error('formato de fonte desconhecido')
  }
}

/**
 * Fontes embutidas no arquivo (`p:embeddedFontLst`). O PowerPoint guarda cada
 * estilo (normal, negrito, itálico, negrito itálico) num `.fntdata`, quase
 * sempre em EOT comprimido com MTX. Cada uma vira uma fonte da apresentação,
 * registrada com o nome que os textos usam.
 *
 * Uma fonte que não abre não impede a importação: o texto fica com uma fonte
 * parecida, e o aviso diz qual.
 */
export async function readEmbeddedFonts(
  pkg: PptxPackage,
  presPath: string,
  pres: Element,
  warnings: Set<string>,
): Promise<PresentationFont[]> {
  const rels = pkg.rels(presPath)
  const fonts: PresentationFont[] = []
  const failed = new Set<string>()
  for (const entry of children(child(pres, 'embeddedFontLst'), 'embeddedFont')) {
    const family = cleanFamily(attr(child(entry, 'font'), 'typeface') ?? '')
    if (!family) continue
    for (const slot of SLOTS) {
      const target = rels.get(relAttr(child(entry, slot.tag), 'id') ?? '')?.target
      const bytes = target ? pkg.bytes(target) : null
      if (!bytes) continue
      try {
        fonts.push(await createPresentationFont(toSfnt(bytes), family, slot.weight, slot.style))
      } catch {
        failed.add(family)
      }
    }
  }
  if (failed.size > 0) {
    warnings.add(
      `Não foi possível usar a(s) fonte(s) embutida(s) ${[...failed].map((f) => `"${f}"`).join(', ')}; o texto usa uma fonte parecida.`,
    )
  }
  return fonts
}
