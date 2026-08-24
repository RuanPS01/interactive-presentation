/**
 * Encurtador do link de entrada da sala.
 *
 * O QR Code continua codificando a URL COMPLETA (não depende de serviço
 * externo para funcionar). O link curto existe só para ser exibido em texto
 * grande ao lado do QR, para quem prefere digitar. Como o encurtamento manda a
 * URL da sala para um serviço de terceiros, ele só acontece quando o
 * apresentador abre o QR — e o resultado é guardado no `localStorage` para não
 * criar um link novo a cada abertura.
 *
 * Por que TinyURL: sendo um site 100% estático, a chamada sai do navegador e o
 * serviço precisa responder com CORS liberado. Entre os encurtadores públicos
 * testados (is.gd, cleanuri, spoo.me, ulvis), só o TinyURL envia
 * `Access-Control-Allow-Origin`; os demais são bloqueados pelo navegador. O
 * redirecionamento preserva o fragmento `#/room/<código>` do HashRouter.
 */

const CACHE_KEY = 'ip-short-urls'
const TIMEOUT_MS = 8000
const ENDPOINT = 'https://tinyurl.com/api-create.php'

function readCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

export function getCachedShortUrl(url: string): string | null {
  const cached = readCache()[url]
  return typeof cached === 'string' && cached ? cached : null
}

function writeCache(url: string, short: string): void {
  try {
    const all = readCache()
    all[url] = short
    localStorage.setItem(CACHE_KEY, JSON.stringify(all))
  } catch {
    // localStorage indisponível: o link curto vale só para esta sessão.
  }
}

/** Remove o protocolo (e o `www.`) para exibir o link o mais curto possível. */
export function displayShortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
}

/**
 * Devolve uma versão curta da URL. Lança em caso de falha (serviço fora do ar,
 * sem internet, ou URL que o encurtador recusa — `localhost`, por exemplo);
 * quem chama mostra a URL original nesse caso.
 */
export async function shortenUrl(url: string): Promise<string> {
  const cached = getCachedShortUrl(url)
  if (cached) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${ENDPOINT}?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    })
    const text = (await res.text()).trim()
    if (!/^https?:\/\//i.test(text)) {
      throw new Error(text || 'resposta inesperada do encurtador')
    }
    writeCache(url, text)
    return text
  } catch (e) {
    throw new Error(
      `Não foi possível encurtar o link (${(e as Error).message || 'sem resposta'}).`,
    )
  } finally {
    clearTimeout(timer)
  }
}
