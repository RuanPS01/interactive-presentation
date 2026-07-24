import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `base` precisa bater com o nome do repositório no GitHub Pages
// (https://<usuario>.github.io/interactive-presentation/).
// Sobrescreva com a env VITE_BASE se publicar em outro caminho.
const base = process.env.VITE_BASE ?? '/interactive-presentation/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
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
})
