import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// O site sai em dois lugares, e cada um tem o seu caminho:
// - GitHub Pages, num subcaminho com o nome do repositório
//   (https://<usuario>.github.io/interactive-presentation/);
// - Firebase Hosting, na raiz do domínio (https://<projeto>.web.app/).
//   `vite build --mode firebase` gera essa versão em `dist-firebase/`, a pasta
//   que o `firebase.json` publica.
// A env VITE_BASE sobrescreve o caminho nos dois casos.

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const firebase = mode === 'firebase'
  return {
    base: process.env.VITE_BASE ?? (firebase ? '/' : '/interactive-presentation/'),
    plugins: [react(), tailwindcss()],
    build: {
      outDir: firebase ? 'dist-firebase' : 'dist',
      rollupOptions: {
        output: {
          // Separa dependências grandes em chunks próprios (melhor cache).
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            charts: ['recharts', 'd3-cloud'],
          },
        },
      },
    },
  }
})
