import { decompressMtx } from './mtx'
import { findTable, fontName, parseSfnt } from './sfnt'

/**
 * Embedded OpenType (EOT): o envelope das fontes embutidas no PowerPoint
 * (`ppt/fonts/*.fntdata`). Um cabeçalho little-endian com nomes e métricas,
 * seguido da fonte, que pode vir comprimida em MTX e/ou "cifrada" com XOR.
 */

const TTEMBED_TTCOMPRESSED = 0x4
const TTEMBED_XORENCRYPTDATA = 0x10000000
const MAGIC = 0x504c

function u32le(b: Uint8Array, i: number): number {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0
}

/** Tira a fonte TrueType de dentro de um EOT. */
export function eotToSfnt(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 82 || (bytes[34] | (bytes[35] << 8)) !== MAGIC) {
    throw new Error('Arquivo EOT inválido.')
  }
  const eotSize = u32le(bytes, 0)
  const fontDataSize = u32le(bytes, 4)
  const flags = u32le(bytes, 12)
  // A fonte é o último campo do arquivo.
  const end = eotSize > 0 && eotSize <= bytes.length ? eotSize : bytes.length
  const start = end - fontDataSize
  if (start < 0) throw new Error('EOT: tamanho da fonte inconsistente.')
  let data: Uint8Array = bytes.slice(start, end)
  if (flags & TTEMBED_XORENCRYPTDATA) for (let i = 0; i < data.length; i++) data[i] ^= 0x50
  if (flags & TTEMBED_TTCOMPRESSED) data = decompressMtx(data)
  return data
}

class LeWriter {
  private parts: number[] = []
  u8(v: number) {
    this.parts.push(v & 0xff)
  }
  u16(v: number) {
    this.u8(v)
    this.u8(v >> 8)
  }
  u32(v: number) {
    this.u16(v & 0xffff)
    this.u16((v >>> 16) & 0xffff)
  }
  bytes(b: Uint8Array) {
    for (const v of b) this.parts.push(v)
  }
  toBytes(): Uint8Array {
    return Uint8Array.from(this.parts)
  }
}

function utf16le(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2)
  for (let i = 0; i < s.length; i++) {
    out[2 * i] = s.charCodeAt(i) & 0xff
    out[2 * i + 1] = s.charCodeAt(i) >> 8
  }
  return out
}

/**
 * Envolve uma fonte TrueType num EOT sem compressão (versão 2.1), o formato
 * que o PowerPoint lê nas fontes embutidas de um .pptx.
 */
export function sfntToEot(sfnt: Uint8Array): Uint8Array {
  const font = parseSfnt(sfnt)
  const os2 = findTable(font, 'OS/2')
  const head = findTable(font, 'head')
  const at = (t: Uint8Array | undefined, i: number, n: number) => {
    let v = 0
    for (let k = 0; k < n; k++) v = v * 256 + (t && i + k < t.length ? t[i + k] : 0)
    return v
  }
  const header = new LeWriter()
  // EOTSize e FontDataSize entram no fim, quando o tamanho é conhecido.
  header.u32(0)
  header.u32(sfnt.length)
  header.u32(0x00020001)
  header.u32(0) // sem compressão nem XOR
  for (let i = 0; i < 10; i++) header.u8(at(os2, 32 + i, 1)) // PANOSE
  header.u8(1) // DEFAULT_CHARSET
  header.u8(at(os2, 62, 2) & 1) // itálico (fsSelection)
  header.u32(at(os2, 4, 2) || 400) // usWeightClass
  header.u16(at(os2, 8, 2)) // fsType
  header.u16(MAGIC)
  for (let i = 0; i < 4; i++) header.u32(at(os2, 42 + 4 * i, 4)) // ulUnicodeRange1..4
  const os2Version = at(os2, 0, 2)
  header.u32(os2Version >= 1 ? at(os2, 78, 4) : 1) // ulCodePageRange1
  header.u32(os2Version >= 1 ? at(os2, 82, 4) : 0) // ulCodePageRange2
  header.u32(at(head, 8, 4)) // checkSumAdjustment
  for (let i = 0; i < 4; i++) header.u32(0) // reservados
  for (const id of [1, 2, 5, 4]) {
    const name = utf16le(fontName(font, id) ?? '')
    header.u16(0) // padding
    header.u16(name.length)
    header.bytes(name)
  }
  header.u16(0) // padding
  header.u16(0) // RootStringSize
  const prefix = header.toBytes()
  const out = new Uint8Array(prefix.length + sfnt.length)
  out.set(prefix)
  out.set(sfnt, prefix.length)
  const size = out.length
  out[0] = size & 0xff
  out[1] = (size >> 8) & 0xff
  out[2] = (size >> 16) & 0xff
  out[3] = (size >>> 24) & 0xff
  return out
}
