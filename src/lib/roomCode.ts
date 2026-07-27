// Alfabeto sem caracteres ambíguos (sem O/0, I/1) para facilitar a digitação.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Gera um código de sala aleatório e legível (padrão: 6 caracteres). */
export function generateRoomCode(length = 6): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ALPHABET[values[i] % ALPHABET.length]
  }
  return code
}

/** Normaliza a entrada do usuário (maiúsculas, sem espaços). */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '')
}

// Alfabeto amplo (URL-safe) para o token secreto do apresentador.
const TOKEN_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Gera um token secreto de apresentador (padrão: 24 caracteres).
 * Vai na URL de apresentação e funciona como credencial: quem o tem controla
 * a sala; quem só tem o código (participantes) não consegue apresentar.
 */
export function generatePresenterToken(length = 24): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  let token = ''
  for (let i = 0; i < length; i++) {
    token += TOKEN_ALPHABET[values[i] % TOKEN_ALPHABET.length]
  }
  return token
}
