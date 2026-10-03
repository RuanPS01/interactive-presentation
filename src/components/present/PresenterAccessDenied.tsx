import { useNavigate } from 'react-router-dom'
import { FullScreenMessage } from '../layout/FullScreenMessage'
import { Button } from '../ui/Button'

/**
 * Quem abriu a tela do apresentador (ou a edição da sala) sem o token: oferece
 * entrar como participante, que é o que a plateia quer na maioria das vezes.
 */
export function PresenterAccessDenied({ code }: { code: string }) {
  const navigate = useNavigate()
  return (
    <FullScreenMessage>
      <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
        Acesso de apresentador necessário
      </p>
      <p className="mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
        Este link não tem o token de apresentador desta sala. Se você é da
        plateia, entre como participante usando o código.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => navigate(`/room/${code}`)}>Entrar como participante</Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Início
        </Button>
      </div>
    </FullScreenMessage>
  )
}
