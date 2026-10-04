/**
 * Leitura e montagem de fontes sfnt (TrueType e OpenType): o formato que o
 * navegador entende e que as outras conversões (EOT, MTX, WOFF) produzem ou
 * consomem.
 */

export type FontFormat = 'truetype' | 'opentype' | 'woff' | 'woff2' | 'eot' | 'unknown'

/** Identifica o formato pelos primeiros bytes. */
export function sniffFontFormat(bytes: Uint8Array): FontFormat {
  if (bytes.length < 4) return 'unknown'
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  if (tag === '\0\x01\0\0' || tag === 'true') return 'truetype'
  if (tag === 'OTTO') return 'opentype'
  if (tag === 'wOFF') return 'woff'
  if (tag === 'wOF2') return 'woff2'
  // EOT: cabeçalho little-endian com o "número mágico" 0x504C no byte 34.
  if (bytes.length > 36 && bytes[34] === 0x4c && bytes[35] === 0x50) return 'eot'
  return 'unknown'
}

/** Leitor big-endian sobre um trecho de bytes. */
export class Reader {
  pos: number
  constructor(
    readonly bytes: Uint8Array,
    start = 0,
    readonly end = bytes.length,
  ) {
    this.pos = start
  }

  private need(n: number): void {
    if (this.pos + n > this.end) throw new Error('Fonte truncada: os dados acabaram antes do esperado.')
  }

  u8(): number {
    this.need(1)
    return this.bytes[this.pos++]
  }

  peek(): number {
    this.need(1)
    return this.bytes[this.pos]
  }

  u16(): number {
    this.need(2)
    const v = (this.bytes[this.pos] << 8) | this.bytes[this.pos + 1]
    this.pos += 2
    return v
  }

  s16(): number {
    const v = this.u16()
    return v & 0x8000 ? v - 0x10000 : v
  }

  u24(): number {
    return (this.u16() << 8) | this.u8()
  }

  u32(): number {
    return ((this.u16() << 16) | this.u16()) >>> 0
  }

  slice(n: number): Uint8Array {
    this.need(n)
    const out = this.bytes.subarray(this.pos, this.pos + n)
    this.pos += n
    return out
  }

  tag(): string {
    const b = this.slice(4)
    return String.fromCharCode(b[0], b[1], b[2], b[3])
  }
}

/** Escritor big-endian que cresce conforme precisa. */
export class Writer {
  private buf = new Uint8Array(1024)
  length = 0

  private grow(n: number): void {
    if (this.length + n <= this.buf.length) return
    let size = this.buf.length * 2
    while (size < this.length + n) size *= 2
    const next = new Uint8Array(size)
    next.set(this.buf.subarray(0, this.length))
    this.buf = next
  }

  u8(v: number): void {
    this.grow(1)
    this.buf[this.length++] = v & 0xff
  }

  u16(v: number): void {
    this.grow(2)
    this.buf[this.length++] = (v >> 8) & 0xff
    this.buf[this.length++] = v & 0xff
  }

  u32(v: number): void {
    this.u16((v >>> 16) & 0xffff)
    this.u16(v & 0xffff)
  }

  bytes(data: Uint8Array): void {
    this.grow(data.length)
    this.buf.set(data, this.length)
    this.length += data.length
  }

  /** Completa com zeros até um múltiplo de `n`. */
  align(n: number): void {
    while (this.length % n) this.u8(0)
  }

  toBytes(): Uint8Array {
    return this.buf.slice(0, this.length)
  }
}

export interface SfntTable {
  tag: string
  data: Uint8Array
}

export interface Sfnt {
  /** 0x00010000 (TrueType) ou 'OTTO' (OpenType/CFF). */
  version: number
  tables: SfntTable[]
}

/** Separa as tabelas de uma fonte sfnt. */
export function parseSfnt(bytes: Uint8Array, start = 0, end = bytes.length): Sfnt {
  const r = new Reader(bytes, start, end)
  const version = r.u32()
  const numTables = r.u16()
  r.slice(6) // searchRange, entrySelector, rangeShift
  const tables: SfntTable[] = []
  for (let i = 0; i < numTables; i++) {
    const tag = r.tag()
    r.u32() // checksum
    const offset = r.u32()
    const length = r.u32()
    if (start + offset + length > end) throw new Error(`Tabela "${tag}" fora dos limites da fonte.`)
    tables.push({ tag, data: bytes.subarray(start + offset, start + offset + length) })
  }
  return { version, tables }
}

export function findTable(font: Sfnt, tag: string): Uint8Array | undefined {
  return font.tables.find((t) => t.tag === tag)?.data
}

/** Soma de verificação de uma tabela (palavras de 32 bits, completando com zeros). */
export function tableChecksum(data: Uint8Array): number {
  let sum = 0
  const full = data.length & ~3
  for (let i = 0; i < full; i += 4) {
    sum = (sum + ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3])) >>> 0
  }
  if (full < data.length) {
    let last = 0
    for (let i = 0; i < 4; i++) last = (last << 8) | (full + i < data.length ? data[full + i] : 0)
    sum = (sum + (last >>> 0)) >>> 0
  }
  return sum
}

/**
 * Monta uma fonte sfnt: diretório ordenado por tag, tabelas alinhadas em 4
 * bytes, somas de verificação e o `checkSumAdjustment` do `head`.
 */
export function buildSfnt(font: Sfnt): Uint8Array {
  const tables = [...font.tables].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
  const head = tables.find((t) => t.tag === 'head')
  if (head) {
    head.data = head.data.slice()
    head.data.fill(0, 8, 12)
  }
  const n = tables.length
  let pow = 1
  let log = 0
  while (pow * 2 <= n) {
    pow *= 2
    log++
  }
  const w = new Writer()
  w.u32(font.version)
  w.u16(n)
  w.u16(pow * 16)
  w.u16(log)
  w.u16(n * 16 - pow * 16)
  let offset = 12 + n * 16
  for (const t of tables) {
    for (let i = 0; i < 4; i++) w.u8(t.tag.charCodeAt(i))
    w.u32(tableChecksum(t.data))
    w.u32(offset)
    w.u32(t.data.length)
    offset += (t.data.length + 3) & ~3
  }
  for (const t of tables) {
    w.bytes(t.data)
    w.align(4)
  }
  const out = w.toBytes()
  if (head) {
    const headOffset = 12 + n * 16 + tables.slice(0, tables.indexOf(head)).reduce((s, t) => s + ((t.data.length + 3) & ~3), 0)
    const adjust = (0xb1b0afba - tableChecksum(out)) >>> 0
    out[headOffset + 8] = adjust >>> 24
    out[headOffset + 9] = (adjust >>> 16) & 0xff
    out[headOffset + 10] = (adjust >>> 8) & 0xff
    out[headOffset + 11] = adjust & 0xff
  }
  return out
}

/** Um nome da tabela `name` (família = 1, estilo = 2, completo = 4, versão = 5). */
export function fontName(font: Sfnt, nameId: number): string | undefined {
  const data = findTable(font, 'name')
  if (!data) return undefined
  try {
    const r = new Reader(data)
    r.u16() // format
    const count = r.u16()
    const stringOffset = r.u16()
    let fallback: string | undefined
    for (let i = 0; i < count; i++) {
      const platform = r.u16()
      const encoding = r.u16()
      r.u16() // language
      const id = r.u16()
      const length = r.u16()
      const offset = r.u16()
      if (id !== nameId) continue
      const raw = data.subarray(stringOffset + offset, stringOffset + offset + length)
      if (platform === 3 || platform === 0) {
        let s = ''
        for (let j = 0; j + 1 < raw.length; j += 2) s += String.fromCharCode((raw[j] << 8) | raw[j + 1])
        return s
      }
      if (platform === 1 && encoding === 0) fallback = String.fromCharCode(...raw)
    }
    return fallback
  } catch {
    return undefined
  }
}
