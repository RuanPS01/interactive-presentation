import { lzcompDecompress } from './lzcomp'
import { buildSfnt, findTable, parseSfnt, Reader, Writer } from './sfnt'
import type { SfntTable } from './sfnt'

/**
 * MicroType Express (MTX): a compressão que o PowerPoint usa nas fontes
 * embutidas (dentro de um EOT). Converte de volta para TrueType.
 *
 * Feito a partir da submissão W3C "MicroType Express (MTX) Font Format". O
 * arquivo tem três blocos LZCOMP: (1) as tabelas da fonte em "Compact Table
 * Format" (CTF), com o `glyf` compactado e sem `loca`; (2) os valores que as
 * instruções de cada glifo empilham no início; (3) o resto das instruções.
 *
 * As tabelas `hdmx` e `VDMX` (larguras e alturas pré-calculadas por tamanho
 * de pixel) ficam de fora: são opcionais, e os navegadores calculam tudo a
 * partir dos contornos.
 */
export function decompressMtx(data: Uint8Array): Uint8Array {
  const r = new Reader(data)
  const version = r.u8()
  r.u24() // limite de cópia: só interessa ao compressor
  const offset2 = r.u24()
  const offset3 = r.u24()
  if (offset2 < 10 || offset3 < offset2 || offset3 > data.length) {
    throw new Error('MTX: cabeçalho inválido.')
  }
  const ctf = lzcompDecompress(data.subarray(10, offset2), version)
  const push = lzcompDecompress(data.subarray(offset2, offset3), version)
  const code = lzcompDecompress(data.subarray(offset3), version)
  return ctfToTtf(ctf, push, code)
}

function read255UShort(r: Reader): number {
  const code = r.u8()
  if (code === 253) return r.u16()
  if (code === 255) return 253 + r.u8()
  if (code === 254) return 506 + r.u8()
  return code
}

function read255Short(r: Reader): number {
  const code = r.u8()
  if (code === 253) return r.s16()
  let sign = 1
  let c = code
  if (c === 250) {
    sign = -1
    c = r.u8()
  }
  let value: number
  if (c === 255) value = 250 + r.u8()
  else if (c === 254) value = 500 + r.u8()
  else value = c
  return value * sign
}

/** Valores empilhados no início das instruções de um glifo (seção 6.2). */
function readPushData(r: Reader, count: number): number[] {
  const values: number[] = []
  while (values.length < count) {
    const code = r.peek()
    if (code === 251 || code === 252) {
      r.u8()
      const a = values[values.length - 2] ?? 0
      values.push(a, read255Short(r), a)
      if (code === 252) values.push(read255Short(r), a)
    } else {
      values.push(read255Short(r))
    }
  }
  return values.slice(0, count)
}

/** Gera instruções TrueType que empilham os valores (PUSHB/PUSHW e as versões N). */
function encodePush(values: number[], w: Writer): void {
  let i = 0
  while (i < values.length) {
    const isByte = (v: number) => v >= 0 && v <= 255
    const bytes = isByte(values[i])
    let j = i
    while (j < values.length && j - i < 255 && isByte(values[j]) === bytes) j++
    const n = j - i
    if (n <= 8) w.u8((bytes ? 0xb0 : 0xb8) + n - 1)
    else {
      w.u8(bytes ? 0x40 : 0x41)
      w.u8(n)
    }
    for (let k = i; k < j; k++) {
      if (bytes) w.u8(values[k])
      else w.u16(values[k] & 0xffff)
    }
    i = j
  }
}

function readInstructions(glyf: Reader, push: Reader, code: Reader): Uint8Array {
  const pushCount = read255UShort(glyf)
  const codeSize = read255UShort(glyf)
  const w = new Writer()
  if (pushCount > 0) encodePush(readPushData(push, pushCount), w)
  if (codeSize > 0) w.bytes(code.slice(codeSize))
  return w.toBytes()
}

const ARG_1_AND_2_ARE_WORDS = 0x0001
const WE_HAVE_A_SCALE = 0x0008
const MORE_COMPONENTS = 0x0020
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040
const WE_HAVE_A_TWO_BY_TWO = 0x0080
const WE_HAVE_INSTRUCTIONS = 0x0100

function decodeComposite(glyf: Reader, push: Reader, code: Reader, out: Writer): void {
  out.u16(0xffff)
  for (let i = 0; i < 4; i++) out.u16(glyf.u16()) // caixa delimitadora
  let flags: number
  do {
    flags = glyf.u16()
    out.u16(flags)
    out.u16(glyf.u16()) // glifo do componente
    out.bytes(glyf.slice(flags & ARG_1_AND_2_ARE_WORDS ? 4 : 2))
    if (flags & WE_HAVE_A_SCALE) out.bytes(glyf.slice(2))
    else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) out.bytes(glyf.slice(4))
    else if (flags & WE_HAVE_A_TWO_BY_TWO) out.bytes(glyf.slice(8))
  } while (flags & MORE_COMPONENTS)
  if (flags & WE_HAVE_INSTRUCTIONS) {
    const instructions = readInstructions(glyf, push, code)
    out.u16(instructions.length)
    out.bytes(instructions)
  }
}

/** Deslocamentos codificados em "tripletos" (seção 5.11; a mesma tabela do WOFF2). */
function decodeTriplets(flags: Uint8Array, glyf: Reader): { x: Int32Array; y: Int32Array } {
  const n = flags.length
  const x = new Int32Array(n)
  const y = new Int32Array(n)
  let cx = 0
  let cy = 0
  const sign = (bit: number, v: number) => (bit & 1 ? v : -v)
  for (let i = 0; i < n; i++) {
    const f = flags[i] & 0x7f
    let dx: number
    let dy: number
    if (f < 10) {
      dx = 0
      dy = sign(f, ((f & 14) << 7) + glyf.u8())
    } else if (f < 20) {
      dx = sign(f, (((f - 10) & 14) << 7) + glyf.u8())
      dy = 0
    } else if (f < 84) {
      const b0 = f - 20
      const b1 = glyf.u8()
      dx = sign(f, 1 + (b0 & 0x30) + (b1 >> 4))
      dy = sign(f >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f))
    } else if (f < 120) {
      const b0 = f - 84
      dx = sign(f, 1 + (Math.floor(b0 / 12) << 8) + glyf.u8())
      dy = sign(f >> 1, 1 + (((b0 % 12) >> 2) << 8) + glyf.u8())
    } else if (f < 124) {
      const b1 = glyf.u8()
      const b2 = glyf.u8()
      dx = sign(f, (b1 << 4) + (b2 >> 4))
      dy = sign(f >> 1, ((b2 & 0x0f) << 8) + glyf.u8())
    } else {
      dx = sign(f, glyf.u16())
      dy = sign(f >> 1, glyf.u16())
    }
    cx += dx
    cy += dy
    x[i] = cx
    y[i] = cy
  }
  return { x, y }
}

/** Escreve um glifo simples no formato TrueType. */
function encodeSimple(
  endPts: number[],
  onCurve: boolean[],
  x: Int32Array,
  y: Int32Array,
  instructions: Uint8Array,
  bbox: [number, number, number, number] | null,
  out: Writer,
): void {
  const n = x.length
  let [xMin, yMin, xMax, yMax] = bbox ?? [0, 0, 0, 0]
  if (!bbox && n > 0) {
    xMin = xMax = x[0]
    yMin = yMax = y[0]
    for (let i = 1; i < n; i++) {
      if (x[i] < xMin) xMin = x[i]
      if (x[i] > xMax) xMax = x[i]
      if (y[i] < yMin) yMin = y[i]
      if (y[i] > yMax) yMax = y[i]
    }
  }
  out.u16(endPts.length)
  for (const v of [xMin, yMin, xMax, yMax]) out.u16(v & 0xffff)
  for (const e of endPts) out.u16(e)
  out.u16(instructions.length)
  out.bytes(instructions)

  const flags: number[] = []
  const xs = new Writer()
  const ys = new Writer()
  let px = 0
  let py = 0
  for (let i = 0; i < n; i++) {
    let f = onCurve[i] ? 1 : 0
    const dx = x[i] - px
    const dy = y[i] - py
    px = x[i]
    py = y[i]
    if (dx === 0) f |= 0x10
    else if (dx > -256 && dx < 256) {
      f |= 0x02 | (dx > 0 ? 0x10 : 0)
      xs.u8(Math.abs(dx))
    } else xs.u16(dx & 0xffff)
    if (dy === 0) f |= 0x20
    else if (dy > -256 && dy < 256) {
      f |= 0x04 | (dy > 0 ? 0x20 : 0)
      ys.u8(Math.abs(dy))
    } else ys.u16(dy & 0xffff)
    flags.push(f)
  }
  // Bandeiras repetidas viram "repita N vezes".
  for (let i = 0; i < flags.length; ) {
    let run = 1
    while (i + run < flags.length && flags[i + run] === flags[i] && run < 256) run++
    if (run > 1) {
      out.u8(flags[i] | 0x08)
      out.u8(run - 1)
    } else {
      out.u8(flags[i])
    }
    i += run
  }
  out.bytes(xs.toBytes())
  out.bytes(ys.toBytes())
}

function decodeSimple(numContoursIn: number, glyf: Reader, push: Reader, code: Reader, out: Writer): void {
  let numContours = numContoursIn
  let bbox: [number, number, number, number] | null = null
  if (numContours === 0x7fff) {
    numContours = glyf.s16()
    bbox = [glyf.s16(), glyf.s16(), glyf.s16(), glyf.s16()]
  }
  if (numContours <= 0) return
  const endPts: number[] = []
  for (let i = 0; i < numContours; i++) {
    const v = read255UShort(glyf)
    endPts.push(i === 0 ? v : endPts[i - 1] + v)
  }
  const numPoints = endPts[numContours - 1] + 1
  const flags = glyf.slice(numPoints)
  const { x, y } = decodeTriplets(flags, glyf)
  const onCurve = Array.from(flags, (f) => (f & 0x80) === 0)
  const instructions = readInstructions(glyf, push, code)
  encodeSimple(endPts, onCurve, x, y, instructions, bbox, out)
}

/** Reconstrói a fonte TrueType a partir dos três blocos descomprimidos. */
function ctfToTtf(ctfBytes: Uint8Array, pushBytes: Uint8Array, codeBytes: Uint8Array): Uint8Array {
  const ctf = parseSfnt(ctfBytes)
  const maxp = findTable(ctf, 'maxp')
  const ctfGlyf = findTable(ctf, 'glyf')
  if (!maxp || !ctfGlyf) throw new Error('MTX: faltam as tabelas maxp ou glyf.')
  const numGlyphs = new Reader(maxp, 4).u16()

  const glyfIn = new Reader(ctfGlyf)
  const push = new Reader(pushBytes)
  const code = new Reader(codeBytes)
  const glyfOut = new Writer()
  const loca = new Writer()
  for (let g = 0; g < numGlyphs; g++) {
    loca.u32(glyfOut.length)
    const numContours = glyfIn.s16()
    if (numContours < 0) decodeComposite(glyfIn, push, code, glyfOut)
    else decodeSimple(numContours, glyfIn, push, code, glyfOut)
    glyfOut.align(4)
  }
  loca.u32(glyfOut.length)

  const tables: SfntTable[] = []
  for (const t of ctf.tables) {
    switch (t.tag) {
      case 'glyf':
        tables.push({ tag: 'glyf', data: glyfOut.toBytes() })
        break
      case 'loca':
        tables.push({ tag: 'loca', data: loca.toBytes() })
        break
      case 'cvt ':
        tables.push({ tag: 'cvt ', data: decodeCvt(t.data) })
        break
      case 'head': {
        const head = t.data.slice()
        head[50] = 0 // indexToLocFormat = 1: `loca` com deslocamentos de 32 bits
        head[51] = 1
        tables.push({ tag: 'head', data: head })
        break
      }
      case 'hdmx':
      case 'VDMX':
      case 'DSIG': // a assinatura deixa de valer depois da conversão
        break
      default:
        tables.push(t)
    }
  }
  if (!tables.some((t) => t.tag === 'loca')) tables.push({ tag: 'loca', data: loca.toBytes() })
  return buildSfnt({ version: 0x00010000, tables })
}

/** `cvt ` em CTF: diferenças para o valor anterior, em 1 a 3 bytes (seção 5.2). */
function decodeCvt(data: Uint8Array): Uint8Array {
  const r = new Reader(data)
  const count = r.u16()
  const out = new Writer()
  let last = 0
  for (let i = 0; i < count; i++) {
    const c = r.u8()
    let delta: number
    if (c < 238) delta = c
    else if (c >= 248) delta = 238 * (c - 247) + r.u8()
    else if (c >= 239) delta = -(238 * (c - 239) + r.u8())
    else delta = r.s16()
    last = (last + delta) & 0xffff
    out.u16(last)
  }
  return out.toBytes()
}
