import { useEffect, useState } from 'react'
import { fetchAssets } from '../lib/assets'
import type { PresentationAssets } from '../types/presentation'

/**
 * Imagens de uma sala, carregadas sob demanda. Quem chama passa só os ids que
 * precisa agora (o slide no ar e o próximo, por exemplo); o que já veio fica
 * guardado, então voltar a um slide não lê nada de novo.
 */
export function useRoomAssets(code: string | undefined, ids: string[]): PresentationAssets {
  const [assets, setAssets] = useState<PresentationAssets>({})
  // A lista muda de identidade a cada renderização; a chave, só com o conteúdo.
  const key = [...new Set(ids)].sort().join('|')

  useEffect(() => {
    if (!code || !key) return
    let cancelled = false
    fetchAssets(code, key.split('|'))
      .then((found) => {
        if (!cancelled && Object.keys(found).length > 0) {
          setAssets((previous) => ({ ...previous, ...found }))
        }
      })
      .catch(() => {
        /* sem a imagem, o slide mostra o espaço reservado */
      })
    return () => {
      cancelled = true
    }
  }, [code, key])

  return assets
}
