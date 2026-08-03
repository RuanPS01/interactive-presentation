import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { WordCount } from '../../utils/aggregate'
import { CHART_COLORS, colorAt } from './palette'

interface WordCloudViewProps {
  words: WordCount[]
}

interface PlacedWord {
  text: string
  /** Centro da palavra, em unidades de layout (relativo ao centro da nuvem). */
  x: number
  y: number
  size: number
  w: number
  h: number
  /** Deslocamento da linha de base para o desenho ficar centrado em (x, y). */
  dy: number
}

interface Layout {
  words: PlacedWord[]
  /** Fator aplicado ao grupo para a nuvem preencher o container sem cortar. */
  scale: number
  /** Centro da caixa envolvente da nuvem, para centralizar o conjunto. */
  cx: number
  cy: number
}

/**
 * Faixa nominal de tamanhos usada durante o layout. São proporções relativas:
 * o resultado é reescalado no fim para preencher o container, então o valor
 * absoluto não importa.
 */
const NOMINAL_MIN = 26
const NOMINAL_MAX = 96
/** Respiro entre as caixas das palavras, em unidades de layout. */
const GAP_X = 10
const GAP_Y = 6
/** Margem interna do container, em px, para nada tocar a borda. */
const INSET = 8
/**
 * Teto do tamanho renderizado, como fração da altura disponível. Evita que uma
 * ou duas palavras fiquem absurdamente grandes, e acompanha o tamanho da área
 * (num projetor o limite é alto; numa miniatura do resumo, baixo).
 */
const MAX_FONT_RATIO = 0.45
const MAX_WORDS = 100
const FONT = '700 %spx Inter, system-ui, sans-serif'

// Canvas reutilizado para medir o texto.
let measureCtx: CanvasRenderingContext2D | null = null

/**
 * Caixa de tinta real da palavra. Usa as métricas de glifo (não o tamanho da
 * fonte): o retângulo de uma linha de texto é ~1,33x a fonte por causa do
 * espaço de ascendentes/descendentes, e usar `size` como altura subestimava a
 * caixa e deixava as palavras se tocarem. Com a caixa justa, palavras sem
 * descendentes ("Teste") também podem ficar mais próximas.
 */
function measureWord(text: string, size: number): { w: number; h: number; dy: number } {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  const fallbackAscent = size * 0.75
  const fallbackDescent = size * 0.22
  if (!measureCtx) {
    return {
      w: text.length * size * 0.6,
      h: fallbackAscent + fallbackDescent,
      dy: (fallbackAscent - fallbackDescent) / 2,
    }
  }
  measureCtx.font = FONT.replace('%s', String(size))
  const m = measureCtx.measureText(text)
  const ascent = m.actualBoundingBoxAscent ?? fallbackAscent
  const descent = m.actualBoundingBoxDescent ?? fallbackDescent
  // A caixa vai de (base - ascent) a (base + descent); para o centro dela cair
  // em y = 0, a linha de base fica em (ascent - descent) / 2.
  return { w: m.width, h: ascent + descent, dy: (ascent - descent) / 2 }
}

/**
 * Cor estável por palavra: derivada do próprio texto, então uma palavra nunca
 * troca de cor quando a ordem por frequência muda.
 */
function colorForWord(text: string): string {
  let hash = 0
  const key = text.toLowerCase()
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) % 1000003
  }
  return colorAt(hash % CHART_COLORS.length)
}

function overlaps(
  x: number,
  y: number,
  w: number,
  h: number,
  placed: PlacedWord[],
): boolean {
  for (let i = placed.length - 1; i >= 0; i--) {
    const p = placed[i]
    if (
      Math.abs(x - p.x) < (w + p.w) / 2 + GAP_X &&
      Math.abs(y - p.y) < (h + p.h) / 2 + GAP_Y
    ) {
      return true
    }
  }
  return false
}

/**
 * Primeiro ponto livre de uma espiral que sai do centro, ou `null` se não achar.
 * O eixo x é esticado por `stretch` para a nuvem crescer na forma da área
 * disponível (numa tela larga ela se espalha na horizontal, não em círculo).
 *
 * A granularidade acompanha a altura da palavra: anéis separados por uma altura
 * (nada caberia entre eles) e passo angular de meia altura. Sondar mais fino
 * que isso não encontra vaga nova e multiplica o custo — com passo fixo a
 * espiral dava ~80 voltas para sair de uma nuvem de 100 palavras.
 */
function findSpot(
  w: number,
  h: number,
  placed: PlacedWord[],
  stretch: number,
): { x: number; y: number } | null {
  if (placed.length === 0) return { x: 0, y: 0 }
  const ring = Math.max(24, h + GAP_Y * 2)
  const arcStep = Math.max(14, h * 0.6)
  const growth = ring / (2 * Math.PI)
  let t = 0
  for (let i = 0; i < 4000; i++) {
    const r = growth * t
    const x = r * Math.cos(t) * stretch
    const y = r * Math.sin(t)
    if (!overlaps(x, y, w, h, placed)) return { x, y }
    t += arcStep / Math.max(r, arcStep)
  }
  return null
}

interface SizedWord {
  text: string
  size: number
  w: number
  h: number
  dy: number
}

interface Placement {
  words: PlacedWord[]
  boxW: number
  boxH: number
  cx: number
  cy: number
}

/** Posiciona todas as palavras (maiores primeiro) e mede a caixa envolvente. */
function placeAll(sized: SizedWord[], stretch: number): Placement {
  const placed: PlacedWord[] = []
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const word of sized) {
    const spot = findSpot(word.w, word.h, placed, stretch)
    // Sem vaga na espiral, encosta à direita de tudo o que já existe: nunca
    // sobrepõe (só alonga a caixa, o que a escala final compensa).
    const x = spot ? spot.x : maxX + GAP_X + word.w / 2
    const y = spot ? spot.y : 0
    placed.push({ ...word, x, y })
    minX = Math.min(minX, x - word.w / 2)
    maxX = Math.max(maxX, x + word.w / 2)
    minY = Math.min(minY, y - word.h / 2)
    maxY = Math.max(maxY, y + word.h / 2)
  }

  return {
    words: placed,
    boxW: Math.max(1, maxX - minX),
    boxH: Math.max(1, maxY - minY),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
}

/**
 * Alongamentos testados, como fração da proporção do container. As palavras já
 * são naturalmente largas, então esticar a espiral na proporção cheia costuma
 * espalhar demais na horizontal e sobrar altura; testar várias e ficar com a
 * melhor é mais confiável que uma fórmula única.
 */
const STRETCH_STEPS = [0.3, 0.5, 0.15, 0.75, 1]

/**
 * Cobertura da menor dimensão que já é considerada boa. Alcançada, para de
 * testar alongamentos: cada tentativa reposiciona todas as palavras, e com
 * muitas palavras o primeiro arranjo costuma já preencher bem.
 */
const GOOD_COVERAGE = 0.85

/**
 * Recalcula o layout inteiro a cada mudança: como o tamanho de cada palavra
 * varia com a frequência, manter posições antigas geraria sobreposição. Ao
 * refazer tudo (maiores primeiro) as palavras se reacomodam nos espaços livres,
 * e a transição de posição é animada em CSS.
 */
function computeLayout(words: WordCount[], width: number, height: number): Layout {
  const empty: Layout = { words: [], scale: 1, cx: 0, cy: 0 }
  if (words.length === 0 || width <= 0 || height <= 0) return empty

  const usableW = Math.max(1, width - INSET * 2)
  const usableH = Math.max(1, height - INSET * 2)
  const aspect = usableW / usableH

  // Maiores primeiro (empate resolvido pelo texto, para o layout ser o mesmo
  // sempre que os dados forem os mesmos).
  const ordered = [...words]
    .sort((a, b) => b.value - a.value || a.text.localeCompare(b.text))
    .slice(0, MAX_WORDS)

  const values = ordered.map((w) => w.value)
  const max = Math.max(...values)
  const min = Math.min(...values)

  const sized: SizedWord[] = ordered.map((word) => {
    const size =
      max === min
        ? (NOMINAL_MIN + NOMINAL_MAX) / 2
        : NOMINAL_MIN + ((word.value - min) / (max - min)) * (NOMINAL_MAX - NOMINAL_MIN)
    return { text: word.text, size, ...measureWord(word.text, size) }
  })

  // Fica com o arranjo que permite a maior ampliação, ou seja, o que aproveita
  // melhor a área: `fit` é exatamente o fator aplicado ao grupo no fim.
  let best: Placement | null = null
  let bestFit = 0
  for (const step of STRETCH_STEPS) {
    const candidate = placeAll(sized, Math.max(1, aspect * step))
    const fit = Math.min(usableW / candidate.boxW, usableH / candidate.boxH)
    if (fit > bestFit) {
      bestFit = fit
      best = candidate
    }
    // `fit` já zera a folga de uma das dimensões; basta olhar a outra.
    const coverage = Math.min(
      (candidate.boxW * fit) / usableW,
      (candidate.boxH * fit) / usableH,
    )
    if (coverage >= GOOD_COVERAGE) break
  }
  if (!best) return empty

  // O teto é sobre o tamanho realmente usado pela maior palavra (e não sobre
  // NOMINAL_MAX): com todas as palavras empatadas o tamanho nominal é o do meio
  // da faixa, e comparar com o topo da faixa limitaria a ampliação sem motivo.
  const largest = Math.max(...sized.map((s) => s.size))
  return {
    words: best.words,
    scale: Math.min(bestFit, (usableH * MAX_FONT_RATIO) / largest),
    cx: best.cx,
    cy: best.cy,
  }
}

/**
 * Nuvem de palavras: ocupa toda a área disponível, tamanho proporcional à
 * frequência e refluxo completo a cada atualização (as palavras se movem para
 * aproveitar o espaço livre em vez de crescer sobre as vizinhas).
 */
export function WordCloudView({ words }: WordCloudViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  // Palavras já exibidas: as inéditas entram com a animação de "pop".
  const seenRef = useRef<Set<string>>(new Set())
  // Animações ligadas só depois do primeiro quadro, para a nuvem já aparecer
  // montada em vez de animar a partir do estado inicial (ver index.css).
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Mede o container. O layout depende do tamanho real, então precisa
  // recalcular ao entrar em tela cheia, ocultar o cabeçalho ou redimensionar.
  // A primeira medição é síncrona (antes da pintura): não depende da primeira
  // entrega do ResizeObserver, que pode não acontecer em aba oculta ou sem
  // renderização ativa — nesses casos a nuvem ficaria 0x0 e invisível.
  useLayoutEffect(() => {
    const el = hostRef.current
    if (!el) return

    function measure(width: number, height: number) {
      setBox((prev) => {
        const next = { width: Math.round(width), height: Math.round(height) }
        return prev.width === next.width && prev.height === next.height ? prev : next
      })
    }

    const rect = el.getBoundingClientRect()
    measure(rect.width, rect.height)

    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect
      measure(box.width, box.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // A identidade de `words` muda a cada snapshot do Firestore mesmo sem
  // alteração real; a assinatura evita recalcular o layout sem necessidade.
  const signature = words.map((w) => `${w.text}:${w.value}`).join('|')
  const layout = useMemo(
    () => computeLayout(words, box.width, box.height),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, box.width, box.height],
  )

  useEffect(() => {
    if (words.length === 0) {
      seenRef.current.clear()
      return
    }
    for (const word of layout.words) seenRef.current.add(word.text)
  }, [layout, words.length])

  return (
    <div ref={hostRef} className="h-full w-full overflow-hidden">
      {words.length === 0 ? (
        <div className="flex h-full items-center justify-center text-neutral-400">
          Aguardando palavras…
        </div>
      ) : (
        <svg
          width={box.width}
          height={box.height}
          className={animate ? 'block wc-animate' : 'block'}
        >
          {/* Centraliza a caixa envolvente no container e aplica o fator de
              preenchimento; a transição suaviza mudanças de escala. */}
          <g
            className="wc-cloud"
            style={{
              transform: `translate(${box.width / 2}px, ${box.height / 2}px) scale(${layout.scale}) translate(${-layout.cx}px, ${-layout.cy}px)`,
            }}
          >
            {layout.words.map((item) => (
              // O <g> anima a posição e o <text> o tamanho: separados para a
              // animação de entrada (que usa transform) não conflitar.
              // `dy` entra no translate (e não no atributo y do texto) para a
              // linha de base acompanhar a transição junto com a posição.
              <g
                key={item.text}
                className="wc-word"
                style={{ transform: `translate(${item.x}px, ${item.y + item.dy}px)` }}
              >
                <text
                  textAnchor="middle"
                  fontWeight={700}
                  fill={colorForWord(item.text)}
                  className={seenRef.current.has(item.text) ? undefined : 'wc-word-new'}
                  style={{
                    fontSize: `${item.size}px`,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  {item.text}
                </text>
              </g>
            ))}
          </g>
        </svg>
      )}
    </div>
  )
}
