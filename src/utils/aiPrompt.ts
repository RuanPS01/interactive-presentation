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
  "slides": [ ...slides... ],
  "settings": { ...opções globais (opcional)... }
}

- "title": texto livre (obrigatório).
- "slides": lista de slides na ordem de apresentação (pode estar vazia, mas gere pelo menos 5).
- "settings": opcional. Se omitido, a plataforma usa os padrões.

CAMPOS COMUNS A TODO SLIDE

- "id": identificador único no arquivo, texto não vazio (ex.: "s1", "s2").
- "type": um de "wordcloud", "bar", "pie", "quiz", "answer", "text", "free".
- "title": título exibido no slide e para os participantes.
- "overrides": opcional. Objeto com as mesmas chaves de "settings" (menos
  "askName", "slideAspect" e "allowDownload") para valer só neste slide. Omita
  se não precisar.

TIPOS DE SLIDE

1) "wordcloud" - nuvem de palavras. Os participantes enviam textos curtos pelo
   celular (uma palavra ou uma frase) e eles aparecem com tamanho proporcional à
   frequência. Use para perguntas abertas.
   Campos adicionais:
   - "wordLimitMode": "one" (um envio por pessoa), "range" (até "maxWords") ou
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

4) "quiz" - alternativas SEM gráfico. As alternativas aparecem grandes no centro
   da tela do apresentador e na tela dos participantes. É o formato de pergunta e
   resposta: nada de contagem enquanto a pergunta está no ar.
   Campos adicionais:
   - "options" e "allowMultiple": iguais aos de "bar".
   - "correctOptionIds": lista com os "id" das alternativas corretas (pode ser
     vazia, para perguntas sem gabarito). Com "allowMultiple": false, use no
     máximo um id.
   - "revealAnswer": true faz a plataforma manter automaticamente um slide
     "answer" logo depois, revelando o gabarito.
   - "showResponses": true mostra na tela do apresentador quantos votos cada
     alternativa recebeu enquanto a pergunta está no ar. Prefira false (padrão)
     em pergunta e resposta, para não entregar o resultado antes da hora.
   - Para dar a esta pergunta um tempo diferente do geral, use
     "overrides": { "quizTimerSeconds": 30 } (0 = sem cronômetro).

   {
     "id": "s4",
     "type": "quiz",
     "title": "Qual estrutura garante ordem de inserção?",
     "allowMultiple": false,
     "correctOptionIds": ["s4o2"],
     "revealAnswer": true,
     "showResponses": false,
     "options": [
       { "id": "s4o1", "label": "Conjunto" },
       { "id": "s4o2", "label": "Lista" },
       { "id": "s4o3", "label": "Dicionário" }
     ]
   }

5) "answer" - slide de gabarito. NÃO gere este tipo: a plataforma cria e remove
   sozinha os slides "answer" a partir do "revealAnswer" do "quiz".

6) "text" - slide de conteúdo, sem interação. Use para abertura, explicações e
   transições entre perguntas.
   Campos adicionais:
   - "content": texto exibido. Use "\\n" para quebrar linha.
   - "align": "left", "center" ou "right".
   - "fontSize": número inteiro de 8 a 200 (tamanho em px). Títulos de seção
     costumam ficar bem entre 48 e 72; parágrafos entre 28 e 40.

   {
     "id": "s5",
     "type": "text",
     "title": "Boas-vindas",
     "content": "Vamos falar sobre dados\\ne como interpretá-los",
     "align": "center",
     "fontSize": 56
   }

7) "free" - slide livre, sem interação. É uma tela em branco onde cada texto
   fica numa caixa com posição, tamanho e formatação próprios. Use só quando
   precisar de um layout especial (duas colunas, destaques coloridos); para
   texto corrido, prefira "text".
   Campos adicionais:
   - "width" e "height": tamanho da tela em pixels. Use 1920 e 1080 (formato
     16:9, o padrão) ou 1440 e 1080 se "settings.slideAspect" for "4:3".
   - "background": cor de fundo em "#rrggbb".
   - "elements": lista de caixas de texto, desenhadas na ordem (a última fica
     por cima). Cada caixa tem:
     - "id": texto único dentro do slide; "kind": "text";
     - "x", "y", "width", "height": posição do canto superior esquerdo e
       tamanho, em pixels da tela acima (números, podem ter decimais);
     - "style": formatação padrão da caixa, com qualquer uma das chaves
       "fontFamily" (ex.: "Arial", "Georgia"), "fontSize" (px), "color"
       ("#rrggbb"), "bold", "italic", "underline", "strike" (booleanos) e
       "highlight" (cor de realce "#rrggbb");
     - "paragraphs": lista de parágrafos, cada um com "runs" (lista de trechos
       { "text": "...", "style": { ...opcional, só o que muda... } }) e,
       opcionalmente, "align" ("left", "center", "right" ou "justify") e
       "bullet" ({ "kind": "char", "char": "•" } para marcadores);
     - opcionais: "verticalAlign" ("top", "middle" ou "bottom") e
       "background" (cor de fundo da caixa).
   NÃO gere imagens ("kind": "image") nem os campos "assets" e "fonts": eles
   dependem de arquivos que a IA não consegue embutir. O apresentador pode
   incluir imagens depois no editor.

   {
     "id": "s6",
     "type": "free",
     "title": "Dois lados",
     "width": 1920,
     "height": 1080,
     "background": "#0f172a",
     "elements": [
       {
         "id": "e1",
         "kind": "text",
         "x": 160, "y": 120, "width": 1600, "height": 180,
         "style": { "fontFamily": "Arial", "fontSize": 96, "color": "#ffffff", "bold": true },
         "paragraphs": [{ "runs": [{ "text": "Dados contam histórias" }], "align": "center" }]
       },
       {
         "id": "e2",
         "kind": "text",
         "x": 160, "y": 400, "width": 1600, "height": 500,
         "style": { "fontFamily": "Arial", "fontSize": 48, "color": "#e2e8f0" },
         "verticalAlign": "top",
         "paragraphs": [
           { "runs": [{ "text": "Números " }, { "text": "sem contexto", "style": { "color": "#facc15", "bold": true } }, { "text": " confundem" }], "bullet": { "kind": "char", "char": "•" } },
           { "runs": [{ "text": "Gráficos certos esclarecem" }], "bullet": { "kind": "char", "char": "•" } }
         ]
       }
     ]
   }

OPÇÕES GLOBAIS ("settings")

Todas opcionais; inclua apenas as que quiser mudar.
- "allowChangeAnswer": booleano. true (padrão) deixa o participante apagar a
  resposta e escolher outra.
- "askName": booleano. true pede o nome antes de entrar na sala.
- "identifyResponses": booleano. true mostra "Nome: resposta" nos slides e no
  PDF. Só funciona com "askName": true.
- "titleFontSize", "labelFontSize", "bodyFontSize": inteiros de 10 a 200 (px),
  para título, rótulos e corpo dos slides.
- "quizTimerSeconds": inteiro de 0 a 300. Segundos do cronômetro dos slides
  "quiz" (padrão 20). Ao acabar o tempo, as respostas são encerradas e a
  apresentação passa sozinha para o slide de resposta. Use 0 para deixar as
  perguntas sem cronômetro.
- "slideAspect": "16:9" (padrão) ou "4:3". Formato dos slides: define o
  tamanho dos slides "free" e a prévia no editor. Vale para a apresentação
  inteira (não use em "overrides").
- "allowDownload": booleano. true deixa os participantes baixarem os slides
  (PDF e PowerPoint) quando a apresentação termina. Padrão false. Vale para a
  apresentação inteira (não use em "overrides").

  "settings": {
    "allowChangeAnswer": true,
    "askName": false,
    "identifyResponses": false,
    "titleFontSize": 36,
    "labelFontSize": 16,
    "bodyFontSize": 24,
    "quizTimerSeconds": 20,
    "slideAspect": "16:9",
    "allowDownload": false
  }

REGRAS

- Use exatamente esses nomes de campo e esses valores permitidos. Qualquer campo
  extra ou faltando faz a importação falhar.
- Números devem ser números JSON (sem aspas) e inteiros, exceto as posições e
  os tamanhos dos elementos de "free", que aceitam decimais.
- Cores sempre no formato "#rrggbb".
- "allowMultiple", "revealAnswer" e "showResponses" devem ser booleanos
  (true/false, sem aspas).
- Todos os "id" de slides são diferentes entre si.
- Escreva todo o conteúdo em português do Brasil.
- Enunciados curtos e diretos; opções com no máximo 4 palavras.
- Intercale slides de texto e slides interativos para manter o ritmo.

EXEMPLO COMPLETO VÁLIDO

{
  "title": "Introdução à Análise de Dados",
  "settings": {
    "titleFontSize": 40,
    "bodyFontSize": 26,
    "quizTimerSeconds": 20
  },
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
      "type": "quiz",
      "title": "O que é uma mediana?",
      "allowMultiple": false,
      "correctOptionIds": ["s4o2"],
      "revealAnswer": true,
      "showResponses": false,
      "options": [
        { "id": "s4o1", "label": "A média dos valores" },
        { "id": "s4o2", "label": "O valor central" },
        { "id": "s4o3", "label": "O valor mais frequente" }
      ]
    },
    {
      "id": "s5",
      "type": "bar",
      "title": "Quais ferramentas você já usou?",
      "allowMultiple": true,
      "options": [
        { "id": "s5o1", "label": "Excel" },
        { "id": "s5o2", "label": "Power BI" },
        { "id": "s5o3", "label": "Python" },
        { "id": "s5o4", "label": "SQL" }
      ]
    },
    {
      "id": "s6",
      "type": "text",
      "title": "Encerramento",
      "content": "Obrigado pela participação",
      "align": "center",
      "fontSize": 48
    }
  ]
}
`
