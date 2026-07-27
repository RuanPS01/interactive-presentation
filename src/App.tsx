import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { CreatePage } from './pages/CreatePage'
import { PresentPage } from './pages/PresentPage'
import { JoinPage } from './pages/JoinPage'
import { RoomPage } from './pages/RoomPage'
import { useApplyTheme } from './hooks/useApplyTheme'
import { useThemeStore } from './store/themeStore'

export default function App() {
  // Tema é preferência do usuário (localStorage), aplicada globalmente.
  useApplyTheme(useThemeStore((s) => s.theme))

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<CreatePage />} />
      <Route path="/present/:code" element={<PresentPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/room/:code" element={<RoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
