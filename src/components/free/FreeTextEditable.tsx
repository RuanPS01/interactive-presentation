import { useEffect, useLayoutEffect, useRef } from 'react'
import type { FreeTextElement, FreeTextParagraph } from '../../types/presentation'
import {
  getSelectionOffsets,
  htmlToParagraphs,
  paragraphsToHtml,
  refreshMarkers,
  setSelectionOffsets,
} from '../../utils/richTextDom'
import type { TextRange } from '../../utils/freeTextFormat'
import { textContentCss } from './layout'

/** Onde o cursor começa: no ponto clicado, com tudo selecionado ou no fim. */
export type CaretStart = { x: number; y: number } | 'all' | 'end'

interface FreeTextEditableProps {
  element: FreeTextElement
  caret: CaretStart
  onChange: (paragraphs: FreeTextParagraph[]) => void
  onSelect: (range: TextRange) => void
  onShortcut: (flag: 'bold' | 'italic' | 'underline') => void
}

function rangeAtPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y)
    if (!pos) return null
    const range = document.createRange()
    range.setStart(pos.offsetNode, pos.offset)
    return range
  }
  return doc.caretRangeFromPoint?.(x, y) ?? null
}

/**
 * Texto de uma caixa em edição, direto no slide.
 *
 * O navegador cuida da digitação (`contentEditable`); a cada mudança o HTML é
 * lido de volta para o modelo. O React não desenha o conteúdo daqui: ele só é
 * reescrito quando o modelo muda por fora (um estilo aplicado pelo painel, por
 * exemplo), e então a seleção é restaurada no mesmo lugar.
 */
export function FreeTextEditable({ element, caret, onChange, onSelect, onShortcut }: FreeTextEditableProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Versão do modelo que está no DOM agora.
  const syncedRef = useRef('')
  const initialCaret = useRef(caret)
  const onSelectRef = useRef(onSelect)
  useLayoutEffect(() => {
    onSelectRef.current = onSelect
  })

  const { paragraphs, style } = element
  useLayoutEffect(() => {
    const root = ref.current
    const key = JSON.stringify([paragraphs, style])
    if (!root || key === syncedRef.current) return
    const focused = document.activeElement === root
    const selection = focused ? getSelectionOffsets(root) : null
    root.innerHTML = paragraphsToHtml(paragraphs, style)
    syncedRef.current = key
    if (selection) setSelectionOffsets(root, selection.start, selection.end)
  }, [paragraphs, style])

  // Ao abrir: foco e cursor no ponto do clique duplo (ou texto todo selecionado).
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    // Enter cria <p>, como os parágrafos do modelo (o padrão seria <div>).
    document.execCommand('defaultParagraphSeparator', false, 'p')
    root.focus({ preventScroll: true })
    const selection = window.getSelection()
    if (!selection) return
    const start = initialCaret.current
    let range: Range | null = null
    if (typeof start === 'object') {
      const atPoint = rangeAtPoint(start.x, start.y)
      if (atPoint && root.contains(atPoint.startContainer)) range = atPoint
    }
    if (!range) {
      range = document.createRange()
      range.selectNodeContents(root)
      if (start !== 'all') range.collapse(false)
    }
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  // A seleção alimenta o painel: o estilo escolhido lá vale para este trecho.
  useEffect(() => {
    function onSelectionChange() {
      const root = ref.current
      if (!root || document.activeElement !== root) return
      const offsets = getSelectionOffsets(root)
      if (offsets) onSelectRef.current(offsets)
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  function handleInput() {
    const root = ref.current
    if (!root) return
    const next = htmlToParagraphs(root, style)
    refreshMarkers(root, next)
    syncedRef.current = JSON.stringify([next, style])
    onChange(next)
  }

  return (
    <div
      ref={ref}
      className="ft-text cursor-text outline-none"
      style={{ ...textContentCss(element), minHeight: '1.2em' }}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onInput={handleInput}
      onKeyDown={(e) => {
        const mod = e.ctrlKey || e.metaKey
        if (!mod || e.shiftKey || e.altKey) return
        const key = e.key.toLowerCase()
        if (key === 'b' || key === 'i' || key === 'u') {
          e.preventDefault()
          onShortcut(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline')
        }
      }}
      onPaste={(e) => {
        // Só texto: HTML colado de outro lugar traria estilos que o modelo não conhece.
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
        text.split('\n').forEach((line, i) => {
          if (i > 0) document.execCommand('insertParagraph')
          if (line) document.execCommand('insertText', false, line)
        })
      }}
    />
  )
}
