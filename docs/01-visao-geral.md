# 01 — Visão geral

## O que é

Aplicação web de **apresentações interativas em tempo real**. O apresentador
monta uma sequência de slides no navegador, inicia a apresentação e recebe um
**código de 6 caracteres** (e um QR Code). A plateia abre o link no celular,
digita o código e responde ao que está na tela; os resultados aparecem ao vivo
no projetor.

Duas características definem o projeto:

- **Sem servidor próprio.** O frontend é 100% estático, publicado no GitHub
  Pages e no Firebase Hosting. Tempo real e persistência vêm do **Firebase (Cloud Firestore +
  Autenticação Anônima)**.
- **Sem cadastro.** Ninguém cria conta. Cada dispositivo recebe um uid anônimo
  do Firebase; o controle da apresentação é provado por um **token secreto na
  URL** do apresentador.

## Para quem

| Papel | Como entra | O que pode fazer |
| --- | --- | --- |
| **Apresentador** | Cria a sala em `/create` e vai para `/present/<código>/<token>` | Monta slides, controla a navegação, edita a sala em andamento, vê os resultados, exporta PDF |
| **Participante** | Abre `/room/<código>` (link, QR ou digitando o código) | Responde ao slide atual; a tela acompanha o apresentador |

Não há administrador, moderador nem limite de participantes por sala.

## Vocabulário do domínio

| Termo | Significado |
| --- | --- |
| **Apresentação** (`Presentation`) | Título + lista de slides + opções globais. É o que se exporta/importa em JSON. |
| **Sala** (`Room`) | Uma apresentação publicada no Firestore, com código, dono, slide atual e status. |
| **Código da sala** | 6 caracteres de um alfabeto sem `O/0` e `I/1`, para ser digitado sem ambiguidade. |
| **Token do apresentador** | Segredo de 24 caracteres na URL de apresentação. Quem o tem controla a sala. |
| **Slide** | Uma tela da apresentação. Sete tipos, ver [05](05-tipos-de-slide.md). |
| **Slide livre** | Slide só de exibição montado com caixas de texto e imagens soltas, cada uma com posição, tamanho e formatação próprios. É o que um PowerPoint importado vira. |
| **Formato dos slides** | Proporção 16:9 (padrão) ou 4:3. Define a moldura dos slides livres e a prévia do editor, e vale para a apresentação inteira. |
| **Imagem da apresentação** (`PresentationAsset`) | Imagem usada por um slide livre, guardada como data URL comprimido e identificada pelo conteúdo. |
| **Fonte embutida** (`PresentationFont`) | Fonte que veio dentro de um PowerPoint, guardada com a apresentação para o texto aparecer igual em qualquer aparelho. |
| **Resposta** (`ResponseDoc`) | O que um participante enviou num slide. Um documento por participante **por slide**. |
| **Participante** (`ParticipantDoc`) | Registro de presença: existe assim que a pessoa abre a sala, mesmo sem responder. |
| **Gabarito** | Slide `answer`, gerado automaticamente, que revela a alternativa correta de um `quiz`. |

## O que a aplicação faz

- **Editor de slides** com prévia ao vivo e três colunas independentes
  (adicionar/listar, configurar, pré-visualizar), ocupando a tela inteira. A
  prévia mostra o slide na proporção escolhida (16:9 ou 4:3).
- **Sete tipos de slide**: nuvem de palavras, gráfico de barras, gráfico de
  pizza, alternativas sem gráfico (pergunta e resposta), slide de gabarito
  automático, texto simples e slide livre.
- **Slide livre**: textos com fonte, tamanho, cor, realce, negrito, itálico,
  sublinhado, tachado, alinhamento e marcadores por trecho; imagens soltas;
  tudo arrastável, redimensionável e girável sobre a prévia, com guias de
  alinhamento, camadas e um editor ampliado.
- **Importar PowerPoint (.pptx)**: cada slide vira um slide livre. Textos
  continuam editáveis, fotos continuam imagens, e formas, fundos, SVG,
  tabelas, gráficos e SmartArt viram imagem. As fontes embutidas no arquivo
  são aproveitadas (inclusive as comprimidas pelo PowerPoint) e passam a valer
  no editor, no projetor, no celular e no PDF.
- **Exportar PowerPoint (.pptx)**: a apresentação vira um arquivo para abrir
  no PowerPoint, Google Slides ou Keynote, com textos e imagens editáveis e as
  fontes embutidas; as perguntas viram slides estáticos com as alternativas,
  no tema da página (claro ou escuro).
- **Opções globais e por slide**: troca de resposta, pedido de nome,
  identificação das respostas, tamanhos de fonte (título, rótulos, corpo) e o
  tempo do cronômetro das perguntas. O pedido de nome e o formato dos slides
  (16:9 ou 4:3) são só globais.
- **Cronômetro nas perguntas**: contagem regressiva grande na tela; ao zerar,
  as respostas são encerradas e o gabarito entra sozinho, depois de três
  segundos de "A resposta certa é…".
- **Tempo real**: cada mudança de slide e cada resposta aparecem
  instantaneamente para todos, via assinaturas do Firestore.
- **Contagem separada** de *participantes conectados* e de *quem já respondeu*.
- **Compartilhamento**: código grande, QR Code ampliado e **link curto** para
  quem prefere digitar.
- **Edição da sala em andamento**: o apresentador reabre o editor com o que
  está no ar (opções gerais, slides e opções de cada slide). Ao salvar, depois
  de uma confirmação, a apresentação recomeça do primeiro slide para todos os
  participantes conectados e para ele mesmo.
- **Componentes de formulário próprios** (caixa de seleção, opção única,
  controle deslizante, lista suspensa, área com rolagem, janelas modais,
  seletor de cor, controle segmentado e botão de alternância), com a mesma
  identidade visual nos temas claro e escuro.
- **Importar** e **exportar** a apresentação em JSON (com as imagens e as
  fontes embutidas) ou PowerPoint, e **exportar PDF** dos resultados.
- **Prompt de IA** pronto para gerar o JSON de uma apresentação inteira.
- **Tema claro/escuro** por usuário, salvo no navegador.
- **Retomada da sala**: o dispositivo lembra as salas apresentadas e oferece
  “Retomar” ou “Exportar PDF” na tela inicial.

## O que a aplicação não faz

- Não tem contas, login por e-mail nem perfis persistentes.
- Não modera nem filtra o conteúdo enviado pelos participantes.
- Não impede que alguém com o código entre na sala (o código **é** a chave de
  acesso da plateia).
- Não sincroniza o tema entre apresentador e plateia — é preferência de cada um.
- Não encerra salas automaticamente nem expira dados (a limpeza é manual, pelo
  console do Firebase).
