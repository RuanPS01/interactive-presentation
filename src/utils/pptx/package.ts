import { unzipSync } from 'fflate'
import { attr, children, parseXml } from './xml'

export interface Relationship {
  id: string
  type: string
  /** Caminho completo dentro do pacote (ou a URL, quando externa). */
  target: string
  external: boolean
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
}

/** Formatos de imagem que o navegador consegue desenhar. */
export function isDrawableImage(path: string): boolean {
  return /\.(png|jpe?g|jpe|gif|webp|bmp|svg)$/i.test(path)
}

export function dirname(path: string): string {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i)
}

/** Junta um caminho relativo (`../media/image1.png`) a uma pasta do pacote. */
export function resolvePath(baseDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = baseDir ? baseDir.split('/') : []
  for (const piece of target.split('/')) {
    if (piece === '..') parts.pop()
    else if (piece !== '.' && piece !== '') parts.push(piece)
  }
  return parts.join('/')
}

/** O arquivo .pptx aberto: um ZIP de partes XML e mídias. */
export class PptxPackage {
  private readonly files: Record<string, Uint8Array>
  private readonly xmlCache = new Map<string, Document | null>()
  private readonly relsCache = new Map<string, Map<string, Relationship>>()

  constructor(data: Uint8Array) {
    try {
      this.files = unzipSync(data)
    } catch {
      throw new Error('O arquivo não é um .pptx válido (não foi possível abrir o ZIP).')
    }
  }

  has(path: string): boolean {
    return path in this.files
  }

  bytes(path: string): Uint8Array | null {
    return this.files[path] ?? null
  }

  text(path: string): string | null {
    const data = this.files[path]
    return data ? new TextDecoder('utf-8').decode(data) : null
  }

  xml(path: string): Document | null {
    if (!this.xmlCache.has(path)) {
      const text = this.text(path)
      this.xmlCache.set(path, text === null ? null : parseXml(text))
    }
    return this.xmlCache.get(path) ?? null
  }

  /** Relações de uma parte (`ppt/slides/slide1.xml` lê `ppt/slides/_rels/slide1.xml.rels`). */
  rels(partPath: string): Map<string, Relationship> {
    const cached = this.relsCache.get(partPath)
    if (cached) return cached
    const dir = dirname(partPath)
    const name = partPath.slice(dir.length + (dir ? 1 : 0))
    const relsPath = `${dir ? `${dir}/` : ''}_rels/${name}.rels`
    const map = new Map<string, Relationship>()
    const doc = this.xml(relsPath)
    for (const rel of children(doc?.documentElement, 'Relationship')) {
      const id = attr(rel, 'Id')
      const target = attr(rel, 'Target')
      if (!id || !target) continue
      const external = attr(rel, 'TargetMode') === 'External'
      map.set(id, {
        id,
        type: attr(rel, 'Type') ?? '',
        target: external ? target : resolvePath(dir, target),
        external,
      })
    }
    this.relsCache.set(partPath, map)
    return map
  }

  /** Primeira relação de um tipo (o tipo é comparado pelo final, ex.: `/slideLayout`). */
  relByType(partPath: string, typeSuffix: string): Relationship | undefined {
    for (const rel of this.rels(partPath).values()) {
      if (rel.type.endsWith(typeSuffix)) return rel
    }
    return undefined
  }

  blob(path: string): Blob | null {
    const data = this.files[path]
    if (!data) return null
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    return new Blob([data as BlobPart], { type: MIME[ext] ?? 'application/octet-stream' })
  }
}
