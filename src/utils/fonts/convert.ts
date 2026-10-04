import type { PresentationFont } from '../../types/presentation'
import { bytesToBase64, dataUrlToBytes, descriptors, fontId, markRegistered, toBuffer } from './faces'
import { sniffFontFormat } from './sfnt'
import { sfntToWoff, woffToSfnt } from './woff'

/**
 * Conversões entre arquivos de fonte e fontes da apresentação. Separado de
 * `faces.ts` para o compressor (zlib) só ser baixado por quem importa ou
 * exporta um PowerPoint.
 */

/**
 * Transforma uma fonte TrueType/OpenType numa fonte da apresentação. Antes,
 * confere se o navegador aceita o arquivo (o FontFace recusa fontes
 * corrompidas); a fonte já fica registrada para uso imediato.
 */
export async function createPresentationFont(
  sfnt: Uint8Array,
  family: string,
  weight: PresentationFont['weight'],
  style: PresentationFont['style'],
): Promise<PresentationFont> {
  const face = new FontFace(family, toBuffer(sfnt), descriptors({ weight, style }))
  await face.load()
  document.fonts.add(face)
  const dataUrl = `data:font/woff;base64,${bytesToBase64(sfntToWoff(sfnt))}`
  const font = { family, weight, style, dataUrl }
  const id = await fontId(font)
  markRegistered(id, face)
  return { id, ...font }
}

/** O arquivo TrueType/OpenType de uma fonte da apresentação. */
export function fontToSfnt(font: PresentationFont): Uint8Array {
  const bytes = dataUrlToBytes(font.dataUrl)
  const format = sniffFontFormat(bytes)
  if (format === 'woff') return woffToSfnt(bytes)
  if (format === 'truetype' || format === 'opentype') return bytes
  throw new Error(`A fonte "${font.family}" está num formato que não dá para embutir.`)
}
