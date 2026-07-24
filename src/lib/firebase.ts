import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True quando as variáveis de ambiente do Firebase foram preenchidas. */
export const isFirebaseConfigured = Boolean(envConfig.apiKey && envConfig.projectId)

// Config de reserva (valores presentes, porém inválidos) usada quando o `.env`
// não foi preenchido. Sem ela, `getAuth()` lançaria `auth/invalid-api-key` na
// avaliação do módulo e deixaria a página inteira em branco. Com ela, a UI
// carrega normalmente e mostra o aviso de configuração; apenas as chamadas de
// rede (login/salas) falham - de forma controlada.
const FALLBACK_CONFIG = {
  apiKey: 'nao-configurado',
  authDomain: 'nao-configurado.firebaseapp.com',
  projectId: 'nao-configurado',
  storageBucket: 'nao-configurado.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
}

if (!isFirebaseConfigured) {
  console.warn(
    '[Firebase] Configuração ausente. Copie .env.example para .env e preencha as chaves VITE_FIREBASE_*.',
  )
}

export const app = initializeApp(isFirebaseConfigured ? envConfig : FALLBACK_CONFIG)
export const auth = getAuth(app)
export const db = getFirestore(app)
