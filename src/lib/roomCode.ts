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
