import { unzlibSync, zlibSync } from 'fflate'
import { buildSfnt, parseSfnt, Reader, tableChecksum, Writer } from './sfnt'
import type { SfntTable } from './sfnt'

/**
 * WOFF 1.0: a fonte sfnt com cada tabela comprimida em zlib. É como as
 * fontes ficam guardadas na apresentação (cerca de 40% menores que o TTF) e
 * o navegador a usa direto.
 */

/** Converte TrueType/OpenType em WOFF. */
export function sfntToWoff(sfnt: Uint8Array): Uint8Array {
  const font = parseSfnt(sfnt)
  const tables = [...font.tables].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
  const packed = tables.map((t) => {
    const compressed = zlibSync(t.data, { level: 9 })
    return { t, data: compressed.length < t.data.length ? compressed : t.data }
  })
  const n = tables.length
  const headerSize = 44 + 20 * n
  let offset = headerSize
  const offsets = packed.map(({ data }) => {
    const at = offset
    offset += (data.length + 3) & ~3
    return at
  })
  const totalSfntSize = 12 + 16 * n + tables.reduce((s, t) => s + ((t.data.length + 3) & ~3), 0)

  const w = new Writer()
  for (const c of 'wOFF') w.u8(c.charCodeAt(0))
  w.u32(font.version)
  w.u32(offset) // tamanho total
  w.u16(n)
  w.u16(0)
  w.u32(totalSfntSize)
  w.u16(1) // versão da fonte (informativa)
  w.u16(0)
  for (let i = 0; i < 5; i++) w.u32(0) // metadados e dados privados: nenhum
  packed.forEach(({ t, data }, i) => {
    for (let k = 0; k < 4; k++) w.u8(t.tag.charCodeAt(k))
    w.u32(offsets[i])
    w.u32(data.length)
    w.u32(t.data.length)
    w.u32(tableChecksum(t.data))
  })
  for (const { data } of packed) {
    w.bytes(data)
    w.align(4)
  }
  return w.toBytes()
}

/** Converte WOFF de volta em TrueType/OpenType (para embutir num .pptx). */
export function woffToSfnt(woff: Uint8Array): Uint8Array {
  const r = new Reader(woff)
  if (r.tag() !== 'wOFF') throw new Error('Arquivo WOFF inválido.')
  const flavor = r.u32()
  r.u32() // tamanho
  const n = r.u16()
  r.slice(2 + 4 + 4 + 20)
  const tables: SfntTable[] = []
  for (let i = 0; i < n; i++) {
    const tag = r.tag()
    const offset = r.u32()
    const compLength = r.u32()
    const origLength = r.u32()
    r.u32() // checksum
    const raw = woff.subarray(offset, offset + compLength)
    tables.push({ tag, data: compLength < origLength ? unzlibSync(raw) : raw.slice() })
  }
  return buildSfnt({ version: flavor, tables })
}
