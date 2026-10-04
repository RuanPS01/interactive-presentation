import type { PresentationAsset } from '../types/presentation'

/**
 * Imagens dos slides livres, prontas para o Firestore.
 *
 * Sem Firebase Storage (que hoje exige o plano pago), cada imagem vira um
 * documento próprio com o `data:` URL. O documento aceita até 1 MiB, então a
 * imagem é reduzida e recomprimida até caber com folga.
 */

/** Tamanho máximo do `data:` URL (caracteres ~ bytes no Firestore). */
export const MAX_ASSET_CHARS = 900_000

/** Lado maior máximo: a moldura do slide tem 1920 px de largura. */
export const MAX_ASSET_DIMENSION = 1920

const KEEP_AS_IS = /^image\/(png|jpeg|webp|gif)$/

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a imagem.'))
    reader.readAsDataURL(blob)
  })
}

/** Carrega uma imagem (qualquer formato que o navegador desenhe, inclusive SVG). */
export async function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url)
  }
}

/** Id estável a partir do conteúdo: a mesma imagem importada duas vezes vira um asset só. */
async function contentId(dataUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(dataUrl)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `img_${hex.slice(0, 24)}`
}

function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true
  return false
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Comprime um canvas no menor formato que mantém a aparência: JPEG quando não
 * há transparência, WebP quando há (PNG se o navegador não gerar WebP). Se
 * ainda passar do limite, reduz a qualidade e depois o tamanho.
 */
export async function canvasToAsset(
  canvas: HTMLCanvasElement,
  options: { opaque?: boolean } = {},
): Promise<PresentationAsset> {
  const opaque = options.opaque ?? !hasTransparency(canvas)
  let current = canvas
  for (let attempt = 0; attempt < 6; attempt++) {
    for (const quality of [0.9, 0.8, 0.68]) {
      let blob = await encode(current, opaque ? 'image/jpeg' : 'image/webp', quality)
      if (blob && !opaque && blob.type !== 'image/webp') blob = await encode(current, 'image/png')
      if (!blob) continue
      const dataUrl = await blobToDataUrl(blob)
      if (dataUrl.length <= MAX_ASSET_CHARS) {
        return { id: await contentId(dataUrl), dataUrl, width: current.width, height: current.height }
      }
      if (blob.type === 'image/png') break // PNG não tem qualidade a reduzir
    }
    current = scaleCanvas(current, 0.75)
  }
  throw new Error('A imagem é grande demais, mesmo depois de reduzida.')
}

function scaleCanvas(source: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * factor))
  canvas.height = Math.max(1, Math.round(source.height * factor))
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  }
  return canvas
}

/** Desenha a imagem num canvas de no máximo `maxDimension` no lado maior. */
export function imageToCanvas(
  img: CanvasImageSource & { width: number; height: number },
  maxDimension = MAX_ASSET_DIMENSION,
): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }
  return canvas
}

/**
 * Prepara um arquivo de imagem (enviado no editor ou extraído de um PPTX).
 * Uma imagem pequena num formato comum é guardada como veio, sem perder
 * qualidade (e um GIF continua animado); as demais são redesenhadas.
 */
export async function blobToAsset(blob: Blob): Promise<PresentationAsset> {
  const img = await loadImage(blob)
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) throw new Error('Imagem sem dimensões.')
  if (KEEP_AS_IS.test(blob.type) && Math.max(width, height) <= MAX_ASSET_DIMENSION) {
    const dataUrl = await blobToDataUrl(blob)
    if (dataUrl.length <= MAX_ASSET_CHARS) {
      return { id: await contentId(dataUrl), dataUrl, width, height }
    }
  }
  return canvasToAsset(imageToCanvas(img))
}
