import { FileDown, FileUp } from 'lucide-react'
import { useRef } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { exportPresentation, importPresentationFromFile } from '../../utils/importExport'
import { Button } from '../ui/Button'

interface ImportExportButtonsProps {
  /** Mensagem de erro da importação (ou `null` quando ela deu certo). */
  onError: (message: string | null) => void
}

/** "Importar JSON" e "Exportar JSON" do editor em uso. */
export function ImportExportButtons({ onError }: ImportExportButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const getPresentation = useEditorStore((s) => s.getPresentation)
  const loadPresentation = useEditorStore((s) => s.loadPresentation)

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const result = await importPresentationFromFile(file)
    if (result.ok) {
      loadPresentation(result.presentation)
      onError(null)
    } else {
      onError(result.error)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFile}
      />
      <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
        <FileUp size={16} /> Importar JSON
      </Button>
      <Button variant="secondary" size="sm" onClick={() => exportPresentation(getPresentation())}>
        <FileDown size={16} /> Exportar JSON
      </Button>
    </>
  )
}
