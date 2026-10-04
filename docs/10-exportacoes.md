# 10 — Exportações e integrações

## Importar

O botão **Importar** do editor abre um modal com duas opções, e as duas aceitam
o arquivo escolhido ou arrastado:

| Opção | O que faz |
| --- | --- |
| **Apresentação (.json)** | Lê um JSON exportado daqui ou gerado pelo prompt de IA e **substitui** todo o conteúdo do editor |
| **PowerPoint (.pptx)** | Converte cada slide visível num slide livre e o **adiciona ao fim** ou **substitui tudo**, conforme a escolha |

O passo a passo do PowerPoint e os avisos que ele pode mostrar estão em
[09](09-fluxos-de-uso.md#importar-um-powerpoint); o que cada objeto do arquivo
vira está em [05](05-tipos-de-slide.md#o-que-vem-de-um-powerpoint).

### Como o PowerPoint é lido

[`src/utils/pptx/`](../src/utils/pptx/index.ts), carregado só quando alguém
importa um PowerPoint (`import()` dinâmico), lê o arquivo inteiro no
navegador:

- **Pacote.** O `.pptx` é um zip de XMLs; o `fflate` o descompacta e
  [`package.ts`](../src/utils/pptx/package.ts) resolve as relações entre slide,
  layout, mestre, tema e mídias.
- **Herança.** Posição, tamanho e estilos de texto de um espaço reservado vêm
  do slide, do layout e do mestre, nessa ordem, mais os estilos padrão da
  apresentação e as referências de fonte e de estilo do tema.
- **Cores.** Cores do tema passam pelo mapa de cores do mestre e pelos
  modificadores (luminosidade, tom, transparência...).
- **Formas.** As formas pré-definidas são calculadas a partir das definições
  oficiais (pacote `modern-openxml`), com as fórmulas avaliadas para o tamanho
  e os ajustes de cada forma; formas livres usam o próprio caminho do arquivo.
  Preenchimento sólido, gradiente, imagem, ladrilho e padrão, contorno com
  tracejado e pontas, e sombra externa são desenhados em canvas.
- **Tabelas, gráficos e SmartArt** são desenhados em canvas: tabelas com o
  estilo do arquivo (ou uma aproximação do estilo padrão), gráficos a partir
  dos dados salvos no arquivo (barras, colunas, linhas, áreas, dispersão, pizza
  e rosca) e SmartArt a partir do desenho que o PowerPoint salva junto.
- **Imagens** passam por recorte, máscara da forma e conversão de SVG antes de
  serem comprimidas.
- **Fontes embutidas** ([`fonts.ts`](../src/utils/pptx/fonts.ts)) são lidas
  antes dos slides, para tabelas, gráficos e SmartArt já saírem com elas. Ver
  abaixo.

Os itens que viram imagem e estão vizinhos na ordem de desenho são desenhados
juntos numa imagem só, do tamanho da área que ocupam. Assim um slide com
dezenas de formas decorativas fica com poucas camadas, e o texto continua
editável por cima.

### Fontes embutidas

O PowerPoint guarda cada estilo de uma fonte embutida (normal, negrito,
itálico, negrito itálico) num `ppt/fonts/*.fntdata`, listado em
`p:embeddedFontLst` com o nome que os textos usam. O arquivo é um **Embedded
OpenType (EOT)**: um cabeçalho com nomes e métricas e, no fim, a fonte, que
pode vir "cifrada" com XOR e quase sempre vem comprimida em **MicroType
Express (MTX)**. A conversão é toda feita no navegador, em
[`src/utils/fonts/`](../src/utils/fonts/eot.ts):

| Etapa | Arquivo | O que faz |
| --- | --- | --- |
| EOT | `eot.ts` | Lê o cabeçalho, desfaz o XOR e entrega a fonte (ou o MTX) |
| LZCOMP | `lzcomp.ts` | Descomprime os três blocos do MTX (LZ77 com três árvores de Huffman adaptativas) |
| CTF | `mtx.ts` | Reconstrói o TrueType: glifos (coordenadas em "tripletos"), instruções de hinting (os valores empilhados vêm num bloco à parte), `loca`, `cvt` |
| WOFF | `woff.ts` | Comprime cada tabela com zlib para guardar (cerca de metade do tamanho) |
| Registro | `faces.ts` | Confere com o `FontFace` do navegador e registra com o nome da família |

O decodificador foi escrito a partir da especificação do formato (submissão
W3C "MicroType Express Font Format") e conferido contra outras duas
implementações: fontes comprimidas pelo sfntly (Google) e descomprimidas pelo
libeot deram os mesmos glifos e as mesmas tabelas de hinting. As tabelas `hdmx`
e `VDMX` (larguras pré-calculadas por tamanho de pixel) ficam de fora: são
opcionais e os navegadores não precisam delas. Fontes já em TrueType,
OpenType ou WOFF dentro do `.fntdata` também são aceitas.

## Exportar

O botão **Exportar** abre um modal com duas opções:

| Opção | O que faz |
| --- | --- |
| **Apresentação (.json)** | Baixa o arquivo completo da plataforma, com imagens e fontes, para importar de volta: as perguntas continuam interativas |
| **PowerPoint (.pptx)** | Gera um arquivo para o PowerPoint, Google Slides ou Keynote, com textos e imagens editáveis e as fontes embutidas |

### Exportar PowerPoint

[`src/utils/pptxExport/`](../src/utils/pptxExport/index.ts), carregado só
quando alguém exporta (`import()` dinâmico), monta o `.pptx` no navegador: um
tema, um mestre e um layout em branco, e um slide por slide da apresentação,
no formato dela (16:9 ou 4:3).

| Na plataforma | No PowerPoint |
| --- | --- |
| Caixa de texto do slide livre | Caixa de texto editável: trechos com fonte, tamanho, cor, realce, negrito, itálico, sublinhado e tachado; parágrafos com alinhamento, marcadores (caractere ou numeração automática), recuos, espaçamentos e altura da linha; margem interna, fundo, posição vertical, rotação e transparência |
| Imagem do slide livre | Imagem, com "preencher" virando recorte, "conter" ajustando a moldura, cantos arredondados e transparência; WebP vira PNG |
| Cor de fundo do slide livre | Fundo do slide |
| Texto simples | Título e o texto, com o alinhamento e o tamanho do slide, no tema da página |
| Alternativas, barras e pizza | Título, as alternativas em cartões (com letras nas alternativas) e a instrução "Responda pelo celular", no tema da página |
| Resposta correta | Título e as alternativas, com a correta destacada em verde, no tema da página |
| Nuvem de palavras | Título e a instrução para enviar a resposta pelo celular, no tema da página |

**Tema.** Os slides comuns (perguntas, gabarito, nuvem, barras, pizza e texto
simples) saem com as cores do tema escolhido na página no momento da
exportação, claro ou escuro, as mesmas da tela do projetor: fundo, texto,
cartões e destaque do gabarito. Os slides livres mantêm as próprias cores.

As unidades são o inverso das do importador: 1 px da moldura vale 6350 EMU
(0,5 pt), e a altura de linha "simples" do PowerPoint (100%) equivale a 1,2
vez a fonte. Assim, um PowerPoint importado e exportado de novo mantém
posições, tamanhos e espaçamentos.

As perguntas saem **sem resultados** (a exportação é feita no editor) e com
tamanhos mínimos de letra, porque os padrões da plataforma foram pensados para
a tela do projetor e ficariam pequenos num arquivo de PowerPoint.

**Fontes.** As fontes embutidas que algum texto usa vão junto, cada estilo
num `.fntdata` em EOT sem compressão (a mesma estrutura que o PowerPoint lê),
listadas em `p:embeddedFontLst`. O PowerPoint só embute fontes TrueType:
uma fonte OpenType com contornos CFF fica de fora, com aviso.

O arquivo gerado foi conferido contra os esquemas XML oficiais do formato
(ECMA-376, Transitional), aberto no python-pptx e no LibreOffice, e importado
de volta na própria plataforma com textos, imagens e fontes.

## Exportar / importar JSON

[`src/utils/importExport.ts`](../src/utils/importExport.ts) ·
[`src/utils/validation.ts`](../src/utils/validation.ts)

- **Exportar JSON** serializa o `Presentation` inteiro (título, slides, opções
  globais e as imagens e fontes usadas pelos slides livres, em `assets` e
  `fonts`) e baixa um arquivo com nome derivado do título (sem acentos nem
  símbolos). Com imagens e fontes, o arquivo pode passar de alguns megabytes.
- **Importar JSON** lê o arquivo, valida com Zod e carrega no editor. Erros são
  mostrados no formato `caminho: mensagem`, apontando o campo problemático.

O formato e as garantias de compatibilidade estão em
[04 — Modelo de dados](04-modelo-de-dados.md#formato-json-importexport).

> A importação **substitui** o conteúdo do editor. Exporte antes se não quiser
> perder o que estava montado.

## Exportar PDF dos resultados

[`src/utils/exportPdf.ts`](../src/utils/exportPdf.ts)

Relatório vetorial gerado no próprio navegador. A jsPDF é importada
dinamicamente, então só é baixada quando alguém exporta.

Estrutura:

1. **Capa** — faixa azul, título, data/hora, número de slides e quantos
   participantes responderam.
2. **Uma página por slide** (com quebra automática quando não cabe):
   - `bar`/`pie`: barra horizontal por opção, com votos e porcentagem;
   - `quiz`: o mesmo, com a alternativa correta em **verde** e marcada como
     `[correta]`;
   - `wordcloud`: os textos enviados, com tamanho proporcional à frequência;
   - `text`: o conteúdo, respeitando o alinhamento;
   - `free`: o slide inteiro como imagem JPEG, desenhado em canvas
     ([`freeSlideRaster.ts`](../src/utils/freeSlideRaster.ts), com o texto
     rico de [`canvasText.ts`](../src/utils/canvasText.ts)), na largura da
     página;
   - `answer`: **não vira página** — a página da pergunta já traz o gabarito.
3. **Uma página de tabela logo depois de cada slide interativo que recebeu
   respostas**, com o que cada pessoa respondeu:

   | Participante | Resposta | Resultado |
   | --- | --- | --- |
   | Ana Paula | Lista | Correta |
   | Bruno | Conjunto | Incorreta |

   - A coluna **Resultado** só aparece em perguntas (`quiz`) com gabarito.
   - Com nomes coletados, as linhas vêm em **ordem alfabética**; sem nomes, a
     tabela cai para **“Participante N”**, numerado pela ordem de chegada das
     respostas — assim a página continua útil sem inventar uma identidade que
     ninguém informou.
   - Tabelas longas quebram em várias páginas, **repetindo o cabeçalho**.
4. **Rodapé** com a mesma contagem da tela na página do slide (“N responderam”,
   e o total de envios só quando ele pode ser diferente — ver
   [04](04-modelo-de-dados.md#números-derivados)), e com o total de
   participantes na página da tabela.

> A tabela sai no relatório mesmo com a identificação desligada nas opções.
> Essa opção controla o que aparece **no projetor**, à vista da plateia; o PDF é
> o material do apresentador.

Quando é gerado:

- pelo botão **Baixar resultados (PDF)**, no centro do slide final;
- pelo botão **Exportar PDF** no cabeçalho do apresentador;
- pela tela inicial, em qualquer sala apresentada naquele dispositivo.

O PDF não baixa sozinho ao chegar no slide final: só quando o apresentador
pede. Nos três casos, as imagens dos slides livres são lidas da sala antes de gerar
o relatório; uma imagem que falhar fica de fora do desenho, sem impedir o PDF.

## Prompt de IA

[`src/utils/aiPrompt.ts`](../src/utils/aiPrompt.ts) ·
[`AiPromptButton`](../src/components/editor/AiPromptButton.tsx)

Texto pronto que descreve **todo o formato JSON aceito** — campos comuns, os
tipos de slide, as opções globais (inclusive o formato 16:9 ou 4:3), as
sobrescritas por slide, as regras de preenchimento e um exemplo completo
válido. O fluxo é: copiar, colar no assistente, trocar o tema, salvar a
resposta como `.json` e usar **Importar**, opção "Apresentação (.json)".

O slide livre também está descrito, mas só com caixas de texto: uma imagem
precisa vir embutida em `assets`, e a IA não tem como gerar esse conteúdo. As
imagens podem ser incluídas depois, no editor.

O prompt instrui explicitamente a IA a **não** gerar slides `answer`: eles são
criados pela plataforma a partir do `revealAnswer` do `quiz`.

> Ao mexer em `utils/validation.ts`, atualize este prompt — ele é a
> documentação que a IA lê.

## Encurtador do link da sala

[`src/lib/shortUrl.ts`](../src/lib/shortUrl.ts) ·
[`ShareRoom`](../src/components/present/ShareRoom.tsx)

O modal do QR mostra o link curto **em texto grande**, para quem prefere digitar
a apertar a câmera.

Como funciona:

1. Ao abrir o modal, a aplicação encurta o link de entrada da sala.
2. O resultado vai para o `localStorage`, indexado pela URL longa: reabrir o
   modal não cria um link novo.
3. O texto exibido perde o `https://` e o `www.` (fica, por exemplo,
   `tinyurl.com/2xoh2ngp`).
4. Se falhar, o modal mostra o link completo e um botão **“Tentar de novo”**.

### Decisões

- **O QR sempre codifica a URL completa.** Se o encurtador sair do ar, a câmera
  continua funcionando; o link curto é uma conveniência, não uma dependência.
- **Serviço: TinyURL.** Sendo um site estático, a chamada sai do navegador e o
  serviço precisa responder com CORS liberado. Entre os encurtadores públicos
  testados (**is.gd, cleanuri, spoo.me, ulvis**), só o TinyURL envia
  `Access-Control-Allow-Origin` — os demais são bloqueados pelo navegador. O
  redirecionamento do TinyURL **preserva o fragmento** `#/room/<código>`, que o
  `HashRouter` exige.
- **Só sob demanda.** A URL da sala só é enviada ao serviço externo quando o
  apresentador abre o QR — não em toda visita à página.
- **Em `localhost` o encurtamento falha** (o serviço recusa endereços locais).
  É esperado em desenvolvimento: a interface cai no link completo.
