/** Utilidades de XML da exportação para PowerPoint. */

export const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
export const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
export const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
export const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
export const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

export const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

/** EMU por px da moldura (1920 px = 12 192 000 EMU, a largura do 16:9). */
export const EMU_PER_PX = 6350

export function emu(px: number): number {
  return Math.round(px * EMU_PER_PX)
}

/** Tira o que o XML não aceita (caracteres de controle) e escapa o resto. */
export function esc(text: string): string {
  let clean = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 0xfffe && code !== 0xffff)) clean += ch
  }
  return clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function relsXml(rels: { id: string; type: string; target: string }[]): string {
  return (
    XML_HEAD +
    `<Relationships xmlns="${NS_REL}">` +
    rels.map((r) => `<Relationship Id="${r.id}" Type="${REL}/${r.type}" Target="${esc(r.target)}"/>`).join('') +
    '</Relationships>'
  )
}

/** `#rrggbb` ou `#rrggbbaa` em `<a:srgbClr>`, com a opacidade extra multiplicada. */
export function colorXml(color: string, opacity = 1): string {
  const hex = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color) ? color : '#000000'
  const own = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1
  const alpha = Math.max(0, Math.min(1, own * opacity))
  const val = hex.slice(1, 7).toUpperCase()
  return alpha < 1
    ? `<a:srgbClr val="${val}"><a:alpha val="${Math.round(alpha * 100000)}"/></a:srgbClr>`
    : `<a:srgbClr val="${val}"/>`
}

export function solidFill(color: string, opacity = 1): string {
  return `<a:solidFill>${colorXml(color, opacity)}</a:solidFill>`
}
