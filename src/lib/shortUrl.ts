/**
 * Encurtador do link de entrada da sala.
 *
 * O QR Code continua codificando a URL COMPLETA (não depende de serviço
 * externo para funcionar). O link curto existe para ser exibido em texto
 * grande ao lado do QR e na projeção do código, para quem prefere digitar.
 * Como o encurtamento manda a URL da sala para um serviço de terceiros, ele
 * só acontece quando o apresentador abre o código da sala, e o resultado é
 * guardado no `localStorage` para não criar um link novo a cada abertura.
 *
 * Por que da.gd: sendo um site estático, a chamada sai do NAVEGADOR, então só
 * servem serviços que respondem com CORS liberado para qualquer origem. O
 * TinyURL saiu da lista: hoje ele responde
 * `Access-Control-Allow-Origin: https://tinyurl.com`, e o navegador descarta a
 * resposta (mesmo com status 200). O da.gd libera para todos
 * (`Access-Control-Allow-Origin: *`), não pede chave, aceita `localhost` e
 * preserva o fragmento `#/room/<código>` do HashRouter no redirecionamento.
 */

const CACHE_KEY = 'ip-short-urls'
const TIMEOUT_MS = 8000

interface Provider {
  /** Domínio que o link curto precisa ter para ser aceito. */
  host: string
  endpoint: (longUrl: string) => string
}

// Para acrescentar um serviço, ele precisa responder com
// `Access-Control-Allow-Origin: *` e devolver o link em texto puro.
const PROVIDERS: Provider[] = [
  { host: 'da.gd', endpoint: (url) => `https://da.gd/s?url=${encodeURIComponent(url)}` },
]

/**
 * Link curto aceitável: `https`, com caminho (um texto de erro do serviço não
 * pode virar "link curto") e, quando informado, do próprio serviço.
 */
function validShortUrl(text: string, host?: string): string | null {
  try {
    const parsed = new URL(text.trim().replace(/^http:\/\//i, 'https://'))
    if (parsed.protocol !== 'https:' || parsed.pathname.length <= 1) return null
    if (host && parsed.hostname !== host) return null
    return parsed.href
  } catch {
    return null
  }
}

/**
 * Lê o cache e descarta o que não for link válido: versões antigas podiam ter
 * gravado o texto de erro de um serviço no lugar do link.
 */
function readCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const clean: Record<string, string> = {}
    let dropped = false
    for (const [url, short] of Object.entries(parsed as Record<string, unknown>)) {
      const valid = typeof short === 'string' ? validShortUrl(short) : null
      if (valid) clean[url] = valid
      else dropped = true
    }
    if (dropped) localStorage.setItem(CACHE_KEY, JSON.stringify(clean))
    return clean
  } catch {
    return {}
  }
}

export function getCachedShortUrl(url: string): string | null {
  return readCache()[url] ?? null
}

function writeCache(url: string, short: string): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [url]: short }))
  } catch {
    // localStorage indisponível: o link curto vale só para esta aba.
  }
}

/** Remove o protocolo (e o `www.`) para exibir o link o mais curto possível. */
export function displayShortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
}

/**
 * Devolve uma versão curta da URL. Lança quando nenhum serviço respondeu (fora
 * do ar, sem internet ou tempo esgotado); quem chama mostra a URL completa (ou
 * o endereço do site, na projeção).
 */
export async function shortenUrl(url: string): Promise<string> {
  const cached = getCachedShortUrl(url)
  if (cached) return cached
  for (const provider of PROVIDERS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(provider.endpoint(url), { signal: controller.signal })
      if (!res.ok) continue
      const short = validShortUrl(await res.text(), provider.host)
      if (!short) continue
      writeCache(url, short)
      return short
    } catch {
      // Fora do ar, sem internet ou tempo esgotado: tenta o próximo.
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error('Nenhum encurtador respondeu.')
}
