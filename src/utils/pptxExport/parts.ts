import { esc, NS_A, NS_P, NS_R, XML_HEAD } from './xml'

/**
 * Partes fixas do pacote: tema, mestre e layout em branco, propriedades e
 * tipos de conteúdo. Tudo o que um slide desenha vem nele mesmo, então o
 * mestre e o layout ficam vazios.
 */

const SCHEME: [string, string][] = [
  ['dk1', '000000'],
  ['lt1', 'FFFFFF'],
  ['dk2', '1F2937'],
  ['lt2', 'F3F4F6'],
  ['accent1', '2563EB'],
  ['accent2', '16A34A'],
  ['accent3', 'F59E0B'],
  ['accent4', 'DC2626'],
  ['accent5', '7C3AED'],
  ['accent6', '0891B2'],
  ['hlink', '2563EB'],
  ['folHlink', '7C3AED'],
]

export function themeXml(font: string): string {
  const colors = SCHEME.map(([name, val]) =>
    name === 'dk1' || name === 'lt1'
      ? `<a:${name}><a:sysClr val="${name === 'dk1' ? 'windowText' : 'window'}" lastClr="${val}"/></a:${name}>`
      : `<a:${name}><a:srgbClr val="${val}"/></a:${name}>`,
  ).join('')
  const fonts = `<a:latin typeface="${esc(font)}"/><a:ea typeface=""/><a:cs typeface=""/>`
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
  const line = (w: number) =>
    `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`
  return (
    XML_HEAD +
    `<a:theme xmlns:a="${NS_A}" name="Apresentação Interativa">` +
    '<a:themeElements>' +
    `<a:clrScheme name="Apresentação Interativa">${colors}</a:clrScheme>` +
    `<a:fontScheme name="Apresentação Interativa"><a:majorFont>${fonts}</a:majorFont><a:minorFont>${fonts}</a:minorFont></a:fontScheme>` +
    '<a:fmtScheme name="Apresentação Interativa">' +
    `<a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst>` +
    `<a:lnStyleLst>${line(6350)}${line(12700)}${line(19050)}</a:lnStyleLst>` +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    `<a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst>` +
    '</a:fmtScheme>' +
    '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/>' +
    '</a:theme>'
  )
}

const EMPTY_TREE =
  '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>'

/** Estilo de texto de um nível de lista (para o mestre e a apresentação). */
function levels(size: number): string {
  let out = ''
  for (let lvl = 1; lvl <= 9; lvl++) {
    out +=
      `<a:lvl${lvl}pPr marL="${(lvl - 1) * 457200}" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">` +
      `<a:defRPr sz="${size}" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill>` +
      '<a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr>' +
      `</a:lvl${lvl}pPr>`
  }
  return out
}

export function defaultTextStyleXml(): string {
  return `<p:defaultTextStyle><a:defPPr><a:defRPr lang="pt-BR"/></a:defPPr>${levels(1800)}</p:defaultTextStyle>`
}

export function masterXml(): string {
  return (
    XML_HEAD +
    `<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    `<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_TREE}</p:cSld>` +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    `<p:txStyles><p:titleStyle>${levels(4400)}</p:titleStyle><p:bodyStyle>${levels(2800)}</p:bodyStyle><p:otherStyle>${levels(1800)}</p:otherStyle></p:txStyles>` +
    '</p:sldMaster>'
  )
}

export function layoutXml(): string {
  return (
    XML_HEAD +
    `<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="blank" preserve="1">` +
    `<p:cSld name="Em branco">${EMPTY_TREE}</p:cSld>` +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
    '</p:sldLayout>'
  )
}

export function presPropsXml(): string {
  return XML_HEAD + `<p:presentationPr xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"/>`
}

export function viewPropsXml(): string {
  return (
    XML_HEAD +
    `<p:viewPr xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
    '<p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr>' +
    '<p:gridSpacing cx="76200" cy="76200"/></p:viewPr>'
  )
}

export function tableStylesXml(): string {
  return XML_HEAD + `<a:tblStyleLst xmlns:a="${NS_A}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`
}

export function coreXml(title: string): string {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  return (
    XML_HEAD +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${esc(title)}</dc:title><dc:creator>Apresentação Interativa</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    '</cp:coreProperties>'
  )
}

export function appXml(slides: number): string {
  return (
    XML_HEAD +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    `<Application>Apresentação Interativa</Application><Slides>${slides}</Slides><PresentationFormat>On-screen Show</PresentationFormat>` +
    '</Properties>'
  )
}

const PML = 'application/vnd.openxmlformats-officedocument.presentationml'

export function contentTypesXml(slideCount: number): string {
  const overrides: [string, string][] = [
    ['/ppt/presentation.xml', `${PML}.presentation.main+xml`],
    ['/ppt/slideMasters/slideMaster1.xml', `${PML}.slideMaster+xml`],
    ['/ppt/slideLayouts/slideLayout1.xml', `${PML}.slideLayout+xml`],
    ['/ppt/theme/theme1.xml', 'application/vnd.openxmlformats-officedocument.theme+xml'],
    ['/ppt/presProps.xml', `${PML}.presProps+xml`],
    ['/ppt/viewProps.xml', `${PML}.viewProps+xml`],
    ['/ppt/tableStyles.xml', `${PML}.tableStyles+xml`],
    ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
    ['/docProps/app.xml', 'application/vnd.openxmlformats-officedocument.extended-properties+xml'],
  ]
  for (let i = 1; i <= slideCount; i++) overrides.push([`/ppt/slides/slide${i}.xml`, `${PML}.slide+xml`])
  return (
    XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
    '<Default Extension="gif" ContentType="image/gif"/>' +
    '<Default Extension="fntdata" ContentType="application/x-fontdata"/>' +
    overrides.map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`).join('') +
    '</Types>'
  )
}
