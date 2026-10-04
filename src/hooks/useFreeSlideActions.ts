import { useState } from 'react'
import { useEditorStoreApi } from '../store/editorStore'
import type { FreeElement, FreeSlide } from '../types/presentation'
import {
  createImageElement,
  createTextElement,
  duplicateElement,
  moveLayer,
} from '../utils/freeSlide'
import type { LayerMove } from '../utils/freeSlide'
import { blobToAsset } from '../utils/images'

/**
 * Ações sobre os elementos de um slide livre, usadas pelo canvas e pelo
 * painel de configuração. Leem sempre o estado mais recente do editor: uma
 * imagem pode terminar de carregar depois de outras mudanças no slide.
 */
export function useFreeSlideActions(slideId: string) {
  const store = useEditorStoreApi()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function currentSlide(): FreeSlide | undefined {
    const slide = store.getState().slides.find((s) => s.id === slideId)
    return slide?.type === 'free' ? slide : undefined
  }

  function commit(elements: FreeElement[]) {
    store.getState().setElements(slideId, elements)
  }

  /** Caixa de texto nova, já em edição com o texto selecionado. */
  function addText() {
    const slide = currentSlide()
    if (!slide) return
    const element = createTextElement(slide)
    commit([...slide.elements, element])
    store.getState().setEditingElement(element.id)
  }

  /** Imagens de arquivos (botão, arrastar e soltar, colar). */
  async function addImages(files: Iterable<File>, at?: { x: number; y: number }) {
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) {
      setError('Escolha um arquivo de imagem (PNG, JPG, WebP, GIF ou SVG).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const assets = await Promise.all(images.map((file) => blobToAsset(file)))
      const slide = currentSlide()
      if (!slide) return
      store.getState().addAssets(assets)
      const added = assets.map((asset, i) =>
        createImageElement(
          asset,
          slide,
          at ? { x: at.x + i * 24, y: at.y + i * 24 } : undefined,
        ),
      )
      commit([...slide.elements, ...added])
      store.getState().selectElement(added[added.length - 1].id)
    } catch (e) {
      setError(`Não foi possível usar a imagem: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  /** Troca o arquivo de uma imagem mantendo posição e largura. */
  async function replaceImage(elementId: string, file: File) {
    setBusy(true)
    setError(null)
    try {
      const asset = await blobToAsset(file)
      const slide = currentSlide()
      const element = slide?.elements.find((e) => e.id === elementId)
      if (!slide || element?.kind !== 'image') return
      store.getState().addAssets([asset])
      store.getState().updateElement(slideId, elementId, {
        assetId: asset.id,
        height: Math.round((element.width * asset.height) / asset.width),
      })
    } catch (e) {
      setError(`Não foi possível usar a imagem: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  function remove(elementId: string) {
    const slide = currentSlide()
    if (slide) commit(slide.elements.filter((e) => e.id !== elementId))
  }

  function duplicate(elementId: string) {
    const slide = currentSlide()
    const element = slide?.elements.find((e) => e.id === elementId)
    if (!slide || !element) return
    const copy = duplicateElement(element)
    const index = slide.elements.indexOf(element)
    const elements = [...slide.elements]
    elements.splice(index + 1, 0, copy)
    commit(elements)
    store.getState().selectElement(copy.id)
  }

  function reorder(elementId: string, move: LayerMove) {
    const slide = currentSlide()
    if (slide) commit(moveLayer(slide.elements, elementId, move))
  }

  return { addText, addImages, replaceImage, remove, duplicate, reorder, busy, error, setError }
}
