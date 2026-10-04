/**
 * Descompressor LZCOMP, a etapa de entropia do MicroType Express (MTX).
 *
 * Implementado a partir da submissão W3C "MicroType Express (MTX) Font
 * Format" (seção 3 e apêndice C): uma variação de LZ77 em que literais,
 * cópias e comprimentos passam por três árvores de Huffman adaptativas.
 */

/** Leitor de bits, do mais significativo para o menos, byte a byte. */
class BitReader {
  private pos = 0
  private current = 0
  private left = 0

  constructor(private readonly data: Uint8Array) {}

  bit(): number {
    if (this.left === 0) {
      if (this.pos >= this.data.length) throw new Error('MTX: os dados comprimidos acabaram antes do esperado.')
      this.current = this.data[this.pos++]
      this.left = 8
    }
    this.left--
    return (this.current >> this.left) & 1
  }

  bits(n: number): number {
    let v = 0
    for (let i = 0; i < n; i++) v = (v << 1) | this.bit()
    return v >>> 0
  }
}

const ROOT = 1

/**
 * Árvore de Huffman adaptativa: os pesos sobem a cada símbolo lido e a
 * árvore se reorganiza, então codificador e decodificador evoluem juntos.
 * Nós em vetores: o nó `i` tem filhos `2i` e `2i + 1` no começo, e as folhas
 * ficam em `range .. 2 * range - 1`.
 */
class AdaptiveHuffman {
  private readonly up: Int32Array
  private readonly left: Int32Array
  private readonly right: Int32Array
  private readonly code: Int32Array
  private readonly weight: Int32Array
  private readonly symbolIndex: Int32Array

  constructor(
    range: number,
    private readonly input: BitReader,
  ) {
    const size = 2 * range
    this.up = new Int32Array(size)
    this.left = new Int32Array(size)
    this.right = new Int32Array(size)
    this.code = new Int32Array(size)
    this.weight = new Int32Array(size)
    this.symbolIndex = new Int32Array(range)
    for (let i = 2; i < size; i++) {
      this.up[i] = i >> 1
      this.weight[i] = 1
    }
    for (let i = 1; i < range; i++) {
      this.left[i] = 2 * i
      this.right[i] = 2 * i + 1
    }
    for (let i = 0; i < range; i++) {
      this.code[i] = -1
      this.code[range + i] = i
      this.left[range + i] = -1
      this.right[range + i] = -1
      this.symbolIndex[i] = range + i
    }
    // Peso de cada nó interno = soma dos filhos (os filhos têm índice maior).
    for (let i = range - 1; i >= ROOT; i--) this.weight[i] = this.weight[2 * i] + this.weight[2 * i + 1]

    // Pesos iniciais, iguais aos do codificador de referência.
    if (range > 256 && range < 512) {
      this.update(this.symbolIndex[256])
      this.update(this.symbolIndex[257])
      for (let i = 0; i < 12; i++) this.update(this.symbolIndex[range - 3])
      for (let i = 0; i < 6; i++) this.update(this.symbolIndex[range - 2])
    } else {
      for (let j = 0; j < 2; j++) for (let i = 0; i < range; i++) this.update(this.symbolIndex[i])
    }
  }

  private swap(a: number, b: number): void {
    const upA = this.up[a]
    const upB = this.up[b]
    for (const arr of [this.left, this.right, this.code, this.weight]) {
      const t = arr[a]
      arr[a] = arr[b]
      arr[b] = t
    }
    this.up[a] = upA
    this.up[b] = upB
    for (const n of [a, b]) {
      const c = this.code[n]
      if (c < 0) {
        this.up[this.left[n]] = n
        this.up[this.right[n]] = n
      } else {
        this.symbolIndex[c] = n
      }
    }
  }

  private update(start: number): void {
    let a = start
    while (a !== ROOT) {
      const w = this.weight[a]
      let b = a - 1
      if (this.weight[b] === w) {
        do b--
        while (this.weight[b] === w)
        b++
        if (b > ROOT) {
          this.swap(a, b)
          a = b
        }
      }
      this.weight[a] = w + 1
      a = this.up[a]
    }
    this.weight[ROOT]++
  }

  read(): number {
    let a = ROOT
    let symbol: number
    do {
      a = this.input.bit() ? this.right[a] : this.left[a]
      symbol = this.code[a]
    } while (symbol < 0)
    this.update(a)
    return symbol
  }
}

/** Tamanho dos dados pré-carregados antes da saída, que as cópias podem referenciar. */
const PRELOAD_SIZE = 2 * 32 * 96 + 4 * 256
const MAX_2BYTE_DIST = 512

function preload(buf: Uint8Array): void {
  let i = 0
  for (let k = 0; k < 32; k++) {
    for (let j = 0; j < 96; j++) {
      buf[i++] = k
      buf[i++] = j
    }
  }
  for (let j = 0; i < PRELOAD_SIZE && j < 256; j++) {
    buf[i++] = j
    buf[i++] = j
    buf[i++] = j
    buf[i++] = j
  }
}

/** Saída com a codificação de repetição (run-length) opcional do LZCOMP. */
class Output {
  private buf: Uint8Array
  length = 0
  private state = 100 // inicial: o primeiro byte é o caractere de escape
  private escape = 0
  private count = 0

  constructor(
    size: number,
    private readonly runLength: boolean,
  ) {
    this.buf = new Uint8Array(Math.max(16, size))
  }

  private push(v: number, times = 1): void {
    if (this.length + times > this.buf.length) {
      const next = new Uint8Array(Math.max(this.buf.length * 2, this.length + times))
      next.set(this.buf.subarray(0, this.length))
      this.buf = next
    }
    this.buf.fill(v, this.length, this.length + times)
    this.length += times
  }

  write(v: number): void {
    if (!this.runLength) return this.push(v)
    if (this.state === 0) {
      if (v === this.escape) this.state = 1
      else this.push(v)
    } else if (this.state === 1) {
      this.count = v
      if (v === 0) {
        this.push(this.escape)
        this.state = 0
      } else {
        this.state = 2
      }
    } else if (this.state === 2) {
      this.push(v, this.count)
      this.state = 0
    } else {
      this.escape = v
      this.state = 0
    }
  }

  result(): Uint8Array {
    return this.buf.slice(0, this.length)
  }
}

/** Descomprime um bloco LZCOMP. `version` é o byte de versão do contêiner MTX. */
export function lzcompDecompress(data: Uint8Array, version: number): Uint8Array {
  const input = new BitReader(data)
  const runLength = version === 1 ? false : input.bit() === 1
  const distCoder = new AdaptiveHuffman(8, input)
  const lenCoder = new AdaptiveHuffman(8, input)
  const outLen = input.bits(24)

  let distRanges = 1
  while (1 << (3 * distRanges) < outLen) distRanges++
  const dup2 = 256 + 8 * distRanges
  const dup4 = dup2 + 1
  const dup6 = dup4 + 1
  const symCoder = new AdaptiveHuffman(dup6 + 1, input)

  const window = new Uint8Array(PRELOAD_SIZE + outLen)
  preload(window)
  const out = new Output(outLen, runLength)
  let pos = PRELOAD_SIZE
  const end = PRELOAD_SIZE + outLen

  while (pos < end) {
    const symbol = symCoder.read()
    if (symbol < 256 || symbol === dup2 || symbol === dup4 || symbol === dup6) {
      const value =
        symbol < 256 ? symbol : window[pos - (symbol === dup2 ? 2 : symbol === dup4 ? 4 : 6)]
      window[pos++] = value
      out.write(value)
      continue
    }
    // Cópia: o símbolo traz quantos grupos de distância virão e o começo do comprimento.
    let bits = symbol - 256
    const numDist = (bits >> 3) + 1
    bits &= 7
    let length = 0
    for (;;) {
      const done = (bits & 4) === 0
      length = (length << 2) | (bits & 3)
      if (done) break
      bits = lenCoder.read()
    }
    length += 2
    let distance = 0
    for (let i = 0; i < numDist; i++) distance = (distance << 3) | distCoder.read()
    distance += 1
    if (distance >= MAX_2BYTE_DIST) length++
    const start = pos - distance - length + 1
    if (start < 0 || pos + length > end) throw new Error('MTX: cópia fora dos limites.')
    for (let j = 0; j < length; j++) {
      const value = window[start + j]
      window[pos++] = value
      out.write(value)
    }
  }
  return out.result()
}
