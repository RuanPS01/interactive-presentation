import { strToU8, zipSync } from 'fflate'
import type { Zippable } from 'fflate'
import type { FreeSlide, Presentation, PresentationFont, ThemeMode } from '../../types/presentation'
import { sfntToEot } from '../fonts/eot'
import { fontToSfnt } from '../fonts/convert'
import { dataUrlToBytes, pickFonts } from '../fonts/faces'
import { sniffFontFormat } from '../fonts/sfnt'
import { collectAssetIds, fitFreeSlideToFrame } from '../freeSlide'
import { loadImage } from '../images'
import { SLIDE_FRAMES, withDefaults } from '../settings'
import {
  appXml,
  contentTypesXml,
  coreXml,
  defaultTextStyleXml,
  layoutXml,
  masterXml,
  presPropsXml,
  tableStylesXml,
  themeXml,
  viewPropsXml,
} from './parts'
import { slideXml } from './slide'
import type { MediaFile } from './slide'
import { standardSlideToFree } from './standard'
import { esc, NS_A, NS_P, NS_R, relsXml, XML_HEAD } from './xml'

/**
 * Exporta a apresentação como PowerPoint (.pptx), gerado no navegador.
 *
 * Slides livres saem com caixas de texto e imagens editáveis; os outros
 * tipos viram a versão estática (enunciado e alternativas, ver
 * `standard.ts`). As fontes embutidas usadas vão junto, em EOT, para o
 * arquivo abrir com elas em outro computador.
 */

export interface PptxExportResult {
  blob: Blob
  warnings: string[]
}

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

/** Imagem em PNG, JPEG ou GIF (o PowerPoint não lê WebP em todas as versões). */
async function mediaBytes(dataUrl: string): Promise<{ bytes: Uint8Array; ext: string }> {
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
  if (mime === 'image/png') return { bytes: dataUrlToBytes(dataUrl), ext: 'png' }
  if (mime === 'image/jpeg') return { bytes: dataUrlToBytes(dataUrl), ext: 'jpeg' }
  if (mime === 'image/gif') return { bytes: dataUrlToBytes(dataUrl), ext: 'gif' }
  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  canvas.getContext('2d')?.drawImage(image, 0, 0)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Não foi possível converter uma imagem para PNG.')
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: 'png' }
}

const SLOT = (font: PresentationFont) =>
  font.weight === 'bold' ? (font.style === 'italic' ? 'boldItalic' : 'bold') : font.style === 'italic' ? 'italic' : 'regular'
const SLOT_ORDER = ['regular', 'bold', 'italic', 'boldItalic']

export interface PptxExportOptions {
  /**
   * Tema dos slides comuns (perguntas, gabarito, texto simples), como na tela
   * do projetor. Os slides livres têm cores próprias e não mudam.
   */
  theme?: ThemeMode
}

export async function exportPptx(
  presentation: Presentation,
  { theme = 'light' }: PptxExportOptions = {},
): Promise<PptxExportResult> {
  const warnings = new Set<string>()
  const settings = withDefaults(presentation.settings)
  const frame = SLIDE_FRAMES[settings.slideAspect]
  const slides: FreeSlide[] = presentation.slides.map((slide) =>
    slide.type === 'free'
      ? fitFreeSlideToFrame(slide, frame)
      : standardSlideToFree(slide, presentation.slides, presentation.settings, frame, theme),
  )
  if (presentation.slides.some((s) => s.type !== 'free')) {
    warnings.add('As perguntas viraram slides estáticos com as alternativas: a votação só funciona aqui na plataforma.')
  }

  const files: Zippable = {}

  // Imagens: um arquivo por imagem, mesmo quando vários slides a usam.
  const media = new Map<string, MediaFile>()
  const assets = presentation.assets ?? {}
  for (const id of collectAssetIds(slides)) {
    const asset = assets[id]
    if (!asset) continue
    const { bytes, ext } = await mediaBytes(asset.dataUrl)
    const file = `image${media.size + 1}.${ext}`
    files[`ppt/media/${file}`] = [bytes, { level: 0 }]
    media.set(id, { file, width: asset.width, height: asset.height })
  }

  // Fontes: o PowerPoint só embute TrueType; fontes CFF (OTF) ficam de fora.
  const byFamily = new Map<string, Map<string, string>>()
  const fontRels: { id: string; target: string }[] = []
  for (const font of Object.values(pickFonts(presentation.fonts ?? {}, slides))) {
    try {
      const sfnt = fontToSfnt(font)
      if (sniffFontFormat(sfnt) !== 'truetype') {
        warnings.add(`A fonte "${font.family}" não pôde ser embutida (o PowerPoint só embute fontes TrueType).`)
        continue
      }
      const target = `fonts/font${fontRels.length + 1}.fntdata`
      files[`ppt/${target}`] = [sfntToEot(sfnt), { level: 6 }]
      const rid = `rIdF${fontRels.length + 1}`
      fontRels.push({ id: rid, target })
      const slots = byFamily.get(font.family) ?? new Map<string, string>()
      slots.set(SLOT(font), rid)
      byFamily.set(font.family, slots)
    } catch {
      warnings.add(`A fonte "${font.family}" não pôde ser embutida.`)
    }
  }

  slides.forEach((slide, i) => {
    const { xml, rels } = slideXml(slide, media)
    files[`ppt/slides/slide${i + 1}.xml`] = strToU8(xml)
    files[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = strToU8(relsXml(rels))
  })

  const presRels = [
    { id: 'rId1', type: 'slideMaster', target: 'slideMasters/slideMaster1.xml' },
    { id: 'rId2', type: 'theme', target: 'theme/theme1.xml' },
    { id: 'rId3', type: 'presProps', target: 'presProps.xml' },
    { id: 'rId4', type: 'viewProps', target: 'viewProps.xml' },
    { id: 'rId5', type: 'tableStyles', target: 'tableStyles.xml' },
    ...slides.map((_, i) => ({ id: `rId${6 + i}`, type: 'slide', target: `slides/slide${i + 1}.xml` })),
    ...fontRels.map((f) => ({ id: f.id, type: 'font', target: f.target })),
  ]
  const embedded = [...byFamily]
    .map(
      ([family, slots]) =>
        `<p:embeddedFont><p:font typeface="${esc(family)}" pitchFamily="2" charset="0"/>` +
        SLOT_ORDER.filter((s) => slots.has(s))
          .map((s) => `<p:${s} r:id="${slots.get(s)}"/>`)
          .join('') +
        '</p:embeddedFont>',
    )
    .join('')
  const cx = Math.round(frame.width * 6350)
  const cy = Math.round(frame.height * 6350)
  const presentationXml =
    XML_HEAD +
    `<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" saveSubsetFonts="1"${embedded ? ' embedTrueTypeFonts="1"' : ''}>` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${6 + i}"/>`).join('')}</p:sldIdLst>` +
    `<p:sldSz cx="${cx}" cy="${cy}"/>` +
    '<p:notesSz cx="6858000" cy="9144000"/>' +
    (embedded ? `<p:embeddedFontLst>${embedded}</p:embeddedFontLst>` : '') +
    defaultTextStyleXml() +
    '</p:presentation>'

  const zip: Zippable = {
    '[Content_Types].xml': strToU8(contentTypesXml(slides.length)),
    '_rels/.rels': strToU8(
      relsXml([
        { id: 'rId1', type: 'officeDocument', target: 'ppt/presentation.xml' },
        { id: 'rId2', type: 'extended-properties', target: 'docProps/app.xml' },
      ]).replace(
        '</Relationships>',
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
      ),
    ),
    'docProps/app.xml': strToU8(appXml(slides.length)),
    'docProps/core.xml': strToU8(coreXml(presentation.title)),
    'ppt/presentation.xml': strToU8(presentationXml),
    'ppt/_rels/presentation.xml.rels': strToU8(relsXml(presRels)),
    'ppt/slideMasters/slideMaster1.xml': strToU8(masterXml()),
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': strToU8(
      relsXml([
        { id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' },
        { id: 'rId2', type: 'theme', target: '../theme/theme1.xml' },
      ]),
    ),
    'ppt/slideLayouts/slideLayout1.xml': strToU8(layoutXml()),
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': strToU8(
      relsXml([{ id: 'rId1', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' }]),
    ),
    'ppt/theme/theme1.xml': strToU8(themeXml('Arial')),
    'ppt/presProps.xml': strToU8(presPropsXml()),
    'ppt/viewProps.xml': strToU8(viewPropsXml()),
    'ppt/tableStyles.xml': strToU8(tableStylesXml()),
    ...files,
  }
  const bytes = zipSync(zip, { level: 6 })
  return { blob: new Blob([bytes as BlobPart], { type: PPTX_MIME }), warnings: [...warnings] }
}
