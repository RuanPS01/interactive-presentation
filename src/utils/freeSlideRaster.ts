import type { FreeImageElement, FreeSlide, PresentationAssets } from '../types/presentation'
import { drawRichText } from './canvasText'
import { loadImage } from './images'

function roundedRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(radius, 0)
  ctx.arcTo(w, 0, w, h, radius)
  ctx.arcTo(w, h, 0, h, radius)
  ctx.arcTo(0, h, 0, 0, radius)
  ctx.arcTo(0, 0, w, 0, radius)
  ctx.closePath()
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  element: FreeImageElement,
): void {
  const { width: w, height: h } = element
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (element.radius) {
    roundedRect(ctx, w, h, element.radius)
    ctx.clip()
  }
  const fit = element.fit ?? 'fill'
  if (fit === 'fill' || !iw || !ih) {
    ctx.drawImage(img, 0, 0, w, h)
    return
  }
  const scale = fit === 'contain' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

/**
 * O slide livre como imagem (para o PDF): fundo, imagens e textos na ordem de
 * desenho, com rotação e opacidade. `scale` multiplica a resolução.
 */
export async function renderFreeSlide(
  slide: FreeSlide,
  assets: PresentationAssets,
  scale = 1,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(slide.width * scale)
  canvas.height = Math.round(slide.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(scale, scale)
  ctx.fillStyle = slide.background
  ctx.fillRect(0, 0, slide.width, slide.height)

  // Carrega todas as imagens antes, em paralelo.
  const images = new Map<string, HTMLImageElement>()
  await Promise.all(
    slide.elements.map(async (element) => {
      if (element.kind !== 'image' || images.has(element.assetId)) return
      const asset = assets[element.assetId]
      if (!asset) return
      try {
        images.set(element.assetId, await loadImage(asset.dataUrl))
      } catch {
        /* imagem ilegível: fica de fora */
      }
    }),
  )

  for (const element of slide.elements) {
    ctx.save()
    ctx.globalAlpha = element.opacity ?? 1
    ctx.translate(element.x + element.width / 2, element.y + element.height / 2)
    if (element.rotation) ctx.rotate((element.rotation * Math.PI) / 180)
    ctx.translate(-element.width / 2, -element.height / 2)
    if (element.kind === 'image') {
      const img = images.get(element.assetId)
      if (img) drawImage(ctx, img, element)
    } else {
      if (element.background) {
        ctx.fillStyle = element.background
        ctx.fillRect(0, 0, element.width, element.height)
      }
      drawRichText(ctx, element.paragraphs, element.style, {
        x: 0,
        y: 0,
        width: element.width,
        height: element.height,
        padding: element.padding,
        verticalAlign: element.verticalAlign,
        lineHeight: element.lineHeight,
      })
    }
    ctx.restore()
  }
  return canvas
}
