/**
 * Prompt pronto para colar em um assistente de IA. Descreve o formato JSON
 * aceito por `importPresentationFromFile` (ver `utils/validation.ts`) para que a
 * IA gere perguntas, slides e conteúdos importáveis na plataforma.
 *
 * Ao alterar o schema em `utils/validation.ts`, atualize este texto também.
 */
export const AI_IMPORT_PROMPT = `Você vai gerar o conteúdo de uma apresentação interativa em JSON.

TEMA DA APRESENTAÇÃO: [descreva aqui o tema, o público e quantos slides quer]

Responda APENAS com o JSON, sem comentários, sem texto antes ou depois e sem bloco de código markdown.

FORMATO GERAL

{
  "title": "Título da apresentação",
  "slides": [ ...slides... ]
}

- "title": texto livre (obrigatório).
- "slides": lista de slides na ordem de apresentação (pode estar vazia, mas gere pelo menos 5).

CAMPOS COMUNS A TODO SLIDE

- "id": identificador único no arquivo, texto não vazio (ex.: "s1", "s2").
- "type": um de "wordcloud", "bar", "pie", "text".
- "title": título exibido no slide e para os participantes.

TIPOS DE SLIDE

1) "wordcloud" - nuvem de palavras. Os participantes enviam palavras pelo celular
   e elas aparecem com tamanho proporcional à frequência. Use para perguntas
   abertas e curtas.
   Campos adicionais:
   - "wordLimitMode": "one" (uma palavra por pessoa), "range" (até "maxWords") ou
     "unlimited" (sem limite).
   - "maxWords": número inteiro de 1 a 50. Obrigatório sempre; só tem efeito
     quando "wordLimitMode" é "range".

   {
     "id": "s1",
     "type": "wordcloud",
     "title": "Qual palavra resume seu dia?",
     "wordLimitMode": "range",
     "maxWords": 3
   }

2) "bar" - gráfico de barras. Pergunta de múltipla escolha com resultado em barras.
   Campos adicionais:
   - "options": lista com no mínimo 1 item, cada um { "id": texto não vazio,
     "label": texto exibido }. Os "id" devem ser únicos dentro do slide.
   - "allowMultiple": true permite marcar várias opções; false permite apenas uma.

   {
     "id": "s2",
     "type": "bar",
     "title": "Quais linguagens você já usou?",
     "allowMultiple": true,
     "options": [
       { "id": "o1", "label": "Python" },
       { "id": "o2", "label": "JavaScript" },
       { "id": "o3", "label": "Java" }
     ]
   }

3) "pie" - gráfico de pizza. Mesmos campos de "bar". Prefira "pie" quando as
   opções são mutuamente exclusivas e a proporção do total importa (use
   "allowMultiple": false).

   {
     "id": "s3",
     "type": "pie",
     "title": "Qual seu nível de experiência?",
     "allowMultiple": false,
     "options": [
       { "id": "o1", "label": "Iniciante" },
       { "id": "o2", "label": "Intermediário" },
       { "id": "o3", "label": "Avançado" }
     ]
   }

4) "text" - slide de conteúdo, sem interação. Use para abertura, explicações e
   transições entre perguntas.
   Campos adicionais:
   - "content": texto exibido. Use "\\n" para quebrar linha.
   - "align": "left", "center" ou "right".
   - "fontSize": número inteiro de 8 a 200 (tamanho em px). Títulos de seção
     costumam ficar bem entre 48 e 72; parágrafos entre 28 e 40.

   {
     "id": "s4",
     "type": "text",
     "title": "Boas-vindas",
     "content": "Vamos falar sobre dados\\ne como interpretá-los",
     "align": "center",
     "fontSize": 56
   }

REGRAS

- Use exatamente esses nomes de campo e esses valores permitidos. Qualquer campo
  extra ou faltando faz a importação falhar.
- Números devem ser números JSON (sem aspas) e inteiros.
- "allowMultiple" deve ser booleano (true/false, sem aspas).
- Todos os "id" de slides são diferentes entre si.
- Escreva todo o conteúdo em português do Brasil.
- Enunciados curtos e diretos; opções com no máximo 4 palavras.
- Intercale slides de texto e slides interativos para manter o ritmo.

EXEMPLO COMPLETO VÁLIDO

{
  "title": "Introdução à Análise de Dados",
  "slides": [
    {
      "id": "s1",
      "type": "text",
      "title": "Abertura",
      "content": "Introdução à Análise de Dados",
      "align": "center",
      "fontSize": 64
    },
    {
      "id": "s2",
      "type": "wordcloud",
      "title": "O que vem à sua mente ao ouvir \\"dados\\"?",
      "wordLimitMode": "range",
      "maxWords": 3
    },
    {
      "id": "s3",
      "type": "pie",
      "title": "Com que frequência você analisa dados no trabalho?",
      "allowMultiple": false,
      "options": [
        { "id": "s3o1", "label": "Todos os dias" },
        { "id": "s3o2", "label": "Toda semana" },
        { "id": "s3o3", "label": "Raramente" },
        { "id": "s3o4", "label": "Nunca" }
      ]
    },
    {
      "id": "s4",
      "type": "bar",
      "title": "Quais ferramentas você já usou?",
      "allowMultiple": true,
      "options": [
        { "id": "s4o1", "label": "Excel" },
        { "id": "s4o2", "label": "Power BI" },
        { "id": "s4o3", "label": "Python" },
        { "id": "s4o4", "label": "SQL" }
      ]
    },
    {
      "id": "s5",
      "type": "text",
      "title": "Encerramento",
      "content": "Obrigado pela participação",
      "align": "center",
      "fontSize": 48
    }
  ]
}
`
