import { Check, ChevronLeft, ChevronRight, Copy, FileText, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom'
import { useResponses } from '../hooks/useResponses'
import { useThemeStore } from '../store/themeStore'
import { setCurrentSlide } from '../lib/rooms'
import { getAllResponses } from '../lib/responses'
import { exportResultsPdf } from '../utils/exportPdf'
import { SlideDisplay } from '../components/slides/SlideDisplay'
import { ShareRoom } from '../components/present/ShareRoom'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Button } from '../components/ui/Button'

export function PresentPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { room, loading, error } = useRoom(code)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  const currentSlide =
    room && room.slides.length > 0 ? room.slides[room.currentSlideIndex] : undefined
  const responses = useResponses(code, currentSlide?.id)

  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Navegação por teclado e passador de slides (clicker):
  // avança com →, PageDown, Espaço; volta com ←, PageUp.
  useEffect(() => {
    if (!room || !code) return
    const slideCount = room.slides.length
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const idx = room!.currentSlideIndex
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        const next = Math.min(idx + 1, slideCount - 1)
        if (next !== idx) void setCurrentSlide(code!, next)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        const prev = Math.max(idx - 1, 0)
        if (prev !== idx) void setCurrentSlide(code!, prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room, code])

  if (loading) {
    return <FullScreenMessage>Carregando sala…</FullScreenMessage>
  }
  if (error) {
    return <FullScreenMessage>Erro ao carregar a sala: {error}</FullScreenMessage>
  }
  if (!room || !code) {
    return (
      <FullScreenMessage>
        Sala não encontrada.
        <Button className="mt-4" onClick={() => navigate('/')}>
          Voltar ao início
        </Button>
      </FullScreenMessage>
    )
  }

  const total = room.slides.length
  const index = room.currentSlideIndex
  const joinUrl = `${window.location.origin}${window.location.pathname}#/room/${code}`

  function goTo(next: number) {
    if (!code) return
    const clamped = Math.max(0, Math.min(next, total - 1))
    if (clamped !== index) void setCurrentSlide(code, clamped)
  }

  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard indisponível: o usuário pode copiar manualmente */
    }
  }

  async function exportPdf() {
    if (!room || !code) return
    setExporting(true)
    try {
      // Busca todas as respostas da sala (de todos os slides) para o relatório.
      const all = await getAllResponses(code)
      await exportResultsPdf(room, all)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* Barra superior */}
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <LogOut size={16} /> Sair
        </Button>
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Código:</span>
          <span className="text-xl font-bold tracking-[0.2em] text-neutral-900 dark:text-neutral-50">
            {code}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void copyJoinLink()}
          className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
          title={joinUrl}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Link copiado' : 'Copiar link de entrada'}
        </button>
        <ShareRoom code={code} joinUrl={joinUrl} />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void exportPdf()}
            disabled={exporting}
          >
            <FileText size={16} /> {exporting ? 'Gerando…' : 'Exportar PDF'}
          </Button>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      {/* Área do slide */}
      <main className="flex min-h-0 flex-1 flex-col px-6 py-6">
        {currentSlide ? (
          <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col">
            <SlideDisplay slide={currentSlide} responses={responses} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-neutral-500 dark:text-neutral-400">
            Esta apresentação ainda não tem slides.
          </div>
        )}
      </main>

      {/* Controles de navegação */}
      <footer className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={index <= 0}>
          <ChevronLeft size={16} /> Anterior
        </Button>
        <span className="flex flex-col items-center text-sm text-neutral-500 dark:text-neutral-400">
          <span>{total > 0 ? `Slide ${index + 1} de ${total}` : 'Sem slides'}</span>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            Use as setas do teclado para navegar
          </span>
        </span>
        <Button
          variant="secondary"
          onClick={() => goTo(index + 1)}
          disabled={index >= total - 1}
        >
          Próximo <ChevronRight size={16} />
        </Button>
      </footer>
    </div>
  )
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center text-neutral-600 dark:text-neutral-300">
      {children}
    </div>
  )
}
