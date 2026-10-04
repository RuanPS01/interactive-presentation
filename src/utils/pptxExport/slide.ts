import type {
  FreeImageElement,
  FreeSlide,
  FreeTextElement,
  FreeTextParagraph,
  FreeTextStyle,
} from '../../types/presentation'
import { FREE_DEFAULT_FONT } from '../freeSlide'
import { resolveStyle } from '../richText'
import { colorXml, emu, esc, NS_A, NS_P, NS_R, solidFill, XML_HEAD } from './xml'

/**
 * Um slide livre em `ppt/slides/slideN.xml`. É o caminho inverso do
 * importador: 1 px da moldura = 6350 EMU = 0,5 pt, e a altura de linha
 * "simples" do PowerPoint (100%) equivale a 1,2 vez a fonte.
 */

export interface MediaFile {
  /** Nome em `ppt/media/`. */
  file: string
  width: number
  height: number
}

export interface SlideRel {
  id: string
  type: string
  target: string
}

/** Tamanho de fonte quando nem o trecho nem a caixa dizem (o mesmo do editor). */
const FALLBACK_SIZE = 24

const ALIGN = { left: 'l', center: 'ctr', right: 'r', justify: 'just' } as const
const ANCHOR = { top: 't', middle: 'ctr', bottom: 'b' } as const

const NUMBERING: Record<string, string> = {
  'arabic.': 'arabicPeriod',
  'arabic)': 'arabicParenR',
  'alphaLower.': 'alphaLcPeriod',
  'alphaLower)': 'alphaLcParenR',
  'alphaUpper.': 'alphaUcPeriod',
  'alphaUpper)': 'alphaUcParenR',
  'romanLower.': 'romanLcPeriod',
  'romanLower)': 'romanLcParenR',
  'romanUpper.': 'romanUcPeriod',
  'romanUpper)': 'romanUcParenR',
}

function xfrm(x: number, y: number, width: number, height: number, rotation = 0): string {
  const deg = ((rotation % 360) + 360) % 360
  const rot = deg ? ` rot="${Math.round(deg * 60000)}"` : ''
  return (
    `<a:xfrm${rot}><a:off x="${emu(x)}" y="${emu(y)}"/>` +
    `<a:ext cx="${Math.max(0, emu(width))}" cy="${Math.max(0, emu(height))}"/></a:xfrm>`
  )
}

/** Tamanho em centésimos de ponto (`sz`), dentro do que o PowerPoint aceita. */
function size(px: number): number {
  return Math.max(100, Math.min(400000, Math.round(px * 50)))
}

function runProps(tag: 'a:rPr' | 'a:endParaRPr', style: FreeTextStyle, opacity: number): string {
  const attrs = [`lang="pt-BR"`, `sz="${size(style.fontSize ?? FALLBACK_SIZE)}"`]
  if (style.bold) attrs.push('b="1"')
  if (style.italic) attrs.push('i="1"')
  if (style.underline) attrs.push('u="sng"')
  if (style.strike) attrs.push('strike="sngStrike"')
  attrs.push('dirty="0"')
  const font = esc(style.fontFamily || FREE_DEFAULT_FONT)
  return (
    `<${tag} ${attrs.join(' ')}>` +
    solidFill(style.color ?? '#000000', opacity) +
    (style.highlight ? `<a:highlight>${colorXml(style.highlight)}</a:highlight>` : '') +
    `<a:latin typeface="${font}"/><a:ea typeface="${font}"/><a:cs typeface="${font}"/>` +
    `</${tag}>`
  )
}

function paragraphXml(paragraph: FreeTextParagraph, element: FreeTextElement, opacity: number): string {
  const pStyle = resolveStyle(element.style, paragraph.style, undefined)
  const fontSize = pStyle.fontSize ?? FALLBACK_SIZE
  const attrs: string[] = []
  let indent = paragraph.indent ?? 0
  let hanging = 0
  if (paragraph.bullet) {
    // O marcador fica pendurado à esquerda da margem do texto, como na tela.
    hanging = paragraph.hanging ?? fontSize * 1.1
    indent = Math.max(indent, hanging)
  }
  if (indent) attrs.push(`marL="${emu(indent)}"`)
  if (hanging) attrs.push(`indent="${-emu(hanging)}"`)
  if (paragraph.align) attrs.push(`algn="${ALIGN[paragraph.align]}"`)

  const lineHeight = paragraph.lineHeight ?? element.lineHeight ?? 1.2
  let props = `<a:lnSpc><a:spcPct val="${Math.round((lineHeight / 1.2) * 100000)}"/></a:lnSpc>`
  if (paragraph.spaceBefore) props += `<a:spcBef><a:spcPts val="${Math.round(paragraph.spaceBefore * 50)}"/></a:spcBef>`
  if (paragraph.spaceAfter) props += `<a:spcAft><a:spcPts val="${Math.round(paragraph.spaceAfter * 50)}"/></a:spcAft>`
  const bullet = paragraph.bullet
  if (bullet?.kind === 'char') {
    if (bullet.color) props += `<a:buClr>${colorXml(bullet.color, opacity)}</a:buClr>`
    props += `<a:buFont typeface="Arial"/><a:buChar char="${esc(bullet.char)}"/>`
  } else if (bullet?.kind === 'number') {
    const type = NUMBERING[`${bullet.format}${bullet.suffix}`] ?? 'arabicPeriod'
    props += `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="${type}"${bullet.startAt && bullet.startAt > 1 ? ` startAt="${bullet.startAt}"` : ''}/>`
  } else {
    props += '<a:buNone/>'
  }

  let runs = ''
  for (const run of paragraph.runs) {
    const style = resolveStyle(element.style, paragraph.style, run.style)
    run.text.split('\n').forEach((piece, i) => {
      if (i > 0) runs += `<a:br>${runProps('a:rPr', style, opacity)}</a:br>`
      if (piece) runs += `<a:r>${runProps('a:rPr', style, opacity)}<a:t>${esc(piece)}</a:t></a:r>`
    })
  }
  return `<a:p><a:pPr${attrs.length ? ` ${attrs.join(' ')}` : ''}>${props}</a:pPr>${runs}${runProps('a:endParaRPr', pStyle, opacity)}</a:p>`
}

function textXml(element: FreeTextElement, id: number): string {
  const opacity = element.opacity ?? 1
  const [top, right, bottom, left] = element.padding ?? [0, 0, 0, 0]
  const paragraphs = element.paragraphs.length > 0 ? element.paragraphs : [{ runs: [] }]
  return (
    '<p:sp>' +
    `<p:nvSpPr><p:cNvPr id="${id}" name="${esc(element.name ?? `Texto ${id - 1}`)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    '<p:spPr>' +
    xfrm(element.x, element.y, element.width, element.height, element.rotation) +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
    (element.background ? solidFill(element.background, opacity) : '<a:noFill/>') +
    '</p:spPr>' +
    '<p:txBody>' +
    `<a:bodyPr wrap="square" lIns="${emu(left)}" tIns="${emu(top)}" rIns="${emu(right)}" bIns="${emu(bottom)}" anchor="${ANCHOR[element.verticalAlign ?? 'top']}" rtlCol="0"><a:noAutofit/></a:bodyPr>` +
    '<a:lstStyle/>' +
    paragraphs.map((p) => paragraphXml(p, element, opacity)).join('') +
    '</p:txBody>' +
    '</p:sp>'
  )
}

function pictureXml(element: FreeImageElement, id: number, rid: string, media: MediaFile): string {
  let { x, y, width, height } = element
  let srcRect = ''
  const fit = element.fit ?? 'fill'
  if (fit === 'contain' && media.width > 0 && media.height > 0) {
    // "Conter": a moldura da imagem encolhe para a área que ela ocupa (mesmo centro).
    const s = Math.min(width / media.width, height / media.height)
    const w = media.width * s
    const h = media.height * s
    x += (width - w) / 2
    y += (height - h) / 2
    width = w
    height = h
  } else if (fit === 'cover' && media.width > 0 && media.height > 0 && width > 0 && height > 0) {
    // "Preencher": corta as sobras da imagem, centralizada.
    const imageRatio = media.width / media.height
    const boxRatio = width / height
    if (imageRatio > boxRatio) {
      const crop = Math.round(((1 - boxRatio / imageRatio) / 2) * 100000)
      srcRect = `<a:srcRect l="${crop}" r="${crop}"/>`
    } else if (imageRatio < boxRatio) {
      const crop = Math.round(((1 - imageRatio / boxRatio) / 2) * 100000)
      srcRect = `<a:srcRect t="${crop}" b="${crop}"/>`
    }
  }
  const opacity = element.opacity ?? 1
  const alpha = opacity < 1 ? `<a:alphaModFix amt="${Math.round(opacity * 100000)}"/>` : ''
  const radius = element.radius ?? 0
  const shortest = Math.min(width, height)
  const geometry =
    radius > 0 && shortest > 0
      ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.min(50000, Math.round((radius / shortest) * 100000))}"/></a:avLst></a:prstGeom>`
      : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
  return (
    '<p:pic>' +
    `<p:nvPicPr><p:cNvPr id="${id}" name="${esc(element.name ?? `Imagem ${id - 1}`)}" descr=""/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${rid}">${alpha}</a:blip>${srcRect}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>${xfrm(x, y, width, height, element.rotation)}${geometry}</p:spPr>` +
    '</p:pic>'
  )
}

/** XML do slide e as relações dele (layout e imagens). */
export function slideXml(slide: FreeSlide, media: Map<string, MediaFile>): { xml: string; rels: SlideRel[] } {
  const rels: SlideRel[] = [{ id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' }]
  const imageRels = new Map<string, string>()
  let shapes = ''
  let id = 2
  for (const element of slide.elements) {
    if (element.kind === 'text') {
      shapes += textXml(element, id++)
      continue
    }
    const file = media.get(element.assetId)
    if (!file) continue
    let rid = imageRels.get(file.file)
    if (!rid) {
      rid = `rId${rels.length + 1}`
      imageRels.set(file.file, rid)
      rels.push({ id: rid, type: 'image', target: `../media/${file.file}` })
    }
    shapes += pictureXml(element, id++, rid, file)
  }
  const xml =
    XML_HEAD +
    `<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    `<p:cSld name="${esc(slide.title)}">` +
    `<p:bg><p:bgPr>${solidFill(slide.background || '#ffffff')}<a:effectLst/></p:bgPr></p:bg>` +
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    shapes +
    '</p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
    '</p:sld>'
  return { xml, rels }
}
