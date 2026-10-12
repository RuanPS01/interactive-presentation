# Apresentações Interativas: especificação técnica completa

Documento único que consolida tudo o que existe sobre o projeto
**Apresentação Interativa** (repositório `interactive-presentation`): os onze
documentos da pasta `docs/`, o `README.md` da raiz e os detalhes de
implementação lidos diretamente do código-fonte. O objetivo é permitir
**recriar a aplicação do zero** ou **embuti-la como uma funcionalidade de
Apresentações Interativas dentro de um projeto maior**, sem precisar consultar
o repositório original.

## Como usar este documento

| Se você quer... | Leia |
| --- | --- |
| Entender o produto e o escopo | Seções 1, 2 e 3 |
| Conhecer a arquitetura, as bibliotecas e o build | Seção 4 |
| Reproduzir os tipos, as coleções e o formato JSON | Seção 5 e Apêndices A e B |
| Saber como cada opção e cada tipo de slide se comporta, com exemplos de execução | Seções 6 e 7 |
| Entender como o sincronismo em tempo real permite que a plateia interaja com a apresentação | Seção 8.0 |
| Implementar o tempo real (sala, respostas, presença, cronômetro, gabarito, encerramento) | Seção 8 e Apêndice C |
| Proteger o gabarito até a revelação | Seção 8.16 |
| Recriar o estado, as telas e os componentes | Seções 9 e 10 |
| Implementar importação e exportação (JSON, PowerPoint, PDF, download dos slides, modo leitura, prompt de IA, link curto) | Seção 11 |
| Ver uma sessão completa acontecendo, passo a passo | Seção 12 |
| Copiar os algoritmos centrais | Seção 13 |
| Configurar Firebase, build e deploy | Seção 14 |
| Embutir a funcionalidade num sistema maior | Seções 15 e 16 |

Convenções:

- Caminhos de arquivo são relativos a `src/`, exceto quando indicado (arquivos
  da raiz como `vite.config.ts` e `firestore.rules`).
- "Projetor" é a tela do apresentador (`/present/...`); "celular" é a tela do
  participante (`/room/...`).
- "Moldura" é o tamanho lógico de um slide (1920 x 1080 no 16:9, 1440 x 1080
  no 4:3).
- Valores numéricos citados são os do código atual. Versões de bibliotecas são
  as resolvidas no `package-lock.json`.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Requisitos](#2-requisitos)
3. [Vocabulário do domínio](#3-vocabulário-do-domínio)
4. [Arquitetura, bibliotecas e build](#4-arquitetura-bibliotecas-e-build)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Configurações globais e por slide](#6-configurações-globais-e-por-slide)
7. [Tipos de slide, com exemplos de execução](#7-tipos-de-slide-com-exemplos-de-execução)
8. [Tempo real e comunicação](#8-tempo-real-e-comunicação)
   - [8.0 Como o sincronismo em tempo real funciona](#80-como-o-sincronismo-em-tempo-real-funciona)
   - [8.15 Encerramento da sala](#815-encerramento-da-sala)
   - [8.16 Gabarito protegido](#816-gabarito-protegido-libanswersts-hooksuseroomanswersts)
9. [Estado, páginas, componentes e hooks](#9-estado-páginas-componentes-e-hooks)
10. [Slide livre em profundidade](#10-slide-livre-em-profundidade)
11. [Importação, exportação e integrações](#11-importação-exportação-e-integrações)
   - [11.8 Código da sala e link curto](#118-código-da-sala-e-link-curto-roomcodedialog-libshorturlts)
   - [11.9 Baixar os slides no fim](#119-baixar-os-slides-no-fim-useslidedownload-exportslidespdf-tostaticslides)
   - [11.10 Modo leitura](#1110-modo-leitura-pagesviewpagetsx)
12. [Exemplos de execução de ponta a ponta](#12-exemplos-de-execução-de-ponta-a-ponta)
13. [Algoritmos centrais](#13-algoritmos-centrais)
14. [Desenvolvimento, configuração e deploy](#14-desenvolvimento-configuração-e-deploy)
15. [Guia para embutir em um projeto maior](#15-guia-para-embutir-em-um-projeto-maior)
16. [Roteiro de replicação e checklist](#16-roteiro-de-replicação-e-checklist)
17. [Observações sobre o código atual](#17-observações-sobre-o-código-atual)
- [Apêndice A: tipos TypeScript completos](#apêndice-a-tipos-typescript-completos)
- [Apêndice B: schema Zod do JSON](#apêndice-b-schema-zod-do-json)
- [Apêndice C: regras de segurança do Firestore](#apêndice-c-regras-de-segurança-do-firestore)
- [Apêndice D: arquivos de configuração](#apêndice-d-arquivos-de-configuração)
- [Apêndice E: texto do prompt de IA](#apêndice-e-texto-do-prompt-de-ia)

---

## 1. Visão geral

### 1.1 O que é

Aplicação web de **apresentações interativas em tempo real**, no estilo do
Mentimeter. O apresentador monta uma sequência de slides no navegador, inicia
a apresentação e recebe um **código de 6 caracteres** (e um QR Code). A
plateia abre o link no celular, digita o código e responde ao que está na
tela; os resultados aparecem ao vivo no projetor.

Duas características definem o projeto:

- **Sem servidor próprio.** O frontend é 100% estático (publicado no GitHub
  Pages e no Firebase Hosting). Tempo real e persistência vêm do **Firebase**
  (Cloud Firestore + Autenticação Anônima). Não existe API da aplicação: todos
  os navegadores conversam através de documentos do Firestore. O
  apresentador grava o estado da sala, cada aluno grava as próprias
  respostas, e todos ficam ouvindo (`onSnapshot`) os documentos de que
  precisam; o Firestore empurra cada mudança em milissegundos. O
  funcionamento completo está na seção 8.0.
- **Sem cadastro.** Ninguém cria conta. Cada dispositivo recebe um `uid`
  anônimo do Firebase; o controle da apresentação é provado por um **token
  secreto na URL** do apresentador.

### 1.2 Papéis

| Papel | Como entra | O que pode fazer |
| --- | --- | --- |
| **Apresentador** | Cria a sala em `/create` e vai para `/present/<código>/<token>` | Monta slides, controla a navegação, mostra e projeta o código da sala, edita a sala em andamento, encerra a apresentação, vê os resultados, exporta PDF, JSON e PowerPoint |
| **Participante** | Abre `/room/<código>` (link, QR ou digitando o código em `/join`) | Responde ao slide atual; a tela acompanha o apresentador; no fim, revê os slides e, se permitido, baixa os slides |
| **Leitor** | Abre `/view` (um `.json`) ou `/view/<código>` (sala encerrada) | Lê os slides sem interação |

Não há administrador, moderador nem limite de participantes por sala.

### 1.3 O que a aplicação faz

- **Editor de slides** ocupando a tela inteira, com prévia na proporção
  escolhida (16:9 ou 4:3): três colunas independentes (listar, configurar,
  pré-visualizar) a partir de 1024 px e seções recolhíveis empilhadas abaixo
  disso, sem rolagem horizontal até 360 px.
- **Montagem dos slides**: "Adicionar slide" abre um menu com os tipos e uma
  dica de cada; a ordem muda arrastando (framer-motion; no toque, pela alça)
  ou pelo menu de cada slide. A barra do editor mostra as ações como botões a
  partir de 1280 px e num menu "Mais" abaixo disso.
- **Rascunho no navegador**: a apresentação em montagem (com imagens e
  fontes) sobrevive a um recarregamento; "Começar do zero" descarta.
- **Sete tipos de slide**: nuvem de palavras, gráfico de barras, gráfico de
  pizza, alternativas sem gráfico (pergunta e resposta), gabarito automático,
  texto simples e slide livre.
- **Slide livre**: caixas de texto rico (fonte, tamanho, cor, realce, negrito,
  itálico, sublinhado, tachado, alinhamento, marcadores por trecho) e imagens
  soltas; tudo arrastável, redimensionável e girável sobre a prévia, com guias
  de alinhamento, camadas e editor ampliado.
- **Importar PowerPoint (.pptx)**: cada slide vira um slide livre. Textos
  continuam editáveis, fotos continuam imagens, formas, fundos, SVG, tabelas,
  gráficos e SmartArt viram imagem. Fontes embutidas no arquivo (inclusive
  comprimidas em MicroType Express) são aproveitadas em todas as telas e no
  PDF. Tudo é lido no navegador.
- **Exportar PowerPoint (.pptx)** com textos e imagens editáveis e fontes
  embutidas; perguntas viram slides estáticos no tema da página.
- **Opções globais e por slide**: troca de resposta, pedido de nome,
  identificação das respostas, tamanhos de fonte (título, rótulos, corpo),
  tempo do cronômetro e download dos slides no fim. O formato dos slides, o
  pedido de nome e o download são só globais.
- **Cronômetro nas perguntas**: contagem grande no projetor; ao zerar, as
  respostas são encerradas e o gabarito entra sozinho depois de três segundos
  de "A resposta certa é…". O gabarito fica fora do documento público da
  sala até a revelação.
- **Tempo real**: cada mudança de slide e cada resposta aparecem
  instantaneamente para todos, via assinaturas do Firestore.
- **Contagem separada** de participantes conectados e de quem já respondeu.
- **Compartilhamento**: o código no cabeçalho do projetor abre o modal
  "Código da sala" (código, QR Code e link curto do da.gd), com projeção em
  tela cheia e QR ampliável.
- **Encerramento**: passar do último slide (ou "Encerrar") encerra a sala;
  "Apresentar de novo" abre uma sala nova com o mesmo conteúdo.
- **Edição da sala em andamento**, com confirmação e reinício do primeiro slide
  para todos.
- **Componentes de formulário próprios** com a mesma identidade visual nos
  temas claro e escuro.
- **Importar e exportar** em JSON (com imagens e fontes) ou PowerPoint;
  **exportar PDF** dos resultados.
- **Baixar os slides no fim** (PDF e PowerPoint, sem a resposta de ninguém),
  quando o apresentador permite.
- **Modo leitura**: `/view` para um `.json` e `/view/<código>` para uma sala
  encerrada, rolando ou um slide por vez.
- **Prompt de IA** pronto para gerar o JSON de uma apresentação inteira.
- **Tema claro/escuro** por usuário, salvo no navegador.
- **Retomada da sala**: o dispositivo lembra as salas apresentadas; a tela
  inicial mostra a situação de cada uma ("No ar", "Encerrada", "Não existe
  mais"), com "Retomar" para as que estão no ar e "Exportar PDF".

### 1.4 O que a aplicação não faz

- Não tem contas, login por e-mail nem perfis persistentes.
- Não modera nem filtra o conteúdo enviado pelos participantes.
- Não impede que alguém com o código entre na sala (o código **é** a chave de
  acesso da plateia).
- Não sincroniza o tema entre apresentador e plateia (é preferência de cada
  um).
- Não reabre uma sala encerrada (apresentar de novo cria outra) nem expira
  dados (a limpeza é manual, pelo console do Firebase).
- Não reproduz vídeo ou áudio, nem animações e transições do PowerPoint.

---

## 2. Requisitos

### 2.1 Requisitos funcionais

| Id | Requisito |
| --- | --- |
| RF01 | Editor de slides em três colunas (listar; configurar; prévia) a partir de 1024 px, e em seções recolhíveis empilhadas abaixo disso, com prévia ao vivo na proporção escolhida. |
| RF02 | Sete tipos de slide: `wordcloud`, `bar`, `pie`, `quiz`, `answer` (gerado automaticamente), `text` e `free`. Seis são criáveis pelo menu "Adicionar slide", que mostra uma dica de cada tipo. |
| RF03 | Opções globais da apresentação e sobrescritas por slide, com resolução determinística do valor efetivo. |
| RF04 | "Iniciar apresentação" cria uma sala com código único de 6 caracteres (sem `O`, `0`, `I`, `1`) e um token secreto de apresentador de 24 caracteres. |
| RF05 | O participante entra sem conta, por QR Code, link completo, link curto ou digitando o código. |
| RF06 | Pedido de nome opcional antes de entrar, lembrado por sala no dispositivo (até 40 caracteres). |
| RF07 | Presença: abrir a sala já registra o participante, mesmo sem responder. |
| RF08 | Respostas em tempo real, no máximo um documento por participante por slide (até 100 itens); reenvio sobrescreve; limpar e trocar conforme a opção; uma resposta esvaziada é apagada. |
| RF09 | Navegação do apresentador por teclado (seta para a direita, PageDown, Espaço avançam; seta para a esquerda e PageUp voltam), passador de slides ou botões; os participantes seguem automaticamente. |
| RF10 | Cronômetro em perguntas `quiz` (padrão 20 s, 0 desliga, até 300 s), por slide, que pausa ao sair, retoma ao voltar, fica congelado depois de zerar; o encerramento é comandado pelo projetor; avanço automático para o gabarito. |
| RF11 | Slide de gabarito automático, com suspense de 3 s ("A resposta certa é…") só na primeira revelação. O gabarito só chega aos celulares quando a revelação termina. |
| RF12 | Rodapé com "N participante(s) · M responderam" e, quando pode diferir, o total de envios. |
| RF13 | Identificação opcional "Nome: resposta" no projetor e no PDF (exige pedir o nome). |
| RF14 | Slide final automático de agradecimento com miniaturas de todos os slides e botão "Baixar resultados (PDF)". Chegar a ele (ou "Encerrar") encerra a sala: sem mudanças e sem respostas depois disso; "Apresentar de novo" abre uma sala nova. |
| RF15 | Relatório PDF gerado no navegador: capa, uma página por slide, tabela de respostas por slide interativo. |
| RF16 | Compartilhamento: modal "Código da sala" com o código, o QR Code, o link curto (da.gd) e botões de copiar; projeção do código em tela cheia, com QR ampliável. |
| RF17 | Retomar a sala no mesmo dispositivo (só as salas no ar, com a situação de cada uma na tela inicial) e reivindicar o controle em outro navegador com o token. |
| RF18 | Editar a sala em andamento; ao salvar (com confirmação), todos voltam ao primeiro slide, cronômetros e gabaritos recomeçam, respostas ficam. |
| RF19 | Importar e exportar a apresentação em JSON validado, com compatibilidade para arquivos antigos. |
| RF20 | Importar PowerPoint (.pptx) como slides livres, "Adicionar ao fim" ou "Substituir tudo", com aproveitamento das fontes embutidas. |
| RF21 | Exportar PowerPoint (.pptx) no formato da apresentação, com fontes embutidas e slides comuns no tema da página. |
| RF22 | Prompt de IA que descreve o JSON aceito, para gerar apresentações. |
| RF23 | Tema claro/escuro por usuário, persistido no navegador e inicializado pelo `prefers-color-scheme`. |
| RF24 | Slide livre com texto rico e imagens: selecionar, mover com guias, redimensionar com 8 alças respeitando a rotação, girar, opacidade, camadas, duplicar, excluir, colar e soltar imagens, editor ampliado. |
| RF25 | Formato dos slides 16:9 (padrão) ou 4:3, com reenquadramento automático dos slides livres. |
| RF26 | Tela cheia e cabeçalho ocultável na tela do apresentador; cabeçalho em uma linha em qualquer largura, com as ações secundárias no menu "Mais ações" abaixo de 1280 px. |
| RF27 | Reordenar slides arrastando (no toque, pela alça) ou pelo menu de cada slide; o gabarito acompanha a pergunta. |
| RF28 | Rascunho da tela de criação guardado no navegador (texto no `localStorage`, imagens e fontes no IndexedDB), com "Começar do zero". |
| RF29 | Opção global para os participantes baixarem os slides (PDF e PowerPoint) no fim, sem respostas. |
| RF30 | Modo leitura em `/view` (arquivo `.json`) e `/view/<código>` (sala encerrada), rolando ou um por vez, com "Mostrar respostas certas". |

### 2.2 Requisitos não funcionais

| Id | Requisito |
| --- | --- |
| RNF01 | Frontend estático, sem servidor de aplicação. Publicação no GitHub Pages (subcaminho) e no Firebase Hosting (raiz). |
| RNF02 | Tempo real nativo no navegador via `onSnapshot` do Firestore. |
| RNF03 | Caber no plano gratuito do Firebase: sem Cloud Storage (exige plano Blaze), sem heartbeat de presença, sem escrita por segundo de cronômetro. |
| RNF04 | Segurança garantida pelas regras do Firestore (campos e tamanhos validados, gabarito legível só pelo dono, sala encerrada imutável); as chaves `VITE_FIREBASE_*` são públicas. |
| RNF05 | Documento da sala sempre abaixo de 1 MiB (limite prático de 1.000.000 bytes do JSON); imagens e fontes ficam em subcoleções. |
| RNF06 | Sem limite de participantes por sala. |
| RNF07 | Código pesado carregado sob demanda: jsPDF, leitor de PowerPoint, gerador de PowerPoint, PDF dos slides e conversores de fonte. |
| RNF08 | Interface e comentários em português do Brasil; acessibilidade (WAI-ARIA no `Select` e no `Menu`, foco preso no `Modal`, `aria-pressed`, `aria-expanded`, `role="timer"`). |
| RNF09 | Funciona sem `.env`: a interface carrega com uma configuração de reserva e só as operações de rede falham. |
| RNF10 | JSON exportado por versões antigas continua importando. |
| RNF11 | Responsivo: nada rola na horizontal em 360 px; cabeçalhos em uma linha; alvos de toque de 44 px; `100dvh`; o editor ocupa a altura da janela a partir de 1024 px e empilha em seções abaixo disso. |
| RNF12 | Respeita `prefers-reduced-motion`. |
| RNF13 | TypeScript estrito e ESLint (regras de hooks e de fast refresh). |
| RNF14 | Slide livre idêntico no projetor, na prévia, no celular, na miniatura e no PDF (moldura lógica escalada por inteiro). |
| RNF15 | Desenvolvimento e teste das regras possíveis com os emuladores do Firebase, sem tocar no projeto real. |

### 2.3 Fora do escopo

Contas e perfis, moderação de conteúdo, expiração automática de salas,
sincronização de tema, reprodução de mídia, animações e transições,
texto vertical e edição colaborativa simultânea do editor.

---

## 3. Vocabulário do domínio

| Termo | Significado |
| --- | --- |
| **Apresentação** (`Presentation`) | Título + lista de slides + opções globais (+ imagens e fontes usadas). É o que se exporta e importa em JSON. |
| **Sala** (`Room`) | Uma apresentação publicada no Firestore, com código, dono, slide atual, status, cronômetros, gabaritos revelados e publicados e revisão. Os quizzes vão sem gabarito. |
| **Sala encerrada** | Sala com `status: 'ended'` (o apresentador passou do último slide ou clicou em "Encerrar"). Não muda mais e não aceita respostas. |
| **Código da sala** | 6 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem `O/0` e `I/1`). É também o id do documento. |
| **Token do apresentador** | Segredo de 24 caracteres (`A-Z`, `a-z`, `0-9`) na URL de apresentação. Quem o tem controla a sala. |
| **Slide** | Uma tela da apresentação. Sete tipos. |
| **Slide livre** | Slide só de exibição com caixas de texto e imagens soltas, cada uma com posição, tamanho e formatação. É o que um PowerPoint importado vira. |
| **Formato dos slides** | 16:9 (padrão) ou 4:3. Define a moldura dos slides livres e a prévia do editor; vale para a apresentação inteira. |
| **Imagem da apresentação** (`PresentationAsset`) | Imagem de um slide livre, guardada como data URL comprimido e identificada pelo hash do conteúdo. |
| **Fonte embutida** (`PresentationFont`) | Fonte que veio dentro de um PowerPoint, guardada em WOFF com a apresentação. |
| **Resposta** (`ResponseDoc`) | O que um participante enviou num slide. Um documento por participante **por slide**. |
| **Participante** (`ParticipantDoc`) | Registro de presença: existe assim que a pessoa abre a sala. |
| **Gabarito** | Slide `answer`, gerado automaticamente, que revela a alternativa correta de um `quiz`. As corretas ficam em `rooms/{code}/secret/answers`, que só o dono lê. |
| **Gabarito publicado** | Corretas de uma pergunta copiadas para `room.revealedAnswers` no fim do suspense; só a partir daí os celulares as conhecem. |
| **Rascunho** | A apresentação em montagem na tela de criação, guardada no navegador. |
| **Modo leitura** | Leitura dos slides sem interação (`/view`, `/view/<código>`). |
| **Slides estáticos** | Todos os slides convertidos em slides livres sem interação (`toStaticSlides`), para o download e o modo leitura. |
| **Sobrescrita** (`overrides`) | Ajuste de uma opção global que vale só para um slide. |
| **Revisão** (`revision`) | Contador de edições feitas numa sala já iniciada. |
| **Slide final** | Índice reservado `currentSlideIndex === slides.length`: tela automática de agradecimento. Chegar a ele encerra a sala. |

---

## 4. Arquitetura, bibliotecas e build

### 4.1 Stack

| Camada | Tecnologia | Versão (lock) | Onde |
| --- | --- | --- | --- |
| Build e dev server | Vite | 6.4.3 (`^6.0.7`) | `vite.config.ts` |
| UI | React + React DOM | 18.3.1 | `src/` |
| Linguagem | TypeScript (estrito) | 5.9.3 (`^5.7.2`) | `tsconfig*.json` |
| Estilo e tema | Tailwind CSS v4 + `@tailwindcss/vite` | 4.3.3 | `index.css` |
| Roteamento | React Router DOM (`HashRouter`) | 7.18.1 | `main.tsx`, `App.tsx` |
| Estado do editor e do tema | Zustand | 5.0.14 | `store/` |
| Gráficos | Recharts (barras e pizza) | 2.15.4 | `components/charts/` |
| Nuvem de palavras | Layout próprio em SVG | | `components/charts/WordCloudView.tsx` |
| Ícones | lucide-react | 1.25.0 | todos os componentes |
| Classes condicionais | clsx | 2.1.1 | todos os componentes |
| QR Code | react-qr-code | 2.2.0 | `components/present/RoomCodeDialog.tsx`, `ShareRoom.tsx` |
| Arraste da lista de slides | framer-motion (`Reorder`, `useDragControls`) | 14.0.0 | `components/editor/SlideList.tsx` |
| Link curto | Serviço público da.gd, chamado do navegador | | `lib/shortUrl.ts` |
| PDF | jsPDF (import dinâmico) | 4.2.1 | `utils/exportPdf.ts` |
| ZIP e zlib | fflate | 0.8.3 | `utils/pptx/`, `utils/pptxExport/`, `utils/fonts/woff.ts` |
| Formas do PowerPoint | modern-openxml (só `presetShapeDefinitions`) | 1.13.4 | `utils/pptx/geometry.ts` |
| Validação do JSON | Zod | 3.25.76 (`^3.24.1`) | `utils/validation.ts` |
| Backend e tempo real | Firebase (Firestore + Auth anônima), SDK modular | 11.10.0 | `lib/` |
| Lint | ESLint 9 (flat config) + typescript-eslint + react-hooks + react-refresh | 9.39.5 | `eslint.config.js` |
| Deploy | GitHub Actions para GitHub Pages e Firebase Hosting | | `.github/workflows/deploy.yml` |

`package.json` (dependências declaradas):

```json
{
  "name": "interactive-presentation",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "build:firebase": "tsc -b && vite build --mode firebase",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "d3-cloud": "^1.2.7",
    "fflate": "^0.8.3",
    "firebase": "^11.3.0",
    "framer-motion": "^14.0.0",
    "jspdf": "^4.2.1",
    "lucide-react": "^1.25.0",
    "modern-openxml": "^1.13.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-qr-code": "^2.2.0",
    "react-router-dom": "^7.1.1",
    "recharts": "^2.15.0",
    "zod": "^3.24.1",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/d3-cloud": "^1.2.9",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.17.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.16",
    "globals": "^15.14.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.19.0",
    "vite": "^6.0.7"
  }
}
```

> `d3-cloud` (e `@types/d3-cloud`) está declarado e aparece nos chunks manuais
> do Vite, mas **não é importado em lugar nenhum**: a nuvem usa um layout
> próprio (seção 13.4). Numa reimplementação, pode ser omitido.

### 4.2 Como cada biblioteca é usada

| Biblioteca | APIs usadas | Observações |
| --- | --- | --- |
| React 18 | `createRoot`, `StrictMode`, `createPortal`, `forwardRef`, `useState`, `useEffect`, `useLayoutEffect`, `useMemo`, `useRef`, `useCallback`, `useId`, `createContext`, `useContext` | Portais para modais, lista do `Select` e editor ampliado. `StrictMode` executa efeitos duas vezes em desenvolvimento: os efeitos são idempotentes. |
| React Router 7 | `HashRouter`, `Routes`, `Route`, `Navigate`, `useParams`, `useNavigate` | `HashRouter` evita 404 em deep-links no GitHub Pages. |
| Zustand 5 | `create` (tema), `createStore` + `useStore` + Context (editor) | O editor é uma fábrica: cada tela pode ter o seu. |
| Firebase 11 (modular) | `initializeApp`; `getAuth`, `onAuthStateChanged`, `signInAnonymously`, `connectAuthEmulator`; `getFirestore`, `connectFirestoreEmulator`, `doc`, `collection`, `getDoc`, `getDocs`, `setDoc` (com `merge`), `updateDoc` (inclusive na forma com `FieldPath`), `deleteDoc`, `onSnapshot`, `query`, `where`, `writeBatch`, `arrayUnion`, `increment`, `FieldPath` | Nenhum índice composto é necessário (só `where('slideId','==',...)`). Os emuladores só são conectados com `VITE_FIREBASE_EMULATORS=true`. |
| Zod 3 | `object`, `discriminatedUnion`, `partial`, `omit`, `default`, `regex`, `refine`, `superRefine`, `record`, `tuple`, `safeParse` | Erros exibidos como `caminho: mensagem`. |
| Recharts 2 | `ResponsiveContainer`, `BarChart`, `Bar`, `Cell`, `LabelList`, `XAxis`, `YAxis`, `Tooltip`, `PieChart`, `Pie`, `Legend` | Animações desligadas (`isAnimationActive={false}`); rótulos com componentes próprios. |
| jsPDF 4 | `new jsPDF({ unit: 'pt', format: 'a4' })`, `setFillColor`, `rect`, `text`, `splitTextToSize`, `setFont`, `setFontSize`, `setTextColor`, `setDrawColor`, `getTextWidth`, `addPage`, `addImage`, `save` | Importada com `await import('jspdf')`. |
| fflate | `unzipSync` (abrir .pptx), `zipSync` + `strToU8` (gerar .pptx), `zlibSync` e `unzlibSync` (tabelas WOFF) | Síncrono e leve. |
| modern-openxml | `import presetShapeDefinitions from 'modern-openxml/presetShapeDefinitions'` | Definições oficiais (`presetShapeDefinitions.xml`) das formas pré-definidas do DrawingML, avaliadas para cada tamanho e ajuste. |
| react-qr-code | `<QRCode value size bgColor fgColor />` | Sempre `#111111` sobre branco `#ffffff` (`QR_FG` e `QR_BG`, exportados por `RoomCodeDialog`), independente do tema. |
| framer-motion 14 | `Reorder.Group`, `Reorder.Item` (com `dragListener={false}` e `dragControls`), `useDragControls` | Só na lista de slides do editor; a ordem é gravada no editor ao soltar. Entra no bundle principal. |
| lucide-react | Ícones como componentes | Cada tipo de slide tem um ícone (seção 9.5). |

APIs do navegador usadas diretamente: `crypto.randomUUID`,
`crypto.getRandomValues`, `crypto.subtle.digest('SHA-1')`, `FontFace` e
`document.fonts`, Canvas 2D e `Path2D`, `ResizeObserver`,
`requestAnimationFrame`, Fullscreen API, Clipboard API, `localStorage`,
IndexedDB (rascunho do editor), `FileReader`, `Blob` e `URL.createObjectURL`,
`DOMParser` (XML do PowerPoint), `contentEditable` com `Selection` e `Range`,
`fetch` com `AbortController`, `TextEncoder`, `atob` e `btoa`,
`structuredClone`, `matchMedia` (com `useSyncExternalStore`), eventos de
ponteiro e `pagehide`.

### 4.3 Por que Firebase e não um banco próprio

O acesso direto do navegador ao MongoDB Atlas foi descontinuado (Data API e
HTTPS Endpoints, fim de vida em setembro de 2025), o que exigiria um servidor
sempre online e quebraria o requisito de site estático. O Firestore oferece
**tempo real nativo no navegador** a partir de uma página estática, é NoSQL e
não impõe limite rígido de conexões no plano gratuito. O Cloud Storage não é
usado porque exige o plano pago (Blaze); por isso imagens e fontes ficam em
documentos do Firestore.

### 4.4 Camadas

Cada camada usa só a de baixo:

| Camada | Papel |
| --- | --- |
| `pages/` | Telas e orquestração (uma por rota) |
| `components/` | Apresentação: editor, slides, participação, gráficos, ui |
| `hooks/` | Ponte entre o React e o Firestore (assinaturas em tempo real) e utilidades de tela (largura, modais controlados, download) |
| `lib/` | Acesso ao Firebase, ao `localStorage` e ao IndexedDB |
| Firebase | Firestore + Auth anônima |

- **`types/`** define o domínio e é importado por todas as camadas.
- **`utils/`** é lógica pura, sem React e sem Firebase: agregação, validação,
  resolução de configurações, cronômetro, import/export, PDF, PowerPoint,
  fontes, texto rico, imagens.
- **`store/`** guarda o estado que existe **antes** de haver sala (a
  apresentação sendo montada, com o rascunho persistido por `editorDraft.ts`)
  e a preferência de tema.

Regra prática: **componentes não falam com o Firestore diretamente**. Recebem
dados por props (das páginas, que usam os hooks) ou disparam funções de `lib/`
para escrever (voto, presença, nome). A exceção controlada são
`ParticipateView` (usa `useMyResponse`) e os controles de resposta
(`ChoiceInput`, `WordCloudInput`), que chamam `saveResponse` e `clearResponse`.

### 4.5 Roteamento

`HashRouter`: os links ficam no formato `.../#/room/ABC123`. Isso evita 404 em
deep-links e em recarregamentos no GitHub Pages, que serve arquivos estáticos
sem fallback para `index.html`.

| Rota | Página | Acesso |
| --- | --- | --- |
| `/` | `HomePage` | Público |
| `/create` | `CreatePage` | Público (editor local) |
| `/present/:code` | `PresentPage` | Só o dono atual (mesmo uid) |
| `/present/:code/:token` | `PresentPage` | Quem tem o token secreto |
| `/edit/:code` | `EditRoomPage` | Só o dono atual (mesmo uid) |
| `/edit/:code/:token` | `EditRoomPage` | Quem tem o token secreto |
| `/join` | `JoinPage` | Público |
| `/room/:code` | `RoomPage` | Quem tem o código |
| `/view` | `ViewPage` | Público (lê um `.json` local, sem Firebase) |
| `/view/:code` | `ViewPage` | Quem tem o código, só com a sala encerrada |
| `*` | Redireciona para `/` | Público |

`main.tsx`:

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
```

`App.tsx` aplica o tema (`useApplyTheme` com o valor de `useThemeStore`) e
declara as rotas acima.

URL de entrada da plateia, montada na tela do apresentador:

```ts
const joinUrl = `${window.location.origin}${window.location.pathname}#/room/${code}`
```

### 4.6 Canal de controle da apresentação

A sala guarda `currentSlideIndex`. Só o apresentador escreve nesse campo (por
teclado, passador de slides ou botões do cabeçalho); todos os outros
navegadores **assinam** o documento e reagem. Não há mensagens diretas entre
apresentador e plateia: **o documento da sala é o único canal**. O mesmo
mecanismo leva todos de volta ao início quando uma edição é salva (a gravação
zera `currentSlideIndex`).

O índice `currentSlideIndex === slides.length` é reservado ao slide final
automático de agradecimento. Chegar a ele **encerra a sala**: a mesma escrita
grava o índice e `status: 'ended'`, e daí em diante as regras recusam
qualquer mudança na sala e qualquer resposta (seção 8.15).

As telas `/present` e `/edit` usam a mesma verificação de acesso
(`usePresenterAccess`): dono atual (uid igual a `creatorUid`) ou token secreto
na URL, que reivindica o controle.

### 4.7 Build e bundle

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const firebase = mode === 'firebase'
  return {
    base: process.env.VITE_BASE ?? (firebase ? '/' : '/interactive-presentation/'),
    plugins: [react(), tailwindcss()],
    build: {
      outDir: firebase ? 'dist-firebase' : 'dist',
      rollupOptions: {
        output: {
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
```

| Destino | Comando | `base` | Pasta |
| --- | --- | --- | --- |
| GitHub Pages | `npm run build` | `/interactive-presentation/` (o workflow passa `VITE_BASE=/<nome-do-repo>/`) | `dist/` |
| Firebase Hosting | `npm run build:firebase` (`vite build --mode firebase`) | `/` | `dist-firebase/` |

A env `VITE_BASE` sobrescreve o `base` nos dois casos.

Carregamento sob demanda (`import()` dinâmico), fora do bundle inicial:

| Módulo | Quando é baixado |
| --- | --- |
| `jspdf` | Ao gerar um PDF (`exportResultsPdf` ou `exportSlidesPdf`) |
| `utils/exportSlidesPdf` | Ao baixar os slides em PDF (`useSlideDownload`) |
| `utils/pptx` (com `modern-openxml`, descompressor de fontes) | Ao importar um `.pptx` |
| `utils/pptxExport` (com conversores de fonte) | Ao exportar um `.pptx` ou baixar os slides em PowerPoint |

A framer-motion não entra em chunk próprio: fica no bundle principal, junto
do editor.

Por isso as conversões de fonte (`utils/fonts/convert.ts`) ficam separadas do
registro (`utils/fonts/faces.ts`), que o editor e as salas usam sempre.

`index.html` (casca da SPA, com favicon SVG inline de três barras):

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='3' y='12' width='4' height='9' rx='1' fill='%236366f1'/><rect x='10' y='7' width='4' height='14' rx='1' fill='%2322c55e'/><rect x='17' y='3' width='4' height='18' rx='1' fill='%23f59e0b'/></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Apresentação interativa em tempo real: nuvem de palavras, gráficos e enquetes ao vivo." />
    <title>Apresentação Interativa</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 4.8 Estrutura de pastas

Raiz:

| Arquivo | Papel |
| --- | --- |
| `index.html` | Casca da SPA |
| `vite.config.ts` | `base`, pasta de saída (Pages e Firebase), plugins, chunks manuais |
| `firestore.rules` | Regras de segurança (publicadas pela pipeline quando mudam) |
| `firebase.json` | Onde estão as regras, o que publicar no Hosting (`dist-firebase/`, com cabeçalhos de cache) e as portas dos emuladores locais |
| `.env.example` | Modelo das variáveis `VITE_FIREBASE_*` (e, comentada, `VITE_FIREBASE_EMULATORS`) |
| `eslint.config.js`, `tsconfig*.json` | Lint e type-check |
| `.github/workflows/deploy.yml` | Build, regras do Firestore e deploy no Pages e no Firebase Hosting |
| `docs/` | Documentação |

`src/`:

```
src/
  main.tsx            Entrada: StrictMode + HashRouter + index.css
  App.tsx             Rotas e aplicação do tema
  index.css           Tailwind, variante dark, animações da nuvem, estilos dos gráficos e dos componentes ui
  vite-env.d.ts       Tipos do ambiente Vite

  types/
    presentation.ts   Todo o domínio: slides, configurações, sala, resposta, presença

  pages/
    HomePage.tsx      Entrada; salas apresentadas neste dispositivo (situação, retomar, reexportar PDF); abrir um .json para leitura
    CreatePage.tsx    Editor com rascunho no navegador e criação da sala
    PresentPage.tsx   Tela do apresentador: slide, navegação, código da sala, PDF, cronômetro, gabarito, encerrar, apresentar de novo
    EditRoomPage.tsx  Edição de uma sala no ar; salvar recomeça do 1º slide
    JoinPage.tsx      Formulário do código da sala
    RoomPage.tsx      Tela do participante: nome, presença, controles, aviso de reinício, tela final
    ViewPage.tsx      Modo leitura: um .json (/view) ou uma sala encerrada (/view/:code)

  components/
    layout/   PageShell, FullScreenMessage, ThemeToggle
    editor/   EditorWorkspace, EditorToolbar, ImportDialog, ExportDialog, AddSlideMenu, SlideList,
              SlideEditor, WordCloudConfig, ChoiceConfig, QuizConfig, AnswerConfig, TextConfig,
              FreeSlideConfig, SlideSettingsSection, PresentationSettingsButton,
              SettingsControls, AiPromptButton, slideTypeIcons.ts
    slides/   SlideDisplay, ScaledFrame, OptionsBoard, NamedResponsesList, SlideCountdown,
              AnswerSuspense
    free/     layout.ts, FreeElementContent, FreeSlideView, FreeTextEditable, FreeSlideCanvas
    participate/ ParticipateView, ChoiceInput, WordCloudInput, AnswerReveal, NamePrompt
    present/  RoomCodeDialog, ShareRoom, SummarySlide, DownloadSlides, PresenterAccessDenied
    charts/   BarChartView, PieChartView, WordCloudView, palette.ts
    ui/       Button, Card, Input (Input, Textarea, Field), fieldStyles.ts, Checkbox (Checkbox,
              Radio, ChoiceMark), Slider, Select, ScrollArea, Modal, Menu, StackSection,
              ConfirmDialog, Banner, ColorInput, SegmentedControl, ToggleButton

  hooks/
    useRoom, useResponses, useMyResponse, useParticipants, useParticipant,
    usePresenterAccess, useSlideTimer, useRevealCountdown, useApplyTheme,
    useFullscreen, useRoomAnswers, useRoomAssets, useRoomFonts, useFreeSlideActions,
    useMediaQuery, useDialogControl, useSlideDownload

  lib/
    firebase.ts           Inicialização (com config de reserva sem .env)
    rooms.ts              Criar, assinar, atualizar, encerrar e reiniciar sala; reivindicar controle
    answers.ts            Gabaritos protegidos (secret/answers) e a visão da plateia
    responses.ts          Salvar, limpar e assinar respostas
    participants.ts       Presença
    roomCode.ts           Código da sala e token do apresentador
    presenterSessions.ts  Salas apresentadas neste dispositivo (localStorage)
    participantName.ts    Nome do participante por sala (localStorage)
    shortUrl.ts           Encurtador do link de entrada (da.gd, com cache)
    draftStorage.ts       Rascunho do editor: texto no localStorage, imagens e fontes no IndexedDB
    assets.ts             Imagens da sala (subcoleção assets)
    fonts.ts              Fontes da sala (subcoleção fonts, em partes)

  store/
    editorStore.ts   Apresentação em edição (Zustand), um editor por contexto
    editorDraft.ts   Restaura e grava o rascunho da tela de criação; estado do rascunho
    themeStore.ts    Tema claro/escuro (Zustand + localStorage)

  utils/
    settings.ts      Padrões, molduras, limites e resolução global/slide
    timer.ts         Duração do cronômetro, avanço e encerramento; atraso da revelação
    slideFactory.ts  Ids, slides padrão, tipos criáveis e rótulos
    slides.ts        findQuizSlide (o quiz de um gabarito)
    aggregate.ts     Contagem de palavras e votos, respostas nomeadas, rodapé
    validation.ts    Schemas Zod do JSON
    importExport.ts  Download e leitura do JSON; nome de arquivo
    exportPdf.ts     Relatório em PDF
    exportSlidesPdf.ts PDF dos slides (uma página por slide)
    staticSlides.ts  Todos os slides como slides livres estáticos (download e leitura)
    aiPrompt.ts      Texto do prompt de IA
    freeSlide.ts     Criar, duplicar, reordenar, reenquadrar elementos; pilha de fontes
    richText.ts      Modelo do texto rico (estilos por trecho e por parágrafo, marcadores)
    richTextDom.ts   Texto rico para HTML e de volta; seleção em deslocamentos
    freeTextFormat.ts Formatação da seleção ou da caixa inteira
    images.ts        Compressão de imagens para data URL
    canvasText.ts    Texto rico desenhado em canvas
    freeSlideRaster.ts Slide livre inteiro desenhado num canvas (PDF)
    fonts/           sfnt.ts, lzcomp.ts, mtx.ts, eot.ts, woff.ts, faces.ts, convert.ts
    pptx/            index.ts, fonts.ts, package.ts, xml.ts, colors.ts, geometry.ts, draw.ts,
                     text.ts, table.ts, chart.ts
    pptxExport/      index.ts, slide.ts, standard.ts, parts.ts, xml.ts
```

### 4.9 Convenções de código

- **Um assunto por arquivo.** Arquivos de componente exportam só componentes
  (regra `react-refresh/only-export-components`); funções compartilhadas vão
  para `utils/` (por isso `findQuizSlide` vive em `utils/slides.ts`).
- **Comentários explicam o porquê** (limites do Firestore, CORS, cálculo do
  layout da nuvem), não o quê.
- **Nunca gravar `undefined` no Firestore**: campos opcionais são omitidos com
  spread condicional (`...(nome ? { participantName: nome } : {})`).
- **Controles de formulário vêm de `components/ui/`**: nada de `<select>`,
  checkbox, radio ou range nativos nas telas (destoam no tema escuro).
- **Efeitos com dependências estáveis**: documentos do Firestore mudam de
  identidade a cada snapshot; dependa de um valor derivado (um booleano, um
  id) para não disparar escritas em cascata.
- **TypeScript estrito**; `any` só onde o Recharts obriga, com
  `eslint-disable-next-line` e justificativa.
- **Interface em português do Brasil.**
- **Layout que cabe em 360 px**: cabeçalhos em uma linha em qualquer largura,
  nada de rolagem horizontal, alvos de toque de pelo menos 44 px
  (`min-h-11`), `100dvh` no lugar de `100vh`, rótulos que somem antes de
  quebrar a linha e ações raras dentro de menus (`Menu`).
- **Um modal, uma montagem**: quando o mesmo modal abre por um botão e por um
  item de menu, ele é montado uma vez e controlado de fora
  (`useDialogControl`, seção 9.7).

---

## 5. Modelo de dados

Todo o domínio está em `types/presentation.ts` (versão integral no
[Apêndice A](#apêndice-a-tipos-typescript-completos)).

### 5.1 Apresentação e sala

```ts
interface Presentation {
  title: string
  slides: Slide[]
  settings?: Partial<PresentationSettings>  // ausente ou parcial: completa com os padrões
  assets?: PresentationAssets               // imagens dos slides livres, pelo id
  fonts?: PresentationFonts                 // fontes embutidas usadas, pelo id
}

interface Room extends Omit<Presentation, 'assets' | 'fonts'> {
  creatorUid: string        // dono atual (quem criou ou reivindicou com o token)
  currentSlideIndex: number // slide no ar; igual a slides.length = slide final
  status: 'live' | 'ended'  // 'ended' ao chegar ao slide final ou em "Encerrar"
  createdAt: number         // epoch ms
  updatedAt: number
  timers?: Record<string, SlideTimer>  // cronômetro de cada slide, pelo id do slide
  revealedSlideIds?: string[]          // gabaritos cujo suspense já terminou
  revision?: number                    // edições feitas depois de iniciada (ausente = 0)
  answersHidden?: boolean              // quizzes gravados sem gabarito (ver secret/answers)
  revealedAnswers?: Record<string, string[]>  // gabaritos já publicados, pelo id do quiz
}

interface SlideTimer {
  endsAt: number | null   // instante final enquanto corre; null quando parado
  remainingMs: number     // o que sobrou quando parado (0 = esgotado)
}
```

- `Presentation` é a estrutura **serializável** (JSON).
- `Room` é ela mais os campos de sala publicada, **sem imagens e sem fontes**,
  que vão para as subcoleções `assets` e `fonts` para o documento continuar
  pequeno.
- `timers` guarda **um registro por slide**: o apresentador pode sair de uma
  pergunta no meio da contagem e voltar depois, e cada slide lembra onde
  parou.
- `revision` soma 1 a cada edição salva numa sala iniciada; é como o celular
  percebe o reinício e mostra o aviso.
- `status` nasce `'live'` e vira `'ended'` na mesma escrita que leva o índice
  ao slide final (ou no "Encerrar"). Sala encerrada não muda mais e não aceita
  respostas (seção 8.15).
- `answersHidden` e `revealedAnswers` protegem o gabarito: com
  `answersHidden: true`, cada `quiz` vai para a sala com `correctOptionIds: []`
  e as corretas ficam em `rooms/{code}/secret/answers`; no fim do suspense, o
  projetor copia as corretas da pergunta para `revealedAnswers[idDoQuiz]`.
  Salas criadas antes da proteção não têm `answersHidden` e usam o gabarito do
  próprio slide (seção 8.16).

### 5.2 Slides

```ts
type SlideType = 'wordcloud' | 'bar' | 'pie' | 'quiz' | 'answer' | 'text' | 'free'

interface SlideBase { id: string; type: SlideType; title: string; overrides?: SlideOverrides }

interface WordCloudSlide extends SlideBase { type: 'wordcloud'; wordLimitMode: 'one' | 'range' | 'unlimited'; maxWords: number }
interface BarSlide       extends SlideBase { type: 'bar'; options: ChoiceOption[]; allowMultiple: boolean }
interface PieSlide       extends SlideBase { type: 'pie'; options: ChoiceOption[]; allowMultiple: boolean }
interface QuizSlide      extends SlideBase {
  type: 'quiz'; options: ChoiceOption[]; allowMultiple: boolean
  correctOptionIds: string[]   // vazio = sem gabarito
  revealAnswer: boolean        // mantém um slide 'answer' logo depois
  showResponses: boolean       // mostra votos no projetor enquanto a pergunta está no ar
}
interface AnswerSlide    extends SlideBase { type: 'answer'; quizSlideId: string }
interface TextSlide      extends SlideBase { type: 'text'; content: string; align: 'left' | 'center' | 'right'; fontSize: number }
interface FreeSlide      extends SlideBase { type: 'free'; width: number; height: number; background: string; elements: FreeElement[] }

interface ChoiceOption { id: string; label: string }

type ChoiceSlide = BarSlide | PieSlide | QuizSlide
function isChoiceSlide(s: Slide): s is ChoiceSlide            // bar, pie, quiz
function isInteractiveSlide(s: Slide): s is WordCloudSlide | ChoiceSlide  // recebem respostas
```

`text`, `answer` e `free` não recebem respostas próprias.

### 5.3 Slide livre

Moldura lógica de tamanho fixo com elementos posicionados em px dessa
moldura. A tela escala a moldura inteira, então texto e imagens mantêm a
proporção em qualquer aparelho.

```ts
interface FreeSlide extends SlideBase {
  type: 'free'
  width: number            // 1920 no 16:9, 1440 no 4:3
  height: number           // 1080 nos dois
  background: string       // '#rrggbb'
  elements: FreeElement[]  // ordem de desenho: o último fica na frente
}

type FreeElement = FreeTextElement | FreeImageElement

// Campos comuns
{ id: string; name?: string; x: number; y: number; width: number; height: number
  rotation?: number /* graus, em torno do centro */; opacity?: number /* 0 a 1 */ }

interface FreeTextElement {
  kind: 'text'
  style: FreeTextStyle                          // estilo base da caixa
  paragraphs: FreeTextParagraph[]
  verticalAlign?: 'top' | 'middle' | 'bottom'
  padding?: [number, number, number, number]    // cima, direita, baixo, esquerda
  background?: string
  lineHeight?: number                           // múltiplo da fonte (padrão 1.2)
}

interface FreeTextParagraph {
  runs: { text: string; style?: FreeTextStyle }[]   // '\n' dentro de um trecho = quebra de linha
  align?: 'left' | 'center' | 'right' | 'justify'
  style?: FreeTextStyle
  bullet?: { kind: 'char'; char: string; color?: string }
         | { kind: 'number'; format: 'arabic' | 'alphaLower' | 'alphaUpper' | 'romanLower' | 'romanUpper';
             suffix: '.' | ')'; startAt?: number }
  indent?: number; hanging?: number                 // margem e recuo do marcador (px)
  spaceBefore?: number; spaceAfter?: number         // px
  lineHeight?: number
}

interface FreeTextStyle {   // tudo opcional: o que falta é herdado
  fontFamily?: string; fontSize?: number; color?: string
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; highlight?: string
}

interface FreeImageElement {
  kind: 'image'
  assetId: string                       // chave em Presentation.assets
  fit?: 'fill' | 'contain' | 'cover'    // padrão: fill (estica)
  radius?: number                       // cantos arredondados (px)
}
```

Herança de estilo de um trecho: **caixa, depois parágrafo, depois trecho**
(`resolveStyle(base, paragraph, run) = { ...base, ...paragraph, ...run }`).

### 5.4 Imagens e fontes

```ts
interface PresentationAsset {
  id: string        // 'img_' + 24 primeiros hex do SHA-1 do data URL
  dataUrl: string   // data:image/(jpeg|webp|png|gif);base64,...
  width: number
  height: number
}
type PresentationAssets = Record<string, PresentationAsset>

interface PresentationFont {
  id: string                    // 'font_' + 24 primeiros hex do SHA-1 de `${family}|${weight}|${style}|${dataUrl}`
  family: string                // nome usado em fontFamily pelos textos
  weight: 'normal' | 'bold'
  style: 'normal' | 'italic'
  dataUrl: string               // data:font/woff;base64,...
}
type PresentationFonts = Record<string, PresentationFont>
```

- Toda imagem é comprimida (`utils/images.ts`): no máximo 1920 px no lado
  maior e 900.000 caracteres de data URL; JPEG quando opaca, WebP (ou PNG)
  quando tem transparência. Como o id vem do conteúdo, a mesma imagem usada em
  vários slides é guardada uma vez, e um id nunca aponta para uma versão
  antiga.
- Cada estilo embutido de uma fonte (normal, negrito, itálico, negrito
  itálico) vira um registro. Os textos não guardam referência à fonte: usam o
  nome da família, e a fonte só precisa estar registrada no navegador
  (`FontFace`). Fontes ficam em WOFF (cerca de metade do TrueType). A
  apresentação leva só as famílias que algum texto usa (`pickFonts`).

### 5.5 Respostas e presença

```ts
interface ResponseDoc {
  slideId: string
  participantUid: string
  type: 'word' | 'choice'
  value: string[]            // textos enviados, ou ids das opções escolhidas (1 a 100 itens)
  participantName?: string   // só quando a sala pede o nome
  createdAt: number
}

interface ParticipantDoc {
  uid: string
  name?: string
  joinedAt: number    // só na primeira entrada
  lastSeenAt: number  // a cada entrada
}
```

Uma resposta sem itens não existe: desmarcar todas as opções de uma múltipla
escolha apaga o documento (seção 8.8).

### 5.6 Coleções do Firestore

```
rooms/{code}                          documento da sala (Room)
  private/presenter                   { token, ownerUid, createdAt }  (ilegível para clientes)
  secret/answers                      { [idDoQuiz]: idsDasCorretas }  (só o dono lê)
  participants/{uid}                  ParticipantDoc (presença)
  responses/{slideId}__{uid}          ResponseDoc
  assets/{assetId}                    { dataUrl, width, height, createdAt }
  fonts/{fontId} e fonts/{fontId}~N   { fontId, family, weight, style, part, parts, data, createdAt }
```

| Caminho | Detalhes |
| --- | --- |
| `rooms/{code}` | O id do documento é o próprio código. Criar sorteia códigos até achar um livre (até 6 tentativas) e grava a sala, o documento privado e os gabaritos numa escrita em lote atômica. |
| `rooms/{code}/private/presenter` | Guarda o token. Ninguém lê. Quem tem o token prova a posse reenviando-o num `update`, o que autoriza definir `ownerUid` como o próprio uid. |
| `rooms/{code}/secret/answers` | Gabaritos das perguntas, pelo id do `quiz`. Só o dono atual lê; gravado no lote que cria a sala e no lote que salva uma edição; nunca apagado pelos clientes. |
| `rooms/{code}/participants/{uid}` | Id é o uid: reentradas atualizam o mesmo documento. `joinRoom` lê antes: `joinedAt` só na criação, `lastSeenAt` a cada entrada; gravado com `setDoc(..., { merge: true })`. Só as chaves `uid`, `name`, `joinedAt`, `lastSeenAt`. Sem heartbeat: escreve ao abrir a sala e quando o nome muda. |
| `rooms/{code}/responses/{slideId}__{uid}` | Id determinístico (conferido pelas regras): no máximo uma resposta por pessoa por slide; reenviar sobrescreve; limpar é um `deleteDoc` direto; o participante assina só o próprio documento, o apresentador assina a coleção filtrada por `slideId`. Só aceito com a sala no ar. |
| `rooms/{code}/assets/{assetId}` | Uma imagem por documento. Fora da sala pelo limite de 1 MiB e porque a sala é relida por todos a cada troca de slide. Lida uma vez por aparelho e guardada em memória. Só o dono grava e apaga. |
| `rooms/{code}/fonts/{fontId}` | Fontes divididas em partes de 700.000 caracteres: `{fontId}`, `{fontId}~1`, `{fontId}~2`... Cada documento repete família, estilo e total de partes; a leitura junta tudo numa consulta só. Só o dono grava e apaga. |

Exemplo de documento `rooms/K7MP2Q` logo depois de criado:

```json
{
  "title": "Introdução à Análise de Dados",
  "slides": [ { "id": "8f1c...", "type": "quiz", "title": "O que é uma mediana?", "...": "..." } ],
  "settings": {
    "allowChangeAnswer": true, "askName": false, "identifyResponses": false,
    "titleFontSize": 36, "labelFontSize": 16, "bodyFontSize": 24,
    "quizTimerSeconds": 20, "slideAspect": "16:9", "allowDownload": false
  },
  "creatorUid": "Xb3...anon",
  "currentSlideIndex": 0,
  "status": "live",
  "createdAt": 1767225600000,
  "updatedAt": 1767225600000,
  "timers": {},
  "revealedSlideIds": [],
  "answersHidden": true,
  "revealedAnswers": {}
}
```

O `quiz` acima vai com `"correctOptionIds": []`; as corretas ficam em
`rooms/K7MP2Q/secret/answers`, por exemplo `{ "8f1c...": ["8f1c...o2"] }`.

### 5.7 Formato JSON (importar e exportar)

O JSON exportado é exatamente um `Presentation`. Quando há slides livres com
imagens ou fontes, leva também `assets` e `fonts` **só com as que estão em
uso**, então o arquivo é autossuficiente.

```json
{
  "title": "Introdução à Análise de Dados",
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
  },
  "slides": [
    { "id": "s1", "type": "text", "title": "Abertura",
      "content": "Bem-vindos", "align": "center", "fontSize": 64 },
    { "id": "s2", "type": "quiz", "title": "O que é uma mediana?",
      "allowMultiple": false, "correctOptionIds": ["s2o2"], "revealAnswer": true,
      "showResponses": false,
      "options": [
        { "id": "s2o1", "label": "A média dos valores" },
        { "id": "s2o2", "label": "O valor central" }
      ] }
  ]
}
```

Validação (Zod, união discriminada por `type`; schema integral no
[Apêndice B](#apêndice-b-schema-zod-do-json)):

| Campo | Regra |
| --- | --- |
| `settings` | Opcional e parcial. Tamanhos de fonte inteiros de 10 a 200; `quizTimerSeconds` inteiro de 0 a 300; `slideAspect` `16:9` ou `4:3`; `allowDownload` booleano. |
| `overrides` | Opcional; mesmas chaves de `settings` menos `askName`, `slideAspect` e `allowDownload`. |
| `wordcloud` | `wordLimitMode` em `one`, `range`, `unlimited`; `maxWords` inteiro de 1 a 50 (sempre obrigatório). |
| `bar`, `pie` | `options` com no mínimo 1 item (`id` não vazio, `label` texto); `allowMultiple` booleano. |
| `quiz` | Como `bar`, mais `correctOptionIds` (padrão `[]`), `revealAnswer` (padrão `false`), `showResponses` (padrão `false`). |
| `answer` | `quizSlideId` não vazio. |
| `text` | `content`; `align` em `left`, `center`, `right`; `fontSize` inteiro de 8 a 200. |
| `free` | `width` e `height` de 100 a 10.000; `background` cor; até 500 elementos. |
| Cores do slide livre | `#rrggbb` ou `#rrggbbaa` (vão direto para o CSS). |
| Elementos | Coordenadas de -100.000 a 100.000; tamanhos de 0 a 100.000; rotação de -360 a 360; opacidade de 0 a 1; até 500 parágrafos; trecho até 20.000 caracteres; `fontSize` de 1 a 2.000; `lineHeight` de 0,5 a 5; marcador de caractere com 1 a 4 caracteres; `startAt` de 1 a 10.000. |
| `assets` | Data URL só de PNG, JPEG, WebP ou GIF em base64; largura e altura inteiras de 1 a 20.000. |
| `fonts` | Data URL só de fonte (`woff`, `woff2`, `ttf`, `otf`) em base64; nome da família sem aspas, `\`, `<`, `>`, `;`, `{`, `}` nem caracteres de controle. |
| Integridade | Toda imagem citada por um elemento precisa existir em `assets`; senão o arquivo é recusado com o caminho do elemento (`slides.3.elements.1.assetId: imagem "img_..." ausente em "assets"`). |

Compatibilidade garantida: `settings` opcional e parcial; `overrides`
opcional; `correctOptionIds`, `revealAnswer` e `showResponses` com `.default()`;
`assets`, `fonts`, `settings.slideAspect` e `settings.allowDownload` opcionais
(sem formato, vale 16:9; sem `allowDownload`, desligado). Um JSON antigo (só
`title` + `slides` com os quatro tipos originais) importa sem erro.

`validation.ts` exporta também `presentationShapeSchema`, a forma da
apresentação **sem** a conferência de integridade das imagens;
`presentationSchema` é `presentationShapeSchema.superRefine(...)`. O rascunho
do editor usa a forma sem a conferência, porque o texto volta antes das
imagens (que ficam à parte, no IndexedDB).

### 5.8 Constantes e limites

| Constante | Valor | Onde |
| --- | --- | --- |
| `DEFAULT_SETTINGS` | `allowChangeAnswer: true`, `askName: false`, `identifyResponses: false`, `titleFontSize: 36`, `labelFontSize: 16`, `bodyFontSize: 24`, `quizTimerSeconds: 20`, `slideAspect: '16:9'`, `allowDownload: false` | `utils/settings.ts` |
| `SLIDE_FRAMES` | 16:9 = 1920 x 1080; 4:3 = 1440 x 1080 | `utils/settings.ts` |
| `FONT_SIZE_RANGE` | 10 a 200 px | `utils/settings.ts` |
| `QUIZ_TIMER_RANGE` | 0 a 300 s | `utils/settings.ts` |
| `REVEAL_DELAY_SECONDS` | 3 | `utils/timer.ts` |
| Código da sala | 6 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` | `lib/roomCode.ts` |
| Token | 24 caracteres de `A-Z a-z 0-9` | `lib/roomCode.ts` |
| Tentativas de código livre | 6 | `lib/rooms.ts` |
| `MAX_ROOM_BYTES` | 1.000.000 (tamanho do JSON da sala) | `lib/rooms.ts` |
| `MAX_ASSET_CHARS` | 900.000 caracteres de data URL | `utils/images.ts` |
| `MAX_ASSET_DIMENSION` | 1920 px no lado maior | `utils/images.ts` |
| Lote de imagens e fontes | até 8 documentos ou 7.000.000 caracteres | `lib/assets.ts`, `lib/fonts.ts` |
| Parte de fonte (`CHUNK_CHARS`) | 700.000 caracteres | `lib/fonts.ts` |
| Lote de exclusão | 400 documentos | `lib/assets.ts`, `lib/fonts.ts` |
| Sessões de apresentador lembradas | 8 | `lib/presenterSessions.ts` |
| Nome do participante | até 40 caracteres (também nas regras) | `lib/participantName.ts`, `firestore.rules` |
| Texto da nuvem | até 80 caracteres por envio | `WordCloudInput.tsx` |
| `MAX_RESPONSE_ITEMS` | 100 itens por resposta (também nas regras; teto do modo "sem limite" da nuvem) | `lib/responses.ts`, `firestore.rules` |
| `slideId` de uma resposta | até 200 caracteres | `firestore.rules` |
| `maxWords` | 1 a 50 (padrão 3) | validação e `WordCloudConfig` |
| Tamanho do slide de texto | padrão 40; controle de 16 a 120 (passo 2); validação de 8 a 200 | `slideFactory.ts`, `TextConfig.tsx` |
| Aviso de reinício no celular | 10.000 ms | `RoomPage.tsx` |
| Tique lógico do cronômetro | 250 ms | `useSlideTimer.ts` |
| Cronômetro em vermelho | últimos 5.000 ms | `SlideCountdown.tsx` |
| Tempo limite do encurtador | 8.000 ms por provedor | `lib/shortUrl.ts` |
| Espera do rascunho | 600 ms depois da última mudança | `store/editorDraft.ts` |
| Layout do editor | colunas a partir de 1024 px; ações da barra como botões a partir de 1280 px | `EditorWorkspace.tsx`, `EditorToolbar.tsx` |
| Limite de arraste na lista | 4 px antes de virar arraste | `SlideList.tsx` |
| `Menu` | 288 px de largura | `components/ui/Menu.tsx` |
| QR no modal do código | 168 px; ampliado: `min(92vw, 92vh)` | `RoomCodeDialog.tsx` |
| PDF dos slides | uma página por slide, 960 pt de largura, JPEG 0,9 | `utils/exportSlidesPdf.ts` |
| Deslize no modo leitura | 50 px na horizontal | `pages/ViewPage.tsx` |
| Limites no celular | título até 30 px; corpo até 28 px; botões de voto até 22 px; gabarito até 20 px; suspense até 24 px | `ParticipateView` e filhos |
| Quadro de alternativas | duas colunas com mais de 4 opções | `OptionsBoard.tsx` |
| Rótulo de barra | quebra a cada 15 caracteres, até 4 linhas, com reticências | `BarChartView.tsx` |
| Slide livre | tamanho mínimo 12 px; encaixe a 8 px de tela; setas 1 px (Shift 10 px); duplicar desloca 24 px | `FreeSlideCanvas.tsx`, `freeSlide.ts` |
| Unidade do PowerPoint | 6350 EMU por px (1920 px = 12.192.000 EMU) | `utils/pptxExport/xml.ts` |
| Mínimos na exportação PPTX | título 60 px, corpo 40 px, dica 28 px (metade em pontos) | `utils/pptxExport/standard.ts` |
| PDF | A4, unidade pt, margem 48 pt | `utils/exportPdf.ts` |
| Chaves do `localStorage` | `ip-theme`, `ip-presenter-sessions`, `ip-participant-names`, `ip-short-urls`, `ip-editor-draft` | `store/themeStore.ts`, `lib/` |
| IndexedDB | banco `ip-editor`, store `draft`, chave `files` (imagens e fontes do rascunho) | `lib/draftStorage.ts` |

### 5.9 Números derivados (`utils/aggregate.ts`)

| Função | Devolve |
| --- | --- |
| `aggregateWords(responses)` | `{ text, value }[]` por frequência, sem diferenciar maiúsculas, mantendo a primeira grafia, ordenado do maior para o menor |
| `aggregateChoices(responses, options)` | `{ id, label, votes }[]` na ordem definida pelo apresentador |
| `totalVotes(tallies)` | Soma dos votos |
| `totalWords(responses)` | Total de textos enviados na nuvem |
| `answeredCount(responses)` | Participantes **distintos** que responderam aquele slide |
| `namedResponses(responses, slide)` | `{ uid, name, answers[] }[]` com ids traduzidos para rótulos, "Anônimo" sem nome, ordem alfabética `pt-BR` |
| `responseSummary(slide, responses)` | Texto do rodapé: "8 responderam", com o total de envios só quando ele pode ser diferente |

`answeredCount` **não é** o total de participantes: esse vem da coleção
`participants`. É essa distinção que faz o rodapé mostrar
"12 participante(s) · 8 responderam".

O total de envios só aparece quando o slide permite mais de um item por
pessoa (`allowMultiple`, ou `wordLimitMode` diferente de `one`), porque
"8 responderam · 8 voto(s)" diria a mesma coisa duas vezes. Vale para a tela e
para o PDF.

---

## 6. Configurações globais e por slide

Fonte: `utils/settings.ts`.

### 6.1 As opções

```ts
interface PresentationSettings {
  allowChangeAnswer: boolean   // padrão: true
  askName: boolean             // padrão: false
  identifyResponses: boolean   // padrão: false
  titleFontSize: number        // padrão: 36 px
  labelFontSize: number        // padrão: 16 px
  bodyFontSize: number         // padrão: 24 px
  quizTimerSeconds: number     // padrão: 20 s (0 = sem cronômetro)
  slideAspect: '16:9' | '4:3'  // padrão: '16:9'
  allowDownload: boolean       // padrão: false
}

type SlideOverrides = Partial<Omit<PresentationSettings, 'askName' | 'slideAspect' | 'allowDownload'>>
```

| Opção (rótulo na interface) | Efeito |
| --- | --- |
| **Permitir limpar e trocar a resposta** | Ligado: o participante vê "Limpar resposta" ou "Limpar tudo" e pode escolher de novo. Desligado: a resposta vira definitiva. Na escolha única o primeiro toque encerra; na múltipla escolha só o **desmarcar** é bloqueado (senão a pessoa não terminaria a própria seleção); na nuvem, os itens enviados perdem o botão de remover e "Limpar tudo" some. |
| **Solicitar o nome antes de entrar na sala** | Quem abre `/room/<código>` preenche o nome antes de ver qualquer slide. O nome fica salvo por sala no dispositivo, acompanha a presença e vai junto de cada resposta. Só global. |
| **Identificar as respostas com o nome do participante** | Abaixo do slide (e no PDF) aparece a lista "Nome: resposta". **Depende** de "Solicitar o nome". Nos slides `quiz` só aparece se o slide também tiver `showResponses`. |
| **Tamanho do título** | Título do slide no projetor (no celular, limitado a 30 px). |
| **Tamanho dos rótulos** | Eixos e legendas dos gráficos, contador acima das barras, textos de instrução, nomes na lista de identificação e rodapé (rodapé usa 0,85 do valor). |
| **Tamanho do corpo** | Alternativas do `quiz` e do gabarito e controles do participante. Nos slides de texto vale o `fontSize` do próprio slide. |
| **Tempo do cronômetro (questionário)** | Segundos que um `quiz` fica aberto. Ao zerar, as respostas são encerradas e a apresentação passa para o gabarito. `0` desliga. |
| **Formato dos slides** | 16:9 (1920 x 1080) ou 4:3 (1440 x 1080): proporção da prévia e moldura dos slides livres. Só global. |
| **Permitir que os participantes baixem os slides no fim** | Quando a apresentação termina, a tela final do celular mostra "Baixar slides" ("PDF dos slides" e "PowerPoint (.pptx)"), e o modo leitura da sala encerrada oferece o menu "Baixar". Os arquivos levam só os slides, sem a resposta de ninguém. Só global. |

Faixas: tamanhos de 10 a 200 px; cronômetro de 0 a 300 s. Os controles já
limitam (`clampFontSize`, `clampTimerSeconds`) para nunca gerar um JSON que a
própria importação recusaria.

### 6.2 Onde se configura

- **Globais**: **Opções** na barra do editor (botão a partir de 1280 px, item
  do menu "Mais" abaixo disso), que abre `PresentationSettingsButton`, um
  `Modal` "Opções da apresentação", na ordem: Formato dos slides
  (`SegmentedControl` "16:9 (widescreen)" e "4:3 (padrão antigo)"), Permitir
  limpar e trocar, Permitir que os participantes baixem os slides no fim,
  Solicitar o nome,
  Identificar as respostas (desativado sem o nome; desligar o nome também
  desliga a identificação), Tempo do cronômetro (campo numérico) e os três
  tamanhos de fonte (`Slider`). O formato também aparece acima da prévia.
- **Por slide**: seção recolhível **"Opções deste slide"**
  (`SlideSettingsSection`) no painel de configuração. Cada opção booleana é
  um seletor de três estados: **Herdar da apresentação (sim/não)**, **Sim**,
  **Não** (lista suspensa `Select`). Cada tamanho de fonte tem uma caixa de
  seleção com o nome da opção: marcada, libera o controle deslizante (que
  começa no valor global); desmarcada, mostra o valor global seguido de
  "(herdado)". O cronômetro ("Tempo próprio para esta pergunta") tem a
  mesma caixa, liberando um campo numérico. Um selo mostra
  "N personalizada(s)".
- Controles desativados com explicação: "Permitir limpar e trocar" em slides
  que não recebem respostas; "Identificar" sem `askName` global; cronômetro
  fora de `quiz`; "Tamanho do corpo" em slides `text`.
- O slide livre **não** mostra "Opções deste slide" (não recebe respostas, não
  tem cronômetro e cada texto tem o próprio tamanho).

Por que `askName` não tem versão por slide: o nome é pedido **uma vez, antes
de entrar na sala**, antes de existir "slide atual". O formato também é só
global: é a moldura de todos os slides livres, que precisam combinar entre si.
E o download vale para a apresentação inteira, que é o que se baixa.

### 6.3 Resolução do valor efetivo

```ts
function withDefaults(settings?: Partial<PresentationSettings>): PresentationSettings {
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) }
}

function resolveSlideSettings(global, slide): PresentationSettings {
  const base = withDefaults(global)
  const merged = { ...base, ...(slide?.overrides ?? {}) }
  merged.identifyResponses = merged.identifyResponses && base.askName   // sem nome, sem identificação
  if (slide?.type === 'text') merged.bodyFontSize = slide.fontSize      // o corpo do texto é o fontSize dele
  return merged
}
```

| Tela | Chamada |
| --- | --- |
| Prévia do editor | `resolveSlideSettings(settings, selectedSlide)` em `EditorWorkspace` |
| Projetor | `resolveSlideSettings(room?.settings, currentSlide)` em `PresentPage` |
| Celular | `resolveSlideSettings(room?.settings, currentSlide)` em `RoomPage` |
| PDF | `resolveSlideSettings(settings, slide)` em `exportPdf` |

`setOverride(id, chave, valor)` grava em `slide.overrides`; passar
`undefined` **remove a chave**, e quando não sobra nenhuma o campo `overrides`
inteiro é apagado (o Firestore recusa `undefined`).

### 6.4 Persistência das opções

- **No editor**: no `editorStore`. Na tela de criação, o rascunho (opções
  incluídas) é gravado no navegador e volta depois de recarregar (seção 9.2);
  para outro aparelho, exporte o JSON. A edição de uma sala parte sempre do
  que está no ar.
- **Na sala**: `room.settings` gravado completo na criação (`withDefaults`).
  Numa sala iniciada, muda-se pelo botão **Editar**, e
  `saveAndRestartRoom` grava tudo e recomeça do primeiro slide.
- **No JSON**: opcional e parcial; a importação completa o que faltar.

Uma mudança em `room.settings` chega a todos pela assinatura da sala. Se a
edição ligar "Solicitar o nome", quem já estava sem nome passa a ver o pedido
antes do primeiro slide.

Por que salvar recomeça: um tempo de cronômetro novo só valeria para perguntas
ainda não iniciadas, e uma pergunta encerrada continuaria congelada com a
regra antiga. Recomeçar zera cronômetros e gabaritos, e a configuração vale
igual para todos os slides.

---

## 7. Tipos de slide, com exemplos de execução

| Tipo | Rótulo | Ícone (lucide) | Interativo | Criável no menu |
| --- | --- | --- | --- | --- |
| `wordcloud` | Nuvem de palavras | `Cloud` | sim | sim |
| `bar` | Gráfico de barras | `BarChart3` | sim | sim |
| `pie` | Gráfico de pizza | `PieChart` | sim | sim |
| `quiz` | Alternativas (sem gráfico) | `ListChecks` | sim | sim |
| `answer` | Resposta correta | `CheckCircle2` | não (usa os dados do `quiz`) | não, automático |
| `text` | Texto simples | `Type` | não | sim |
| `free` | Slide livre | `LayoutTemplate` | não | sim (e pela importação de PowerPoint) |

Valores padrão de criação (`utils/slideFactory.ts`, ids por `crypto.randomUUID()`):

| Tipo | Slide novo |
| --- | --- |
| `wordcloud` | título "Nuvem de palavras", `wordLimitMode: 'unlimited'`, `maxWords: 3` |
| `bar` | título "Gráfico de barras", `allowMultiple: false`, opções "Opção 1" e "Opção 2" |
| `pie` | título "Gráfico de pizza", igual às barras |
| `quiz` | título "Pergunta", `allowMultiple: false`, `correctOptionIds: []`, `revealAnswer: false`, `showResponses: false`, "Alternativa 1" e "Alternativa 2" |
| `answer` | `createAnswerSlide(quizId, 'Resposta correta')` (nunca pelo menu) |

O menu "Adicionar slide" (`AddSlideMenu`) mostra, abaixo do nome de cada tipo
criável, uma linha do que ele faz: "Respostas curtas viram uma nuvem ao vivo"
(`wordcloud`), "Votação com o resultado em barras" (`bar`), "Votação com o
resultado em pizza" (`pie`), "Pergunta com alternativas e gabarito" (`quiz`),
"Um texto grande, sem respostas" (`text`) e "Caixas de texto e imagens
livres" (`free`).
| `text` | título "Slide de texto", `content: 'Escreva seu texto aqui'`, `align: 'center'`, `fontSize: 40` |
| `free` | `createFreeSlide(SLIDE_FRAMES[aspect])`: título "Slide livre", fundo `#ffffff`, uma caixa de texto "Clique duas vezes para editar" em negrito, em x = 8%, y = 10%, largura 84%, altura 16% da moldura, fonte Arial com 7,5% da altura |

Arquivos de referência: exibição no projetor em
`components/slides/SlideDisplay.tsx`; controles do participante em
`components/participate/ParticipateView.tsx`; formulários em
`components/editor/*Config.tsx`.

### 7.0 Estrutura comum da tela do projetor

Todo slide, menos o livre, é desenhado por `SlideDisplay` na mesma moldura
vertical:

1. **Título** centralizado, em negrito, com `titleFontSize` e altura de linha
   1,15 (no gabarito, o título é o da pergunta).
2. **Corpo** conforme o tipo, ocupando o espaço restante (`flex-1`,
   `min-h-0`).
3. **Lista "Nome: resposta"** (`NamedResponsesList`), só com identificação
   ligada e slide interativo (no `quiz`, só com `showResponses`): chips com
   rolagem própria e altura máxima de 22% da tela, fonte `labelFontSize * 0.85`.
4. **Card do cronômetro** (`SlideCountdown`) quando o slide tem tempo.
5. **Rodapé** (`labelFontSize * 0.85`): "N participante(s) · " + `responseSummary`.

Durante o suspense do gabarito, nada do resultado aparece (nem corpo, nem
nomes, nem rodapé): só "A resposta certa é…".

No celular, `ParticipateView` mostra o título (até 30 px) e o controle do
tipo; a `RoomPage` usa `key={currentSlide.id}`, então trocar de slide reinicia
os controles.

### 7.1 `wordcloud`: nuvem de palavras

```ts
{ type: 'wordcloud', wordLimitMode: 'one' | 'range' | 'unlimited', maxWords: number }
```

**Comportamento**

- O participante envia textos curtos (palavra **ou frase**, até 80
  caracteres). O campo diz "Entre com seu texto" justamente para não sugerir
  uma única palavra.
- `wordLimitMode`: `unlimited` (padrão, "Quantas quiser"), `one` ("Apenas 1
  palavra") ou `range` ("De 1 até um limite", até `maxWords`, de 1 a 50).
- Textos repetidos **pela mesma pessoa** são recusados (comparação sem
  diferenciar maiúsculas), com o aviso "Você já enviou esse texto.".
- A cada envio, o documento de resposta é regravado com a lista inteira
  (`type: 'word'`, `value: [...anteriores, novo]`). O foco volta ao campo.
- Com "Permitir limpar e trocar": cada item tem um botão de remover e existe
  "Limpar tudo" (`deleteDoc`). Sem a opção, os itens ficam fixos.
- Ao atingir o limite, o campo é desativado com o texto "Limite atingido". No
  modo "Quantas quiser", o limite é `MAX_RESPONSE_ITEMS` (100), o mesmo que
  as regras do Firestore aplicam a qualquer resposta.
- Instrução exibida: "Você pode enviar 1 resposta (palavra ou frase).",
  "Você pode enviar até N resposta(s), palavra ou frase." ou "Você pode enviar
  quantas respostas quiser (palavra ou frase).".

**Projetor**: `WordCloudView` com `aggregateWords(responses)`; tamanho
proporcional à frequência; cor estável por palavra (hash do texto); o layout é
refeito a cada atualização, com transição em CSS e animação de entrada só para
palavras novas; sem palavras: "Aguardando palavras…". Algoritmo na seção 13.4.

**Rodapé**: `one` mostra "M responderam"; os outros, "M responderam · K
resposta(s) enviada(s)".

**PDF**: os textos em sequência, tamanho de 14 a 40 pt conforme a frequência
(22 pt se todos empatam), cores da paleta, até 120 textos; depois, tabela de
respostas.

**Exemplo de execução**

Slide "Qual palavra resume seu dia?", `range` com `maxWords: 3`, troca
permitida, sala sem pedido de nome.

1. O apresentador avança para o slide. A sala recebe
   `currentSlideIndex: 2` (e `timers` inalterado, porque nuvem não tem
   cronômetro). O projetor mostra o título e "Aguardando palavras…".
2. No celular da Ana aparece "Você pode enviar até 3 resposta(s)...". Ela
   digita "Cansado" e toca em Enviar. É gravado
   `rooms/K7MP2Q/responses/{slideId}__{uidAna}` com
   `{ type: 'word', value: ['Cansado'] }`. O projetor recebe o snapshot e
   desenha "Cansado" no centro. Rodapé: "5 participante(s) · 1 responderam ·
   1 resposta(s) enviada(s)".
3. Ana envia "Feliz" (o documento passa a `['Cansado', 'Feliz']`) e depois
   "feliz": o celular recusa localmente com "Você já enviou esse texto.".
4. Bruno envia "feliz". A contagem junta sem diferenciar maiúsculas:
   "Feliz" (grafia do primeiro documento lido) com 2 e "Cansado" com 1. A
   nuvem se reorganiza com "Feliz" maior.
5. Ana envia "Animado": chega a 3, o campo desativa com "Limite atingido".
6. Ana toca no X de "Cansado": o documento é regravado sem ele. Toca em
   "Limpar tudo": o documento é apagado e ela pode recomeçar.
7. Com `wordLimitMode: 'one'`, o primeiro envio já esgota o limite, e o rodapé
   mostra só "M responderam".

### 7.2 `bar`: gráfico de barras

```ts
{ type: 'bar', options: ChoiceOption[], allowMultiple: boolean }
```

**Comportamento**

- Votação com resultado em barras verticais (Recharts), contador grande acima
  de cada barra (`labelFontSize * 1.5`, negrito), rótulos quebrados em até 4
  linhas de 15 caracteres (com reticências), cantos superiores arredondados
  (8 px), cores da paleta categórica pela posição, eixo Y oculto
  (`domain [0, 'dataMax']`), tooltip "N voto(s)".
- `allowMultiple` alterna entre caixas de seleção (quadradas) e escolha única
  (redondas). Instrução: "Você pode escolher mais de uma opção." ou "Escolha
  uma opção.".
- **O toque é o envio**: não há botão "enviar" nem estado otimista; o botão
  marcado vem sempre do Firestore (`useMyResponse`).
- Escolha única: tocar noutra opção substitui (`value: [novoId]`). Múltipla:
  tocar alterna a opção na lista; desmarcar a última **apaga** a resposta
  (`saveResponse` com lista vazia chama `clearResponse`), e a pessoa deixa de
  contar em "responderam".
- Depois de votar: "Voto registrado" e, com troca permitida, "Limpar
  resposta" (`deleteDoc`); sem troca, um cadeado com "Não é possível trocar"
  (única) ou "Não é possível desmarcar" (múltipla).

**Editor** (`ChoiceConfig`): título, lista de opções (mínimo 1, cada uma com
remover), "Adicionar opção" (cria `{ id: uuid, label: '' }`) e "Permitir
escolher mais de uma opção".

**Rodapé**: escolha única "M responderam"; múltipla "M responderam · K
voto(s)".

**PDF**: uma barra horizontal por opção com rótulo, votos e porcentagem;
depois, tabela de respostas.

**Exemplo de execução**

Slide "Quais linguagens você já usou?" com Python, JavaScript e Java,
`allowMultiple: true`, e a sala com "Permitir limpar e trocar" **desligado**.

1. Carla toca em Python: grava `{ type: 'choice', value: ['o1'] }`. A barra
   de Python sobe para 1 no projetor. No celular aparece "Voto registrado" e
   o cadeado "Não é possível desmarcar".
2. Carla toca em JavaScript: grava `['o1', 'o2']` (marcar novas opções
   continua liberado na múltipla escolha).
3. Carla tenta desmarcar Python: o botão está desativado (bloqueio só de
   desmarcar).
4. Com 10 participantes e 6 respondendo, o rodapé mostra "10 participante(s) ·
   6 responderam · 11 voto(s)".
5. Se o slide fosse de escolha única com troca desligada, o primeiro toque de
   Carla travaria todas as opções ("Não é possível trocar").

### 7.3 `pie`: gráfico de pizza

```ts
{ type: 'pie', options: ChoiceOption[], allowMultiple: boolean }
```

Mesmos campos, editor e controles de `bar`. Diferenças de exibição:

- Só fatia opções com votos; raio externo de 62%; cor de cada fatia pela
  posição original da opção (estável).
- Cada fatia mostra "60% (3 votos)" (singular "voto" quando 1); a legenda
  abaixo traz o rótulo completo (`labelFontSize`).
- Sem votos: "Aguardando votos…".
- Prefira pizza quando as opções são mutuamente exclusivas.

**Exemplo de execução**: "Qual seu nível de experiência?" com Iniciante,
Intermediário e Avançado, escolha única, troca permitida. Três pessoas
escolhem Iniciante e duas Avançado: duas fatias, "60% (3 votos)" e "40% (2
votos)"; Intermediário não aparece na pizza, só na legenda. Uma pessoa troca
de Iniciante para Intermediário: um toque regrava `value: ['o2']`, e a pizza
passa a três fatias (40%, 20%, 40%).

### 7.4 `quiz`: alternativas sem gráfico (pergunta e resposta)

```ts
{
  type: 'quiz',
  options: ChoiceOption[],
  allowMultiple: boolean,
  correctOptionIds: string[],   // vazio = pergunta sem gabarito
  revealAnswer: boolean,        // mantém um slide `answer` logo depois
  showResponses: boolean,       // votos no projetor enquanto a pergunta está no ar
}
```

**Projetor**: `OptionsBoard` com as alternativas em cartões grandes, letras
A, B, C... num quadrado de `1,8 x bodyFontSize`, texto em `bodyFontSize`,
duas colunas com mais de 4 opções. Por padrão a distribuição fica **oculta**
(o rodapé mostra só quantos já votaram). Com `showResponses`, cada alternativa
mostra "votos · porcentagem%" ao vivo e, se a sala identificar as respostas, a
lista de nomes aparece; desligado, a lista de nomes é suprimida mesmo com a
identificação ativa (mostrar "Ana: Lista" revelaria a resposta).

**Celular**: os mesmos botões de voto de `bar` e `pie`. O celular **não
conhece o gabarito** enquanto a pergunta está no ar: a sala guarda o `quiz`
com `correctOptionIds: []`, e as corretas ficam em `secret/answers`, que só o
dono lê (seção 8.16). O projetor junta os dois (`withAnswers`) para desenhar o
gabarito.

**Editor** (`QuizConfig`): "Pergunta" (o título), alternativas com marcador
de "correta" ao lado (caixa de seleção verde com `allowMultiple`, botão de
opção verde sem; clicar de novo no marcado desmarca e volta a "sem
gabarito"), "Adicionar alternativa", "Permitir escolher mais de uma
alternativa" (ao desligar, sobra no máximo um gabarito), "Mostrar as respostas
dos participantes na tela do apresentador" e "Adicionar um slide de resposta
logo depois". Remover uma alternativa remove o gabarito correspondente.

**Cronômetro** (detalhes de implementação na seção 8.4):

- Por padrão a pergunta fica no ar **20 segundos** (`quizTimerSeconds`, com
  tempo próprio por slide via `overrides.quizTimerSeconds`, inclusive `0`).
- A contagem aparece **só no projetor**, num card acima do rodapé: rótulo
  "Tempo restante" (ou "Tempo esgotado"), segundos grandes
  (`max(titleFontSize * 1.2, 52)` px) e milissegundos ao lado
  ("14.237s"), vermelho nos últimos 5 segundos. No celular não aparece: o
  relógio de cada aparelho diverge do projetor.
- Ao zerar **no projetor**: o apresentador encerra a pergunta para a sala
  inteira; os controles do celular travam ("Tempo esgotado: as respostas foram
  encerradas."); se o próximo slide for o `answer` dessa pergunta, a
  apresentação avança sozinha.
- Quem trava a plateia é o encerramento gravado na sala, nunca o relógio do
  celular.

| O apresentador... | O cronômetro... |
| --- | --- |
| sai da pergunta no meio da contagem | **pausa** |
| volta para essa pergunta | **retoma de onde parou** |
| volta para uma pergunta que já zerou | **continua zerado**: sem contagem nova, respostas congeladas, sem novo avanço automático |

**Rodapé**: como `bar`.

**PDF**: barras horizontais com a alternativa correta em verde e o prefixo
`[correta]`; tabela com a coluna "Resultado" (Correta ou Incorreta) quando há
gabarito.

**Exemplo de execução** (a linha do tempo completa com o gabarito está na
seção 12.3): "Qual estrutura garante ordem de inserção?", alternativas
Conjunto, Lista e Dicionário, correta Lista, `revealAnswer: true`, 20 s.

1. O apresentador avança para a pergunta. Na mesma escrita, a sala recebe
   `currentSlideIndex: 4` e `timers.s4 = { endsAt: agora + 20000,
   remainingMs: 20000 }`.
2. O projetor mostra A Conjunto, B Lista, C Dicionário e o card "Tempo
   restante 20.000s" correndo. O rodapé: "30 participante(s) · 0 responderam".
3. Os celulares mostram as três opções. Votos chegam; o rodapé sobe para "22
   responderam" sem revelar a distribuição.
4. Faltando 5 s, o card fica vermelho.
5. Em zero, o projetor avança para o gabarito na mesma escrita que congela o
   cronômetro (`timers.s4 = { endsAt: null, remainingMs: 0 }`).
6. Se o apresentador voltar à pergunta depois, ela aparece com "Tempo
   esgotado" e os celulares continuam travados.

### 7.5 `answer`: resposta correta (automático)

```ts
{ type: 'answer', quizSlideId: string }
```

Não tem conteúdo próprio: aponta para o `quiz` e reexibe as alternativas com
a correta destacada (cartão verde com marca de verificação no lugar da letra;
as erradas esmaecidas a 60%), mais **votos e porcentagem por alternativa**.
Projetor e celular assinam as respostas do **`quiz` de origem**
(`resultsSlideId = quizSlideId`), nunca as do próprio `answer`.

**Celular** (`AnswerReveal`): "Você acertou!" (verde) ou "Não foi dessa vez."
(âmbar), a lista com as corretas marcadas e o selo "sua resposta" na escolha
da pessoa; quem não respondeu vê "Você não respondeu esta pergunta.". Acerto
exige o **conjunto exato** de corretas (ordem irrelevante). Sem gabarito
definido, não há veredito.

**Suspense antes de revelar**: por **3 segundos** a tela mostra, no centro,
"A resposta certa é" seguido das reticências, que são a própria contagem: um
ponto, dois, três (um por segundo). O atraso absorve a diferença de
milissegundos com que cada celular recebe a troca de slide; sem ele, quem tem
a conexão mais rápida veria a resposta antes. A contagem é local
(`useRevealCountdown`).

**Só na primeira vez.** Quando o suspense termina, o projetor grava o slide em
`room.revealedSlideIds` (`arrayUnion`, idempotente) e, **na mesma escrita**,
publica as corretas da pergunta em `room.revealedAnswers[idDoQuiz]`
(`markAnswerRevealed`). Só aí os celulares conhecem o gabarito: o celular
mostra o veredito quando o suspense local terminou **e** as corretas chegaram
(`revealPending = reveal.pending || !answerPublished`); se a contagem dele
acabar antes da escrita do projetor, o suspense continua por mais um
instante.

| Situação | O que aparece |
| --- | --- |
| Primeira vez no gabarito | 3 s de "A resposta certa é…" e então a resposta |
| Voltar depois de revelado | A resposta na hora |
| Sair antes dos 3 s e voltar | O suspense recomeça (a revelação não aconteceu) |
| Participante que chega atrasado | A resposta na hora (as corretas já estão em `revealedAnswers`) |

**Ciclo de vida no editor** (`syncAnswerSlides`, reaplicado depois de toda
alteração na lista):

| Ação | Efeito |
| --- | --- |
| Ligar "Adicionar um slide de resposta" | Insere o `answer` logo depois do `quiz` |
| Desligar a opção | Remove o `answer` |
| Mover o `quiz` (arrastando ou pelo menu do slide) | O `answer` acompanha, sempre logo atrás |
| Apagar o `answer` pela lista | Equivale a desligar a opção no `quiz` |
| Apagar o `quiz` | O `answer` órfão é removido junto |

O slide reaproveitado preserva id, título e sobrescritas. Na lista, o gabarito
aparece recuado, com ícone de vínculo (`Link2`) no lugar da alça de arraste;
não arrasta, e o menu dele só tem "Remover o slide de resposta". O
painel do gabarito (`AnswerConfig`) só permite renomear ("Nome na lista de
slides") e explica de onde vêm as alternativas.

O gabarito **é** um slide de verdade: ocupa um índice, aparece para os
participantes e vai no JSON. No PDF não vira página (a página da pergunta já
traz o gabarito). Na exportação PPTX e no download dos slides vira título +
alternativas com a correta em verde; no modo leitura fica de fora (a pergunta
mostra a correta quando "Mostrar respostas certas" está ligado).

Gabarito cuja pergunta foi removida: "A pergunta deste gabarito não existe
mais." (o editor remove órfãos sozinho).

### 7.6 `text`: texto simples

```ts
{ type: 'text', content: string, align: 'left' | 'center' | 'right', fontSize: number }
```

- Slide de conteúdo, sem interação: abertura, explicações, transições.
- Projetor: o texto com quebras preservadas (`white-space: pre-wrap`), peso
  médio, altura de linha 1,25, centralizado na vertical e alinhado conforme
  `align`, em `fontSize` px.
- Celular: um quadro "O apresentador está exibindo um texto:" com o conteúdo
  (fonte limitada a 28 px).
- Editor: título, área de texto (5 linhas), três botões de alinhamento
  (Esquerda, Centro, Direita) e "Tamanho da fonte" (controle de 16 a 120, passo
  2). Nas opções do slide, "Tamanho do corpo" fica desativado: o `fontSize` do
  slide é o corpo.
- PDF: o conteúdo com o alinhamento, fonte limitada entre 12 e 28 pt.
- Sem rodapé de respostas.

**Exemplo de execução**: "Boas-vindas", conteúdo "Vamos falar sobre
dados\ne como interpretá-los", centro, 56 px. O projetor mostra duas linhas
centralizadas em 56 px; o celular mostra o quadro com as duas linhas em 28 px;
nenhum documento de resposta é criado.

### 7.7 `free`: slide livre

```ts
{ type: 'free', width: number, height: number, background: string, elements: FreeElement[] }
```

Slide só de exibição montado à mão: caixas de texto e imagens soltas, cada uma
com posição, tamanho, rotação e opacidade. É também o que cada slide de um
PowerPoint importado vira. Modelo na seção 5.3 e detalhes de implementação na
seção 10.

- A moldura tem o tamanho do formato (1920 x 1080 ou 1440 x 1080) e é escalada
  inteira para a tela (`ScaledFrame`), com faixas nas bordas quando a
  proporção da tela é outra. Fica igual no projetor, na prévia, no celular, na
  miniatura do resumo e no PDF.
- O título do slide **não** é desenhado: serve para a lista, o resumo e o PDF.
  Não há rodapé (não recebe respostas) nem "Opções deste slide".
- Celular: o slide inteiro numa caixa com `aspect-ratio` igual ao do slide,
  com borda arredondada.
- Imagens não ficam dentro do slide: o elemento guarda só o `assetId`.
  Enquanto uma imagem não chega, o lugar dela mostra um espaço reservado cinza
  com o ícone `ImageOff`.

**Edição** (prévia vira área de trabalho, painel do meio vira painel do slide):

| Ação | Como |
| --- | --- |
| Selecionar | Clique no elemento ou na lista de camadas |
| Mover | Arrastar; guias nas bordas e centros do slide e dos outros elementos (Alt desliga o encaixe); setas movem 1 px, com Shift 10 px |
| Redimensionar | 8 alças que respeitam a rotação. Imagens mantêm a proporção (Shift inverte); textos não |
| Editar texto | Clique duplo, ou Enter com a caixa selecionada; Esc sai da edição |
| Formatar | Barra do painel ou Ctrl+B, Ctrl+I, Ctrl+U. Com texto selecionado vale para a seleção; sem seleção, para a caixa inteira |
| Duplicar e excluir | Ctrl+D e Delete (ou Backspace), ou os botões do painel |
| Ordem | Lista de camadas (uma posição por vez) ou "Trazer para a frente" e "Enviar para trás" |
| Imagens | "Adicionar imagem", arrastar arquivos para a prévia ou colar com Ctrl+V |
| Editor ampliado | Botão "Ampliar": a mesma área ocupando a tela inteira, com o painel ao lado (Esc fecha) |

**Painel do slide** (`FreeSlideConfig`): nome na lista, cor de fundo, botões
"Adicionar texto" e "Adicionar imagem", lista de camadas (subir, descer,
excluir) e, para o elemento selecionado: posição X e Y, largura e altura
(mínimo 12), rotação (-180 a 180), opacidade (0 a 100%), trazer para a frente,
enviar para trás, duplicar, excluir.

**Painel de texto**: fonte (lista com as embutidas primeiro, marcadas como
"(embutida)", depois Arial, Helvetica, Verdana, Tahoma, Trebuchet MS, Segoe UI,
Calibri, Roboto, Open Sans, Georgia, Cambria, Times New Roman, Garamond,
Courier New, Impact, Comic Sans MS), tamanho (4 a 1000), negrito, itálico,
sublinhado, tachado, alinhamento horizontal (esquerda, centro, direita,
justificado), cor do texto, realce (com opção "nenhuma"), marcadores, posição
vertical (em cima, no meio, embaixo), altura da linha (0,8 a 2,5, passo 0,05;
padrão 1,2), margem interna (0 a 120), fundo da caixa e "Uniformizar
formatação" (remove os estilos dos trechos, fica só o da caixa). Quando a
seleção mistura valores, o controle fica vazio ("Misto", "Várias fontes").

Opções de marcador:

| Valor | Rótulo | Marcador gravado |
| --- | --- | --- |
| `none` | Nenhum | sem `bullet` |
| `dot` | Ponto | `{ kind: 'char', char: '•' }` |
| `dash` | Traço | `{ kind: 'char', char: '\u2013' }` (traço curto) |
| `square` | Quadrado | `{ kind: 'char', char: '▪' }` |
| `arrow` | Seta | `{ kind: 'char', char: '\u203A' }` (aspa angular simples) |
| `num` | Números | `{ kind: 'number', format: 'arabic', suffix: '.' }` |
| `alpha` | Letras | `{ kind: 'number', format: 'alphaLower', suffix: ')' }` |
| `roman` | Romanos | `{ kind: 'number', format: 'romanLower', suffix: '.' }` |

Ao escolher um marcador, `indent` e `hanging` recebem `round(tamanhoBase * 1,1)`
para o marcador ficar pendurado à esquerda.

**Painel de imagem**: encaixe (esticar `fill`, conter `contain`, preencher
`cover`), cantos arredondados (0 até metade do menor lado), "Trocar imagem"
(mantém posição e largura e recalcula a altura pela proporção nova) e
"Proporção original".

**O que vem de um PowerPoint**

| No .pptx | No slide livre |
| --- | --- |
| Caixa de texto, espaço reservado com texto, texto dentro de forma | Caixa de texto editável com fonte, tamanho, cor, negrito, itálico, sublinhado, tachado, realce, alinhamento, marcadores, recuos, espaçamentos e posição vertical |
| Foto (com recorte, máscara ou SVG) | Imagem |
| Fundo (cor, gradiente, imagem, ladrilho, padrão) | Cor de fundo, ou imagem do slide inteiro quando não é cor sólida |
| Forma, linha, conector, forma livre | Imagem; o texto da forma continua texto por cima |
| Tabela, gráfico, SmartArt | Imagem |
| Grupo | Os itens um a um, com a transformação do grupo aplicada |
| Itens gráficos vizinhos na ordem de desenho | Uma imagem só |
| Slide oculto | Ignorado |
| Fontes embutidas (`ppt/fonts/*.fntdata`) | Fontes da apresentação |

**O que vai para um PowerPoint**: cada caixa de texto vira caixa de texto com
trechos, marcadores, recuos e espaçamentos; cada imagem vira imagem com
encaixe, cantos e transparência; a cor de fundo vira o fundo; as fontes
embutidas usadas vão junto.

**Exemplo de execução**

1. No editor, "Adicionar slide" e "Slide livre": nasce com fundo branco,
   1920 x 1080 e o título de exemplo.
2. Clique duplo no título, digita "Dados contam histórias"; seleciona
   "histórias" e aperta Ctrl+B: o parágrafo passa a ter dois trechos, o
   segundo com `{ bold: true }`.
3. Arrasta um arquivo `grafico.png` (2400 x 1600) para a prévia: a imagem é
   reduzida para 1920 x 1280, comprimida (`img_3fa1...`), adicionada a
   `assets` e posicionada no ponto do soltar com no máximo metade da moldura
   (960 x 640).
4. Arrasta a imagem: a guia vertical do centro do slide aparece a 8 px de
   tela; solta alinhada ao centro.
5. Inicia a apresentação: `createRoom` grava a sala sem a imagem e depois o
   documento `rooms/K7MP2Q/assets/img_3fa1...`.
6. No projetor, ao chegar a esse slide (ou ao estar no anterior), a imagem é
   lida uma vez e guardada em memória; enquanto não chega, aparece o espaço
   reservado. Os celulares fazem o mesmo, mostrando o slide em miniatura com a
   mesma composição.

### 7.8 Slide final automático

Quando o apresentador avança além do último slide, `currentSlideIndex` vira
`slides.length` e, **na mesma escrita**, a sala recebe `status: 'ended'`
(seção 8.15). O botão "Encerrar" faz a mesma coisa a partir de qualquer
slide:

- **Projetor** (`SummarySlide`): "Obrigado por participar!", "Resumo de
  "<título>"", o botão central **Baixar resultados (PDF)** e uma grade (2
  colunas, 3 em telas médias, linhas de 220 px) com a miniatura de cada slide:
  nuvem, barras (rótulos de 11 px), pizza, lista de alternativas com o
  gabarito, texto ou o próprio slide livre reduzido. As respostas de todos os
  slides são lidas uma vez (`getAllResponses`) ao chegar ali, e todas as
  imagens são buscadas. **Nada baixa sozinho**.
- **Celular**: ícone de comemoração (`PartyPopper`), "Obrigado por
  participar!" e "A apresentação foi encerrada.", com **Rever os slides**
  (abre `/view/<código>`) e, se `settings.allowDownload`, o bloco **Baixar
  slides** ("PDF dos slides" e "PowerPoint (.pptx)").
- Navegação: o contador do cabeçalho mostra "Fim" e os botões de navegação
  ficam desativados (a sala encerrada não muda mais). Uma faixa avisa "A
  apresentação foi encerrada." com **Apresentar de novo**, que abre uma sala
  nova com o mesmo conteúdo.

---

## 8. Tempo real e comunicação

Não existe servidor da aplicação. Todos os navegadores conversam **através do
Firestore**: quem escreve grava um documento; quem lê mantém uma assinatura
(`onSnapshot`) e recebe a atualização em milissegundos.

A seção 8.0 explica o sincronismo de ponta a ponta (quem escreve, quem ouve,
os fluxos de cada interação, as garantias de consistência, a reconexão, o
custo e como reproduzir com outra tecnologia). As seções 8.1 a 8.14
detalham a implementação de cada parte.

### 8.0 Como o sincronismo em tempo real funciona

Esta é a peça central do projeto: é o que permite que a plateia (alunos,
participantes) interaja com a apresentação ao mesmo tempo que ela acontece. O
apresentador troca de slide e todos os celulares acompanham; um aluno toca numa
alternativa e o gráfico do projetor muda; o tempo acaba e as respostas travam
para todos juntos. Tudo isso **sem servidor próprio**, só com o Cloud
Firestore e o SDK dele rodando em cada navegador.

#### 8.0.1 A ideia em uma frase

**O estado da apresentação mora em documentos do Firestore; cada navegador
escreve só a sua parte e "assina" (fica ouvindo) os documentos de que
precisa; o Firestore empurra cada mudança para todos os ouvintes em
milissegundos.** Não existe mensagem direta entre apresentador e aluno, nem
um processo central coordenando a sala: o próprio documento compartilhado é o
canal de comunicação.

É o padrão **publicar e assinar sobre estado compartilhado**:

- **Publicar** é gravar um documento (`setDoc`, `updateDoc`, `deleteDoc`,
  `writeBatch`).
- **Assinar** é abrir um ouvinte com `onSnapshot` num documento ou numa
  consulta. O ouvinte recebe primeiro o estado atual completo e, depois,
  uma nova versão a cada mudança, até ser cancelado.
- A interface **nunca guarda uma cópia própria do estado compartilhado**: o
  React só desenha o último snapshot recebido. Por isso duas telas que ouvem o
  mesmo documento mostram sempre a mesma coisa.

#### 8.0.2 As peças envolvidas

| Peça | Papel no sincronismo |
| --- | --- |
| Cloud Firestore (nuvem) | Guarda o estado (sala, respostas, presença) e envia cada mudança para quem tem ouvinte aberto naquele documento ou consulta |
| SDK do Firestore no navegador (`firebase/firestore`) | Mantém uma conexão persistente de streaming com o Firestore (em redes que bloqueiam streaming, o SDK pode recorrer a long polling), um cache em memória, a compensação de latência (seção 8.0.6) e a reconexão automática |
| Autenticação Anônima (`firebase/auth`) | Dá a cada aparelho um `uid` estável, sem cadastro. É a identidade usada pelas regras para saber quem pode escrever o quê |
| Regras do Firestore (`firestore.rules`) | Validam cada escrita no servidor: só o dono muda a sala, e só enquanto ela está no ar; só o dono lê os gabaritos; cada aluno só grava a própria resposta e a própria presença, com os campos e tamanhos esperados |
| Hooks React (`hooks/`) | Abrem um ouvinte quando a tela precisa de um dado e fecham quando não precisa mais (cleanup do `useEffect`) |
| Documento da sala `rooms/{code}` | O canal de controle: slide atual, status, cronômetros, gabaritos revelados e publicados, opções e revisão. Só o apresentador escreve; todos ouvem |

O padrão de todos os hooks de assinatura é o mesmo:

```ts
// lib/rooms.ts
export function subscribeRoom(code: string, onData: (room: Room | null) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    doc(db, 'rooms', code),
    (snap) => onData(snap.exists() ? (snap.data() as Room) : null),   // estado atual e cada mudança
    (error) => onError?.(error),
  )   // devolve a função que cancela o ouvinte
}

// hooks/useRoom.ts
export function useRoom(code: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!code) { setLoading(false); return }
    setLoading(true); setError(null)
    const unsubscribe = subscribeRoom(
      code,
      (r) => { setRoom(r); setLoading(false) },
      (e) => { setError(e.message); setLoading(false) },
    )
    return unsubscribe            // trocar de sala ou sair da tela fecha o ouvinte
  }, [code])
  return { room, loading, error }
}
```

#### 8.0.3 Quem escreve e quem ouve cada dado

| Dado | Caminho | Quem escreve | Quando escreve | Quem ouve | Como ouve |
| --- | --- | --- | --- | --- | --- |
| Slide atual, status, cronômetros, gabaritos revelados e publicados, título, slides (sem gabarito), opções, revisão | `rooms/{code}` | Só o apresentador (dono) | Trocar de slide; abrir um slide com tempo; o tempo zerar; terminar o suspense do gabarito (publicando as corretas); encerrar; salvar uma edição | Projetor, todos os celulares e a tela de edição | `useRoom` (ouvinte do documento) |
| Gabaritos das perguntas | `rooms/{code}/secret/answers` | Só o apresentador | No lote que cria a sala e no lote que salva uma edição | Só o projetor; a edição e o PDF da tela inicial leem uma vez | `useRoomAnswers` (ouvinte do documento) e `fetchAnswers` |
| Resposta de um aluno num slide | `rooms/{code}/responses/{slideId}__{uid}` | Só o próprio aluno | Tocar numa opção; enviar ou remover um texto; limpar a resposta | O projetor (todas as respostas do slide no ar) e o próprio aluno (só o documento dele) | `useResponses` (consulta `where('slideId', '==', id)`) e `useMyResponse` (ouvinte do documento) |
| Presença | `rooms/{code}/participants/{uid}` | Só o próprio aluno | Ao abrir a sala e quando o nome muda | Projetor e tela de edição | `useParticipants` (ouvinte da coleção) |
| Token do apresentador | `rooms/{code}/private/presenter` | Criação e reivindicação | Criar a sala; abrir a URL com o token em outro navegador | Ninguém (leitura proibida) | |
| Imagens dos slides livres | `rooms/{code}/assets/{id}` | Apresentador | Criar ou salvar a sala | Ninguém ouve: leitura única sob demanda, porque o id muda junto com o conteúdo | `useRoomAssets` (`getDoc` com cache) |
| Fontes embutidas | `rooms/{code}/fonts/...` | Apresentador | Criar ou salvar a sala | Ninguém ouve: uma consulta por `revision` | `useRoomFonts` (`getDocs` com cache) |

Três consequências dessa divisão:

1. **Não há conflito de escrita entre alunos**: cada um grava só documentos
   com o próprio `uid` no id. Mil alunos votando ao mesmo tempo gravam mil
   documentos diferentes.
2. **A sala tem um único escritor** (o apresentador), então o documento de
   controle nunca recebe escritas concorrentes da plateia.
3. **Cada tela ouve só o que mostra**: o aluno não baixa as respostas dos
   colegas; o projetor só ouve as respostas do slide que está no ar.

Quem abre ouvinte em cada tela:

| Tela | Ouvintes abertos |
| --- | --- |
| Projetor (`PresentPage`) | Sala; gabaritos (`secret/answers`); respostas do slide no ar (no gabarito, as da pergunta de origem); participantes |
| Celular do aluno (`RoomPage` + `ParticipateView`) | Sala; a própria resposta no slide no ar (no gabarito, a resposta dada na pergunta) |
| Edição da sala (`EditRoomPage`) | Sala (só para o acesso e a primeira carga); participantes (para a mensagem de confirmação) |

#### 8.0.4 Fluxo A: o apresentador troca de slide e todos acompanham

1. O apresentador aperta a seta para a direita (ou o passador de slides, ou o
   botão "Próximo slide").
2. `goTo(índice + 1)` lê a sala pela referência mais recente, limita o índice
   (o valor `slides.length` é o slide final) e calcula os cronômetros com
   `advanceTimers` (pausa o slide que sai, inicia ou retoma o que entra).
3. **Uma única escrita**: `updateDoc(rooms/{code}, { currentSlideIndex,
   timers, updatedAt })`. Se o novo índice for o slide final, a mesma escrita
   leva também `status: 'ended'` (seção 8.15).
4. A tela do apresentador muda **na hora**, porque o SDK entrega ao ouvinte
   local a versão com a escrita pendente (compensação de latência).
5. O Firestore valida a escrita pelas regras (o `uid` precisa ser o dono e a
   sala precisa estar `live`) e a confirma.
6. O Firestore envia a nova versão do documento a **todos os ouvintes** da
   sala. Em condições normais, isso leva de dezenas a poucas centenas de
   milissegundos.
7. Em cada celular, o `useRoom` recebe o snapshot e a `RoomPage` recalcula
   `currentSlide = room.slides[room.currentSlideIndex]`.
8. Como a `ParticipateView` usa `key={currentSlide.id}`, os controles do slide
   anterior são desmontados e os do novo slide nascem limpos (campo de texto
   vazio, nenhuma marcação local).
9. `useMyResponse` fecha o ouvinte do slide anterior e abre o do novo slide:
   se o aluno já tinha respondido esse slide antes (o apresentador voltou), a
   resposta reaparece marcada.
10. `useSlideTimer` passa a olhar `timers[novoSlide]`; `useRevealCountdown`
    começa o suspense se o novo slide for um gabarito ainda não revelado;
    `useRoomAssets` busca as imagens do slide no ar e do seguinte.
11. No projetor, `useResponses` fecha o ouvinte do slide anterior e abre o do
    novo; o primeiro snapshot já traz **todas as respostas existentes** desse
    slide, então voltar a um slide mostra o resultado acumulado.

Por que índice e cronômetros vão juntos: escrevendo separado, haveria um
instante em que os celulares veriam o slide novo com o cronômetro do anterior
(ou o contrário). Com uma escrita só, todos recebem o par já coerente.

#### 8.0.5 Fluxo B: o aluno responde e o projetor atualiza

1. A aluna toca na alternativa "B".
2. `ChoiceInput` monta o novo valor (`['b']` na escolha única, ou a lista
   alternada na múltipla) e chama `saveResponse`, que faz `setDoc` em
   `responses/{slideId}__{uid}` com `{ slideId, participantUid, type: 'choice',
   value, createdAt, participantName? }`. Enquanto a promessa não volta, os
   botões ficam ocupados (`busy`) para evitar toques duplos.
3. O ouvinte `useMyResponse` do próprio celular recebe a versão local na hora:
   o botão aparece marcado e surge "Voto registrado".
4. O Firestore valida (o `participantUid` precisa ser o `uid` de quem grava, o
   id precisa ser `{slideId}__{uid}`, só os campos esperados, até 100 itens e
   a sala no ar) e confirma; a promessa do `setDoc` resolve e os botões voltam
   a ficar livres.
5. O ouvinte `useResponses` do projetor (consulta das respostas do slide)
   recebe a mudança.
6. O projetor recalcula com funções puras: `aggregateChoices` (barras, pizza,
   alternativas), `aggregateWords` (nuvem), `answeredCount` e
   `responseSummary` (rodapé) e `namedResponses` (lista "Nome: resposta").
7. O gráfico, a nuvem ou o quadro se redesenha. Na nuvem, o layout inteiro é
   refeito com transição.
8. Se a aluna estiver com a sala aberta em outra aba ou aparelho com o mesmo
   `uid`, aquela tela também marca a opção (o mesmo documento é ouvido lá).

Não existe botão "enviar" nos slides de escolha: **o toque é o envio**.
Trocar de opção regrava o mesmo documento; "Limpar resposta" o apaga
(`deleteDoc`), e o projetor recebe a remoção da mesma forma. Desmarcar a
última opção de uma múltipla escolha também apaga o documento. Na nuvem de
palavras, cada envio regrava o documento com a lista inteira de textos da
pessoa.

#### 8.0.6 Compensação de latência: por que a resposta aparece na hora

O código **não** mantém estado otimista próprio (não existe um `useState`
"votei em B" esperando o servidor). Mesmo assim, a marcação aparece
instantaneamente porque o SDK do Firestore aplica a escrita no cache local e
dispara os ouvintes daquele navegador antes da confirmação do servidor.

| Momento | Celular da aluna | Projetor |
| --- | --- | --- |
| Toque | Ouvinte local recebe a versão pendente: botão marcado | Nada ainda |
| Confirmação do servidor | Nada muda na tela; a promessa do `setDoc` resolve | Ouvinte recebe a resposta e o gráfico atualiza |
| Escrita recusada pelas regras (caso raro) | O SDK desfaz a versão local e o ouvinte recebe o estado anterior: o botão desmarca | Nada muda |

Por isso a regra do projeto é: **o que a tela mostra vem sempre de um
snapshot**. Isso mantém abas e aparelhos do mesmo aluno em sincronia e evita
divergência entre o que o aluno vê e o que o projetor contou.

#### 8.0.7 Fluxo C: entrada do aluno e contagem de presença

1. O aluno abre `/room/<código>` (QR, link curto, link completo ou digitando
   o código em `/join`).
2. `useParticipant` garante a sessão anônima e devolve o `uid`.
3. `useRoom` abre o ouvinte da sala; o primeiro snapshot já traz o slide no
   ar, as opções, os cronômetros e os gabaritos revelados e publicados. **Quem chega
   atrasado não precisa de nenhum "replay"**: o estado atual completo está no
   documento.
4. Se a sala pede o nome e ele ainda não foi informado, o `NamePrompt`
   aparece antes de qualquer slide.
5. `joinRoom` lê `participants/{uid}` e grava o documento (com
   `merge: true`; `joinedAt` só se ele ainda não existia). O ouvinte
   `useParticipants` do projetor recebe o documento novo e o contador de
   pessoas e o rodapé ("N participante(s)") sobem, mesmo sem nenhuma resposta.
6. O efeito de presença depende de `Boolean(room)` e não do objeto `room`;
   assim as trocas de slide (que geram snapshots novos da sala) não reescrevem
   a presença.
7. Se a sala já estiver encerrada, o celular vai direto para a tela final.

#### 8.0.8 Fluxo D: tempo, encerramento e revelação sincronizados

O tempo é sincronizado **sem nenhuma escrita por segundo**:

1. Ao entrar numa pergunta com cronômetro, o apresentador grava o **instante
   final** (`timers[slideId].endsAt`), na mesma escrita da troca de slide.
2. Cada aparelho calcula o tempo restante localmente (`endsAt - Date.now()`),
   amostrando a cada 250 ms. Só o projetor desenha a contagem (com
   `requestAnimationFrame`); o celular não mostra contagem, porque o relógio de
   cada aparelho pode estar alguns segundos adiantado ou atrasado.
3. Quando a contagem **do projetor** chega a zero, ele grava o encerramento
   (`{ endsAt: null, remainingMs: 0 }`) e, se o slide seguinte for o
   gabarito dessa pergunta, avança na mesma escrita.
4. Os celulares recebem esse snapshot e só então travam os botões
   (`closed`). **Quem trava a plateia é o estado da sala, nunca o relógio do
   celular.**
5. No gabarito, cada aparelho conta 3 segundos **localmente** a partir do
   momento em que recebeu a troca de slide ("A resposta certa é." "..."
   "..."). Como cada celular recebe a troca com alguns milissegundos de
   diferença, esse atraso faz todo mundo ver a resposta praticamente junto.
6. Terminado o suspense, o projetor grava, numa escrita só,
   `revealedSlideIds: arrayUnion(id)` e as corretas da pergunta em
   `revealedAnswers.<idDoQuiz>`. Até aqui o celular não conhecia o gabarito
   (a sala guarda o `quiz` sem ele). O celular mostra o veredito quando o
   suspense local terminou **e** as corretas chegaram. Quem chega depois, ou
   volta ao gabarito, recebe os dois campos no snapshot e vê a resposta na
   hora.

#### 8.0.9 Fluxo E: edição salva e reinício para todos

1. O apresentador salva uma edição da sala (`saveAndRestartRoom`).
2. Um lote (`writeBatch`) grava, no documento da sala, os slides (sem
   gabarito) e as opções novas, `currentSlideIndex: 0`, `timers: {}`,
   `revealedSlideIds: []`, `answersHidden: true`, `revealedAnswers: {}`,
   `status: 'live'` e `revision: increment(1)`, e, em `secret/answers`, os
   gabaritos novos.
3. Todos os celulares recebem o snapshot: como seguem `currentSlideIndex`,
   voltam ao primeiro slide sem nenhuma mensagem direta.
4. Cada celular compara `revision` com o valor que viu ao abrir; se aumentou,
   mostra por 10 segundos "O apresentador atualizou a apresentação e todos
   voltaram para o início.".
5. `useRoomFonts` refaz a leitura das fontes, porque a chave do cache inclui a
   `revision`.

#### 8.0.10 Sequência completa de uma interação

| Passo | Quem | Ação | Efeito nos outros |
| --- | --- | --- | --- |
| 1 | Apresentador | Cria a sala (`writeBatch` com sala, token e gabaritos) | Nenhum (ninguém conectado ainda) |
| 2 | Aluno | Abre a sala: ouvinte da sala + `joinRoom` | Projetor: contador de participantes sobe |
| 3 | Apresentador | Avança para a nuvem de palavras (`updateDoc` da sala) | Celulares: trocam para o campo de texto |
| 4 | Aluno | Envia "Feliz" (`setDoc` da resposta) | Projetor: "Feliz" aparece na nuvem; rodapé atualiza |
| 5 | Apresentador | Avança para a pergunta com 20 s (índice + `endsAt` numa escrita) | Celulares: mostram as alternativas |
| 6 | Aluno | Toca em "B" (`setDoc` da resposta) | Projetor: "N responderam" sobe (sem revelar a distribuição) |
| 7 | Projetor | Contagem zera: grava o encerramento e avança para o gabarito numa escrita | Celulares: mudam para o gabarito; suspense local de 3 s |
| 8 | Projetor | Fim do suspense: `arrayUnion` em `revealedSlideIds` e as corretas em `revealedAnswers`, numa escrita | Celulares: "Você acertou!" ou "Não foi dessa vez."; quem chegar depois vê a resposta na hora |
| 9 | Apresentador | Passa do último slide (`currentSlideIndex = slides.length` e `status: 'ended'` numa escrita) | Celulares: "Obrigado por participar!", "Rever os slides" e, se permitido, "Baixar slides"; respostas novas passam a ser recusadas |

#### 8.0.11 Garantias e decisões de consistência

- **Fonte única da verdade**: o Firestore. O React só deriva a tela do último
  snapshot; não há estado compartilhado duplicado em memória.
- **Estados que precisam chegar juntos vão na mesma escrita** (índice e
  cronômetros; encerramento da pergunta e avanço para o gabarito; registro da
  revelação e gabarito publicado; índice final e `status: 'ended'`; o
  reinício completo da edição, com sala e gabaritos num lote).
- **Ids determinísticos** (`{slideId}__{uid}`, `participants/{uid}`): reenviar
  é idempotente, nunca duplica, e apagar não precisa de consulta.
- **Escrita idempotente** para marcas de evento (`arrayUnion` em
  `revealedSlideIds`, `increment` em `revision`).
- **Última escrita vence** em cada documento. Como cada aluno só escreve os
  próprios documentos e a sala tem um único escritor, isso não gera
  conflitos. Exceção possível: o mesmo apresentador com duas abas do projetor
  abertas; as duas escrevem na sala e vale a última.
- **Ordem**: as versões de um mesmo documento chegam em ordem, mas não há
  ordem global entre documentos diferentes. O projeto não depende dela: o
  gabarito lê as respostas da pergunta de origem, e o bloqueio por tempo vem
  do mesmo documento que traz o slide.
- **Assinaturas com ciclo de vida**: todo ouvinte é cancelado no cleanup do
  `useEffect`; trocar de slide troca as assinaturas de respostas.
- **Efeitos com dependências estáveis**: escritas disparadas por efeitos
  (presença, início do cronômetro, encerramento, revelação) dependem de
  valores derivados (ids, booleanos), nunca do objeto da sala, para não
  reescrever a cada snapshot.
- **O bloqueio por tempo é da interface**, não das regras: uma resposta já em
  trânsito no momento do encerramento da pergunta ainda pode ser gravada. As
  regras só barram respostas depois do **fim da apresentação** (sala
  `ended`).
- **O desvio do relógio não é medido.** Só o projetor mostra a contagem, e ele
  compara o `endsAt` que ele mesmo gravou com o próprio relógio; o bloqueio do
  voto vem do estado da sala (`closed`). Medir o desvio de cada aparelho (com
  um `serverTimestamp()` gravado e lido de volta) não mudaria nada do que a
  plateia vê. `createdAt` e `updatedAt` continuam vindo de `Date.now()`.

#### 8.0.12 Conexão instável, recarregar e trocar de aparelho

| Situação | O que acontece |
| --- | --- |
| A rede cai por alguns segundos | O SDK reconecta sozinho; os ouvintes recebem o estado atual ao voltar (inclusive se o slide mudou nesse meio tempo) |
| O aluno responde sem rede | A marcação aparece pela compensação local; a escrita fica na fila em memória e é enviada quando a conexão volta, desde que a página continue aberta (o projeto não liga a persistência em disco do Firestore). Os botões ficam ocupados até a confirmação |
| O aluno recarrega a página | O `uid` anônimo continua o mesmo (o Auth guarda a sessão no navegador), o nome vem do `localStorage` e a resposta reaparece, porque o documento é ligado ao `uid` |
| O aluno troca de aparelho ou de navegador | Recebe um `uid` novo: conta como outro participante e começa sem respostas; as anteriores ficam com o `uid` antigo |
| O apresentador recarrega | O token na URL reivindica o controle; slide, cronômetros e revelações estão no documento, então a apresentação continua do mesmo ponto. Se o tempo acabou enquanto a página estava fechada, ao abrir ele encerra a pergunta e avança para o gabarito |
| O apresentador fecha o projetor no meio de uma pergunta | Nada encerra a pergunta (só o projetor encerra); os alunos continuam podendo responder até o projetor ser reaberto |
| Uma resposta chega depois do fim da apresentação | As regras recusam (a sala não está mais `live`); a tela do aluno já mostra o fim |

#### 8.0.13 Desempenho e custo do sincronismo

Cada mudança entregue a um ouvinte conta como leitura no Firestore, e um
ouvinte de documento recebe **o documento inteiro** a cada mudança. Daí as
principais decisões de desenho:

| Decisão | Motivo ligado ao sincronismo |
| --- | --- |
| Sala pequena (abaixo de 1 MiB), sem imagens e sem fontes | Toda troca de slide envia o documento da sala inteiro para cada aluno conectado |
| Imagens e fontes em subcoleções, lidas uma vez | Não são reenviadas a cada troca de slide |
| Uma resposta por documento, e não contadores na sala | Cada aluno escreve num documento diferente, sem disputa; um único documento recebendo centenas de escritas por segundo seria um gargalo (o Firestore recomenda cerca de uma escrita por segundo, sustentada, por documento) |
| Cronômetro por instante final | Uma escrita por troca de slide, e não uma por segundo para cada ouvinte |
| Sem heartbeat de presença | Evita escritas e leituras periódicas proporcionais ao tamanho da plateia |
| O aluno ouve só a própria resposta | Não recebe as respostas dos colegas |
| O projetor ouve só as respostas do slide no ar | Consulta filtrada por `slideId` |

Estimativa para uma aula com 100 alunos, 10 slides (6 interativos), uma
resposta por aluno em cada slide interativo:

| Item | Conta aproximada | Total |
| --- | --- | --- |
| Escritas de presença | 100 | 100 |
| Escritas de respostas | 100 x 6 | cerca de 600 |
| Escritas na sala (trocas de slide, cronômetros, revelações, encerramento) | cerca de 15 | cerca de 15 |
| Leituras da sala nas regras (conferência de que ela está no ar, uma por escrita de resposta) | 600 | 600 |
| Leituras de cada mudança da sala | 15 x 101 ouvintes | cerca de 1.500 |
| Leituras das respostas (projetor + o próprio aluno) | 600 x 2 | cerca de 1.200 |
| Leituras de presença no projetor | 100 | 100 |
| PDF ao final (`getAllResponses`) | 600 | 600 |

São milhares de operações por aula, o que costuma caber nas cotas diárias do
plano gratuito do Firebase (confira os valores atuais na página de preços do
Firebase). Slides com várias interações por aluno (nuvem com muitos textos,
múltipla escolha alternando opções) aumentam as escritas proporcionalmente.

#### 8.0.14 Como reproduzir o sincronismo com outra tecnologia

Se o sistema maior não usar Firebase, o mesmo comportamento pode ser obtido com
WebSocket próprio, Socket.IO, Supabase Realtime ou similares, desde que o
servidor ofereça estas garantias:

| Garantia do Firestore usada aqui | Equivalente a implementar |
| --- | --- |
| Ao assinar, recebe o estado atual completo | Ao entrar na sala (e a cada reconexão), o servidor envia o estado inteiro da sala e a resposta do próprio aluno |
| Cada mudança é empurrada aos ouvintes | Uma "sala" de broadcast por código; o servidor transmite o estado da sala a cada alteração |
| Ouvinte de consulta (respostas de um slide) | Canal só do apresentador recebendo inclusão, alteração e exclusão de respostas do slide no ar |
| Escrita atômica de vários campos | Uma única mensagem que atualiza índice e cronômetros juntos |
| Upsert por chave `slideId + uid` | Tabela de respostas com chave única (`slide_id`, `participant_uid`) e "insert or update" |
| Regras por usuário | Validação no servidor: só o dono muda a sala (e só com ela no ar); cada aluno só grava o que é dele, com campos e tamanhos validados; respostas recusadas depois do fim |
| Documento legível só pelo dono | Os gabaritos ficam numa tabela ou num canal só do apresentador; a plateia recebe cada gabarito no estado da sala, quando ele é revelado |
| Compensação de latência | Opcional: atualizar a interface do aluno ao enviar e corrigir se o servidor recusar |
| Reconexão automática | Reconectar e pedir o estado completo de novo |

Mensagens sugeridas para um protocolo próprio: `room:state` (servidor para
todos), `room:goto` e `room:timers` (apresentador), `response:upsert` e
`response:delete` (aluno), `response:changed` (servidor para o apresentador),
`presence:join` (aluno) e `presence:list` (servidor para o apresentador). A
lista de funções da camada `lib/` que precisam ser reimplementadas está na
seção 15.4.

### 8.1 Inicialização do Firebase (`lib/firebase.ts`)

```ts
const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const isFirebaseConfigured = Boolean(envConfig.apiKey && envConfig.projectId)

// Valores presentes, porém inválidos: sem eles, getAuth() lançaria
// auth/invalid-api-key ao carregar o módulo e a página ficaria em branco.
const FALLBACK_CONFIG = {
  apiKey: 'nao-configurado',
  authDomain: 'nao-configurado.firebaseapp.com',
  projectId: 'nao-configurado',
  storageBucket: 'nao-configurado.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
}

export const app = initializeApp(isFirebaseConfigured ? envConfig : FALLBACK_CONFIG)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Desenvolvimento: com VITE_FIREBASE_EMULATORS=true o app usa os emuladores
// locais (`npx firebase-tools emulators:start --only auth,firestore`), com as
// regras do firestore.rules e sem tocar no projeto real.
if (import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
```

Sem configuração, a tela de criação mostra o aviso "Firebase não configurado"
e só as operações de sala falham. O uso dos emuladores está na seção 14.1.

### 8.2 Autenticação anônima (`hooks/useParticipant.ts`)

Fluxo: `onAuthStateChanged`; se não houver usuário, `signInAnonymously`;
devolve `{ uid, error }`. O uid persiste entre recarregamentos no mesmo
navegador e identifica o dono da sala e o autor de cada resposta. Nenhum dado
pessoal é pedido pelo Firebase; o nome, quando existe, é digitado pela pessoa.

```ts
export function useParticipant() {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid)
      else signInAnonymously(auth).catch((e) => setError(e instanceof Error ? e.message : 'Falha ao autenticar anonimamente.'))
    })
  }, [])
  return { uid, error }
}
```

### 8.3 Assinaturas

| Hook | Assina | Quem usa |
| --- | --- | --- |
| `useRoom(code)` | `rooms/{code}` (`onSnapshot` do documento) | Apresentador, edição e participante |
| `useResponses(code, slideId)` | `responses` com `where('slideId', '==', slideId)` | Apresentador |
| `useMyResponse(code, slideId, uid)` | `responses/{slideId}__{uid}` | Participante |
| `useParticipants(code)` | `participants` (coleção inteira) | Apresentador e edição |
| `useRoomAnswers(code, enabled)` | `secret/answers` (só o dono lê; `enabled` quando o acesso foi concedido) | Apresentador |
| `useRoomAssets(code, ids)` | `assets/{id}` (leitura única com cache, não é assinatura) | Apresentador e participante |
| `useRoomFonts(code, revision, enabled)` | `fonts` (uma consulta por versão da sala) | Apresentador e participante |

Todos devolvem a função de cancelamento do `onSnapshot` no cleanup do
`useEffect`: trocar de slide ou sair da página encerra a escuta.

`useRoom` devolve `{ room, loading, error }`. `useResponses`,
`useParticipants` e `useMyResponse` devolvem a lista (ou o documento) e zeram
quando faltam parâmetros.

### 8.4 Navegação

O apresentador escreve `currentSlideIndex`; os participantes só observam.
`goTo(next)` no `PresentPage`:

```ts
const goTo = useCallback((next: number) => {
  const current = roomRef.current            // referência sempre atual da sala
  if (!code || !current || current.status === 'ended') return   // sala encerrada não anda
  const count = current.slides.length
  const clamped = Math.max(0, Math.min(next, count > 0 ? count : 0))   // count = slide final
  if (clamped === current.currentSlideIndex) return
  const timers = advanceTimers(current.timers, current.slides[current.currentSlideIndex],
                               current.slides[clamped], current.settings)
  // Índice e cronômetros na MESMA escrita; chegar ao slide final encerra a sala.
  void setCurrentSlide(code, clamped, timers,
    count > 0 && clamped === count ? { status: 'ended' } : undefined)
}, [code])

// lib/rooms.ts
export async function setCurrentSlide(code, index, timers, extra?: { status?: RoomStatus }) {
  await updateDoc(roomRef(code), {
    currentSlideIndex: index, timers, updatedAt: Date.now(),
    ...(extra?.status ? { status: extra.status } : {}),
  })
}
```

- Teclado: seta para a direita, `PageDown` e Espaço avançam; seta para a
  esquerda e `PageUp` voltam (funciona com passador de slides). Ignorado
  dentro de campos (`INPUT`, `TEXTAREA`, `contentEditable`), de modais
  (`[role="dialog"]`) e de menus (`[role="menu"]`), para as teclas ficarem
  com eles (a projeção do código, por exemplo, não troca o slide por trás).
- A sala é lida por `useRef` para o ouvinte de teclado não ser recadastrado a
  cada snapshot.
- Separar índice e cronômetros em duas escritas abriria um intervalo em que a
  plateia veria o slide novo com o tempo do anterior.

### 8.5 Cronômetro

O documento da sala guarda **um instante final por slide**, não uma contagem:

```ts
timers: {
  s4: { endsAt: 1735689600000, remainingMs: 20000 },  // correndo
  s7: { endsAt: null,          remainingMs: 12000 },  // pausado (fora do slide)
  s9: { endsAt: null,          remainingMs: 0 },      // esgotado, congelado
}
```

Transições (todas em `utils/timer.ts`, escritas só pelo apresentador):

| Situação | Escrita |
| --- | --- |
| Entra num slide pela primeira vez | `{ endsAt: agora + duração, remainingMs: duração }` |
| Sai de um slide que estava correndo | `{ endsAt: null, remainingMs: o que sobrou }` |
| Volta a um slide pausado | `{ endsAt: agora + remainingMs, remainingMs }` |
| A contagem do projetor zera | `{ endsAt: null, remainingMs: 0 }` (`closeTimer`) |
| Volta a um slide esgotado | nada muda |

```ts
export const REVEAL_DELAY_SECONDS = 3

export function slideTimerSeconds(slide, settings): number {
  if (slide?.type !== 'quiz') return 0
  return clampTimerSeconds(settings.quizTimerSeconds)
}

export function timerRemainingMs(timer, now = Date.now()): number | null {
  if (!timer) return null
  if (timer.endsAt === null) return Math.max(0, timer.remainingMs)
  return Math.max(0, timer.endsAt - now)
}

export function closeTimer(timers, slideId) {
  return { ...(timers ?? {}), [slideId]: { endsAt: null, remainingMs: 0 } }
}

export function advanceTimers(timers, from, to, global, now = Date.now()) {
  const next = { ...(timers ?? {}) }
  if (from && from.id !== to?.id) {
    const leaving = next[from.id]
    if (leaving && leaving.endsAt !== null) {
      next[from.id] = { endsAt: null, remainingMs: Math.max(0, leaving.endsAt - now) }   // pausa
    }
  }
  const total = to ? slideTimerSeconds(to, resolveSlideSettings(global, to)) * 1000 : 0
  if (to && total > 0) {
    const entering = next[to.id]
    if (!entering) {
      next[to.id] = { endsAt: now + total, remainingMs: total }                           // inicia
    } else if (entering.endsAt === null && entering.remainingMs > 0) {
      next[to.id] = { endsAt: now + entering.remainingMs, remainingMs: entering.remainingMs } // retoma
    }
    // esgotado continua esgotado; correndo continua correndo (recarregar sem sair do slide)
  }
  return next
}
```

Quem escreve: `setCurrentSlide` (na troca de slide) e `saveSlideTimers`, em
dois casos do `PresentPage`:

1. **Sala aberta ou retomada num slide com tempo** cujo cronômetro nunca
   começou, ou ficou pausado: grava
   `advanceTimers(timers, undefined, slideAtual, settings)`.
2. **A contagem do projetor zerou** (`runOut`): se o próximo slide é o
   `answer` dessa pergunta, chama `goTo(index + 1)` (o `advanceTimers` congela
   a pergunta em zero na mesma escrita); senão grava
   `closeTimer(timers, slideId)` e a pergunta fica no ar, travada.

Uma escrita por troca de slide, e não uma por segundo (que multiplicaria a
cota do plano gratuito pelos segundos da apresentação).

#### Quem exibe e quem encerra (`hooks/useSlideTimer.ts`)

| Campo | De onde vem | Quem usa |
| --- | --- | --- |
| `active` | o slide tem cronômetro (`quiz` com tempo maior que 0) | todos |
| `remainingMs` e `endsAt` | relógio **local**, a partir de `endsAt` (amostrado a cada 250 ms) | só o projetor, para desenhar |
| `closed` | estado **da sala**: registro com `endsAt: null` e `remainingMs <= 0` | todos, para travar as respostas |
| `runOut` | relógio **local** zerou com o cronômetro ainda correndo (`endsAt !== null && remainingMs <= 0`) | só o apresentador, como gatilho para encerrar |

```ts
export function useSlideTimer(room, slide, settings) {
  const total = slideTimerSeconds(slide, settings)
  const entry = total > 0 && slide ? room?.timers?.[slide.id] : undefined
  const endsAt = entry?.endsAt ?? null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (endsAt === null) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [endsAt])
  if (total <= 0) return IDLE   // { active: false, endsAt: null, remainingMs: 0, closed: false, runOut: false }
  // sem registro ainda: mostra o tempo cheio (evita a contagem piscar)
  const remainingMs = entry ? Math.min(timerRemainingMs(entry, now) ?? 0, total * 1000) : total * 1000
  return {
    active: true,
    endsAt,
    remainingMs,
    closed: entry !== undefined && entry.endsAt === null && entry.remainingMs <= 0,
    runOut: endsAt !== null && remainingMs <= 0,
  }
}
```

A separação corrige um erro real: quando cada celular decidia pelo próprio
relógio, um aparelho adiantado bloqueava as opções antes de o tempo acabar no
projetor. Agora o aparelho pode achar que o tempo acabou (`runOut`), mas nada
trava enquanto a sala não disser `closed`.

A contagem em milissegundos é animada dentro do `SlideCountdown` com
`requestAnimationFrame`: só o card se redesenha a cada quadro, sem arrastar o
quadro de alternativas e os gráficos.

Consequências assumidas:

- **O desvio do relógio não é medido.** Só o projetor desenha a contagem, e o
  `endsAt` foi gravado por ele mesmo: a comparação é com o próprio relógio. O
  bloqueio do voto vem do estado da sala (`closed`), não do relógio do
  celular, então medir o desvio de cada aparelho não mudaria nada do que a
  plateia vê. O tempo restante é limitado à duração do slide, e a troca para o
  gabarito quem decide é o apresentador.
- **O bloqueio do cronômetro é da interface, não das regras.** As regras do
  Firestore não conhecem o cronômetro: uma resposta em trânsito ainda pode ser
  gravada. As regras só barram respostas depois do fim da apresentação (sala
  `ended`). É o mesmo nível de confiança do resto da sala.

Por que pausar em vez de deixar correr: pular para uma referência no meio da
pergunta queimaria o tempo da plateia. E um cronômetro esgotado **não**
reinicia ao voltar: a pergunta encerrada é para ser revista, não refeita; isso
também impede que a troca automática para o gabarito dispare de novo.

### 8.6 Suspense do gabarito (`hooks/useRevealCountdown.ts`)

```ts
export function useRevealCountdown(key: string | null, { revealed = false, seconds = 3 } = {}) {
  // o passo fica junto da chave do slide: trocar de slide reinicia já na primeira renderização
  const [progress, setProgress] = useState({ key, step: 0 })
  const step = progress.key === key ? progress.step : 0
  const skip = key === null || revealed || seconds <= 0
  useEffect(() => {
    setProgress({ key, step: 0 })   // reinicia sempre, para uma volta ao mesmo gabarito recomeçar do zero
    if (skip) return
    let elapsed = 0
    const id = window.setInterval(() => {
      elapsed += 1
      setProgress({ key, step: elapsed })
      if (elapsed >= seconds) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [key, seconds, skip])
  if (skip) return { pending: false, dots: 0 }
  return { pending: step < seconds, dots: Math.min(step + 1, seconds) }   // ".", "..", "..."
}
```

- `key` é o id do slide `answer` no ar (ou `null`).
- `revealed` vem de `room.revealedSlideIds.includes(answerSlideId)`.
- No projetor, quando `pending` vira falso e o slide ainda não estava
  revelado (e a sala está no ar), `markAnswerRevealed` grava numa escrita só
  o registro da revelação e o gabarito publicado. Falhar só faz o suspense se
  repetir.

```ts
export async function markAnswerRevealed(code, answerSlideId, quizSlideId, correctOptionIds) {
  await updateDoc(
    roomRef(code),
    new FieldPath('revealedAnswers', quizSlideId),   // o id pode ter caracteres que um caminho com pontos não aceita
    correctOptionIds,
    'revealedSlideIds', arrayUnion(answerSlideId),
    'updatedAt', Date.now(),
  )
}
```

O efeito do projetor depende do id do slide e de uma chave em texto com o id
da pergunta e as corretas (`JSON.stringify([quizId, correctOptionIds])`), não
do array, que muda de identidade a cada snapshot.

No celular, o veredito espera as duas coisas:

```ts
const answerPublished = quizSlide ? isAnswerPublished(room, quizSlide.id) : true
const revealPending = reveal.pending || !answerPublished
```

### 8.7 Presença (`lib/participants.ts`)

```ts
export async function joinRoom(code: string, uid: string, name?: string) {
  const ref = doc(participantsCol(code), uid)
  const now = Date.now()
  const existing = await getDoc(ref)
  const payload = {
    uid,
    lastSeenAt: now,
    ...(existing.exists() ? {} : { joinedAt: now }),   // só na criação
    ...(name?.trim() ? { name: name.trim() } : {}),
  }
  await setDoc(ref, payload, { merge: true })   // merge preserva joinedAt e o nome
}
```

Chamado pela `RoomPage` assim que a pessoa entra (e antes de qualquer
resposta), e de novo quando o nome muda. Separa os dois números do rodapé:

- **participantes** = `participants.length` (quem abriu a sala);
- **responderam** = `answeredCount(responses)` (uids distintos com resposta).

Decisões deliberadas:

- **Sem heartbeat.** Um heartbeat por minuto multiplicaria as escritas sem
  mudar a contagem pedida ("quem conectou já é participante").
- **Dependência estável no efeito.** O efeito de presença depende de
  `Boolean(room)`, não do objeto `room` (que muda a cada snapshot, inclusive
  na troca de slide). Sem isso, cada participante reescreveria a presença a
  cada slide.

```ts
const roomExists = Boolean(room)
useEffect(() => {
  if (!code || !uid || !roomExists || needsName) return
  void joinRoom(code, uid, askName ? (name ?? undefined) : undefined).catch(() => {})
}, [code, uid, roomExists, needsName, name, askName])
```

### 8.8 Respostas (`lib/responses.ts`)

```ts
const responseId = (slideId: string, uid: string) => `${slideId}__${uid}`

/** Itens por resposta: o mesmo limite das regras do Firestore. */
export const MAX_RESPONSE_ITEMS = 100

export async function saveResponse(code, slideId, participantUid, type, value, participantName?) {
  // Lista vazia (múltipla escolha toda desmarcada) APAGA: um documento vazio
  // contaria como "respondeu" no rodapé.
  if (value.length === 0) return clearResponse(code, slideId, participantUid)
  const payload: ResponseDoc = {
    slideId, participantUid, type, value, createdAt: Date.now(),
    ...(participantName?.trim() ? { participantName: participantName.trim() } : {}),
  }
  await setDoc(doc(responsesCol(code), responseId(slideId, participantUid)), payload)
}

export async function clearResponse(code, slideId, participantUid) {
  await deleteDoc(doc(responsesCol(code), responseId(slideId, participantUid)))
}

export function subscribeResponses(code, slideId, onData, onError?) {
  const q = query(responsesCol(code), where('slideId', '==', slideId))
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as ResponseDoc)), onError)
}

export async function getAllResponses(code) { /* getDocs da coleção inteira (PDF e resumo) */ }

export function subscribeMyResponse(code, slideId, uid, onData, onError?) {
  return onSnapshot(doc(responsesCol(code), responseId(slideId, uid)),
    (snap) => onData(snap.exists() ? (snap.data() as ResponseDoc) : null), onError)
}
```

`participantName` só é passado quando a sala pede o nome
(`participantName={askName ? name : null}`).

Ciclo de uma resposta:

1. O participante toca na opção.
2. `saveResponse` faz `setDoc` em `rooms/{code}/responses/{slideId}__{uid}`.
3. O `onSnapshot` do apresentador (`useResponses`) recebe a coleção; o
   `aggregateChoices` recalcula e o gráfico ou quadro se redesenha.
4. O `onSnapshot` do próprio participante (`useMyResponse`) recebe o
   documento e o botão aparece marcado (inclusive em outras abas dele).

Não há confirmação nem botão "enviar" nos slides de escolha: o toque **é** o
envio, e o estado exibido vem sempre do Firestore, nunca de um estado local
otimista.

### 8.9 Controle do apresentador (token)

`createRoom(creatorUid, presentation)` (`lib/rooms.ts`):

```ts
for (let attempt = 0; attempt < 6; attempt++) {
  const code = generateRoomCode()
  const ref = roomRef(code)
  if ((await getDoc(ref)).exists()) continue
  const now = Date.now()
  const token = generatePresenterToken()
  const { assets = {}, fonts = {}, ...content } = presentation   // imagens e fontes fora da sala
  const { slides, answers } = splitAnswers(content.slides)          // gabaritos fora da sala
  const room: Room = {
    ...content,
    slides,
    settings: withDefaults(presentation.settings),   // nunca undefined
    creatorUid, currentSlideIndex: 0, status: 'live',
    createdAt: now, updatedAt: now, timers: {}, revealedSlideIds: [],
    answersHidden: true, revealedAnswers: {},
  }
  assertRoomFits(room)   // JSON acima de 1.000.000 bytes: erro pedindo para dividir
  const batch = writeBatch(db)                     // sala, token e gabaritos numa escrita atômica
  batch.set(ref, room)
  batch.set(presenterRef(code), { token, ownerUid: creatorUid, createdAt: now })
  batch.set(answersRef(code), answers)
  await batch.commit()
  // depois da sala, porque as regras só deixam o dono gravar imagens e fontes
  try {
    await Promise.all([uploadAssets(code, Object.values(assets)), uploadFonts(code, Object.values(fonts))])
  } catch (e) {
    throw new Error(`A sala foi criada, mas as imagens ou fontes não foram enviadas: ${(e as Error).message}`)
  }
  return { code, token }
}
throw new Error('Não foi possível gerar um código de sala único. Tente novamente.')
```

O token vai na URL `/present/<código>/<token>`. Ao abrir essa URL em outro
navegador (ou depois de limpar os dados), `claimPresenter`:

```ts
export async function claimPresenter(code, uid, token) {
  // 1) prova o token: as regras só aceitam se for igual ao gravado
  await updateDoc(presenterRef(code), { ownerUid: uid, token })
  // 2) otimização: assume creatorUid para as próximas escritas não consultarem o doc privado
  try { await updateDoc(roomRef(code), { creatorUid: uid, updatedAt: Date.now() }) } catch { /* segue */ }
}
```

`usePresenterAccess(code, token, room, uid)` devolve `'checking'`,
`'granted'` ou `'denied'`:

1. Espera `code`, `room.creatorUid` e `uid`.
2. Se `creatorUid === uid`: `granted`.
3. Sem token: `denied` (tela "Acesso de apresentador necessário", com atalho
   para entrar como participante).
4. Com token: tenta `claimPresenter` uma única vez; sucesso `granted`, falha
   `denied`.
5. Com acesso concedido e token, grava a sessão no `localStorage`
   (`savePresenterSession({ code, token, title })`) para "Retomar" e
   "Exportar PDF" na tela inicial. A tela inicial lê cada sala lembrada uma
   vez (`getRoom`) e mostra a situação ("No ar", "Encerrada" ou "Não existe
   mais"); "Retomar" só aparece nas salas no ar, que vêm primeiro.

`presenterSessions` (chave `ip-presenter-sessions`): lista de
`{ code, token, title, updatedAt }`, no máximo 8, mais recentes primeiro,
inserção ou atualização por código, remoção pelo X na tela inicial.

### 8.10 Edição de uma sala em andamento

O botão **Editar** do projetor abre `/edit/<código>/<token>`, com a mesma
verificação de acesso. A tela (`EditRoomPage`):

1. Cria o **próprio** editor (`createEditorStore()` dentro de
   `EditorStoreContext.Provider`), sem tocar no rascunho da tela de criação.
2. Carrega a sala **uma única vez**: busca as imagens (`fetchAssets` de todos
   os ids usados), as fontes (`fetchRoomFonts(code, revision)`, com falha
   tolerada) e os gabaritos (`fetchAnswers`, devolvidos aos slides com
   `withAnswers`), chama `loadPresentation` e guarda o que a sala já tem
   (`stored = { assetIds, fontDocIds }`). Snapshots seguintes (troca de slide,
   cronômetro) não atropelam a edição. Com a sala encerrada, o editor não
   abre: a tela mostra "Esta apresentação foi encerrada e não pode mais ser
   editada." e "Voltar à apresentação".
3. Guarda uma linha de base `JSON.stringify({ title, settings, slides })` e
   habilita **Salvar alterações** só quando algo muda.
4. Mostra a faixa "Editando a sala XXXXXX, que já está em andamento. Ao
   salvar, a apresentação recomeça do primeiro slide para todos."
5. Ao salvar, pede confirmação com o número de participantes ("Ninguém entrou
   na sala ainda...", "Há 1 participante...", "Há N participantes nesta sala.
   Ao salvar, todos serão redirecionados para o início da apresentação, assim
   como você.") e avisa que cronômetros recomeçam, gabaritos voltam a ter o
   suspense e as respostas continuam guardadas.
6. Lista vazia é recusada: "A apresentação precisa de ao menos um slide.".
7. "Voltar à apresentação" com alterações pede para descartar ("Descartar e
   voltar" ou "Continuar editando").
8. Usa a mesma barra da criação (`EditorToolbar`): botão "Voltar" (só ícone
   no celular), título, ações (ou o menu "Mais") e o primário "Salvar
   alterações".

Enquanto o apresentador edita, nada é gravado e a plateia continua no slide em
que estava. Uma pergunta com cronômetro no ar não é encerrada durante a
edição (quem encerra é a tela de apresentação): descartando, o encerramento
acontece quando essa tela reabre; salvando, os cronômetros recomeçam.

`saveAndRestartRoom(code, presentation, stored)`:

```ts
const { assets = {}, fonts = {}, ...content } = presentation
const { slides, answers } = splitAnswers(content.slides)
const data = {
  title: content.title, slides, settings: withDefaults(content.settings),
  currentSlideIndex: 0, status: 'live', timers: {}, revealedSlideIds: [],
  answersHidden: true, revealedAnswers: {}, updatedAt: Date.now(),
}
assertRoomFits(data)
// 1) envia só as imagens e fontes que a sala ainda não tem (antes do documento)
await Promise.all([
  uploadAssets(code, Object.values(assets).filter((a) => !stored.assetIds.includes(a.id))),
  uploadFonts(code, Object.values(fonts).filter((f) => !stored.fontDocIds[f.id])),
])
// 2) sala e gabaritos num lote: ninguém vê perguntas novas com o gabarito antigo
const batch = writeBatch(db)
batch.update(roomRef(code), { ...data, revision: increment(1) })
batch.set(answersRef(code), answers)
await batch.commit()
// 3) limpeza das que nenhum slide usa mais (falha tolerada)
await deleteAssets(code, stored.assetIds.filter((id) => !assets[id])).catch(() => {})
await deleteFontDocs(code, /* todas as partes das fontes sem uso */).catch(() => {})
```

| Campo gravado | Valor |
| --- | --- |
| `title`, `slides`, `settings` | A versão editada (opções completas) |
| `currentSlideIndex` | `0`: todos voltam ao primeiro slide |
| `timers` | `{}` |
| `revealedSlideIds` | `[]` |
| `answersHidden`, `revealedAnswers` | `true` e `{}` |
| `status` | `live` |
| `revision` | `increment(1)` |
| `secret/answers` (no mesmo lote) | Os gabaritos da versão editada |

Depois de salvar, a tela navega para `/present/...`, que abre no slide 1.

No celular, a `RoomPage` guarda o `revision` que encontrou ao abrir. Quando
chega um maior, mostra por 10 segundos (ou até fechar) o aviso
"O apresentador atualizou a apresentação e todos voltaram para o início.".
Quem entra depois da edição não vê aviso.

```ts
const revision = room?.revision ?? 0
const [seenRevision, setSeenRevision] = useState<number | null>(null)
useEffect(() => { if (roomExists && seenRevision === null) setSeenRevision(revision) }, [roomExists, seenRevision, revision])
const restarted = seenRevision !== null && revision > seenRevision
useEffect(() => {
  if (!restarted) return
  const id = window.setTimeout(() => setSeenRevision(revision), 10_000)
  return () => window.clearTimeout(id)
}, [restarted, revision])
```

Decisões:

- **As respostas ficam.** Pertencem a um slide pelo id (preservado pelo
  editor), e as regras só deixam o autor apagá-las. Respostas de um slide
  removido ficam órfãs; votos em opção removida deixam de contar.
- **Nenhuma regra especial**: gravar a edição é um `update` comum, permitido
  ao dono com a sala no ar; os gabaritos seguem a regra de `secret`. Uma
  sala encerrada não pode ser editada.

### 8.11 Imagens dos slides livres (`lib/assets.ts`, `hooks/useRoomAssets.ts`)

- **Onde**: `rooms/{code}/assets/{assetId}`, uma por documento
  (`{ dataUrl, width, height, createdAt }`).
- **Escrita**: `uploadAssets` agrupa em lotes de até 8 documentos ou 7.000.000
  caracteres (o lote do Firestore aceita até 10 MiB, e as regras de cada
  escrita consultam a sala). Quem enviou já coloca a imagem no cache local.
- **Leitura**: sem assinatura (o id muda com o conteúdo, nunca fica
  desatualizado). Cache em memória por `código/id` com a **promessa**
  (leituras em andamento também são compartilhadas); falhas saem do cache para
  tentar de novo. `fetchAssets` usa `Promise.allSettled` e ignora as ausentes.
- `useRoomAssets(code, ids)` usa como dependência uma chave estável
  (`[...new Set(ids)].sort().join('|')`) e acumula o que chega.

| Tela | Imagens lidas |
| --- | --- |
| Projetor | As do slide no ar e do seguinte; no slide final, todas (miniaturas) |
| Celular | As do slide no ar e do seguinte |
| Edição da sala | Todas, antes de abrir o editor |
| PDF (projetor e tela inicial) | Todas, na hora de gerar |
| Download dos slides, "Apresentar de novo" e modo leitura da sala | Todas, na hora de gerar, de criar a sala nova ou de abrir |

`collectAssetIds(slides)` junta os `assetId` dos elementos de imagem dos
slides livres, sem repetição.

### 8.12 Fontes embutidas (`lib/fonts.ts`, `hooks/useRoomFonts.ts`)

- **Onde**: `rooms/{code}/fonts`, cada fonte dividida em partes de até 700.000
  caracteres: `{fontId}`, `{fontId}~1`, `{fontId}~2`... Documento:
  `{ fontId, family, weight, style, part, parts, data, createdAt }`.
- **Escrita**: `uploadFonts`, com os mesmos lotes das imagens. Na edição, só as
  novas; as sem uso são apagadas com todas as partes.
- **Leitura**: uma consulta à subcoleção inteira (`getDocs`), agrupando por
  `fontId` e juntando as partes na ordem de `part`. Fonte com parte faltando
  fica de fora. Cache por `código#revisão` (uma edição pode trocar as fontes).
  Depois, `registerFonts` registra cada uma com `FontFace` usando o nome da
  família; o texto já na tela troca de fonte sozinho.
- `useRoomFonts(code, revision, enabled)` só lê quando a sala tem slides
  livres.

| Tela | Quando lê |
| --- | --- |
| Projetor e celular | Ao abrir a sala e a cada edição |
| Edição da sala | Antes de abrir o editor |
| PDF | Antes de gerar (os slides livres são desenhados em canvas) |

Se uma fonte não carregar, o texto usa a próxima da pilha CSS: não é erro de
tela.

### 8.13 Regras de segurança

Arquivo integral no [Apêndice C](#apêndice-c-regras-de-segurança-do-firestore).

| Caminho | Leitura | Escrita |
| --- | --- | --- |
| `rooms/{code}` | pública (o código é a chave) | criar: autenticado, `creatorUid == uid` e `status == 'live'`; alterar: dono atual **ou** quem reivindicou pelo documento privado, **só com a sala `live`**; excluir: o dono |
| `rooms/{code}/private/{doc}` | **negada a todos** | criar: autenticado e `ownerUid == uid`; atualizar: autenticado, reenviando o **mesmo token** e com `ownerUid == uid`; excluir: negado |
| `rooms/{code}/secret/{doc}` | só o dono atual (`isRoomOwner`) | criar e atualizar: o dono, conferido na sala **depois** da escrita (`getAfter`), porque na criação a sala nasce no mesmo lote; excluir: negado |
| `rooms/{code}/participants/{uid}` | pública | criar e atualizar: só o próprio uid (id do documento e `data.uid`), só as chaves `uid`, `name`, `joinedAt`, `lastSeenAt`, nome texto de até 40 caracteres; excluir: o próprio |
| `rooms/{code}/responses/{id}` | pública | criar e atualizar: `participantUid == uid`; só as chaves `slideId`, `participantUid`, `type`, `value`, `participantName`, `createdAt`; `slideId` texto de até 200 caracteres; id igual a `slideId + '__' + uid`; `type` em `word` ou `choice`; `value` lista de até 100 itens; `createdAt` número; nome texto de até 40 caracteres; sala `live` (`isRoomLive`, uma leitura da sala por escrita). Excluir: só o autor, sempre |
| `rooms/{code}/assets/{id}` | pública | autenticado e dono da sala (`isRoomOwner`) |
| `rooms/{code}/fonts/{id}` | pública | autenticado e dono da sala (`isRoomOwner`) |

Funções auxiliares das regras: `roomPath(code)`, `presenterOwner(code)` (o
`ownerUid` do documento privado), `isRoomOwner(code)` (`creatorUid` da sala ou
`presenterOwner`) e `isRoomLive(code)` (`status == 'live'`).

Consequências:

- Quem tem o código **lê** a sala e os resultados, mas não apresenta.
- Ninguém lê o token de outra pessoa, nem o dono depois de gravado.
- Ninguém além do dono lê o gabarito antes da revelação.
- Uma sala encerrada não muda mais (nem índice, nem cronômetro, nem dono) e
  não recebe respostas.
- Ninguém edita ou apaga a resposta alheia, nem forja presença com outro uid;
  campos extras, listas enormes e nomes longos são recusados.
- Como a leitura das respostas é pública, **não se deve coletar dados
  sensíveis** por esses campos.

As regras não validam cada texto da lista (a linguagem de regras não percorre
listas); o limite de 80 caracteres por texto da nuvem fica no
`WordCloudInput`. Para testá-las sem o projeto real, use os emuladores (seção
14.1).

### 8.14 Limites e custos

- Escrita típica por participante: 1 documento de presença (com uma leitura
  antes) + 1 por slide respondido (sobrescrito, não acumulado). Cada escrita
  de resposta custa também uma leitura da sala nas regras.
- Leitura típica do apresentador: 1 assinatura da sala + 1 dos gabaritos + 1
  das respostas do slide atual + 1 dos participantes.
- PDF e slide final: uma leitura única de **todas** as respostas
  (`getAllResponses`).
- Fontes: uma consulta por aparelho e por versão da sala, só com slides
  livres; cada parte conta como uma leitura.
- Imagens: uma leitura por imagem por aparelho, só quando o slide está no ar
  ou é o próximo. Uma imagem de 900 mil caracteres ocupa cerca de 900 KB (o
  plano gratuito tem 1 GiB).
- Sem expiração automática: salas, respostas, imagens e fontes ficam até serem
  apagadas manualmente.

### 8.15 Encerramento da sala

| Gatilho | Escrita |
| --- | --- |
| Avançar do último slide para o slide final | `setCurrentSlide(code, slides.length, timers, { status: 'ended' })` |
| Botão "Encerrar" (confirmação "Encerrar a apresentação?") | `endRoom(code, slides.length, timers)`, com o cronômetro do slide no ar pausado (`advanceTimers(timers, slideAtual, undefined, settings)`) |

```ts
// lib/rooms.ts
export async function endRoom(code: string, slideCount: number, timers: SlideTimers) {
  await setCurrentSlide(code, slideCount, timers, { status: 'ended' })
}
```

Índice final e status vão na mesma escrita: nenhum aparelho vê o slide final
com a sala ainda aberta. Depois disso:

| Onde | Comportamento |
| --- | --- |
| Projetor | `goTo` não faz nada; botões de navegação desativados; efeitos de cronômetro e de revelação parados; "Editar" e "Encerrar" somem; faixa "A apresentação foi encerrada." com **Apresentar de novo** |
| Celular | Tela final ("Obrigado por participar!"), com **Rever os slides** e, se `allowDownload`, **Baixar slides** |
| Edição (`/edit/...`) | Não abre o editor: "Esta apresentação foi encerrada e não pode mais ser editada." |
| Modo leitura (`/view/<código>`) | Liberado (antes do fim: "A leitura fica disponível quando a apresentação terminar.") |
| Regras | `update` da sala recusado; respostas novas recusadas |
| Tela inicial | A sala aparece como "Encerrada", sem "Retomar" (o "Exportar PDF" continua) |

**Apresentar de novo** abre uma sala **nova** com o mesmo conteúdo, sem tocar
na antiga (que continua servindo ao PDF dos resultados e ao modo leitura):

```ts
const key = await fetchAnswers(code)                                   // gabaritos (o dono lê)
const presentation = await loadRoomPresentation(code, room, withAnswers(room.slides, key))
const created = await createRoom(uid, presentation)                    // código e token novos
savePresenterSession({ code: created.code, token: created.token, title: presentation.title })
navigate(`/present/${created.code}/${created.token}`)
```

`loadRoomPresentation(code, room, slides)` monta a `Presentation` completa de
uma sala (título, slides, opções com os padrões, imagens com `fetchAssets` e
fontes com `fetchRoomFonts`); é usada também pelo download dos slides.

### 8.16 Gabarito protegido (`lib/answers.ts`, `hooks/useRoomAnswers.ts`)

O documento da sala tem leitura pública. Se o gabarito ficasse nele, qualquer
participante poderia lê-lo pelas ferramentas do navegador antes da revelação.
Por isso ele é separado:

| Onde | O que fica | Quem lê |
| --- | --- | --- |
| `rooms/{code}` | Cada `quiz` com `correctOptionIds: []`, `answersHidden: true` e `revealedAnswers` (as corretas já publicadas, pelo id do quiz) | Todos |
| `rooms/{code}/secret/answers` | `{ [idDoQuiz]: idsDasCorretas }` | Só o dono atual |

```ts
export type AnswerKey = Record<string, string[]>

export const answersRef = (code: string) => doc(db, 'rooms', code, 'secret', 'answers')

/** Separa os gabaritos: a versão pública vai sem `correctOptionIds`. */
export function splitAnswers(slides: Slide[]): { slides: Slide[]; answers: AnswerKey } {
  const answers: AnswerKey = {}
  const publicSlides = slides.map((slide) => {
    if (slide.type !== 'quiz') return slide
    answers[slide.id] = slide.correctOptionIds
    return { ...slide, correctOptionIds: [] }
  })
  return { slides: publicSlides, answers }
}

/** Visão do dono. Sala antiga (sem registro no documento secreto): vale o do slide. */
export function withAnswers(slides: Slide[], answers: AnswerKey | null | undefined): Slide[] {
  if (!answers) return slides
  return slides.map((s) => (s.type === 'quiz' && answers[s.id] ? { ...s, correctOptionIds: answers[s.id] } : s))
}

/** Visão da plateia: cada pergunta só com o gabarito já publicado. */
export function withRevealedAnswers(room: Room): Slide[] {
  if (!room.answersHidden) return room.slides            // sala antiga: gabarito no próprio slide
  const revealed = room.revealedAnswers ?? {}
  return room.slides.map((s) => (s.type === 'quiz' ? { ...s, correctOptionIds: revealed[s.id] ?? [] } : s))
}

export function isAnswerPublished(room: Room, quizSlideId: string): boolean {
  return !room.answersHidden || Boolean(room.revealedAnswers && quizSlideId in room.revealedAnswers)
}

// subscribeAnswers(code, onData, onError): onSnapshot de answersRef
// fetchAnswers(code): getDoc de answersRef; sem permissão ou sem documento, null
```

| Quem | Como obtém o gabarito |
| --- | --- |
| Projetor | `useRoomAnswers(code, access === 'granted')` e `withAnswers(room.slides, answers)` |
| Edição da sala, PDF da tela inicial, "Apresentar de novo" | `fetchAnswers(code)` uma vez, com `withAnswers` |
| Celular, download dos slides, modo leitura da sala | `withRevealedAnswers(room)`: só as corretas já publicadas |

A publicação acontece no fim do suspense, por `markAnswerRevealed` (seção
8.6), numa escrita com o registro da revelação. Uma edição salva regrava os
gabaritos no mesmo lote da sala e zera `revealedAnswers`.

---

## 9. Estado, páginas, componentes e hooks

### 9.1 Onde vive cada estado

| Onde | O quê | Vive até |
| --- | --- | --- |
| `editorStore` (Zustand) | Apresentação em edição: título, slides, opções, imagens, fontes, seleção do slide e do elemento | O da criação volta depois de recarregar (rascunho, abaixo); o da edição de sala vive até sair da tela |
| `useDraftStatus` (Zustand) | Estado do rascunho: `'idle'`, `'saving'`, `'saved'` ou `'error'` | Enquanto a aba estiver aberta |
| `localStorage` `ip-editor-draft` | Rascunho da criação: `{ version: 1, title, slides, settings, selectedIndex, savedAt }` | Até "Começar do zero" |
| IndexedDB `ip-editor` (store `draft`, chave `files`) | Imagens e fontes usadas pelo rascunho (`{ assets, fonts }`) | Até "Começar do zero" |
| `themeStore` (Zustand + `localStorage`) | Tema claro/escuro | Sempre (por dispositivo) |
| Firestore | Sala publicada, respostas, presença, imagens, fontes | Até ser apagada |
| `localStorage` `ip-presenter-sessions` | Salas apresentadas neste dispositivo (com token) | Sempre |
| `localStorage` `ip-participant-names` | Nome do participante por sala (`{ [código]: nome }`) | Sempre |
| `localStorage` `ip-short-urls` | Link curto de cada URL longa | Sempre |
| `localStorage` `ip-theme` | `'light'` ou `'dark'` | Sempre |

Todo acesso ao `localStorage` fica em `try/catch`: indisponível (modo privado
restrito), o recurso vale só para a sessão.

### 9.2 `editorStore` em detalhe

`createEditorStore()` cria um editor **independente** (`createStore` do
Zustand). Os componentes de `components/editor/` usam o que estiver no
`EditorStoreContext`:

| Tela | Editor |
| --- | --- |
| `CreatePage` | O padrão do contexto (`defaultEditorStore`), criado uma vez no módulo e mantido enquanto a aba estiver aberta, com o rascunho persistido |
| `EditRoomPage` | Um editor próprio, criado ao abrir a tela e carregado com a sala |

```ts
export const defaultEditorStore = createEditorStore()
export const EditorStoreContext = createContext<EditorStore>(defaultEditorStore)
export function useEditorStore<T>(selector: (state: EditorState) => T): T {
  return useStore(useContext(EditorStoreContext), selector)
}
export function useEditorStoreApi(): EditorStore { return useContext(EditorStoreContext) }
```

Estado e ações:

```ts
interface EditorState {
  title: string                       // inicial: 'Minha apresentação'
  slides: Slide[]
  settings: PresentationSettings      // inicial: DEFAULT_SETTINGS
  selectedIndex: number
  assets: PresentationAssets
  fonts: PresentationFonts
  selectedElementId: string | null    // slide livre: elemento selecionado
  editingElementId: string | null     // slide livre: caixa de texto em edição
  textSelection: { elementId: string; start: number; end: number } | null

  setTitle(title): void
  updateSettings(patch): void         // trocar slideAspect reenquadra os slides livres da moldura antiga
  setOverride(id, key, value): void   // undefined remove a chave; sem chaves, remove overrides
  addSlide(type): void                // cria com createDefaultSlide(type, slideAspect) e seleciona
  updateSlide(id, patch): void
  removeSlide(id): void               // remover um 'answer' desliga revealAnswer no quiz de origem
  moveSlide(from, to): void
  reorderSlides(ids): void            // ordem entregue pela lista arrastada; reusa applySlides; sem mudança, não gera estado
  select(index): void                 // trocar de slide limpa seleção de elemento e de texto
  addAssets(assets): void
  selectElement(id): void
  setEditingElement(id): void
  setTextSelection(sel): void
  updateElement(slideId, elementId, patch): void
  setElements(slideId, elements): void   // elemento que saiu da lista deixa de estar selecionado
  appendSlides(slides, assets, fonts?): void  // "Adicionar ao fim" do PowerPoint; seleciona o primeiro novo
  loadPresentation(presentation): void        // completa settings com os padrões
  getPresentation(): Presentation             // só imagens e fontes ainda usadas (pickAssets, pickFonts)
  reset(): void
}
```

Auxiliares internos:

```ts
// Todo quiz com revealAnswer ganha um 'answer' logo depois; reaproveita o existente.
function syncAnswerSlides(slides: Slide[]): Slide[] {
  const existing = new Map<string, AnswerSlide>()
  for (const s of slides) if (s.type === 'answer' && !existing.has(s.quizSlideId)) existing.set(s.quizSlideId, s)
  const result: Slide[] = []
  for (const s of slides) {
    if (s.type === 'answer') continue
    result.push(s)
    if (s.type === 'quiz' && s.revealAnswer) result.push(existing.get(s.id) ?? createAnswerSlide(s.id, 'Resposta correta'))
  }
  return result
}

// Aplica o sync e mantém a seleção PELO ID do slide.
function applySlides(slides: Slide[], keepId: string | undefined, fallbackIndex: number) {
  const synced = syncAnswerSlides(slides)
  const found = keepId ? synced.findIndex((s) => s.id === keepId) : -1
  return { slides: synced, selectedIndex: found >= 0 ? found : clampIndex(fallbackIndex, synced.length) }
}
```

`updateSettings` com `slideAspect` novo: todo slide livre com `width` e
`height` iguais à moldura antiga passa por `fitFreeSlideToFrame(slide,
novaMoldura)`; slides com tamanho próprio ficam como estão.

As fontes do editor são registradas no navegador pelo `EditorWorkspace`
sempre que mudam (`registerFonts(Object.values(fonts))`).

```ts
reorderSlides: (ids) => set((s) => {
  const byId = new Map(s.slides.map((slide) => [slide.id, slide]))
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean)
  const seen = new Set(ordered.map((slide) => slide.id))
  const slides = [...ordered, ...s.slides.filter((slide) => !seen.has(slide.id))]   // nada se perde
  if (slides.every((slide, i) => slide.id === s.slides[i]?.id)) return {}           // nada mudou
  return applySlides(slides, s.slides[s.selectedIndex]?.id, s.selectedIndex)        // o gabarito volta para trás da pergunta
}),
```

#### Rascunho da criação (`store/editorDraft.ts`, `lib/draftStorage.ts`)

A `CreatePage` chama `startDraftPersistence(defaultEditorStore)` uma vez (num
`useState` com inicializador, antes de qualquer leitura do editor). A função é
idempotente:

1. **Restaura** o texto do `localStorage` na hora (sem piscar o editor vazio),
   só se o editor estiver intocado (título "Minha apresentação" e nenhum
   slide), validado com `presentationShapeSchema`; aplica com
   `loadPresentation` e `select(selectedIndex)`. As imagens e as fontes vêm
   depois, do IndexedDB, também validadas, e entram com `store.setState`.
2. **Grava** depois de restaurar: assina o editor e, a cada mudança de título,
   slides, opções, imagens, fontes ou slide selecionado, marca `'saving'` e
   agenda a gravação para 600 ms depois da última mudança. No `pagehide`, uma
   gravação pendente sai na hora.
3. A gravação escreve o texto sempre e as imagens e fontes só quando muda o
   conjunto de ids usados (`pickAssets` e `pickFonts`): digitar um texto não
   regrava megabytes. Imagens e fontes vão para o IndexedDB porque passariam
   do limite do `localStorage` (cerca de 5 MB).

`discardDraft(store)` ("Começar do zero", com confirmação) chama `reset()`,
cancela a gravação pendente e apaga o rascunho (`clearDraftStorage`). A
edição de uma sala não usa rascunho: parte sempre do que está no ar.

### 9.3 `themeStore`

```ts
// Inicial: valor salvo em 'ip-theme'; senão, prefers-color-scheme: dark; senão 'light'.
export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => { persist(theme); set({ theme }) },
  toggleTheme: () => set((s) => { const theme = s.theme === 'dark' ? 'light' : 'dark'; persist(theme); return { theme } }),
}))
```

`useApplyTheme(theme)` alterna a classe `.dark` no `<html>`.

### 9.4 Páginas

| Página | Responsabilidade | Detalhes |
| --- | --- | --- |
| `HomePage` | Entrada | Ícone `BarChart3`, título "Apresentação Interativa", texto "Crie enquetes, nuvens de palavras e gráficos ao vivo. A plateia participa pelo celular, sem instalar nada e sem criar conta."; cartões "Criar apresentação" (botão "Criar sala") e "Entrar em uma sala" (botão "Entrar na sala"); botão "Ler uma apresentação (.json)" (abre `/view`); lista "Continuar como apresentador (neste dispositivo)", com a situação de cada sala lida por `getRoom` (`StatusBadge`: "No ar" com o ícone `Radio`, "Encerrada" ou "Não existe mais"), as salas no ar primeiro e com borda azul, "Retomar" só nas salas no ar, "Exportar PDF" (busca sala, gabaritos, respostas, imagens e fontes) e X para remover |
| `CreatePage` | Editor e criação | `EditorToolbar` com voltar "Início" (só ícone no celular), campo do título, estado do rascunho ("Salvando…", "Rascunho salvo neste navegador" ou "Não foi possível salvar o rascunho"), ações (Opções, Prompt de IA, Importar, Exportar, tema; menu "Mais" abaixo de 1280 px), item raro "Começar do zero" e o primário **Iniciar apresentação**. Avisos: Firebase não configurado; falha da autenticação anônima; erros. Iniciar exige uid e ao menos um slide; chama `createRoom`, salva a sessão e navega para `/present/<código>/<token>` |
| `PresentPage` | Projetor | Acesso, navegação, slide, cronômetro, gabarito (com `useRoomAnswers`), código da sala (`RoomCodeDialog`, montado na página), PDF, slide final, Editar, Encerrar, Apresentar de novo, tela cheia, cabeçalho ocultável |
| `EditRoomPage` | Edição da sala iniciada | Seção 8.10 |
| `JoinPage` | Código | Campo grande (até 10 caracteres, maiúsculas), `normalizeRoomCode` (maiúsculas, sem espaços) e navega para `/room/<código>` |
| `RoomPage` | Participante | Cabeçalho compacto: "Trocar sala" (rótulo a partir de `sm`), nome, "Sala XXXXXX", tema; aviso de reinício; estados (entrando, erro, sala não encontrada, conectando, pedido de nome, aguardando, encerrada); `ParticipateView` com os slides de `withRevealedAnswers(room)` e `revealPending`; tela final com "Rever os slides" e `DownloadSlides`; rodapé "A tela acompanha o apresentador automaticamente." |
| `ViewPage` | Modo leitura | Seção 11.10 |

Cabeçalho do projetor, **sempre numa linha** (da esquerda para a direita):

| Item | Celular | `sm` (640 px) | `md` (768 px) | `xl` (1280 px) |
| --- | --- | --- | --- | --- |
| Sair | Só o ícone | Ícone e "Sair" | | |
| Código da sala (botão que abre o modal) | Código em `text-base` | Código maior | "Código:" antes | |
| Miniatura do QR (`ShareRoom`, abre o modal) | Oculta | Visível | | |
| Pessoas conectadas (ícone `Users`) | Visível | | | |
| Copiar link, Editar (ao vivo), Exportar PDF ("Gerando…"), Encerrar (ao vivo, tom de perigo), tela cheia, tema | No menu "Mais ações" | | | Como botões |
| Navegação (anterior, "N / total" ou "Fim", próximo) | Botões de 36 px, contador compacto | | | |
| Ocultar cabeçalho | Oculto | Visível | | |

O menu **Mais ações** (`Menu`, oculto a partir de `xl`) tem: Mostrar o código
da sala, Copiar link de entrada, Editar (só ao vivo), Exportar PDF, Tela
cheia (ou Sair da tela cheia), Tema claro ou escuro e, separado, Encerrar
("Leva todos à tela final e fecha a sala", só ao vivo). Com o cabeçalho
oculto, uma faixa de 12 px no topo o reexibe ao passar o mouse e um botão
flutuante "Cabeçalho" também. Com a sala encerrada, uma faixa (`Banner`)
abaixo do cabeçalho diz "A apresentação foi encerrada." e oferece
**Apresentar de novo** ("Abrindo a sala nova…").

Estados do projetor: "Carregando sala…", "Erro ao carregar a sala: ...",
"Sala não encontrada." (com "Voltar ao início"), "Verificando acesso de
apresentador…", tela de acesso negado, "Esta apresentação ainda não tem
slides.".

### 9.5 Layout do editor (`EditorWorkspace`)

O `EditorWorkspace` escolhe **uma** montagem pela largura, com
`useMediaQuery('(min-width: 1024px)')`: nunca as duas montadas e uma escondida
por CSS (o editor visual do slide livre e os modais existiriam em dobro).

**A partir de 1024 px: três colunas.** Grid
`grid-cols-[250px_minmax(0,1fr)_minmax(0,1.2fr)]` e, a partir de `xl`,
`xl:grid-cols-[290px_minmax(0,0.9fr)_minmax(0,1.35fr)]`. A página ocupa a
altura da janela (`lg:h-[100dvh] lg:overflow-hidden`), o grid recebe
`min-h-0 flex-1` e cada coluna (um `Card`) tem uma `ScrollArea` interna com
`min-h-0 flex-1`.

| Coluna | Fixo | Rolagem própria |
| --- | --- | --- |
| 1 | `AddSlideMenu` (botão "Adicionar slide" de largura total) e "Slides (N)" | `SlideList` |
| 2 | Título "Configuração" e o selo do tipo (`TypeBadge`) | Formulário do slide (`SlideEditor`) + "Opções deste slide" |
| 3 | "Prévia" (ou "Prévia e edição"), formato 16:9/4:3 e, no slide livre, "Ampliar" | Prévia |

**Abaixo de 1024 px: pilha.** Um cartão com três `StackSection` recolhíveis,
todas abertas de início, nesta ordem: "Slides (N)" (com o `AddSlideMenu` e a
`SlideList`), "Prévia" (ou "Prévia e edição", com o selo do tipo e os
controles da prévia; a prévia ganha a proporção do formato) e
"Configuração" (com o selo do tipo). Recolher **esconde** o corpo (`hidden`)
em vez de desmontar, para o editor visual não perder a seleção nem a rolagem.
Nada rola na horizontal até 360 px.

A prévia desenha o slide numa moldura do formato com `ScaledFrame` (fundo do
tema, sombra e anel), com o mesmo respiro do projetor (`px-6 py-6`), sem
respostas e com o cronômetro parado no tempo configurado. No slide livre, a
prévia é o `FreeSlideCanvas`; "Ampliar" abre um portal em tela inteira com o
canvas e o `FreeSlideConfig` lado a lado (400 px), fechado com Esc (exceto
quando o Esc foi usado pelo próprio slide).

> A combinação `min-h-0` + `flex-1` é o que faz a rolagem funcionar dentro de
> flex e grid: sem `min-h-0`, o item usa `min-height: auto` e estica o pai.

`SlideList` (framer-motion `Reorder.Group` como `<ol aria-label="Ordem dos
slides">`): cada item com a alça de arraste (`GripVertical`), o número, o
título (ou o rótulo do tipo), o ícone e o tipo, e um `Menu` "Ações do slide N"
com "Mover para cima", "Mover para baixo" (desativados nas pontas) e "Remover
slide"; selecionado com borda azul. Com o mouse, o cartão inteiro arrasta
(`dragListener={false}` e `controls.start` no `pointerdown`); no toque, só a
alça, com `touch-none`, para a rolagem da lista continuar funcionando. A
ordem muda na tela durante o arraste (estado local) e só é gravada no editor
ao soltar (`reorderSlides`); gravar a cada troca reposicionaria o gabarito no
meio do gesto. Um deslocamento acima de 4 px marca o gesto como arraste, para
o clique que o encerra não selecionar o slide. O gabarito aparece recuado,
com `Link2` no lugar da alça, não arrasta, e o menu dele só tem "Remover o
slide de resposta" ("Desliga a revelação na pergunta"). Vazia: "Nenhum slide
ainda. Use "Adicionar slide".".

### 9.6 Componentes por pasta

**`slides/`** (tela do apresentador)

| Componente | Função |
| --- | --- |
| `SlideDisplay` | Moldura de todo slide (seção 7.0). Recebe `slide`, `slides` (para o gabarito achar o quiz), `responses`, `settings` resolvido, `participants`, `countdown`, `revealPending`, `revealDots`, `assets`. O slide livre vira só `FreeSlideView`. |
| `ScaledFrame` | Desenha um conteúdo de tamanho fixo escalado com `transform: scale()` para caber, centralizado, medindo com `ResizeObserver`; o filho pode ser função que recebe a escala. |
| `OptionsBoard` | Alternativas em cartões com letras; modo `reveal` pinta a correta de verde; `showVotes` mostra "votos · pct%"; duas colunas com mais de 4 opções. |
| `NamedResponsesList` | Chips "Nome: resposta" com rolagem e altura limitada. |
| `SlideCountdown` | Card do cronômetro animado por `requestAnimationFrame`; vermelho nos últimos 5 s; `role="timer"` com `aria-live="off"`. |
| `AnswerSuspense` | "A resposta certa é" + pontos numa caixa de largura fixa (2em) para o texto não pular. |

**`free/`**: `FreeSlideView` (exibição; `FreeSlideStage` desenha a moldura e
os elementos), `FreeElementContent` (`FreeTextContent` e
`FreeImageContent`), `layout.ts` (estilos de caixa), `FreeTextEditable`
(edição com `contentEditable`), `FreeSlideCanvas` (área de trabalho). Seção 10.

**`participate/`**

| Componente | Função |
| --- | --- |
| `ParticipateView` | Escolhe o controle pelo tipo; resolve o alvo da resposta (no gabarito, a resposta dada na pergunta); slide livre numa caixa com a proporção dele; texto num quadro. Recebe `revealPending`, que segura o suspense até o gabarito ser publicado. |
| `ChoiceInput` | Voto em `bar`, `pie`, `quiz`; marcação redonda ou quadrada (`ChoiceMark`); "Voto registrado"; "Limpar resposta" ou cadeado; trava tudo com `timeUp` ("Tempo esgotado: as respostas foram encerradas."); desmarcar a última opção apaga a resposta. |
| `WordCloudInput` | Envio de textos (até 80), bloqueio de repetição, remoção individual e "Limpar tudo"; no modo sem limite, para em `MAX_RESPONSE_ITEMS` (100). |
| `AnswerReveal` | "Você acertou!" ou "Não foi dessa vez.", gabarito e "sua resposta". |
| `NamePrompt` | Ícone `UserRound`, título da sala, "Informe seu nome para entrar na sala.", campo (até 40, `autoComplete="name"`) e "Entrar". |

**`present/`**

| Componente | Função |
| --- | --- |
| `RoomCodeDialog` | Modal "Código da sala" e a projeção em tela cheia (seção 11.8). Props `{ code, joinUrl, open, onOpenChange }`; montado uma vez na página do projetor, aberto pelo código no cabeçalho, pela miniatura do QR e pelo menu. Exporta `QR_FG = '#111111'` e `QR_BG = '#ffffff'`. |
| `ShareRoom` | Só a miniatura do QR (32 px) no cabeçalho, com o ícone `Maximize2`; abre o modal. Props `{ joinUrl, onOpen, className }`; a classe de exibição vem toda de fora (`className ?? 'inline-flex'`), para um `hidden sm:inline-flex` não brigar com um `inline-flex` próprio. |
| `DownloadSlides` | Bloco "Baixar slides" com "PDF dos slides" e "PowerPoint (.pptx)" (seção 11.9). Props `{ loadPresentation, className }`. |
| `SummarySlide` | Slide final (seção 7.8). |
| `PresenterAccessDenied` | Tela de quem abre `/present` ou `/edit` sem token, com atalho para entrar como participante. |

**`charts/`**: `BarChartView`, `PieChartView` (aceitam `labelFontSize`),
`WordCloudView` e `palette.ts`:

```ts
export const CHART_COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
                             '#a855f7', '#ec4899', '#84cc16', '#f97316', '#14b8a6']
export function colorAt(index: number) { return CHART_COLORS[index % CHART_COLORS.length] }
```

A mesma paleta é usada no PDF.

**`editor/`**: formulários por tipo (`WordCloudConfig`, `ChoiceConfig`,
`QuizConfig`, `AnswerConfig`, `TextConfig`, `FreeSlideConfig`), `SlideList`,
`AddSlideMenu`, `SlideEditor` (despacha pelo tipo e acrescenta
`SlideSettingsSection`, exceto no livre), `PresentationSettingsButton`,
`SlideSettingsSection`, `SettingsControls` (`FontSizeRow`, `TimerRow`,
`OverrideToggleRow`, `OverrideTimerRow`, `OverrideFontRow`),
`AiPromptButton`, `EditorWorkspace`, `EditorToolbar`, `ImportDialog`,
`ExportDialog` e `slideTypeIcons.ts`.

`EditorToolbar` é a barra das duas telas de editor:

```ts
interface EditorToolbarProps {
  back: ReactNode                 // "Início" (criação) ou "Voltar" (edição da sala)
  title: string
  onTitleChange: (title: string) => void
  primary: ReactNode              // "Iniciar apresentação" ou "Salvar alterações"
  status?: ReactNode              // estado do rascunho, por exemplo
  rareItems?: MenuEntry[]         // ações raras, como "Começar do zero"
  onImportError: (message: string) => void
}
```

A partir de `xl` (1280 px), **Opções**, **Prompt de IA**, **Importar** e
**Exportar** são botões, mais o botão de tema e, se houver `rareItems`, um
menu "Mais" só com eles; abaixo de `xl`, um menu "Mais" (classe `xl:hidden`)
reúne tudo. Cada modal é montado **uma vez** e aberto de forma controlada
pelo botão ou pelo item do menu: `PresentationSettingsButton`,
`AiPromptButton` e `ImportDialog` recebem `open`, `onOpenChange` e
`trigger={false}` (seção 9.7); o `ExportDialog` já era controlado.

`AddSlideMenu` é o botão azul de largura total "Adicionar slide", que abre um
`Menu` com o título "Escolha o tipo" e um item por tipo criável (ícone, nome e
dica, seção 7).

**`layout/`**: `PageShell` (contêiner com largura máxima), `ThemeToggle`
(botão claro/escuro; o rótulo some abaixo de `sm`) e `FullScreenMessage`
(mensagem centralizada, com `min-h-[100dvh]`).

### 9.7 Hooks

| Hook | O que faz |
| --- | --- |
| `useRoom`, `useResponses`, `useMyResponse`, `useParticipants` | Assinaturas do Firestore (seção 8.3) |
| `useParticipant` | Sessão anônima e uid |
| `usePresenterAccess` | Dono atual ou token na URL (reivindica); lembra a sala para "Retomar" |
| `useSlideTimer` | Contagem local para exibir e `closed` (estado da sala) para travar |
| `useRevealCountdown` | Os 3 s de suspense, pulados num gabarito já revelado |
| `useApplyTheme` | Classe `.dark` no `<html>` |
| `useFullscreen` | Fullscreen API (`requestFullscreen` no `documentElement`), acompanhando a saída por Esc via `fullscreenchange` |
| `useRoomAssets` | Imagens de uma sala para os ids pedidos, lidas uma vez e guardadas |
| `useRoomFonts` | Fontes da sala registradas, relidas a cada `revision` |
| `useFreeSlideActions` | Ações do slide livre: `addText`, `addImages`, `replaceImage`, `remove`, `duplicate`, `reorder`, com `busy` e `error` |
| `useRoomAnswers(code, enabled)` | Assina `secret/answers` (só o dono lê); devolve o `AnswerKey` ou `null` |
| `useMediaQuery(query)` | `useSyncExternalStore` sobre `matchMedia(query)`: o valor certo já na primeira renderização e atualizado ao redimensionar |
| `useDialogControl(props)` | Estado de abertura de um modal: controlado por fora (`open` e `onOpenChange`) ou interno; `DialogControlProps { open?, onOpenChange?, trigger? }`, com `trigger={false}` escondendo o botão próprio do modal |
| `useSlideDownload(loadPresentation)` | `{ download('pdf' \| 'pptx'), working, error }`: baixa os slides com os geradores importados no clique (seção 11.9) |

### 9.8 Componentes genéricos (`components/ui/`)

Todo controle de formulário sai daqui, com a mesma identidade visual (azul de
destaque, cinzas neutros, cantos arredondados, anel de foco azul translúcido)
nos temas claro e escuro.

| Componente | Uso | Destaques |
| --- | --- | --- |
| `Button` | Ações | Variantes `primary` (azul 600), `secondary` (neutro 200/800), `ghost` (transparente), `danger` (vermelho 600); tamanhos `sm` (`px-3 py-1.5 text-sm`), `md` (`px-4 py-2 text-sm`), `lg` (`px-6 py-3 text-base`); aceita `ref`; desativado com 50% de opacidade |
| `Card` | Painéis | Borda, fundo e sombra do tema |
| `Input`, `Textarea`, `Field` | Texto | Visual comum em `fieldStyles.ts`; `Field` = rótulo + controle + dica |
| `Checkbox`, `Radio` | Marcar opções | Rótulo e dica opcionais; tom `success` (verde) para a alternativa correta; o `<input>` nativo continua no DOM para teclado e leitor de tela |
| `ChoiceMark` | Só o desenho da marcação | `shape` `round` ou `square`; usado nos botões de voto |
| `Slider` | Faixa numérica | Rótulo à esquerda, valor à direita, trecho percorrido preenchido via `--slider-fill` |
| `Select` | Lista suspensa | Padrão "select-only combobox" do WAI-ARIA; lista em portal, abre para cima quando falta espaço |
| `ScrollArea` | Rolagem própria | Barra fina; eixo `y`, `x` ou `both` |
| `Modal` | Janelas | Tamanhos `sm` a `xl`; altura máxima `90dvh`; Esc e clique fora fecham (se `dismissible`); Tab preso; foco volta para quem abriu; `initialFocusRef`; trava a rolagem do corpo |
| `Menu` | Ações agrupadas num botão ("Adicionar slide", "Mais", "Mais ações", ações de cada slide, "Baixar") | Padrão "menu button" do WAI-ARIA (`aria-haspopup`, `role="menu"`, `role="menuitem"`); lista em portal com posição fixa (`ui-popover ui-scroll fixed z-[70]`), 288 px de largura, que abre para cima quando falta espaço; título opcional (`heading`); itens `{ key, label, hint?, icon?, onSelect, disabled?, danger? }` ou `'separator'` |
| `StackSection` | Seção recolhível do editor empilhado | `{ title, icon, open, onToggle, badge?, children }`; cabeçalho com pelo menos 44 px (`min-h-11`) e `aria-expanded`/`aria-controls`; corpo com `hidden` (não desmonta) |
| `ConfirmDialog` | Confirmar | Sobre o `Modal`; foco inicial no botão de confirmar; tom `primary` ou `danger`; `busy` |
| `Banner` | Avisos | Tons `info`, `warning`, `error`; ícone e fechar opcionais |
| `ColorInput` | Cor | Amostra que abre o seletor do sistema, campo hexadecimal e cores rápidas; estado misto; opção "nenhuma" (`allowNone`) |
| `SegmentedControl` | Poucas opções lado a lado | `radiogroup` de botões com texto ou ícone; tamanhos `sm` e `md`; rótulos com `whitespace-nowrap`; não tira o foco do texto em edição |
| `ToggleButton` | Liga e desliga | `aria-pressed`; estado misto |

Teclado do `Select`:

| Tecla | Lista fechada | Lista aberta |
| --- | --- | --- |
| Setas, Enter, Espaço | Abre na opção escolhida | Setas percorrem; Enter e Espaço escolhem |
| Home, End | Abre na primeira ou última | Vai para a primeira ou última |
| Letras | Abre na opção que começa com elas (sem diferenciar acentos) | Pula para a opção |
| Esc | Segue para a tela (num modal, fecha o modal) | Fecha só a lista |
| Tab | Segue o foco | Fecha a lista e segue o foco |

Teclado do `Menu`: Enter, Espaço ou seta para baixo abrem no primeiro item
ativo; setas percorrem os itens ativos; Home e End vão ao primeiro e ao
último; Esc fecha e devolve o foco ao botão; Tab fecha e segue. As teclas
param no menu (`stopPropagation`), então o projetor não troca de slide com um
menu aberto. Escolher um item fecha o menu, devolve o foco ao botão e só
então chama `onSelect`, para um modal aberto pelo item receber o foco certo.

### 9.9 Estilo e tema (`index.css`)

```css
@import 'tailwindcss';
@custom-variant dark (&:where(.dark, .dark *));   /* tema pela classe, não pelo sistema */

@layer base {
  html, body, #root { height: 100%; }
  body { @apply bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100; }
  html { color-scheme: light; }
  html.dark { color-scheme: dark; }   /* controles nativos seguem o tema escolhido */
}
```

Classes próprias:

| Classe | Função |
| --- | --- |
| `.ui-slider` | Trilho de 6 px, polegar de 18 px com borda azul, trecho preenchido por gradiente usando `--slider-fill`; variantes `-webkit-` e `-moz-`; anel de foco `color-mix(in oklab, var(--color-blue-500) 35%, transparent)` |
| `.ui-scroll` | Barra fina (`scrollbar-width: thin`) nas cores neutras; pseudo-elementos `-webkit-` para o Safari |
| `.ui-popover` | Animação de entrada da lista do `Select` (0,12 s, 4 px) |
| `.ft-text` | Texto do slide livre: `white-space: pre-wrap`, `overflow-wrap: break-word`; `p { margin: 0 }`; marcador por `p[data-marker]::before { content: attr(data-marker) }` com largura `--ft-hang` (padrão 1.1em), margem negativa e cor `--ft-marker-color` |
| `.free-el:hover` | Contorno tracejado azul no editor, com espessura `calc(1px * var(--inv))` (inverso da escala) |
| `.wc-cloud`, `.wc-word` | `transform-origin: 0 0` (em SVG o padrão seria o centro) |
| `.wc-animate ...` | Transições de 0,5 s (`cubic-bezier(0.22, 0.61, 0.36, 1)`) de posição e tamanho, ligadas só depois do primeiro quadro |
| `.wc-word-new` | Animação `wc-pop` (0,45 s, de escala 0,3 e opacidade 0) só para palavras inéditas |
| `.chart-axis-label`, `.bar-count`, `.recharts-pie-label-text` | `fill: #171717` (escuro: `#f5f5f5`), negrito, com `!important` contra o `fill` do Recharts |
| `.chart-legend-label` | Cor `#171717` (escuro: `#f5f5f5`), negrito |
| `.recharts-default-tooltip` | Tooltip no tema: raio 12 px, borda `#e5e5e5` e fundo branco (escuro: borda `#404040`, fundo `#171717`) |

Todas as animações e transições são desligadas com
`@media (prefers-reduced-motion: reduce)`.

As páginas usam `min-h-[100dvh]` (e não `min-h-screen`), para a altura
acompanhar a barra de endereço do celular.

---

## 10. Slide livre em profundidade

### 10.1 Moldura e escala

- A moldura lógica tem o tamanho do slide (`width` x `height`). Tudo é
  posicionado em px dessa moldura (`position: absolute`, `left`, `top`,
  `width`, `height`, `transform: rotate(...)`, `opacity`).
- `ScaledFrame` mede o contêiner e aplica
  `scale = min(larguraDisponível / width, alturaDisponível / height)`; a
  moldura fica centralizada com faixas nas bordas. Como a escala é por
  `transform`, o layout interno continua medindo e quebrando linhas no tamanho
  lógico: o resultado é idêntico em qualquer tela.
- No editor, a escala é passada aos filhos para converter o ponteiro em px do
  slide: `x = (clientX - rect.left) / scale`.

`components/free/layout.ts`:

```ts
export function elementBoxStyle(element, g = element): CSSProperties {
  return { position: 'absolute', left: g.x, top: g.y, width: g.width, height: g.height,
           transform: g.rotation ? `rotate(${g.rotation}deg)` : undefined, opacity: element.opacity ?? 1 }
}
const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }
export function textBoxCss(el) {   // caixa: padding, alinhamento vertical, fundo
  const [t, r, b, l] = el.padding ?? [0, 0, 0, 0]
  return { display: 'flex', flexDirection: 'column', justifyContent: JUSTIFY[el.verticalAlign ?? 'top'],
           padding: `${t}px ${r}px ${b}px ${l}px`, background: el.background, boxSizing: 'border-box' }
}
export function textContentCss(el) {   // texto: estilo base + altura de linha (padrão 1.2)
  return { fontFamily: fontStack(el.style.fontFamily), fontSize: el.style.fontSize, color: el.style.color,
           fontWeight: el.style.bold ? 700 : 400, fontStyle: el.style.italic ? 'italic' : 'normal',
           lineHeight: el.lineHeight ?? 1.2 }
}
```

Pilha de fontes (`fontStack`): o nome limpo (sem `"`, `\`, `<`, `>`, `;`,
`{`, `}`) entre aspas, seguido de alternativas: monoespaçada
(`"Courier New", monospace`) para nomes com courier, consol, mono ou code;
serifada (`Georgia, "Times New Roman", serif`) para georgia, times, garamond,
cambria, book, serif, minion, palatino, baskerville; `Carlito, Arial,
sans-serif` para Calibri (mesmas medidas); e `Arial, Helvetica, sans-serif`
para o resto. Fonte padrão de textos novos: **Arial**.

### 10.2 Texto rico: modelo (`utils/richText.ts`)

- Parágrafos de trechos (`runs`), cada um com estilo próprio. Posições são
  **deslocamentos no texto corrido**, em que a passagem de um parágrafo para o
  seguinte conta 1 caractere (como um Enter). É a mesma contagem que a seleção
  do navegador usa (`richTextDom.ts`), o que permite aplicar estilo só ao
  trecho selecionado.
- `cleanStyle` remove chaves `undefined` (e devolve `undefined` se nada
  sobrar).
- `normalizeParagraph` junta trechos vizinhos de mesmo estilo e descarta os
  vazios; um parágrafo vazio guarda o estilo do primeiro trecho (é ele que
  define a altura da linha em branco).
- `mapRangeStyle(paragraphs, start, end, change)` divide trechos nas
  fronteiras do intervalo e aplica `change` ao estilo de cada trecho dentro
  dele; parágrafos vazios no caminho recebem a mudança no estilo do parágrafo.
- `setRangeStyle`, `rangeStyleValue` (valor do intervalo ou `'misto'`),
  `clearStyleKey`, `setParagraphProps`, `rangeParagraphValue`.
- `paragraphMarkers(paragraphs)` calcula o texto do marcador de cada
  parágrafo ("•", "1.", "b)", "iv."): a numeração segue **por nível de
  recuo** (`round(indent)`), recomeça quando a lista é interrompida por um
  parágrafo de recuo menor ou igual sem marcador, e um nível mais raso encerra
  a contagem dos mais fundos; `startAt` define o início. Letras: a, b, ...,
  z, aa, ab...; romanos: m, cm, d, cd, c, xc, l, xl, x, ix, v, iv, i.

`utils/freeTextFormat.ts` aplica formatação **à seleção** (se houver texto
selecionado na caixa em edição) **ou à caixa inteira**: `textStyleValue`,
`formatTextStyle`, `toggleTextFlag` (negrito, itálico, sublinhado, tachado),
`paragraphValue`, `formatParagraphs`.

### 10.3 Texto rico no DOM (`utils/richTextDom.ts`)

- O **mesmo HTML** serve para exibir e para editar: cada parágrafo é um `<p>`
  e cada trecho um `<span>`, com os dados originais em atributos `data-p` e
  `data-s` (JSON). O navegador copia os atributos quando divide um parágrafo
  no Enter ou um trecho ao digitar, então a leitura de volta recupera o modelo
  sem depender do CSS.
- `paragraphsToHtml(paragraphs, base)` escapa todo texto e gera, por
  parágrafo: `text-align`, `padding-left` (indent), `--ft-hang` (hanging, ou
  1.1em), `--ft-marker-color`, `margin-top` e `margin-bottom` (espaços),
  `line-height`, o CSS herdável do estilo do parágrafo e `data-marker` com o
  texto do marcador. Por trecho: o CSS herdável (`font-family` com a pilha,
  `font-size`, `color` validada, `font-weight`, `font-style`) e as decorações
  calculadas sobre o estilo resolvido (`text-decoration-line: underline
  line-through`, `background-color` do realce).
- `htmlToParagraphs(root, base)` percorre os blocos (`P`, `DIV`, `LI`, `H1` a
  `H6`, `BLOCKQUOTE`, `PRE`), lê o estilo de cada folha subindo até a raiz,
  descarta o que é herdado e normaliza.
- `refreshMarkers` atualiza os `data-marker` depois de cada digitação.
- `getSelectionOffsets(root)` e `setSelectionOffsets(root, start, end)`
  convertem entre a seleção do navegador e deslocamentos no texto corrido; a
  seleção sobrevive a uma nova renderização.
- `cssColorToHex` converte `rgb(...)` para `#rrggbb`.

### 10.4 Edição de texto (`FreeTextEditable`)

- `contentEditable` com a classe `ft-text`; o React **não** desenha o conteúdo
  a cada tecla: o HTML só é reescrito quando o modelo muda por fora (um estilo
  aplicado pelo painel), comparando `JSON.stringify([paragraphs, style])`, e
  então a seleção é restaurada.
- Ao abrir: `document.execCommand('defaultParagraphSeparator', false, 'p')`
  (Enter cria `<p>`), foco, e o cursor vai para o ponto do clique duplo
  (`caretPositionFromPoint` ou `caretRangeFromPoint`), para o fim, ou com
  tudo selecionado (`'all'`, quando a edição abre pelo Enter).
- A cada `input`: `htmlToParagraphs`, `refreshMarkers` e `onChange`.
- `selectionchange` alimenta `textSelection` no store (os botões do painel
  tiram o foco do texto, então a última seleção fica guardada).
- Ctrl+B, Ctrl+I, Ctrl+U (ou Cmd) disparam `onShortcut`.
- **Colar só texto**: `text/plain`, quebras normalizadas, cada linha inserida
  com `insertText` e `insertParagraph` entre elas.

### 10.5 Área de trabalho (`FreeSlideCanvas`)

- Clique seleciona; clique fora tira a seleção e fecha a edição.
- **Arrastar** move. **Guias de encaixe**: linhas candidatas em x = 0, meio e
  largura do slide, mais esquerda, centro e direita de cada outro elemento
  (o mesmo em y). Para cada eixo, testa as três bordas do elemento (início,
  centro, fim) e escolhe a linha mais próxima dentro do limite de 8 px de tela
  (`8 / escala` no slide). Alt desliga. As guias ativas são desenhadas.
- **8 alças** (cantos e meios, com cursores `nwse`, `ns`, `nesw`, `ew`). O
  redimensionamento mantém fixo o ponto oposto mesmo com rotação: o
  deslocamento do ponteiro é levado ao eixo do elemento
  (`lx = dx cos + dy sen`, `ly = -dx sen + dy cos`), a nova largura e altura
  são calculadas, e o centro novo é recalculado a partir da âncora girada.
  Nos cantos, imagens mantêm a proporção (Shift solta); textos fazem o
  contrário. Tamanho mínimo 12 px. Valores arredondados ao soltar.
- **Teclado** (com o slide em foco): setas movem 1 px (Shift: 10 px), Delete
  ou Backspace apaga, Ctrl+D duplica, Enter abre a edição com tudo
  selecionado, Esc sai da edição (ou tira a seleção) sem fechar o editor
  ampliado.
- **Imagens**: colar (Ctrl+V com arquivos de imagem na área de transferência)
  e soltar arquivos (no ponto do soltar; várias imagens em cascata de 24 px).
- Contorno tracejado ao passar o mouse (`.free-el:hover`).

`useFreeSlideActions(slideId)` lê sempre o estado mais recente do editor
(uma imagem pode terminar de carregar depois de outras mudanças):

- `addText()`: `createTextElement(slide)` (metade da largura, 15% da altura,
  centralizado, "Novo texto", Arial, 5% da altura, cor `#171717`, alinhado à
  esquerda, `verticalAlign: 'top'`) e já abre a edição.
- `addImages(files, at?)`: filtra `image/*` (senão: "Escolha um arquivo de
  imagem (PNG, JPG, WebP, GIF ou SVG)."), comprime cada uma (`blobToAsset`),
  adiciona a `assets` e cria elementos com no máximo metade da moldura,
  mantendo a proporção, `fit: 'fill'`; seleciona o último.
- `replaceImage(id, file)`: troca o `assetId` e recalcula a altura pela nova
  proporção mantendo a largura.
- `duplicate(id)`: `structuredClone`, id novo, deslocado 24 px, inserido logo
  acima do original.
- `reorder(id, 'front' | 'back' | 'forward' | 'backward')`: `moveLayer`.
- `remove(id)`.

### 10.6 Imagens (`utils/images.ts`)

```ts
export const MAX_ASSET_CHARS = 900_000
export const MAX_ASSET_DIMENSION = 1920
const KEEP_AS_IS = /^image\/(png|jpeg|webp|gif)$/

export async function blobToAsset(blob: Blob): Promise<PresentationAsset> {
  const img = await loadImage(blob)                 // aceita qualquer formato desenhável, inclusive SVG
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (KEEP_AS_IS.test(blob.type) && Math.max(width, height) <= MAX_ASSET_DIMENSION) {
    const dataUrl = await blobToDataUrl(blob)
    if (dataUrl.length <= MAX_ASSET_CHARS) return { id: await contentId(dataUrl), dataUrl, width, height }
  }
  return canvasToAsset(imageToCanvas(img))          // reduz para 1920 no lado maior e recomprime
}
```

`canvasToAsset(canvas)`: detecta transparência (algum alfa menor que 255);
até 6 tentativas, cada uma testando qualidades 0,9, 0,8 e 0,68 em JPEG (opaca)
ou WebP (com transparência; PNG se o navegador não gerar WebP); se nada couber
em 900.000 caracteres, reduz o canvas a 75% e tenta de novo; depois disso,
erro "A imagem é grande demais, mesmo depois de reduzida.".

`contentId(dataUrl)`: `img_` + 24 primeiros caracteres hexadecimais do SHA-1
do data URL.

Um GIF pequeno é guardado como veio (continua animado).

### 10.7 Exibição em canvas (PDF e importação)

- `utils/canvasText.ts`: `canvasFont(style)` monta a fonte do canvas;
  `drawRichText` faz o layout dos parágrafos (quebra por largura, marcadores,
  recuos, espaçamentos, alinhamento, decorações, realce) e desenha.
- `utils/freeSlideRaster.ts`: `renderFreeSlide(slide, assets, escala)` desenha
  o fundo, as imagens (com encaixe, cantos arredondados, rotação e opacidade) e
  os textos num canvas; o relatório PDF usa a imagem JPEG (qualidade 0,9).
- O PDF dos slides (`utils/exportSlidesPdf.ts`, seção 11.9) desenha **todos**
  os slides por esse mesmo caminho, depois de convertê-los em slides livres
  estáticos (`toStaticSlides`).

---

## 11. Importação, exportação e integrações

### 11.1 Botões e modais

- **Importar** (`ImportDialog`, botão na barra a partir de 1280 px ou item do
  menu "Mais") abre um modal com duas opções, e as duas aceitam o arquivo
  escolhido ou arrastado:

| Opção | O que faz |
| --- | --- |
| **Apresentação (.json)** | Lê um JSON exportado daqui ou gerado pelo prompt de IA, valida e **substitui** todo o conteúdo do editor (`loadPresentation`). Um `.pptx` escolhido aqui é lido como PowerPoint. |
| **PowerPoint (.pptx)** | Converte cada slide visível num slide livre. Antes, escolhe-se **Adicionar ao fim** (padrão) ou **Substituir tudo** (`SegmentedControl`). Qualquer outro arquivo (inclusive `.ppt` antigo) é recusado: "Escolha um arquivo .pptx (PowerPoint 2007 ou mais novo). Arquivos .ppt antigos precisam ser salvos como .pptx antes." |

- **Exportar** (`ExportDialog`, botão ou item do menu "Mais") abre um modal
  com:

| Opção | O que faz |
| --- | --- |
| **Apresentação (.json)** | Baixa na hora o `Presentation` completo (com imagens e fontes usadas), para importar de volta; perguntas continuam interativas. |
| **PowerPoint (.pptx)** | Carrega o gerador sob demanda, passa o tema atual da página (claro ou escuro), mostra "Gerando…" e, no fim, os avisos. |

Nome dos arquivos: `presentationFileName(título, extensão)`, com o título em
minúsculas, sem acentos (`normalize('NFD')` e remoção de U+0300 a U+036F) e com
tudo que não for `a-z0-9` virando `-` (vazio: `apresentacao`). O relatório
PDF usa `<slug>-resultados.pdf`; o PDF dos slides, `<slug>.pdf`.

Download: `downloadBlob(blob, nome)` cria um `<a download>` temporário com
`URL.createObjectURL`.

### 11.2 JSON (`utils/importExport.ts`)

```ts
export function exportPresentation(presentation: Presentation, filename?: string) {
  const data = JSON.stringify(presentation, null, 2)
  downloadBlob(new Blob([data], { type: 'application/json' }),
               filename ?? presentationFileName(presentation.title, 'json'))
}

export async function importPresentationFromFile(file: File): Promise<ImportResult> {
  try {
    const json = JSON.parse(await file.text())
    const parsed = presentationSchema.safeParse(json)
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join('.') || 'raiz'}: ${i.message}`).join('; ')
      return { ok: false, error: `JSON inválido - ${detail}` }
    }
    return { ok: true, presentation: parsed.data as Presentation }
  } catch (e) {
    return { ok: false, error: `Não foi possível ler o arquivo: ${(e as Error).message}` }
  }
}
```

A importação **substitui** o conteúdo do editor: exporte antes se não quiser
perder o que estava montado.

### 11.3 Importar PowerPoint (`utils/pptx/`)

Carregado só quando alguém importa (`await import('../../utils/pptx')`), lê o
arquivo inteiro no navegador, sem enviar nada a servidor. Assinatura:

```ts
interface PptxProgress { done: number; total: number; message: string }
interface PptxImportResult {
  title: string                 // docProps/core.xml (dc:title)
  slides: FreeSlide[]
  assets: PresentationAsset[]
  fonts: PresentationFont[]
  aspect: '16:9' | '4:3' | null // null quando não é nenhum dos dois
  warnings: string[]
}
function importPptx(file: Blob, onProgress?: (p: PptxProgress) => void): Promise<PptxImportResult>
```

Pipeline:

1. **Pacote**: o `.pptx` é um ZIP de XMLs; `fflate.unzipSync` abre e
   `PptxPackage` (`package.ts`) resolve relações (`_rels`), caminhos relativos
   e tipos. XML lido com `DOMParser` e acessado por nome local (`xml.ts`).
   Falha: "O arquivo não é um .pptx válido (não foi possível abrir o ZIP).".
2. **Formato**: `p:sldSz` (padrão 12.192.000 x 6.858.000 EMU). Proporção a
   menos de 0,03 de 16/9: moldura 1920 x 1080; de 4/3: 1440 x 1080; senão
   1920 de largura e altura proporcional (`aspect: null`). Fator
   `k = larguraDaMoldura / cx` converte EMU em px.
3. **Fontes embutidas** primeiro (para tabelas, gráficos e SmartArt já saírem
   com elas): seção 11.4.
4. **Slides**: na ordem de `p:sldIdLst`; slides com `show="0"` são contados e
   ignorados. Para cada um, carrega layout e mestre (com cache), tema (cores,
   fontes maior e menor, estilos de preenchimento, linha, efeito e fundo) e o
   **mapa de cores** (do mestre, sobrescrito pelo `clrMapOvr` do layout e do
   slide). Progresso: "Convertendo o slide i de n…", cedendo a vez à tela entre
   slides (`setTimeout 0`).
5. **Fundo**: do slide, do layout ou do mestre (o primeiro que existir). Cor
   sólida vira `background`; gradiente, imagem, ladrilho ou padrão vira uma
   imagem do slide inteiro.
6. **Árvore de formas**: mestre e layout (se `showMasterSp` não for `0`) e
   depois o slide. Grupos são achatados com a transformação aplicada.
   - **Herança**: posição, tamanho e estilos de texto de um espaço reservado
     vêm do slide, do layout e do mestre, nessa ordem, mais os estilos padrão
     da apresentação e as referências de fonte e estilo do tema.
   - **Cores**: cores do tema passam pelo mapa de cores e pelos modificadores
     (luminosidade, tom, saturação, transparência...).
   - **Texto** vira `FreeTextElement` editável (fonte, tamanho, cor, negrito,
     itálico, sublinhado, tachado, realce, alinhamento, marcadores, recuos,
     espaçamentos, posição vertical, margens internas).
   - **Formas** pré-definidas são calculadas pelas definições oficiais do
     pacote `modern-openxml` (fórmulas avaliadas para o tamanho e os ajustes
     de cada forma, convertidas em `Path2D`); formas livres usam o caminho do
     arquivo. Preenchimento sólido, gradiente, imagem, ladrilho e padrão,
     contorno com tracejado e pontas, e sombra externa são desenhados em canvas
     (`draw.ts`). O texto da forma continua texto por cima.
   - **Fotos** passam por recorte, máscara da forma e conversão de SVG, e são
     comprimidas (`blobToAsset` ou `canvasToAsset`).
   - **Tabelas** (`table.ts`) são desenhadas em canvas com o estilo do arquivo
     (ou uma aproximação do estilo padrão).
   - **Gráficos** (`chart.ts`) são redesenhados a partir dos dados salvos no
     arquivo: barras, colunas, linhas, áreas, dispersão, pizza e rosca.
   - **SmartArt** usa o desenho que o PowerPoint salva junto; sem ele, fica de
     fora.
   - Vídeo e áudio viram só a imagem de capa. Objetos OLE e controles ficam de
     fora.
7. **Montagem** (`assemble`): itens gráficos **vizinhos na ordem de desenho**
   (sem texto ou foto entre eles) são desenhados juntos numa imagem só, do
   tamanho da área que ocupam (limitada à moldura). Um slide com dezenas de
   formas decorativas fica com poucas camadas, e o texto continua editável por
   cima. Imagens repetidas (um logotipo do mestre) são guardadas uma vez (id
   pelo conteúdo).
8. **Título do slide**: o texto do espaço reservado de título (até 80
   caracteres), senão "Slide N".

Avisos possíveis:

| Aviso | Motivo |
| --- | --- |
| Imagens em formato EMF, WMF ou TIFF ficaram de fora | Navegadores não desenham esses formatos |
| Textos verticais foram importados na horizontal | O slide livre só tem texto horizontal |
| Vídeos e áudios viraram apenas a imagem de capa | A plataforma não reproduz mídia |
| Gráficos viraram imagens simplificadas | Redesenhados a partir dos dados, com estilo próprio |
| SmartArt virou imagem (ou ficou de fora, sem desenho salvo) | |
| Alguns objetos ficaram de fora | OLE, controles e afins |
| N slide(s) oculto(s) ficaram de fora | Slides ocultos não entram |
| Não foi possível usar a(s) fonte(s) embutida(s) X | Arquivo corrompido ou formato recusado pelo navegador |

Aplicação no editor:

- **Substituir tudo**, ou editor vazio: `loadPresentation` com o título do
  arquivo (ou o nome do arquivo sem `.pptx`), os slides, imagens e fontes, e o
  formato do arquivo (`slideAspect: aspect ?? atual`), com a nota "O formato
  da apresentação passou para X, o mesmo do arquivo." quando muda.
- **Adicionar ao fim**: `appendSlides(slides, assets, fonts)`; se o formato do
  arquivo diferir, a nota avisa que os slides aparecem com faixas nas bordas e
  sugere trocar o formato nas Opções. Um PowerPoint em 16:10 ou A4 mantém a
  própria proporção.
- Sem slides visíveis: "O arquivo não tem slides visíveis para importar.".
- O modal mostra o progresso, o resultado (quantos slides e imagens, as
  famílias de fontes embutidas e os avisos) e **Concluir**, que deixa o
  primeiro slide novo selecionado.

As fontes que não vieram embutidas são mantidas só pelo nome: se o aparelho
não tiver a fonte, o navegador usa uma parecida e as quebras de linha podem
mudar.

### 11.4 Fontes embutidas (`utils/fonts/`)

O PowerPoint guarda cada estilo de uma fonte embutida (regular, bold, italic,
boldItalic) num `ppt/fonts/*.fntdata`, listado em `p:embeddedFontLst` com o
nome que os textos usam (`typeface`). O arquivo é um **Embedded OpenType
(EOT)**: cabeçalho little-endian com nomes e métricas e, no fim, a fonte, que
pode vir "cifrada" com XOR e quase sempre vem comprimida em **MicroType
Express (MTX)**.

| Etapa | Arquivo | O que faz |
| --- | --- | --- |
| Detecção | `sfnt.ts` (`sniffFontFormat`) | TrueType, OpenType, WOFF ou EOT |
| EOT | `eot.ts` (`eotToSfnt`) | Valida o número mágico `0x504C` no byte 34; lê `eotSize` (byte 0), `fontDataSize` (byte 4) e `flags` (byte 12); a fonte são os últimos `fontDataSize` bytes; com a flag `0x10000000` desfaz o XOR com `0x50`; com a flag `0x4` descomprime o MTX |
| LZCOMP | `lzcomp.ts` | Descomprime os três blocos do MTX (LZ77 com três árvores de Huffman adaptativas) |
| CTF | `mtx.ts` | Reconstrói o TrueType: glifos (coordenadas em "tripletos"), instruções de hinting (os valores empilhados vêm num bloco à parte), `loca`, `cvt` |
| sfnt | `sfnt.ts` | Lê e monta tabelas TrueType/OpenType com somas de verificação |
| WOFF | `woff.ts` | Comprime cada tabela com zlib (`fflate.zlibSync`) para guardar; e o caminho inverso (`unzlibSync`) |
| Conversão | `convert.ts` | Arquivo de fonte para `PresentationFont` (só no importador e no exportador) |
| Registro | `faces.ts` | `new FontFace(family, bytes, { weight, style })`, `load()`, `document.fonts.add()`; uma vez por id; falha devolve `null` sem travar |

O decodificador foi escrito a partir da especificação (submissão W3C
"MicroType Express Font Format") e conferido contra o sfntly (Google) e o
libeot. As tabelas `hdmx` e `VDMX` ficam de fora (opcionais). Fontes já em
TrueType, OpenType ou WOFF dentro do `.fntdata` também são aceitas.

Com "Incorporar somente os caracteres usados" no PowerPoint, a fonte vem só
com as letras do arquivo: letras novas digitadas depois aparecem numa fonte
parecida.

Uma fonte registrada com o mesmo nome de família que os textos usam passa na
frente de uma fonte instalada com esse nome: o texto aparece com a fonte do
arquivo em qualquer aparelho, no HTML e nos canvas (PDF).

`pickFonts(fonts, slides)` mantém só as fontes cujas famílias (em minúsculas)
aparecem em algum `fontFamily` de caixa, parágrafo ou trecho de slide livre.

### 11.5 Exportar PowerPoint (`utils/pptxExport/`)

Carregado sob demanda. `exportPptx(presentation, { theme, hints })` devolve
`{ blob, warnings }` (MIME
`application/vnd.openxmlformats-officedocument.presentationml.presentation`).

Estrutura do pacote gerado (ZIP com `fflate.zipSync`):

```
[Content_Types].xml
_rels/.rels
docProps/app.xml, docProps/core.xml (com o título)
ppt/presentation.xml (p:sldSz no formato, p:embeddedFontLst quando há fontes)
ppt/_rels/presentation.xml.rels
ppt/slideMasters/slideMaster1.xml (+ _rels)
ppt/slideLayouts/slideLayout1.xml (+ _rels)   layout em branco
ppt/theme/theme1.xml                          fonte Arial
ppt/presProps.xml, ppt/viewProps.xml, ppt/tableStyles.xml
ppt/slides/slideN.xml (+ _rels)
ppt/media/*                                   imagens (sem recompressão, level 0)
ppt/fonts/fontN.fntdata                       fontes em EOT sem compressão
```

| Na plataforma | No PowerPoint |
| --- | --- |
| Caixa de texto do slide livre | Caixa de texto (`prstGeom rect`, `bodyPr wrap="square"` com margens em EMU, `anchor` pela posição vertical, `noAutofit`): trechos com fonte, tamanho, cor, realce, negrito, itálico, sublinhado e tachado; parágrafos com alinhamento, marcadores (caractere ou numeração automática), recuos, espaçamentos e altura da linha; fundo, rotação e transparência |
| Imagem do slide livre | Imagem: "preencher" vira recorte (`srcRect`), "conter" ajusta a moldura, cantos arredondados viram `roundRect` com ajuste proporcional, transparência por `alpha`; WebP vira PNG (PNG, JPEG e GIF passam como estão) |
| Cor de fundo do slide livre | Fundo do slide |
| Texto simples | Título e o texto, com o alinhamento e o tamanho do slide, no tema da página |
| Alternativas, barras e pizza | Título, as alternativas em cartões (com letras) e a instrução "Responda pelo celular", no tema da página |
| Resposta correta | Título e alternativas com a correta destacada em verde |
| Nuvem de palavras | Título e a instrução para enviar a resposta pelo celular |

- **Unidades**: 1 px da moldura = 6350 EMU (0,5 pt); altura de linha
  "simples" do PowerPoint (100%) = 1,2 vez a fonte, então
  `spcPct = round(lineHeight / 1.2 * 100000)`. Um PowerPoint importado e
  exportado de novo mantém posições, tamanhos e espaçamentos.
- **Slides livres em outra proporção** são reenquadrados com
  `fitFreeSlideToFrame` para o formato da apresentação.
- **Slides comuns** viram slides livres estáticos (`standard.ts`), sem
  resultados, com tamanhos mínimos (título 60 px, corpo 40 px, dica 28 px) e as
  cores do tema da página. `standardSlideToFree(slide, slides, settings,
  frame, theme, options)` aceita `StaticSlideOptions { hints?, revealQuiz? }`:
  `hints: false` tira as instruções de participação ("Responda pelo
  celular." e afins) e `revealQuiz: true` destaca a correta na própria
  pergunta. A exportação do editor usa os padrões (`hints: true`,
  `revealQuiz: false`); o download dos slides passa `hints: false` por
  `PptxExportOptions`; o modo leitura usa `toStaticSlides` (seção 11.10).

| Cor | Claro | Escuro |
| --- | --- | --- |
| Fundo | `#ffffff` | `#0a0a0a` |
| Texto | `#171717` | `#fafafa` |
| Texto secundário | `#737373` | `#a3a3a3` |
| Cartão | `#f3f4f6` | `#262626` |
| Letra da alternativa | `#2563eb` | `#60a5fa` |
| Cartão correto | `#dcfce7` | `#052e16` |
| Texto correto | `#14532d` | `#bbf7d0` |
| Marca de correta | `#16a34a` | `#4ade80` |
| Espaço reservado | `#a3a3a3` | `#525252` |

- **Fontes**: as embutidas usadas vão como EOT sem compressão, uma por estilo,
  listadas em `p:embeddedFontLst` (`regular`, `bold`, `italic`,
  `boldItalic`). Só TrueType: OpenType com contornos CFF fica de fora com
  aviso.
- **Avisos**: "As perguntas viraram slides estáticos com as alternativas: a
  votação só funciona aqui na plataforma."; "A fonte X não pôde ser embutida
  (o PowerPoint só embute fontes TrueType).".
- Conferido contra os esquemas oficiais (ECMA-376 Transitional), aberto no
  python-pptx e no LibreOffice e reimportado na plataforma.

### 11.6 Relatório PDF (`utils/exportPdf.ts`)

`exportResultsPdf(room, responses, assets)`; jsPDF importada sob demanda; A4
em pontos; margem 48. Os slides livres são desenhados antes em canvas
(`renderFreeSlide`) e entram como JPEG. Como a sala guarda as perguntas sem
gabarito, quem chama passa a sala com os gabaritos de volta: o projetor usa
os que assina (`useRoomAnswers`), e a tela inicial os lê com `fetchAnswers`
(`{ ...room, slides: withAnswers(room.slides, answers) }`).

1. **Capa**: faixa azul (`rgb(37, 99, 235)`, 130 pt de altura), "Relatório
   de resultados", o título (24 pt, negrito, quebrado na largura), "Gerado
   em: <data e hora pt-BR>", "Slides: N", "Participantes que responderam: N".
2. **Uma página por slide** (os `answer` são pulados), com "Slide i/n · Tipo"
   e o título (20 pt):
   - `bar`, `pie`: barra horizontal por opção (linha de 50 pt), cor da
     paleta, votos e porcentagem; quebra de página quando não cabe;
   - `quiz`: o mesmo, com a correta em **verde** e o prefixo `[correta]`;
   - `wordcloud`: os textos em fluxo, de 14 a 40 pt pela frequência (22 pt se
     empatam), até 120, cores da paleta; sem respostas: "Nenhuma resposta
     enviada.";
   - `text`: o conteúdo com o alinhamento, fonte entre 12 e 28 pt;
   - `free`: a imagem do slide na largura da página, sem passar da altura, com
     borda cinza.
3. **Tabela** logo depois de cada slide interativo **com respostas**:

   | Participante | Resposta | Resultado |
   | --- | --- | --- |
   | Ana Paula | Lista | Correta |
   | Bruno | Conjunto | Incorreta |

   - "Resultado" só em `quiz` com gabarito (acerto = conjunto exato).
   - Com nomes, ordem alfabética `pt-BR`; sem nomes, "Participante N" pela
     ordem de chegada (`createdAt`).
   - Resposta vazia vira um hífen (`-`).
   - Tabelas longas quebram em várias páginas **repetindo o cabeçalho**.
4. **Rodapé** com a mesma contagem da tela na página do slide
   (`responseSummary`) e o total de participantes na página da tabela.

A tabela sai mesmo com a identificação desligada: essa opção controla o que
aparece **no projetor**, à vista da plateia; o PDF é material do apresentador.

Quando é gerado: botão **Baixar resultados (PDF)** no slide final; botão
**Exportar PDF** do cabeçalho; e na tela inicial, para qualquer sala
apresentada no dispositivo. Nos três casos, as imagens e as fontes são lidas
da sala antes; uma imagem que falhar fica de fora sem impedir o PDF.

### 11.7 Prompt de IA (`utils/aiPrompt.ts`, `AiPromptButton`)

Texto pronto (integral no [Apêndice E](#apêndice-e-texto-do-prompt-de-ia)) que
descreve **todo o formato JSON aceito**: campos comuns, os tipos de slide, as
opções globais (inclusive o formato), as sobrescritas, as regras de
preenchimento e um exemplo completo válido. Fluxo: copiar no modal, colar no
assistente, trocar o tema na linha "TEMA DA APRESENTAÇÃO", salvar a resposta
como `.json` e usar **Importar**, opção "Apresentação (.json)".

- O slide livre é descrito só com caixas de texto (imagens dependem de
  `assets`, que a IA não consegue gerar).
- Descreve `allowDownload` entre as opções globais e o deixa de fora das
  sobrescritas por slide (junto de `askName` e `slideAspect`).
- Instrui a IA a **não** gerar slides `answer` (a plataforma os cria a partir
  de `revealAnswer`).
- Ao mexer em `utils/validation.ts`, o prompt precisa ser atualizado: ele é a
  documentação que a IA lê.

### 11.8 Código da sala e link curto (`RoomCodeDialog`, `lib/shortUrl.ts`)

**Modal "Código da sala"** (`Modal` de tamanho `sm`, com a descrição "Os
participantes entram com este código em "Entrar em uma sala", na página
inicial."): o código em fonte mono, o QR Code (168 px, `QR_FG` sobre `QR_BG`),
uma linha com o link curto (ou o completo, enquanto não há curto) e o botão
de copiar, "Encurtando o link..." enquanto encurta, e, se falhar, "Não foi
possível encurtar o link agora." com **Tentar de novo**. Embaixo, **Copiar
código** e **Projetar em tela cheia**. Copiar mostra a confirmação por 2 s.

**Projeção em tela cheia**: o modal fecha antes (o foco preso dele engoliria
o primeiro clique) e uma camada em portal (`fixed inset-0 z-[100]`,
`role="dialog"`, "Código da sala em tela cheia") cobre a página, pedindo tela
cheia ao `documentElement` (se o navegador recusar, a camada ocupa a janela
igual). Conteúdo, em tamanhos com `clamp()` para servir do celular ao
projetor: "1. Acesse:" e o link curto em letra grande (sem link curto, o
endereço do site, `host + pathname`); "2. Use o código da sala:" e o código
numa caixa; o QR ao lado ("Toque no QR Code para ampliar"); "3. Responda pelo
celular enquanto a apresentação estiver no ar.". No canto, alternar o tema e
sair da tela cheia. A projeção tem **tema próprio** (começa no tema da página
e alterna ali mesmo), com classes sem `dark:`, que seguiriam o `<html>`.

| Ação | Efeito |
| --- | --- |
| Clicar no QR projetado | QR ampliado (`z-[110]`, `min(92vw, 92vh)`), com "Voltar ao código" |
| Esc | Fecha o QR ampliado; sem ele, fecha a projeção |
| Outras teclas | Param na projeção: o ouvinte de teclado fica na fase de **captura** e chama `stopPropagation`, para o passador de slides não trocar o slide escondido atrás |
| Sair da tela cheia pelo navegador | Fecha a projeção (`fullscreenchange`) |

**Link curto** (`lib/shortUrl.ts`):

```ts
const CACHE_KEY = 'ip-short-urls'
const TIMEOUT_MS = 8000

// Para acrescentar um serviço: precisa responder com
// `Access-Control-Allow-Origin: *` e devolver o link em texto puro.
const PROVIDERS = [
  { host: 'da.gd', endpoint: (url: string) => `https://da.gd/s?url=${encodeURIComponent(url)}` },
]

/** https, com caminho e (quando informado) do próprio serviço. */
function validShortUrl(text: string, host?: string): string | null {
  try {
    const parsed = new URL(text.trim().replace(/^http:\/\//i, 'https://'))
    if (parsed.protocol !== 'https:' || parsed.pathname.length <= 1) return null
    if (host && parsed.hostname !== host) return null
    return parsed.href
  } catch {
    return null
  }
}

export async function shortenUrl(url: string): Promise<string> {
  const cached = getCachedShortUrl(url)
  if (cached) return cached
  for (const provider of PROVIDERS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(provider.endpoint(url), { signal: controller.signal })
      if (!res.ok) continue
      const short = validShortUrl(await res.text(), provider.host)
      if (!short) continue
      writeCache(url, short)
      return short
    } catch {
      // fora do ar, sem internet ou tempo esgotado: tenta o próximo
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error('Nenhum encurtador respondeu.')
}
```

1. O link curto é pedido **sob demanda**, quando o modal ou a projeção abre.
2. A resposta só vale se for `https`, do próprio `da.gd` e com caminho: uma
   página de erro em texto não vira "link curto".
3. O resultado vai para o `localStorage` (`ip-short-urls`), indexado pela URL
   longa: reabrir não cria um link novo. A leitura do cache **descarta
   entradas inválidas** (por exemplo, links de um serviço usado antes) e
   regrava o cache limpo.
4. `displayShortUrl` tira `https://` e `www.` (ex.: `da.gd/e0SS8g`).

Decisões:

- **O QR sempre codifica a URL completa**: se o encurtador sair do ar, a
  câmera continua funcionando.
- **da.gd** porque, sendo um site estático, a chamada sai do navegador e o
  serviço precisa responder com CORS liberado para qualquer origem. O TinyURL,
  usado antes, passou a responder `Access-Control-Allow-Origin:
  https://tinyurl.com`, e o navegador descarta a resposta mesmo com status
  200; o is.gd não libera CORS. O da.gd responde com
  `Access-Control-Allow-Origin: *`, é gratuito, de código aberto, não pede
  chave, aceita `localhost` e **preserva o fragmento** `#/room/<código>` no
  redirecionamento (302).
- **Sem servidor**: encurtar numa função de servidor (por exemplo, Cloud
  Functions chamando o TinyURL, com o da.gd de reserva) funcionaria sem CORS,
  mas exigiria o plano pago e tiraria o projeto do modelo 100% estático.
- **Serviço lento**: o da.gd costuma responder em menos de um segundo, mas
  numa rede com proxy pode levar vários segundos; passando de 8 s, a
  interface mostra o link completo e "Tentar de novo".

### 11.9 Baixar os slides no fim (`useSlideDownload`, `exportSlidesPdf`, `toStaticSlides`)

Com `settings.allowDownload`, a tela final do celular mostra o bloco
`DownloadSlides` ("Baixar slides") com dois botões, **PDF dos slides** e
**PowerPoint (.pptx)** (cada um mostra "Gerando…" enquanto trabalha). Os arquivos levam **só os slides**, sem a
resposta de ninguém e sem as instruções de participação, no tema da página de
quem baixa.

```ts
// utils/staticSlides.ts: todos os slides como slides livres estáticos
export function toStaticSlides(presentation, { theme = 'light', skipAnswerSlides = false, ...options } = {}): FreeSlide[] {
  const settings = withDefaults(presentation.settings)
  const frame = SLIDE_FRAMES[settings.slideAspect]
  return presentation.slides
    .filter((slide) => !(skipAnswerSlides && slide.type === 'answer'))
    .map((slide) => slide.type === 'free'
      ? fitFreeSlideToFrame(slide, frame)
      : standardSlideToFree(slide, presentation.slides, presentation.settings, frame, theme, options))
}

// utils/exportSlidesPdf.ts: uma página por slide
export async function exportSlidesPdf(presentation, { theme = 'light' } = {}) {
  const slides = toStaticSlides(presentation, { theme, hints: false })
  const { jsPDF } = await import('jspdf')
  const width = 960, height = Math.round(width * slides[0].height / slides[0].width)
  const doc = new jsPDF({ unit: 'pt', format: [width, height], orientation: 'landscape' })
  for (const [i, slide] of slides.entries()) {
    if (i > 0) doc.addPage([width, height], 'landscape')
    const canvas = await renderFreeSlide(slide, presentation.assets ?? {}, 1)
    doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, width, height)
  }
  doc.save(presentationFileName(presentation.title, 'pdf'))
}

// hooks/useSlideDownload.ts
export function useSlideDownload(loadPresentation: () => Promise<Presentation>) {
  // download('pdf'): registerFonts (o canvas usa as fontes do documento) e exportSlidesPdf
  // download('pptx'): exportPptx(presentation, { theme, hints: false }) e downloadBlob
  // os dois geradores entram por import() dinâmico; devolve { download, working, error }
}
```

No celular, `loadPresentation` é `loadRoomPresentation(code, room,
withRevealedAnswers(room))`: a apresentação como a plateia a vê, com imagens
e fontes. Os slides de gabarito saem com a correta destacada **só nas
perguntas reveladas** durante a apresentação. Falhas mostram "Não foi
possível gerar o arquivo: ...".

### 11.10 Modo leitura (`pages/ViewPage.tsx`)

| Rota | Fonte | Download |
| --- | --- | --- |
| `/view` | Um `.json` exportado (ou gerado pelo prompt de IA), escolhido ou arrastado para a página, lido e validado no navegador, sem Firebase. A tela inicial tem o botão "Ler uma apresentação (.json)" | Sempre (o arquivo já é de quem lê) |
| `/view/:code` | A sala (`useRoom`), com `withRevealedAnswers`, imagens (`useRoomAssets`) e fontes (`useRoomFonts`). Só com `status === 'ended'`; antes disso, "A leitura fica disponível quando a apresentação terminar." | Só com `allowDownload` |

O leitor (`Reader`):

- **Rolagem** (todos os slides, um embaixo do outro) ou **Um por vez**
  (`SegmentedControl`). No modo "um por vez": setas do teclado e
  `PageUp`/`PageDown`, deslize horizontal (pelo menos 50 px e 1,5 vez maior
  que o vertical), botões e contador, e tela cheia no palco (`requestFullscreen`
  no elemento do slide). A caixa do slide mede `min(100%, calc(65vh * proporção))`.
- **Mostrar respostas certas** (`Checkbox`, só quando há perguntas): marca a
  correta na própria pergunta (`revealQuiz`). Numa sala, só as corretas
  publicadas existem para marcar.
- Menu **Baixar** (`Menu` com "PDF dos slides" e "PowerPoint (.pptx)", pelo
  `useSlideDownload`) quando o download é permitido, e o botão de tema.
- Os slides passam por `toStaticSlides(presentation, { hints: false,
  revealQuiz: mostrarRespostas, skipAnswerSlides: true })` e são desenhados
  com `FreeSlideView`.

---

## 12. Exemplos de execução de ponta a ponta

Os exemplos mostram, em ordem, o que cada tela faz e o que é escrito no
Firestore. Sala de exemplo: código `K7MP2Q`, token `aZ3...` (24 caracteres).

### 12.1 Da criação ao início

1. O apresentador abre `/` e clica em **Criar sala** (`/create`). O editor
   abre vazio com o título "Minha apresentação" (ou com o rascunho deixado
   neste navegador). `useParticipant` já faz o login anônimo em segundo plano
   (uid `P1`).
2. Adiciona slides pelo menu "Adicionar slide", ordena arrastando,
   configura na coluna do meio e confere na prévia (no celular, nas seções
   empilhadas). Cada mudança vai para o rascunho 600 ms depois ("Rascunho
   salvo neste navegador"). Opcionalmente ajusta **Opções**, importa um JSON
   (por exemplo, o gerado pelo prompt de IA) ou um PowerPoint.
3. Clica em **Iniciar apresentação**:
   - sem uid: "Conectando ao Firebase… aguarde um instante e tente
     novamente." (ou a mensagem de falha da autenticação anônima);
   - sem slides: "Adicione ao menos um slide antes de iniciar.";
   - senão, `getPresentation()` (só imagens e fontes em uso) e
     `createRoom(P1, apresentação)`.
4. `createRoom` sorteia `K7MP2Q`, confirma que não existe (`getDoc`), mede o
   JSON (abaixo de 1.000.000 bytes) e grava em lote:
   - `rooms/K7MP2Q` com `creatorUid: P1`, `currentSlideIndex: 0`,
     `status: 'live'`, `timers: {}`, `revealedSlideIds: []`,
     `answersHidden: true`, `revealedAnswers: {}`, `settings` completo e os
     quizzes com `correctOptionIds: []`;
   - `rooms/K7MP2Q/private/presenter` com `{ token, ownerUid: P1, createdAt }`;
   - `rooms/K7MP2Q/secret/answers` com os gabaritos (`{ q1: ['b'] }`).
   Depois envia as imagens e fontes para `assets` e `fonts`.
5. `savePresenterSession({ code: 'K7MP2Q', token, title })` e navegação para
   `/present/K7MP2Q/<token>`.
6. O projetor assina a sala; `usePresenterAccess` vê `creatorUid === P1` e
   concede o acesso; `useRoomAnswers` passa a assinar `secret/answers`. Se o
   primeiro slide for um `quiz` com tempo, o efeito de "cronômetro ausente"
   grava `timers.<id> = { endsAt: agora + 20000, remainingMs: 20000 }`.
7. Para mostrar o código, o apresentador clica nele no cabeçalho: o modal
   "Código da sala" pede o link curto ao da.gd ("Encurtando o link..."),
   guarda em `ip-short-urls` e mostra `da.gd/xxxxxx`. **Projetar em tela
   cheia** leva código, QR e link curto para a tela inteira do projetor; Esc
   volta.

### 12.2 Entrada do participante

1. A Ana aponta a câmera para o QR (URL completa
   `https://.../#/room/K7MP2Q`), toca no link curto ou abre `/join` e digita
   `k7mp 2q` (normalizado para `K7MP2Q`).
2. `RoomPage` faz o login anônimo (uid `A1`) e assina a sala.
3. Se `askName` estiver ligado e não houver nome salvo para `K7MP2Q`, aparece
   o `NamePrompt`. Ela digita "Ana Paula", que vai para
   `ip-participant-names` (`{ "K7MP2Q": "Ana Paula" }`).
4. Presença: `joinRoom('K7MP2Q', 'A1', 'Ana Paula')` lê `participants/A1`
   (não existe) e grava `{ uid, name, joinedAt, lastSeenAt }` com
   `merge: true`. O contador do projetor (ícone de pessoas) e o rodapé passam
   a contar a Ana. Se ela recarregar, a nova escrita leva só `lastSeenAt` e o
   nome: `joinedAt` fica.
5. O celular mostra o título da apresentação e o controle do slide atual. Se
   a sala já estiver encerrada, aparece a tela final ("Obrigado por
   participar!", "Rever os slides").

### 12.3 Pergunta com cronômetro e gabarito (linha do tempo)

Configuração: slide 3 `quiz` "O que é uma mediana?" (id `q1`), alternativas
"A média dos valores" (`a`), "O valor central" (`b`), "O valor mais
frequente" (`c`), correta `b`, `revealAnswer: true`, 20 s; slide 4 é o
`answer` (id `r1`, `quizSlideId: 'q1'`). 30 pessoas conectadas.

| Tempo | Projetor | Firestore | Celulares |
| --- | --- | --- | --- |
| t = 0 | Apresentador aperta a seta para a direita no slide 2 | `currentSlideIndex: 2` e `timers.q1 = { endsAt: t0+20000, remainingMs: 20000 }` numa escrita | Trocam para a pergunta; mostram A, B e C, sem contagem. O `q1` deles tem `correctOptionIds: []`: a resposta não está em nenhum documento que possam ler |
| 0 a 15 s | Card "Tempo restante" com segundos e milissegundos; rodapé "30 participante(s) · N responderam" | Cada toque grava `responses/q1__<uid>` com `value: ['b']` etc. | "Voto registrado"; "Limpar resposta" se permitido |
| 15 s | Card fica vermelho (últimos 5 s) | | |
| 20 s | `useSlideTimer` dá `runOut`; o próximo slide é o `answer` de `q1`, então `goTo(3)` | `currentSlideIndex: 3` e `timers.q1 = { endsAt: null, remainingMs: 0 }` numa escrita | Trocam para o gabarito |
| 20 a 23 s | "A resposta certa é." ".." "..." (o projetor já sabe a correta, por `secret/answers`) | | Mesmo suspense, contado localmente |
| 23 s | Quadro com B em verde e "votos · %" em cada alternativa; rodapé com os números da pergunta | Numa escrita: `revealedSlideIds: arrayUnion('r1')` e `revealedAnswers.q1 = ['b']` | Assim que a escrita chega (o suspense local segura a tela até lá): "Você acertou!" ou "Não foi dessa vez.", com "sua resposta" |

Variações:

- **O apresentador volta para a pergunta** (seta para a esquerda): a escrita
  só troca o índice (o cronômetro de `q1` já está esgotado e continua). O
  projetor mostra "Tempo esgotado"; os celulares mostram "Tempo esgotado: as
  respostas foram encerradas." e os botões travados (`closed`). Não há novo
  avanço automático.
- **Volta ao gabarito**: aparece direto, sem suspense (`r1` está em
  `revealedSlideIds` e `q1` em `revealedAnswers`).
- **Sai da pergunta aos 12 s restantes** (avança antes de zerar): a escrita
  grava `timers.q1 = { endsAt: null, remainingMs: 12000 }` (pausa). Voltando,
  `timers.q1 = { endsAt: agora + 12000, remainingMs: 12000 }` (retoma).
- **Sem slide de gabarito depois**: ao zerar, `saveSlideTimers` grava
  `closeTimer` e a pergunta continua no ar, travada; o apresentador avança
  quando quiser.
- **Cronômetro 0** (global ou `overrides.quizTimerSeconds: 0`): sem card, sem
  encerramento; o apresentador avança quando quiser.
- **O apresentador recarrega a página com o tempo já esgotado** (o registro
  ainda está "correndo" com `endsAt` no passado): ao abrir, `runOut` é
  verdadeiro e a apresentação passa direto para o gabarito.
- **Sai do gabarito antes dos 3 s e volta**: o suspense recomeça (nada foi
  registrado).
- **Participante entra atrasado no gabarito já revelado**: vê a resposta na
  hora (as corretas já estão em `revealedAnswers`).
- **Alguém tenta ler o gabarito antes da revelação** (ferramentas do
  navegador): a sala só tem `correctOptionIds: []`, e a leitura de
  `secret/answers` é recusada pelas regras.
- **Relógio do celular adiantado**: nada muda, porque o bloqueio só vem de
  `closed`, gravado pelo projetor.

### 12.4 Sessão completa com vários tipos

Apresentação "Introdução à Análise de Dados" (a do exemplo do prompt de IA):

1. **Slide 1, `text`** "Abertura": projetor com "Introdução à Análise de
   Dados" centralizado em 64 px; celulares com o quadro "O apresentador está
   exibindo um texto:". Nenhuma escrita além da presença.
2. **Slide 2, `wordcloud`** "O que vem à sua mente ao ouvir "dados"?" (até 3):
   cada pessoa envia até três textos; a nuvem cresce e se reorganiza; rodapé
   "30 participante(s) · 24 responderam · 61 resposta(s) enviada(s)".
3. **Slide 3, `pie`** "Com que frequência você analisa dados no trabalho?":
   um toque por pessoa; fatias com porcentagem e contagem; rodapé
   "30 participante(s) · 27 responderam".
4. **Slide 4, `quiz`** "O que é uma mediana?" com cronômetro de 20 s e
   **slide 5, `answer`** automático: linha do tempo da seção 12.3.
5. **Slide 6, `bar`** "Quais ferramentas você já usou?" (múltipla): barras
   com contadores; rodapé "30 participante(s) · 25 responderam · 58 voto(s)".
6. **Slide 7, `text`** "Encerramento".
7. **Seta para a direita no último slide**: numa escrita,
   `currentSlideIndex: 7` (igual a `slides.length`) e `status: 'ended'`.
   Projetor: slide final com miniaturas e **Baixar resultados (PDF)**,
   navegação desativada e a faixa "A apresentação foi encerrada." com
   **Apresentar de novo**; celulares: "Obrigado por participar! A
   apresentação foi encerrada.", **Rever os slides** e, com `allowDownload`,
   **Baixar slides**. Uma resposta que chegue agora é recusada pelas regras.
8. **Baixar resultados (PDF)**: `getAllResponses`, `fetchAssets`,
   `loadRoomFonts` e `exportResultsPdf` geram
   `introducao-a-analise-de-dados-resultados.pdf` com capa, uma página por
   slide (o gabarito não vira página) e uma tabela depois de cada slide
   interativo com respostas.
9. **Ana toca em Rever os slides**: `/view/K7MP2Q` mostra os slides em
   rolagem, sem dicas e sem os slides de gabarito; com "Mostrar respostas
   certas", a pergunta de mediana mostra "O valor central" marcada. Com
   `allowDownload`, ela toca em **PDF dos slides** na tela final e baixa
   `introducao-a-analise-de-dados.pdf`, uma página por slide.
10. **Apresentar de novo** (outra turma): o projetor lê os gabaritos, monta a
    apresentação com imagens e fontes, cria a sala `M4QX8T` (vazia de
    respostas) e navega para ela. `K7MP2Q` continua encerrada, com o PDF e o
    modo leitura disponíveis.

### 12.5 Edição de uma sala em andamento

1. No slide 4 (pergunta com 8 s restantes), o apresentador clica em
   **Editar**: `/edit/K7MP2Q/<token>`. A plateia continua no slide 4; o
   cronômetro continua no documento (quem encerra é o projetor, que agora está
   fechado).
2. A tela carrega a sala no próprio editor (com imagens e fontes) e mostra a
   faixa de aviso. O apresentador corrige o texto da alternativa C, liga
   "Solicitar o nome" e muda o cronômetro para 30 s.
3. **Salvar alterações** fica ativo; ao clicar: "Há 30 participantes nesta
   sala. Ao salvar, todos serão redirecionados para o início da apresentação,
   assim como você."
4. Confirmando: envia imagens e fontes novas (nenhuma, neste caso) e grava
   num lote, na sala, `title`, `slides` (sem gabarito), `settings`
   (completo), `currentSlideIndex: 0`, `timers: {}`, `revealedSlideIds: []`,
   `answersHidden: true`, `revealedAnswers: {}`, `status: 'live'`,
   `updatedAt` e `revision: increment(1)` (de 0 para 1), e, em
   `secret/answers`, os gabaritos. Depois apaga imagens e fontes sem uso.
5. A tela navega para `/present/K7MP2Q/<token>`, que abre no slide 1.
6. Cada celular recebe o snapshot: `currentSlideIndex: 0` e `revision: 1`
   maior que o visto (0): aparece o aviso "O apresentador atualizou a
   apresentação e todos voltaram para o início." por 10 s. Como "Solicitar o
   nome" foi ligado, quem não tinha nome vê o pedido antes do primeiro slide.
7. As respostas antigas continuam na coleção; voltando à pergunta, o
   cronômetro recomeça com 30 s cheios, e o gabarito terá suspense de novo.

Se ele tivesse clicado em "Voltar à apresentação" sem salvar: "Descartar as
alterações?"; descartando, nada é gravado, ninguém é redirecionado, e o
projetor, ao reabrir, encerra a pergunta se o tempo já tiver acabado.

### 12.6 Retomar e reivindicar o controle

- **Mesmo dispositivo**: a tela inicial lista "Continuar como apresentador
  (neste dispositivo)" com o título, o código e a situação ("No ar",
  "Encerrada" ou "Não existe mais"). **Retomar** (só nas salas no ar) abre
  `/present/<código>/<token>`; **Exportar PDF** gera o relatório sem reabrir a
  apresentação, com os gabaritos lidos por `fetchAnswers` (se a sala não
  existir mais: "A sala XXXXXX não existe mais.").
- **Outro navegador** (ou dados limpos): ao abrir a URL com o token, o uid
  novo `P2` é diferente de `creatorUid`. `claimPresenter` faz `update` em
  `private/presenter` com `{ ownerUid: P2, token }`; as regras aceitam porque o
  token é o mesmo. Em seguida tenta `creatorUid: P2` na sala. O acesso é
  concedido e a sessão é lembrada nesse dispositivo.
- **Sem o token** (`/present/K7MP2Q`) e com outro uid: tela "Acesso de
  apresentador necessário", com atalho para entrar como participante.
- As salas lembradas ficam no `localStorage`, separado por domínio: quem
  apresentou pelo GitHub Pages não as vê no Firebase Hosting (o link com o
  token funciona nos dois).

### 12.7 Importar um PowerPoint e apresentar

1. **Importar**, opção "PowerPoint (.pptx)", modo **Substituir tudo**, arquivo
   `aula.pptx` (16:9, 12 slides, 1 oculto, fonte "Montserrat" embutida).
2. O leitor é baixado; o modal mostra "Lendo as fontes embutidas…" e depois
   "Convertendo o slide i de 12…".
3. As quatro variantes de Montserrat são extraídas (EOT, XOR, MTX),
   convertidas para WOFF e registradas.
4. Resultado: 11 slides livres, N imagens, "Fontes embutidas: Montserrat" e o
   aviso "1 slide(s) oculto(s) no PowerPoint ficaram de fora.".
   **Concluir**.
5. O editor mostra a lista de fontes com "Montserrat (embutida)" no topo.
6. **Iniciar apresentação**: a sala é criada; as imagens vão para `assets` e
   a fonte vai para `fonts` em partes (`font_xxx`, `font_xxx~1`...).
7. Projetor e celulares leem a subcoleção `fonts` uma vez, juntam as partes,
   registram com `FontFace`, e os textos trocam para Montserrat sozinhos.

### 12.8 Situações de borda

| Situação | Comportamento |
| --- | --- |
| Participante abre `/present/<código>` sem token | Tela "Acesso de apresentador necessário", com atalho para entrar como participante |
| Código inexistente | "Sala não encontrada. Verifique o código com o apresentador." com "Tentar outro código" |
| Apresentador recarrega a página | O token na URL reivindica o controle de volta |
| Apresentação sem slides | "Esta apresentação ainda não tem slides." |
| Firebase sem configuração | A interface carrega com aviso; só as chamadas de rede falham |
| Encurtador indisponível ou lento (mais de 8 s) | No modal, o link completo, "Não foi possível encurtar o link agora." e "Tentar de novo"; na projeção, o endereço do site no lugar do link curto |
| Gabarito cuja pergunta foi removida | "A pergunta deste gabarito não existe mais." (o editor remove órfãos) |
| Tempo esgotado sem gabarito depois | A pergunta continua no ar, travada; o apresentador avança |
| Relógio do celular adiantado ou atrasado | Não muda nada |
| Gabarito lido antes da revelação | Impossível pela sala (`correctOptionIds: []`); `secret/answers` recusa a leitura |
| O suspense do celular termina antes de o gabarito ser publicado | O suspense continua até a escrita do projetor chegar |
| Resposta enviada depois do fim da apresentação | Recusada pelas regras |
| Navegar numa sala encerrada | Botões e teclado sem efeito; "Apresentar de novo" abre uma sala nova |
| `/edit/<código>` de uma sala encerrada | "Esta apresentação foi encerrada e não pode mais ser editada." |
| `/view/<código>` com a sala no ar | "A leitura fica disponível quando a apresentação terminar." |
| Recarregar a tela de criação | O rascunho volta (texto na hora, imagens e fontes logo depois) |
| Participante desmarca todas as opções de uma múltipla escolha | A resposta é apagada e ele deixa de contar em "responderam" |
| Modal ou menu aberto no projetor | Setas, `PageUp`, `PageDown` e Espaço ficam com o modal ou o menu, sem trocar o slide |
| Apresentador sai de uma pergunta no meio da contagem | Pausa; voltar retoma de onde parou |
| Volta para uma pergunta que já zerou | Continua zerada, respostas congeladas, sem avanço automático |
| Volta para um gabarito já revelado | Resposta na hora |
| Sai do gabarito antes dos 3 s | Voltar refaz o suspense |
| Recarrega com o tempo já esgotado | Passa direto para o gabarito |
| Salva uma edição da sala | Todos (inclusive ele) voltam ao primeiro slide; cronômetros e gabaritos recomeçam; respostas ficam |
| A edição liga "Solicitar o nome" | Quem estava sem nome vê o pedido antes do primeiro slide |
| A edição remove o slide em que a plateia estava | Sem problema: todos voltam ao primeiro slide |
| Participante entra depois de uma edição | Vê a sala atualizada, sem aviso |
| `/edit/<código>` sem token | "Acesso de apresentador necessário" |
| A edição esvazia a lista | Salvar é recusado |
| Imagem ainda não chegou ao celular | Espaço reservado cinza; o resto aparece na hora |
| Imagem que não existe mais na sala | Espaço reservado com ícone de imagem ausente |
| Sala passaria de 1 MB sem as imagens | Criar ou salvar é recusado com o tamanho e a sugestão de dividir |
| Sala criada, mas envio das imagens falhou | Mensagem de que a sala existe sem as imagens; reabrir a edição e salvar envia de novo |
| `.ppt` antigo, ou outro arquivo na opção de PowerPoint | Recusado, com orientação de salvar como `.pptx` |
| `.pptx` na opção de JSON | Lido como PowerPoint |
| PowerPoint sem slides visíveis | "O arquivo não tem slides visíveis para importar." |
| Fonte embutida recusada pelo navegador | Fica de fora com aviso |
| Fonte maior que um documento | Dividida em partes e remontada em cada aparelho |
| Texto com fonte embutida apagado na edição | A fonte deixa de ser usada e é apagada ao salvar |
| Fonte OpenType (CFF) na exportação PPTX | Não é embutida; o modal avisa |
| Troca de formato com slides livres | Reenquadrados para caber, sem distorcer |

---

## 13. Algoritmos centrais

### 13.1 Código da sala e token

```ts
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'          // 32 símbolos, sem O/0 e I/1
export function generateRoomCode(length = 6): string {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  let code = ''
  for (let i = 0; i < length; i++) code += ALPHABET[values[i] % ALPHABET.length]
  return code                                                 // 32^6 = ~1,07 bilhão de códigos
}
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '')
}
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
export function generatePresenterToken(length = 24): string { /* mesmo método, 62 símbolos */ }
```

### 13.2 Agregação

```ts
export function aggregateWords(responses: ResponseDoc[]) {
  const counts = new Map<string, number>()
  const display = new Map<string, string>()
  for (const r of responses) for (const raw of r.value) {
    const word = String(raw).trim()
    if (!word) continue
    const key = word.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
    if (!display.has(key)) display.set(key, word)              // mantém a primeira grafia
  }
  return [...counts.entries()].map(([k, value]) => ({ text: display.get(k) ?? k, value }))
                              .sort((a, b) => b.value - a.value)
}

export function aggregateChoices(responses, options) {
  const counts = new Map<string, number>()
  for (const r of responses) for (const id of r.value) counts.set(id, (counts.get(id) ?? 0) + 1)
  return options.map((o) => ({ id: o.id, label: o.label, votes: counts.get(o.id) ?? 0 }))
}

export const answeredCount = (responses) => new Set(responses.map((r) => r.participantUid)).size

export function responseSummary(slide, responses): string {
  const answered = `${answeredCount(responses)} responderam`
  if (slide.type === 'wordcloud') {
    if (slide.wordLimitMode === 'one') return answered
    return `${answered} · ${totalWords(responses)} resposta(s) enviada(s)`
  }
  if (!slide.allowMultiple) return answered
  return `${answered} · ${totalVotes(aggregateChoices(responses, slide.options))} voto(s)`
}

export function namedResponses(responses, slide) {
  const labels = new Map(('options' in (slide ?? {}) ? slide.options : []).map((o) => [o.id, o.label]))
  return responses
    .map((r) => ({ uid: r.participantUid, name: r.participantName?.trim() || 'Anônimo',
                   answers: r.value.map((v) => labels.get(v) ?? v).filter(Boolean) }))
    .filter((r) => r.answers.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
```

Porcentagem no quadro de alternativas: `round(votos / total * 100)` (0 sem
votos). Na pizza: `toFixed(0)` sobre o total.

### 13.3 Regras de bloqueio do voto (`ChoiceInput`)

```ts
function isBlocked(optionId: string): boolean {
  if (timeUp) return true                                         // sala encerrou a pergunta
  if (settings.allowChangeAnswer || !hasAnswered) return false
  return slide.allowMultiple ? selected.has(optionId) : true      // múltipla: só bloqueia desmarcar
}
async function toggle(optionId: string) {
  if (isBlocked(optionId)) return
  if (slide.allowMultiple) {
    const next = new Set(selected)
    next.has(optionId) ? next.delete(optionId) : next.add(optionId)
    await saveResponse(code, slide.id, uid, 'choice', [...next], participantName)
  } else {
    await saveResponse(code, slide.id, uid, 'choice', [optionId], participantName)
  }
}
```

Na múltipla escolha com troca permitida, desmarcar a última opção chama
`saveResponse` com `[]`, que **apaga** o documento (`clearResponse`): uma
resposta vazia contaria em `answeredCount` (que olha só os uids) sem ter
voto. "Limpar resposta" apaga do mesmo jeito.

### 13.4 Layout da nuvem de palavras (`WordCloudView`)

Constantes: tamanhos nominais de 26 a 96; folga entre caixas 10 (x) e 6 (y);
margem interna 8 px; teto do tamanho renderizado de 45% da altura; no máximo
100 palavras; fonte `700 <tamanho>px Inter, system-ui, sans-serif`;
alongamentos testados `[0.3, 0.5, 0.15, 0.75, 1]`; cobertura boa 0,85.

1. **Ordenar** do mais frequente para o menos (empate pelo texto, para o
   layout ser determinístico) e cortar em 100.
2. **Tamanho nominal**: interpolação linear da frequência entre 26 e 96 (todos
   iguais: 61).
3. **Medir a caixa de tinta** de cada palavra num canvas reutilizado
   (`measureText`, com `actualBoundingBoxAscent` e `Descent`); altura =
   ascendente + descendente; deslocamento da linha de base
   `dy = (ascendente - descendente) / 2` para o centro da caixa cair em y = 0.
4. **Posicionar em espiral** (maiores primeiro): para cada palavra, percorre
   uma espiral de Arquimedes saindo do centro, esticada no eixo x por
   `stretch`, com anéis separados por `max(24, h + 12)` e passo angular
   `max(14, h * 0.6)` dividido pelo raio, até 4000 passos; o primeiro ponto sem
   sobreposição (testada com as caixas mais as folgas) é usado. Sem vaga, a
   palavra encosta à direita de tudo, sem sobrepor.
5. **Escolher o alongamento**: para cada `stretch = max(1, proporção da área *
   passo)`, posiciona tudo e calcula
   `fit = min(larguraÚtil / larguraDaCaixa, alturaÚtil / alturaDaCaixa)`;
   fica com o maior `fit`; para assim que a cobertura da outra dimensão chega a
   85%.
6. **Escala final**: `min(fit, alturaÚtil * 0.45 / maiorTamanho)`; o grupo é
   desenhado com `translate(centro da área) scale(escala)
   translate(-centro da caixa)`.
7. **Cor** estável por palavra: hash `(h * 31 + código) mod 1000003` do texto
   em minúsculas, índice na paleta.
8. **Recalcular** a cada mudança real (assinatura `texto:valor|...`) ou de
   tamanho do contêiner (`ResizeObserver`, com primeira medição síncrona em
   `useLayoutEffect`). Transições CSS de 0,5 s; palavras inéditas entram com
   `wc-pop`; as animações só ligam depois do primeiro quadro.

```ts
function findSpot(w: number, h: number, placed: PlacedWord[], stretch: number) {
  if (placed.length === 0) return { x: 0, y: 0 }
  const ring = Math.max(24, h + GAP_Y * 2)
  const arcStep = Math.max(14, h * 0.6)
  const growth = ring / (2 * Math.PI)
  let t = 0
  for (let i = 0; i < 4000; i++) {
    const r = growth * t
    const x = r * Math.cos(t) * stretch
    const y = r * Math.sin(t)
    if (!overlaps(x, y, w, h, placed)) return { x, y }
    t += arcStep / Math.max(r, arcStep)
  }
  return null
}
function overlaps(x, y, w, h, placed): boolean {
  return placed.some((p) => Math.abs(x - p.x) < (w + p.w) / 2 + GAP_X && Math.abs(y - p.y) < (h + p.h) / 2 + GAP_Y)
}
```

### 13.5 Quebra de rótulos das barras

Divide o rótulo em palavras, quebra palavras com mais de 15 caracteres, monta
linhas de até 15 caracteres e para em 4 linhas; se cortou, a última linha
termina com reticências. Cada linha é um `<text>` com `dy = tamanho + i *
tamanho * 1,15`; o eixo X reserva `round(tamanho * 4,9)` de altura.

### 13.6 Reenquadramento do slide livre

```ts
export function fitFreeSlideToFrame(slide: FreeSlide, frame: { width: number; height: number }): FreeSlide {
  if (slide.width === frame.width && slide.height === frame.height) return slide
  const factor = Math.min(frame.width / slide.width, frame.height / slide.height)
  const offsetX = (frame.width - slide.width * factor) / 2
  const offsetY = (frame.height - slide.height * factor) / 2
  const elements = slide.elements.map((el) => {
    const placed = { ...el, x: Math.round(offsetX + el.x * factor), y: Math.round(offsetY + el.y * factor),
                     width: Math.round(el.width * factor), height: Math.round(el.height * factor) }
    if (placed.kind === 'image') return placed.radius ? { ...placed, radius: placed.radius * factor } : placed
    return scaleText(placed, factor)   // fontSize (1 casa), padding, indent, hanging, spaceBefore, spaceAfter
  })
  return { ...slide, width: frame.width, height: frame.height, elements }
}
```

### 13.7 Ordem de camadas

`moveLayer(elements, id, 'front' | 'back' | 'forward' | 'backward')`: alvo é
o fim da lista, o início, uma posição acima ou uma abaixo; remove e reinsere.
O último da lista fica na frente.

### 13.8 Divisão de fontes em partes

```ts
const CHUNK_CHARS = 700_000
function fontDocs(font: PresentationFont) {
  const parts = Math.max(1, Math.ceil(font.dataUrl.length / CHUNK_CHARS))
  return Array.from({ length: parts }, (_, part) => ({
    id: part === 0 ? font.id : `${font.id}~${part}`,
    data: { fontId: font.id, family: font.family, weight: font.weight, style: font.style,
            part, parts, data: font.dataUrl.slice(part * CHUNK_CHARS, (part + 1) * CHUNK_CHARS),
            createdAt: Date.now() },
  }))
}
// Leitura: agrupa por fontId, coloca cada pedaço em parts[part]; só aceita se tiver todas as partes.
```

### 13.9 Lotes de escrita de imagens e fontes

```ts
let batch = writeBatch(db), size = 0, count = 0
const commits: Promise<void>[] = []
for (const item of items) {
  if (count > 0 && (size + item.chars > 7_000_000 || count >= 8)) {
    commits.push(batch.commit()); batch = writeBatch(db); size = 0; count = 0
  }
  batch.set(doc(col, item.id), item.data); size += item.chars; count++
}
if (count > 0) commits.push(batch.commit())
await Promise.all(commits)
```

### 13.10 Tamanho máximo da sala

```ts
const MAX_ROOM_BYTES = 1_000_000
function assertRoomFits(data: object) {
  const bytes = new Blob([JSON.stringify(data)]).size
  if (bytes > MAX_ROOM_BYTES) throw new Error(
    `A apresentação ficou grande demais para uma sala (${Math.round(bytes / 1024)} KB; ` +
    'o limite do Firestore é 1 MiB por documento). Divida-a em menos slides ou encurte os textos.')
}
```

### 13.11 Arraste da lista de slides (`SlideList`)

```tsx
const key = slides.map((s) => s.id).join('|')
const [order, setOrder] = useState<string[]>(() => slides.map((s) => s.id))
const orderRef = useRef(order); orderRef.current = order
const dragging = useRef(false)

// Fora do arraste, a lista segue o editor (slide novo, removido, importado).
useEffect(() => { if (!dragging.current) setOrder(key ? key.split('|') : []) }, [key])

<Reorder.Group as="ol" axis="y" values={order} onReorder={setOrder} aria-label="Ordem dos slides">
  {order.map((id) => (
    <SlideRow key={id} /* ... */
      onDragStart={() => { dragging.current = true }}
      onDragEnd={() => { dragging.current = false; reorderSlides(orderRef.current) }}   // grava só ao soltar
    />
  ))}
</Reorder.Group>

// Em cada SlideRow (Reorder.Item com dragListener={false} e dragControls):
// - mouse: onPointerDown no cartão chama controls.start(e) (exceto no gabarito e no menu);
// - toque: só a alça (touch-none) chama controls.start(e);
// - onDrag marca justDragged quando |offset.y| > 4; o clique que termina o arraste não seleciona.
```

A ordem muda **na tela** durante o gesto (estado local) e só vai para o
editor ao soltar: gravar a cada troca faria `syncAnswerSlides` reposicionar o
gabarito no meio do arraste. Ao soltar, `reorderSlides` aplica a ordem e o
gabarito volta para logo depois da pergunta.

---

## 14. Desenvolvimento, configuração e deploy

### 14.1 Pré-requisitos e execução local

- Node.js 18+ (o CI usa a 20).
- Um projeto no Firebase Console com **Firestore** e **Autenticação Anônima**.

```bash
npm install
cp .env.example .env      # preencher as chaves VITE_FIREBASE_*
npm run dev               # http://localhost:5173
```

Para testar o tempo real, abra **duas janelas**: uma em "Criar sala"
(apresentador) e outra em "Entrar na sala" (participante) com o código gerado.
Sem `.env`, a aplicação carrega com aviso: dá para editar, ver a prévia e
exportar JSON; só as operações de sala falham.

| Comando | Ação |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (porta 5173) |
| `npm run build` | Type-check (`tsc -b`) + build em `dist/` (GitHub Pages) |
| `npm run build:firebase` | Type-check + build com `base` na raiz em `dist-firebase/` |
| `npm run preview` | Serve o build localmente |
| `npm run typecheck` | Só `tsc -b` |
| `npm run lint` | ESLint |

Rode typecheck e lint antes de commitar: o build do CI falha em erro de tipo.

**Emuladores do Firebase.** Para desenvolver e testar as regras sem tocar no
projeto real, o app pode usar os emuladores locais do Auth e do Firestore
(precisa de Java, porque o emulador do Firestore roda na JVM). O
`firebase.json` tem a seção `emulators` (Auth em `127.0.0.1:9099`, Firestore
em `127.0.0.1:8080`, interface web desligada, `singleProjectMode: true`):

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-ip
```

Um id de projeto que começa com `demo-` diz à CLI que não há projeto real.
Em seguida, um `.env.emulators.local` (o `.gitignore` já cobre `.env.*.local`)
com chaves fictícias e a variável que liga os emuladores:

```
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-ip.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-ip
VITE_FIREBASE_STORAGE_BUCKET=demo-ip.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
VITE_FIREBASE_EMULATORS=true
```

E o Vite nesse modo: `npx vite --mode emulators`. Com a variável ligada,
`lib/firebase.ts` chama `connectAuthEmulator` e `connectFirestoreEmulator`
(seção 8.1). As regras podem ser conferidas direto pela API REST do emulador
(`http://127.0.0.1:8080/v1/projects/demo-ip/databases/(default)/documents`,
com o token de um usuário do emulador no cabeçalho `Authorization`). Os dados
somem quando os emuladores param.

### 14.2 Configuração do Firebase (uma vez)

1. Criar o projeto no Firebase Console.
2. **Build, Firestore Database, Criar banco** (modo de produção).
3. **Build, Authentication, Sign-in method, Anônimo, Ativar**.
4. **Configurações do projeto, Seus apps, Web** e copiar as chaves para o
   `.env`.
5. Publicar `firestore.rules`: colar em **Firestore, Regras, Publicar** ou
   `npx firebase-tools deploy --only firestore:rules --project <id>`. Depois do
   primeiro deploy, a pipeline faz isso sozinha quando o arquivo muda.
6. Abrir **Hosting** e clicar em **Começar** (só avançar as telas) para criar o
   site padrão.
7. Depois de publicar no GitHub Pages, adicionar `SEU-USUARIO.github.io` em
   **Authentication, Settings, Domínios autorizados** (os domínios do Firebase
   Hosting já vêm autorizados).

`.env` (as chaves são identificadores públicos; a proteção é feita pelas
regras):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### 14.3 Pipeline de deploy (`.github/workflows/deploy.yml`)

Dispara em `push` na `main` e no disparo manual. Permissões `contents: read`,
`pages: write`, `id-token: write`; concorrência `pages` com cancelamento.

| Job | Espera | O que faz |
| --- | --- | --- |
| `build` | nada | `npm ci`; `npm run build` com os secrets e `VITE_BASE=/<nome-do-repo>/`; `npx vite build --mode firebase`; envia o artefato do Pages (`dist`) e o `site-firebase` (`dist-firebase`, retenção de 1 dia) |
| `regras-firestore` | nada | Publica `firestore.rules` só quando o arquivo muda em relação ao commit anterior do push (ou no disparo manual, ou sem base de comparação confiável) |
| `deploy` | `build` e `regras-firestore` | `actions/deploy-pages@v4` |
| `hosting-firebase` | `build` e `regras-firestore` | Baixa `site-firebase` e roda `firebase-tools@15 deploy --only hosting` com a mensagem do commit |

- As publicações esperam as regras: uma versão do app que usa uma coleção
  recém-liberada nunca vai ao ar antes das regras (evita `permission-denied`).
  Entre si, Pages e Hosting são independentes.
- Só `firestore:rules` (incluir `firestore:indexes` apagaria índices criados
  pelo console).
- Sem `FIREBASE_SERVICE_ACCOUNT` ou `VITE_FIREBASE_PROJECT_ID`, os jobs de
  regras e Hosting emitem `::warning::` e terminam com sucesso; o Pages publica
  normalmente.
- A credencial é gravada em `$RUNNER_TEMP/firebase-service-account.json` e
  apontada por `GOOGLE_APPLICATION_CREDENTIALS`.
- Não há `.firebaserc`: o id do projeto vem da secret via `--project`.

Secrets:

| Secret | Para quê |
| --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Build |
| `VITE_FIREBASE_PROJECT_ID` | Build e alvo das regras e do Hosting |
| `FIREBASE_SERVICE_ACCOUNT` | JSON inteiro da conta de serviço (segredo de verdade) |

Conta de serviço (Google Cloud Console, IAM, Contas de serviço): papéis
**Firebase Rules Admin** (`roles/firebaserules.admin`), **Firebase Hosting
Admin** (`roles/firebasehosting.admin`), **Firebase Viewer**
(`roles/firebase.viewer`) e, se a CLI reclamar da Service Usage API,
**Service Usage Consumer** (`roles/serviceusage.serviceUsageConsumer`).
Alternativa mais permissiva: **Firebase Admin** (`roles/firebase.admin`).
Gerar a chave JSON na aba Chaves e colar o conteúdo inteiro na secret.

Também é preciso: **Settings, Pages, Source: GitHub Actions** no repositório.

`firebase.json`: publica `dist-firebase`, com `Cache-Control: public,
max-age=31536000, immutable` em `/assets/**` (nomes mudam a cada build) e
`no-cache` em `/` e `/index.html`; sem reescrita para o `index.html` (o
`HashRouter` dispensa).

Publicação manual no Hosting:

```bash
npm run build:firebase
npx firebase-tools deploy --only hosting --project <id-do-projeto>
```

Endereços: `https://<usuario>.github.io/<nome-do-repo>/` e
`https://<id-do-projeto>.web.app/` (e `.firebaseapp.com`). As salas lembradas
para "Retomar" ficam no `localStorage` de cada domínio; a sala é a mesma nos
dois (o banco é um só).

### 14.4 Solução de problemas

| Sintoma | Causa e correção |
| --- | --- |
| `auth/configuration-not-found` ao iniciar | Autenticação Anônima desativada |
| `permission-denied` ao criar sala ou votar | Regras não publicadas |
| `permission-denied` ao avançar, encerrar ou votar numa sala encerrada | Esperado: sala `ended` não muda nem aceita respostas; "Apresentar de novo" abre outra |
| Gabarito não aparece no projetor ou no PDF de uma sala nova | Regras antigas sem `secret/{doc}`: republicar |
| `Missing or insufficient permissions` | Firestore Database não criado |
| Página em branco após o deploy | `base` não bate com o caminho (confira `VITE_BASE`) |
| Login recusado no domínio publicado | Adicionar o domínio em Domínios autorizados |
| Contagem de participantes parada em zero | Regras antigas sem `participants/{participantUid}` |
| `regras-firestore` falha com `PERMISSION_DENIED` | Faltam Firebase Rules Admin ou Firebase Viewer |
| `regras-firestore` falha com erro de credencial | A secret não contém o JSON inteiro |
| Aviso "Credenciais ausentes" | Falta `FIREBASE_SERVICE_ACCOUNT` |
| Link curto não aparece ("Não foi possível encurtar o link agora.") | O da.gd não respondeu em 8 s (rede lenta, proxy, serviço fora do ar): "Tentar de novo"; o QR e o código continuam valendo |
| O editor da criação abre com uma apresentação antiga | É o rascunho do navegador: "Começar do zero" (menu "Mais") descarta |
| `hosting-firebase` com `403` | Falta Firebase Hosting Admin |
| `hosting-firebase` não encontra o site | Hosting não iniciado no console (passo 6) |
| Site do Hosting em branco | O artefato veio do build do Pages |
| "A sala foi criada, mas as imagens... não foram enviadas" | Regras antigas sem `assets/{assetId}` |
| Imagens como espaço reservado cinza | Subcoleção `assets` vazia ou leitura negada; salvar a sala de novo pela edição |
| "A apresentação ficou grande demais para uma sala" | Documento passaria de 1 MiB: dividir a apresentação |
| PowerPoint importa com fontes diferentes | A fonte não veio embutida e não está instalada |
| Fontes embutidas não aparecem na sala | Regras antigas sem `fonts/{fontId}` |
| PowerPoint exportado abre com outra fonte | Fonte não embutida ou OpenType (CFF) |

### 14.5 Onde mexer para tarefas comuns

| Quero... | Comece por (nesta ordem) |
| --- | --- |
| Criar um novo tipo de slide | `types/presentation.ts`, `utils/slideFactory.ts`, `utils/validation.ts`, `components/editor/` (com a dica em `AddSlideMenu`), `SlideDisplay`, `ParticipateView`, `exportPdf`, `aiPrompt` (e `pptxExport/standard.ts`, que também alimenta o download e o modo leitura) |
| Adicionar uma opção global | `PresentationSettings`, `utils/settings.ts`, `utils/validation.ts`, `PresentationSettingsButton`, `SlideSettingsSection` (ou, se for só global, `SlideOverrides` e `overridesSchema`), `aiPrompt` |
| Mudar as cores dos gráficos | `components/charts/palette.ts` (vale para o PDF) |
| Mudar o que a edição grava | `saveAndRestartRoom` em `lib/rooms.ts` |
| Ajustar o relatório | `utils/exportPdf.ts` |
| Mexer nas regras | `firestore.rules`, testando com os emuladores (seção 14.1) |
| Mudar o que a plateia sabe do gabarito | `lib/answers.ts`, `markAnswerRevealed` em `lib/rooms.ts`, regra `secret/{doc}` |
| Mudar o fim da apresentação | `goTo` e `endRoom` (`PresentPage`, `lib/rooms.ts`), tela final da `RoomPage` |
| Mudar o rascunho do editor | `store/editorDraft.ts` (quando restaura e grava) e `lib/draftStorage.ts` (onde guarda) |
| Trocar ou acrescentar um encurtador | `PROVIDERS` em `lib/shortUrl.ts` |
| Download dos slides e modo leitura | `utils/staticSlides.ts`, `utils/exportSlidesPdf.ts`, `hooks/useSlideDownload.ts`, `pages/ViewPage.tsx` |
| Layout do editor no celular | `EditorWorkspace.tsx` (pilha abaixo de 1024 px) e `components/ui/StackSection.tsx` |
| Ações da barra do editor ou do projetor | `EditorToolbar.tsx` e o `menuItems` do `PresentPage` (uma lista para os botões e o menu) |
| Mudar a exibição de um elemento do slide livre | `components/free/layout.ts`, `FreeElementContent.tsx`, e para o PDF `utils/freeSlideRaster.ts` e `utils/canvasText.ts` |
| Nova propriedade de texto no slide livre | `FreeTextStyle` ou `FreeTextParagraph`, `utils/validation.ts`, `utils/richText.ts`, `utils/richTextDom.ts`, `components/free/layout.ts`, `utils/canvasText.ts`, `FreeSlideConfig`, `utils/pptx/text.ts`, `utils/pptxExport/slide.ts` |
| Compressão das imagens | `utils/images.ts` |
| Onde as imagens ficam | `lib/assets.ts`, `hooks/useRoomAssets.ts`, regra `assets/{assetId}` |
| Exportação PPTX | `utils/pptxExport/slide.ts` e `standard.ts` |
| Fontes embutidas | `utils/pptx/fonts.ts`, `utils/fonts/`, `lib/fonts.ts`, regra `fonts/{fontId}` |

---

## 15. Guia para embutir em um projeto maior

Esta seção traduz a arquitetura acima em decisões para quem vai incorporar as
Apresentações Interativas como uma funcionalidade dentro de outro sistema.

### 15.1 Fronteira do módulo

Organize tudo numa pasta de funcionalidade (por exemplo
`src/features/interactive-presentations/`) mantendo as mesmas camadas
internas (`types`, `utils`, `lib`, `hooks`, `store`, `components`, `pages`).
Exponha uma superfície pequena:

```tsx
// features/interactive-presentations/index.ts
export { InteractivePresentationsRoutes } from './routes'          // as 7 telas
export type { Presentation, Slide } from './types/presentation'    // para integrar dados
export { exportPresentation, importPresentationFromFile } from './utils/importExport'
```

`utils/` e `types/` não dependem de React nem do Firebase: podem ser
reaproveitados no backend do sistema maior (validação do JSON, agregação,
geração de relatórios).

### 15.2 Rotas e URLs

- O código atual navega com caminhos absolutos (`navigate('/present/...')`).
  Ao montar sob um prefixo (por exemplo `/apresentacoes/*`), centralize os
  caminhos num único lugar:

```ts
export const ipPaths = {
  home: () => `${BASE}/`,
  create: () => `${BASE}/create`,
  present: (code: string, token?: string) => `${BASE}/present/${code}${token ? `/${token}` : ''}`,
  edit: (code: string, token?: string) => `${BASE}/edit/${code}${token ? `/${token}` : ''}`,
  join: () => `${BASE}/join`,
  room: (code: string) => `${BASE}/room/${code}`,
  view: (code?: string) => `${BASE}/view${code ? `/${code}` : ''}`,
}
```

- **Link da plateia** (QR, cópia, encurtador): com `HashRouter` é
  `origin + pathname + '#/room/<código>'`; com `BrowserRouter` vira
  `origin + basePath + '/apresentacoes/room/<código>'`, e o servidor do sistema
  precisa de fallback de SPA para essas rotas.
- A rota do participante precisa ser **pública** (sem login do sistema maior),
  senão a plateia não entra pelo QR. O mesmo vale para `/view/<código>`, que
  o participante abre por "Rever os slides".
- O encurtador recebe a URL de entrada inteira: com `BrowserRouter`, o da.gd
  continua servindo (o redirecionamento leva o caminho); com `HashRouter`, ele
  preserva o fragmento.
- As rotas `/present` e `/edit` dependem do token na URL; se o sistema tiver
  login, pode exigir login além do token, mas mantenha o token para trocar de
  dispositivo.

### 15.3 Firebase dentro de outro projeto

- **Mesmo projeto Firebase**: reaproveite o app existente
  (`getApps().length ? getApp() : initializeApp(config)`), ou crie um app
  nomeado (`initializeApp(config, 'interactive-presentations')`) para isolar a
  autenticação anônima da do sistema.
- **Atenção à autenticação**: no mesmo app, `signInAnonymously` substitui o
  usuário logado. O hook atual só faz login anônimo quando **não há usuário**;
  se o sistema já autentica pelo Firebase Auth, o uid do usuário do sistema
  vira o `creatorUid` (e o `participantUid`), o que é desejável. Se o sistema
  usa outro provedor de identidade, use um **app nomeado** só para a
  funcionalidade.
- **Nomes de coleção**: `rooms` é genérico. Centralize os nomes (por exemplo
  `ip_rooms`) para não colidir com coleções do sistema; as subcoleções podem
  manter os nomes.
- **Regras**: um projeto tem um único arquivo de regras. Incorpore os blocos
  `match` do Apêndice C ao arquivo do sistema, ajustando o nome da coleção.
  Cada `get()` nas regras conta como leitura (e há limite de chamadas por
  requisição).
- **Domínios autorizados** e o provedor **Anônimo** precisam estar ativos no
  projeto.

### 15.4 Trocar o Firestore por outro backend

A camada `lib/` é a porta de saída. Para usar outro mecanismo de tempo real
(WebSocket próprio, Supabase Realtime, Socket.IO), reimplemente estas funções
preservando a semântica:

| Função | Semântica que precisa ser mantida |
| --- | --- |
| `createRoom(uid, presentation)` | Código único; sala (sem gabarito) + token + gabaritos gravados de forma atômica; imagens e fontes só depois |
| `claimPresenter(code, uid, token)` | Troca de dono só com o token correto; token nunca legível |
| `subscribeRoom(code, cb)`, `getRoom(code)` | Envia o documento inteiro a cada mudança; leitura única |
| `setCurrentSlide(code, index, timers, extra?)` | Índice e cronômetros (e, no fim, `status: 'ended'`) na **mesma** escrita |
| `endRoom(code, slideCount, timers)` | Slide final e `status: 'ended'` numa escrita; depois disso, nada muda na sala nem entram respostas |
| `saveSlideTimers(code, timers)` | Só cronômetros |
| `markAnswerRevealed(code, answerSlideId, quizSlideId, correctOptionIds)` | União idempotente do registro e publicação do gabarito, na mesma escrita |
| `subscribeAnswers`, `fetchAnswers` (`lib/answers.ts`) | Gabaritos legíveis só pelo dono |
| `saveAndRestartRoom(code, presentation, stored)` | Sala e gabaritos num lote com reinício + `revision` incrementado |
| `loadRoomPresentation(code, room, slides)` | A apresentação completa de uma sala (com imagens e fontes) |
| `saveResponse`, `clearResponse` | Upsert e exclusão por chave `slideId + uid`; lista vazia apaga |
| `subscribeResponses(code, slideId)`, `subscribeMyResponse`, `getAllResponses` | Filtro por slide; documento próprio; leitura total |
| `joinRoom`, `subscribeParticipants` | Upsert por uid (com `joinedAt` só na criação); lista inteira |
| `fetchAsset`, `uploadAssets`, `deleteAssets` | Imagens imutáveis por id de conteúdo |
| `fetchRoomFonts`, `uploadFonts`, `deleteFontDocs` | Fontes por sala, relidas a cada revisão |

Com um backend próprio, imagens e fontes podem ir para um armazenamento de
arquivos (S3, Cloud Storage) com URLs, eliminando a divisão em partes e o
limite de 900 mil caracteres; o modelo (`assetId` por conteúdo) continua
igual.

### 15.5 Estilo e tema

- O projeto usa **Tailwind CSS v4** com classes utilitárias em todos os
  componentes e a variante `dark` por classe. Se o sistema usa Tailwind v4,
  basta incluir `@custom-variant dark (&:where(.dark, .dark *));` (ou a
  equivalente do sistema) e as classes próprias da seção 9.9. Com Tailwind v3,
  configure `darkMode: 'class'` e troque a sintaxe de `@import`/`@custom-variant`.
  Sem Tailwind, será preciso reescrever os estilos.
- **Tema**: se o sistema já controla o tema (classe `.dark` no `<html>`),
  substitua o `themeStore` pelo do sistema e remova o `ThemeToggle` das telas.
- **Altura do editor**: `lg:h-[100dvh]` assume a página inteira; dentro de um
  layout com cabeçalho, use `calc(100dvh - <altura do cabeçalho>)`.
- O projetor pode ser aberto sem o layout do sistema (tela cheia), e a tela do
  participante deve ser leve e sem navegação do sistema.
- Isole as classes globais (`.ft-text`, `.ui-slider`, `.wc-*`, `.chart-*`,
  `.recharts-default-tooltip`) com um prefixo ou dentro de um contêiner, se
  houver risco de conflito.

### 15.6 Estado, SSR e carregamento

- Zustand: o editor padrão (`defaultEditorStore`) é criado no carregamento do
  módulo; a edição de sala cria o seu. O rascunho fica no navegador
  (`editorDraft.ts`, com `localStorage` e IndexedDB); para guardá-lo no
  sistema (e abrir em outro aparelho), troque `lib/draftStorage.ts` por
  chamadas ao backend do sistema, mantendo `startDraftPersistence` e
  `discardDraft`.
- **SSR** (Next.js, Remix): todas as telas usam `window`, `localStorage`,
  `crypto`, `FontFace`, canvas e `onSnapshot`. Marque como componentes de
  cliente e carregue as rotas sem renderização no servidor.
- Mantenha os `import()` dinâmicos de `jspdf`, `utils/exportSlidesPdf`,
  `utils/pptx` e `utils/pptxExport` (são os maiores pedaços).
- Chaves do `localStorage` (`ip-theme`, `ip-presenter-sessions`,
  `ip-participant-names`, `ip-short-urls`, `ip-editor-draft`) e o banco
  IndexedDB `ip-editor`: mantenha o prefixo ou acrescente o do sistema.

### 15.7 Integração com dados do sistema maior

- Associe salas a entidades do sistema (turma, evento, curso) gravando um campo
  extra no documento da sala (por exemplo `context: { tipo, id }`) e liberando
  esse campo nas regras.
- Biblioteca de apresentações: guarde o JSON (`Presentation`) no banco do
  sistema; o schema Zod valida na entrada (também no servidor).
- Relatórios: `getAllResponses` + `utils/aggregate.ts` geram os mesmos números
  do PDF para outros painéis.
- Identidade dos participantes: se a plateia estiver logada no sistema, o nome
  pode vir do perfil (dispensando o `NamePrompt`) e ir em `participantName`.

### 15.8 Segurança e privacidade

- Leitura pública das respostas é uma decisão do projeto original (o código é
  a chave). Se o sistema exigir mais privacidade, restrinja a leitura das
  respostas ao dono da sala e ao próprio autor (a consulta do apresentador
  continua permitida porque ele é dono; o participante lê só o próprio
  documento):

```
match /responses/{responseId} {
  allow read: if isSignedIn() && (resource.data.participantUid == request.auth.uid || isRoomOwner(code));
  ...
}
```

  Nesse caso, o PDF só pode ser gerado pelo dono, o que já é o comportamento.
- As regras atuais já validam o formato de respostas e presença (chaves
  permitidas, tamanhos de lista e de nome, id conferido) e recusam respostas
  depois do fim; o gabarito só é legível pelo dono até a revelação. Ao
  incorporar, mantenha esses blocos e acrescente as validações do sistema.
- Qualquer usuário autenticado (inclusive anônimo) ainda pode criar salas:
  em ambientes abertos, exija o login do sistema para criar (`allow create`
  com o provedor do sistema).
- Não há moderação: em ambientes abertos, considere filtrar a nuvem de
  palavras.
- Não há expiração: agende uma limpeza (Cloud Function ou tarefa do sistema)
  que apague salas antigas **e suas subcoleções** (o Firestore não apaga em
  cascata).

### 15.9 Internacionalização

Todos os textos estão em português do Brasil, escritos diretamente nos
componentes, no PDF, no prompt de IA e nos avisos do PowerPoint. Para outro
idioma, extraia as strings para o mecanismo de i18n do sistema.

---

## 16. Roteiro de replicação e checklist

Ordem sugerida, com o critério de pronto de cada etapa:

1. **Base do projeto**: Vite + React 18 + TypeScript estrito + Tailwind v4 +
   React Router + Zustand + ESLint. Pronto quando `npm run build` passa com
   uma página em branco roteada.
2. **Domínio**: `types/presentation.ts` (Apêndice A), `utils/settings.ts`,
   `utils/slideFactory.ts`, `utils/slides.ts`, `utils/aggregate.ts`,
   `utils/timer.ts`. Pronto quando as funções puras têm testes de
   `resolveSlideSettings`, `advanceTimers`, `aggregate*` e `responseSummary`.
3. **Validação e JSON**: `utils/validation.ts` (Apêndice B) e
   `utils/importExport.ts`. Pronto quando o JSON de exemplo importa e um
   arquivo com imagem ausente é recusado com o caminho.
4. **Componentes `ui/`**: Button, Card, Input, Checkbox/Radio, Slider, Select,
   ScrollArea, Modal, Menu, StackSection, ConfirmDialog, Banner, ColorInput,
   SegmentedControl, ToggleButton, e o `index.css` (seção 9.9); hooks
   `useMediaQuery` e `useDialogControl`.
5. **Editor**: `editorStore` (com `syncAnswerSlides`, `applySlides` e
   `reorderSlides`), `EditorWorkspace` (colunas e pilha), `EditorToolbar`,
   `AddSlideMenu`, `SlideList` com framer-motion, formulários por tipo,
   opções globais e por slide, `ScaledFrame`, `SlideDisplay` com respostas
   vazias, e o rascunho (`editorDraft.ts`, `draftStorage.ts`). Pronto quando
   ligar e desligar o gabarito insere e remove o slide no lugar certo, o
   arraste mantém o gabarito atrás da pergunta e recarregar a página traz o
   rascunho de volta.
6. **Gráficos**: paleta, barras, pizza, nuvem (seção 13.4), quadro de
   alternativas, cronômetro, suspense.
7. **Firebase**: `lib/firebase.ts` (com a opção dos emuladores), regras
   (Apêndice C), `useParticipant`, `lib/rooms.ts`, `lib/answers.ts`,
   `lib/responses.ts`, `lib/participants.ts`, `lib/roomCode.ts`, hooks de
   assinatura. Pronto quando duas janelas conversam (criar, entrar, votar, ver
   o voto no projetor) e o gabarito não aparece no documento da sala.
8. **Projetor**: `PresentPage` com acesso, cabeçalho em uma linha com o menu
   "Mais ações", navegação por teclado, cronômetro (início, pausa, retomada,
   encerramento, avanço), gabarito com registro de revelação e publicação,
   rodapé, slide final, encerramento e "Apresentar de novo". Pronto quando a
   linha do tempo da seção 12.3 se reproduz, inclusive as variações, e passar
   do último slide encerra a sala.
9. **Participante**: `JoinPage`, `RoomPage`, `ParticipateView`, `ChoiceInput`,
   `WordCloudInput`, `AnswerReveal`, `NamePrompt`, aviso de reinício, tela
   final.
10. **Sessões e retomada**: `presenterSessions`, `HomePage`,
    `usePresenterAccess` com `claimPresenter`.
11. **Edição em andamento**: `EditRoomPage`, `saveAndRestartRoom`. Pronto
    quando a seção 12.5 se reproduz.
12. **PDF**: `exportPdf.ts` (seção 11.6).
13. **Compartilhamento**: `RoomCodeDialog` (modal, projeção, QR ampliado),
    `ShareRoom` e o encurtador da.gd (seção 11.8).
14. **Slide livre**: modelo, `layout.ts`, `FreeSlideView`, texto rico
    (`richText`, `richTextDom`, `freeTextFormat`), `FreeTextEditable`,
    `FreeSlideCanvas`, `FreeSlideConfig`, `useFreeSlideActions`, imagens
    (`images.ts`, `lib/assets.ts`, `useRoomAssets`), canvas para o PDF.
15. **Fontes**: `utils/fonts/` (sfnt, WOFF, registro) e `lib/fonts.ts`.
16. **Importar PowerPoint**: `utils/pptx/` com EOT/MTX/LZCOMP.
17. **Exportar PowerPoint**: `utils/pptxExport/`.
18. **Prompt de IA** (Apêndice E).
19. **Download dos slides e modo leitura**: `staticSlides.ts`,
    `exportSlidesPdf.ts`, `useSlideDownload`, `DownloadSlides`, `ViewPage`
    (seções 11.9 e 11.10).
20. **Deploy**: `vite.config.ts`, `firebase.json` (com os emuladores),
    workflow (Apêndice D).

Checklist de comportamento (para testes de aceitação):

- [ ] Código de sala sem `O`, `0`, `I`, `1`; normalização de espaços e
      minúsculas na entrada.
- [ ] Quem só tem o código não apresenta; o token reivindica o controle em
      outro navegador.
- [ ] Presença conta antes de qualquer resposta; o rodapé separa participantes
      e respondentes.
- [ ] Uma resposta por pessoa por slide; reenvio sobrescreve; desmarcar tudo
      apaga.
- [ ] Nuvem recusa repetição da mesma pessoa sem diferenciar maiúsculas.
- [ ] Troca desligada: escolha única trava no primeiro toque; múltipla bloqueia
      só desmarcar; nuvem sem remover.
- [ ] Trocar de slide no projetor muda todos os celulares sem recarregar; quem
      entra atrasado já abre no slide atual.
- [ ] Um voto aparece marcado no celular na hora e chega ao projetor sem
      recarregar; a mesma conta aberta em duas abas fica sincronizada.
- [ ] Depois de uma queda de rede, celulares e projetor voltam ao estado
      atual sozinhos.
- [ ] Cronômetro só no projetor; pausa, retoma, fica zerado; quem trava é o
      estado da sala.
- [ ] Ao zerar com gabarito em seguida, avança na mesma escrita que encerra.
- [ ] Suspense de 3 s só na primeira revelação; chegar atrasado mostra direto.
- [ ] O gabarito não está no documento público da sala antes da revelação;
      `secret/answers` recusa a leitura de quem não é dono.
- [ ] Identificação só com nome; no `quiz`, só com `showResponses`.
- [ ] Slide final com miniaturas; PDF só quando pedido.
- [ ] Passar do último slide (ou "Encerrar") grava `status: 'ended'` junto do
      índice; depois disso, a navegação para e respostas são recusadas;
      "Apresentar de novo" abre uma sala nova.
- [ ] Com `allowDownload`, o celular baixa os slides em PDF e PowerPoint no
      fim, sem respostas; `/view/<código>` só abre com a sala encerrada.
- [ ] Edição salva leva todos ao início, com aviso de 10 s no celular; respostas
      preservadas.
- [ ] JSON antigo importa; imagem ausente é recusada; cores validadas.
- [ ] Sala acima de 1 MB é recusada; imagens fora do documento.
- [ ] Slide livre idêntico no projetor, celular, miniatura e PDF.
- [ ] Trocar o formato reenquadra os slides livres da moldura antiga.
- [ ] PowerPoint importado mantém textos editáveis e fontes embutidas.
- [ ] PowerPoint exportado abre com textos e imagens editáveis.
- [ ] Em 360 px, nenhuma tela rola na horizontal; o cabeçalho do projetor
      fica numa linha; o editor vira pilha abaixo de 1024 px.
- [ ] Arrastar um slide (mouse ou alça no toque) muda a ordem; o gabarito
      acompanha a pergunta.
- [ ] Recarregar a tela de criação traz o rascunho, com imagens e fontes.
- [ ] O modal do código mostra o link curto (`da.gd/...`) e projeta em tela
      cheia; Esc fecha o QR ampliado e depois a projeção, sem trocar o slide.
- [ ] Reentrar na sala não muda `joinedAt`; respostas com campos extras ou
      listas acima de 100 itens são recusadas.

---

## 17. Observações sobre o código atual

Pontos encontrados na leitura do código que vale conhecer (e, numa
reimplementação, decidir se mantém ou corrige):

| Ponto | Situação | Sugestão |
| --- | --- | --- |
| `d3-cloud` | Declarado e nos chunks manuais, mas não importado | Omitir |
| Presença | Ninguém "sai": o número de participantes é de quem já abriu a sala | Aceito pelo requisito; se precisar de "conectados agora", usar heartbeat ou presença do Realtime Database |
| `lastSeenAt` | Gravado a cada entrada, sem heartbeat: é a "última entrada" | Manter (um heartbeat multiplicaria as escritas) |
| Horários | `Date.now()` do cliente em `createdAt`, `updatedAt` e no cronômetro; o desvio do relógio de cada aparelho **não é medido**, de propósito: só o projetor mostra a contagem, comparando o `endsAt` que ele mesmo gravou com o próprio relógio, e o bloqueio do voto vem do estado da sala (`closed`) | Manter; `serverTimestamp()` só se a ordem entre aparelhos passar a importar |
| Validação de cada texto da nuvem | As regras limitam a lista a 100 itens, mas não o tamanho de cada texto (a linguagem de regras não percorre listas); o limite de 80 caracteres fica na interface | Aceito; num backend próprio, validar no servidor |
| Criação de salas | Qualquer usuário autenticado (inclusive anônimo) cria salas | Exigir login do sistema num ambiente aberto (seção 15.8) |
| Leitura pública das respostas | Decisão de projeto | Ver seção 15.8 |

Pendências resolvidas nesta versão (registradas para quem compara com uma
cópia anterior do projeto):

| Pendência antiga | Como ficou |
| --- | --- |
| `status: 'ended'` nunca gravado (`setStatus` sem uso) | O fim da apresentação encerra a sala: `status: 'ended'` vai na mesma escrita do índice final (seção 8.15); `setStatus` foi removido |
| `joinRoom` sobrescrevia `joinedAt` | `joinRoom` lê o documento antes e grava `joinedAt` só na criação |
| Múltipla escolha esvaziada contava em `answeredCount` | Lista vazia apaga a resposta (`saveResponse` chama `clearResponse`) |
| Rascunho do editor só em memória | Rascunho no navegador (`editorDraft.ts`, seção 9.2) |
| Regras sem validação de formato e tamanho | Respostas e presença com chaves permitidas, tamanhos e id conferidos; respostas só com a sala no ar; sala encerrada imutável; gabaritos legíveis só pelo dono (seção 8.13) |
| Gabarito legível pela plateia no documento da sala | Gabarito em `secret/answers`, publicado na revelação (seção 8.16) |
| Emoji no "Obrigado por participar!" | Ícone `PartyPopper` no celular; texto sem emoji no slide final |
| Travessão para resposta vazia no PDF (e em textos da interface) | Hífen no PDF; dois-pontos nos avisos ("Tempo esgotado: as respostas foram encerradas.") |
| Encurtador TinyURL bloqueado por CORS | da.gd, com validação da resposta e cache que descarta entradas inválidas (seção 11.8) |

---

## Apêndice A: tipos TypeScript completos

Arquivo `src/types/presentation.ts`, integral.

```ts
/** Tipos centrais do domínio da apresentação interativa. */

export type SlideType = 'wordcloud' | 'bar' | 'pie' | 'quiz' | 'answer' | 'text' | 'free'
export type ThemeMode = 'light' | 'dark'

/** Formato (proporção) dos slides da apresentação. */
export type SlideAspect = '16:9' | '4:3'

/** Quantas palavras o participante pode enviar numa nuvem de palavras. */
export type WordLimitMode = 'one' | 'range' | 'unlimited'

export type TextAlign = 'left' | 'center' | 'right'

export interface ChoiceOption {
  id: string
  label: string
}

/**
 * Opções que valem para a apresentação inteira. Cada slide pode sobrescrever
 * parte delas (ver `SlideOverrides`); o valor efetivo sai de
 * `resolveSlideSettings` (utils/settings.ts).
 */
export interface PresentationSettings {
  /** Participante pode limpar a resposta e escolher outra. */
  allowChangeAnswer: boolean
  /** Pedir o nome do participante antes de entrar na sala (nível da sala). */
  askName: boolean
  /** Mostrar quem respondeu o quê (exige `askName`). */
  identifyResponses: boolean
  /** Tamanho (px) do título do slide na tela do apresentador. */
  titleFontSize: number
  /** Tamanho (px) de rótulos: eixos, legendas, opções, nomes. */
  labelFontSize: number
  /** Tamanho (px) do corpo/conteúdo do slide. */
  bodyFontSize: number
  /**
   * Segundos do cronômetro dos slides de questionário (`quiz`). Zerado, o
   * slide fica sem cronômetro e a pergunta espera o apresentador avançar.
   */
  quizTimerSeconds: number
  /**
   * Formato dos slides: a moldura da prévia no editor e o tamanho de cada
   * slide livre novo. A tela do projetor continua ocupando a tela inteira.
   */
  slideAspect: SlideAspect
  /**
   * A plateia pode baixar os slides (PDF e PowerPoint) quando a apresentação
   * termina. Os arquivos levam só os slides, sem a resposta de ninguém.
   */
  allowDownload: boolean
}

/**
 * Sobrescritas por slide. Campo ausente = herda a configuração global.
 * `askName`, `slideAspect` e `allowDownload` não aparecem aqui: o nome é pedido
 * uma única vez, antes de entrar na sala, e o formato e o download valem para
 * a apresentação inteira.
 */
export type SlideOverrides = Partial<Omit<PresentationSettings, 'askName' | 'slideAspect' | 'allowDownload'>>

interface SlideBase {
  id: string
  type: SlideType
  title: string
  /** Ajustes que valem só para este slide (herda o global quando ausente). */
  overrides?: SlideOverrides
}

export interface WordCloudSlide extends SlideBase {
  type: 'wordcloud'
  wordLimitMode: WordLimitMode
  /** Máximo de palavras quando `wordLimitMode === 'range'`. */
  maxWords: number
}

export interface BarSlide extends SlideBase {
  type: 'bar'
  options: ChoiceOption[]
  allowMultiple: boolean
}

export interface PieSlide extends SlideBase {
  type: 'pie'
  options: ChoiceOption[]
  allowMultiple: boolean
}

/**
 * Alternativas SEM gráfico: as opções aparecem grandes no centro da tela do
 * apresentador e na tela dos participantes. Feito para pergunta e resposta :
 * daí `correctOptionIds` e o slide de resposta gerado automaticamente.
 */
export interface QuizSlide extends SlideBase {
  type: 'quiz'
  options: ChoiceOption[]
  allowMultiple: boolean
  /** Ids das opções corretas (vazio = sem gabarito). */
  correctOptionIds: string[]
  /** Mantém um slide `answer` logo depois deste, revelando o gabarito. */
  revealAnswer: boolean
  /**
   * Mostrar na tela do apresentador o que os participantes responderam
   * (contagem por alternativa e, se a sala identificar, os nomes).
   *
   * Padrão `false`: numa pergunta e resposta, exibir as respostas enquanto a
   * pergunta está no ar entrega o resultado antes da hora.
   */
  showResponses: boolean
}

/**
 * Slide de revelação do gabarito. Não tem conteúdo próprio: aponta para o
 * `quiz` e reexibe as alternativas destacando as corretas. É inserido e
 * removido automaticamente pelo editor (ver `store/editorStore`).
 */
export interface AnswerSlide extends SlideBase {
  type: 'answer'
  /** Id do slide `quiz` que este slide revela. */
  quizSlideId: string
}

export interface TextSlide extends SlideBase {
  type: 'text'
  content: string
  align: TextAlign
  fontSize: number
}

/* ------------------------------------------------------------------------
   Slide livre: composição de textos e imagens posicionados à mão (ou vindos
   de um PPTX importado). Só exibição, como o slide de texto.

   Coordenadas e tamanhos estão em px de uma moldura lógica (`width` x
   `height` do slide, 1920 x 1080 no 16:9). A tela redimensiona a moldura
   inteira de uma vez, então texto e imagens mantêm a proporção em qualquer
   tela.
   ------------------------------------------------------------------------ */

/** Estilo de um trecho de texto. Ausente = herda do parágrafo e da caixa. */
export interface FreeTextStyle {
  fontFamily?: string
  /** Tamanho em px da moldura lógica. */
  fontSize?: number
  /** Cor em `#rrggbb` (ou `#rrggbbaa`). */
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /** Cor de realce atrás do texto. */
  highlight?: string
}

export type FreeTextAlign = 'left' | 'center' | 'right' | 'justify'
export type FreeVerticalAlign = 'top' | 'middle' | 'bottom'

/** Trecho de texto com estilo próprio. `\n` é quebra de linha no parágrafo. */
export interface FreeTextRun {
  text: string
  style?: FreeTextStyle
}

export type FreeNumbering = 'arabic' | 'alphaLower' | 'alphaUpper' | 'romanLower' | 'romanUpper'

/** Marcador de lista: um caractere ("•") ou numeração automática. */
export type FreeBullet =
  | { kind: 'char'; char: string; color?: string }
  | { kind: 'number'; format: FreeNumbering; suffix: '.' | ')'; startAt?: number }

export interface FreeTextParagraph {
  runs: FreeTextRun[]
  align?: FreeTextAlign
  /** Estilo padrão dos trechos deste parágrafo (e da linha quando vazio). */
  style?: FreeTextStyle
  bullet?: FreeBullet
  /** Margem esquerda do texto (px). */
  indent?: number
  /** Quanto o marcador fica pendurado à esquerda da margem (px). */
  hanging?: number
  /** Espaço antes e depois do parágrafo (px). */
  spaceBefore?: number
  spaceAfter?: number
  /** Altura da linha, em múltiplos do tamanho da fonte. */
  lineHeight?: number
}

interface FreeElementBase {
  id: string
  /** Nome na lista de camadas. */
  name?: string
  x: number
  y: number
  width: number
  height: number
  /** Rotação em graus, em torno do centro. */
  rotation?: number
  /** 0 a 1. Ausente = opaco. */
  opacity?: number
}

export interface FreeTextElement extends FreeElementBase {
  kind: 'text'
  paragraphs: FreeTextParagraph[]
  /** Estilo base de todos os parágrafos. */
  style: FreeTextStyle
  verticalAlign?: FreeVerticalAlign
  /** Espaço interno (px): cima, direita, baixo, esquerda. */
  padding?: [number, number, number, number]
  /** Cor de fundo da caixa. */
  background?: string
  /** Altura de linha padrão, em múltiplos do tamanho da fonte. */
  lineHeight?: number
}

export type FreeImageFit = 'fill' | 'contain' | 'cover'

export interface FreeImageElement extends FreeElementBase {
  kind: 'image'
  /** Chave em `Presentation.assets` (e em `rooms/{code}/assets`). */
  assetId: string
  /** Como a imagem ocupa a caixa. Padrão: `fill` (estica). */
  fit?: FreeImageFit
  /** Arredondamento dos cantos (px). */
  radius?: number
}

export type FreeElement = FreeTextElement | FreeImageElement

export interface FreeSlide extends SlideBase {
  type: 'free'
  /** Tamanho da moldura lógica, em px. */
  width: number
  height: number
  /** Cor de fundo do slide. */
  background: string
  /** Em ordem de desenho: o último fica na frente. */
  elements: FreeElement[]
}

/**
 * Imagem usada por slides livres, já comprimida para caber num documento do
 * Firestore. Fica fora dos slides para a sala não estourar o limite de 1 MiB
 * do documento: os slides guardam só o `id`.
 */
export interface PresentationAsset {
  id: string
  /** `data:` URL da imagem. */
  dataUrl: string
  width: number
  height: number
}

export type PresentationAssets = Record<string, PresentationAsset>

/**
 * Fonte que veio embutida num PowerPoint. Os textos a usam pelo nome da
 * família, como qualquer outra fonte; ela só precisa estar registrada no
 * navegador (ver `utils/fonts/faces.ts`). Cada estilo (negrito, itálico) é
 * um arquivo e um registro.
 */
export interface PresentationFont {
  id: string
  /** Nome usado em `fontFamily` nos textos (o "typeface" do PowerPoint). */
  family: string
  weight: 'normal' | 'bold'
  style: 'normal' | 'italic'
  /** `data:font/woff;base64,...` */
  dataUrl: string
}

export type PresentationFonts = Record<string, PresentationFont>

export type Slide =
  | WordCloudSlide
  | BarSlide
  | PieSlide
  | QuizSlide
  | AnswerSlide
  | TextSlide
  | FreeSlide

/** Slides de barras, pizza e alternativas compartilham opções e votação. */
export type ChoiceSlide = BarSlide | PieSlide | QuizSlide

export function isChoiceSlide(slide: Slide): slide is ChoiceSlide {
  return slide.type === 'bar' || slide.type === 'pie' || slide.type === 'quiz'
}

/** Slides que produzem resultado (participantes enviam algo). */
export function isInteractiveSlide(
  slide: Slide,
): slide is WordCloudSlide | ChoiceSlide {
  return slide.type === 'wordcloud' || isChoiceSlide(slide)
}

/** Estrutura serializável (import/export JSON). */
export interface Presentation {
  title: string
  slides: Slide[]
  /**
   * Opções globais. Opcional e parcial no JSON importado: o que faltar recebe
   * o padrão (ver `utils/settings.ts`). A sala criada guarda sempre a versão
   * completa.
   */
  settings?: Partial<PresentationSettings>
  /**
   * Imagens dos slides livres, pelo id. Vão junto no JSON exportado; na sala
   * ficam numa subcoleção própria (ver `lib/assets.ts`).
   */
  assets?: PresentationAssets
  /**
   * Fontes embutidas usadas pelos slides livres, pelo id. Vão junto no JSON;
   * na sala ficam em `rooms/{code}/fonts` (ver `lib/fonts.ts`).
   */
  fonts?: PresentationFonts
}

export type RoomStatus = 'live' | 'ended'

/**
 * Cronômetro de um slide dentro da sala.
 *
 * - **correndo**: `endsAt` tem o instante final (epoch ms);
 * - **pausado**: `endsAt` é `null` e o que sobrou está em `remainingMs`: é o
 *   estado de um slide que o apresentador deixou no meio da contagem;
 * - **esgotado**: `endsAt` é `null` e `remainingMs` é 0. Voltar para a pergunta
 *   não reabre as respostas: elas ficam congeladas como estavam.
 */
export interface SlideTimer {
  endsAt: number | null
  remainingMs: number
}

/** Cronômetros da sala, indexados pelo id do slide. */
export type SlideTimers = Record<string, SlideTimer>

/**
 * Documento salvo em `rooms/{roomCode}` no Firestore. As imagens e as fontes
 * não vão nele (ficam em `rooms/{roomCode}/assets` e `rooms/{roomCode}/fonts`),
 * por isso `assets` e `fonts` ficam de fora.
 */
export interface Room extends Omit<Presentation, 'assets' | 'fonts'> {
  creatorUid: string
  currentSlideIndex: number
  status: RoomStatus
  createdAt: number
  updatedAt: number
  /**
   * Cronômetro de cada slide que já esteve no ar. Só o apresentador grava;
   * todos os navegadores contam a partir do mesmo instante final, o que
   * dispensa uma escrita por segundo. Ausente nas salas criadas antes do
   * cronômetro existir.
   */
  timers?: SlideTimers
  /**
   * Ids dos slides de gabarito cujo suspense já terminou. Voltar a um deles
   * mostra a resposta na hora: a espera de 3 s existe para sincronizar a
   * primeira revelação, não para atrasar a revisão.
   */
  revealedSlideIds?: string[]
  /**
   * A sala guarda as perguntas SEM gabarito: os `correctOptionIds` ficam em
   * `rooms/{code}/secret/answers`, que só o dono lê (ver `lib/answers.ts`).
   * Ausente nas salas criadas antes dessa proteção.
   */
  answersHidden?: boolean
  /**
   * Gabaritos já revelados à plateia, pelo id do `quiz`. O projetor grava a
   * pergunta aqui quando o suspense do gabarito dela termina.
   */
  revealedAnswers?: Record<string, string[]>
  /**
   * Quantas vezes o apresentador editou a sala depois de iniciada. Cada edição
   * recomeça a apresentação do primeiro slide e soma 1 aqui; é por esse número
   * que a tela do participante percebe a mudança e avisa. Ausente = 0.
   */
  revision?: number
}

export type ResponseType = 'word' | 'choice'

/** Documento em `rooms/{roomCode}/responses/{id}`. Um doc por participante/slide. */
export interface ResponseDoc {
  slideId: string
  participantUid: string
  type: ResponseType
  /** Palavras enviadas, ou ids das opções escolhidas. */
  value: string[]
  /** Nome informado ao entrar (quando a sala pede identificação). */
  participantName?: string
  createdAt: number
}

/** Documento em `rooms/{roomCode}/participants/{uid}`: presença na sala. */
export interface ParticipantDoc {
  uid: string
  name?: string
  /** Primeira entrada na sala (reentrar não muda). */
  joinedAt: number
  /** Última entrada na sala (não há atualização periódica). */
  lastSeenAt: number
}
```

---

## Apêndice B: schema Zod do JSON

Arquivo `src/utils/validation.ts`, integral. Depende de `FONT_SIZE_RANGE` (10 a 200) e `QUIZ_TIMER_RANGE` (0 a 300) de `utils/settings.ts`.

```ts
import { z } from 'zod'
import { FONT_SIZE_RANGE, QUIZ_TIMER_RANGE } from './settings'

/** Schemas Zod usados para validar apresentações importadas via JSON. */

export const choiceOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
})

const fontSizeSchema = z
  .number()
  .int()
  .min(FONT_SIZE_RANGE.min)
  .max(FONT_SIZE_RANGE.max)

/** Opções globais. Tudo opcional: o que faltar recebe o padrão na importação. */
export const settingsSchema = z
  .object({
    allowChangeAnswer: z.boolean(),
    askName: z.boolean(),
    identifyResponses: z.boolean(),
    titleFontSize: fontSizeSchema,
    labelFontSize: fontSizeSchema,
    bodyFontSize: fontSizeSchema,
    quizTimerSeconds: z
      .number()
      .int()
      .min(QUIZ_TIMER_RANGE.min)
      .max(QUIZ_TIMER_RANGE.max),
    slideAspect: z.enum(['16:9', '4:3']),
    allowDownload: z.boolean(),
  })
  .partial()

/** Sobrescritas por slide (mesmas opções, sem `askName`, `slideAspect` e `allowDownload`). */
export const overridesSchema = settingsSchema.omit({ askName: true, slideAspect: true, allowDownload: true })

/* Slide livre ------------------------------------------------------------ */

/** Cor em `#rrggbb` ou `#rrggbbaa`: o valor vai direto para o CSS. */
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'cor inválida')
const coordSchema = z.number().finite().min(-100_000).max(100_000)
const lengthSchema = z.number().finite().min(0).max(100_000)

const freeTextStyleSchema = z
  .object({
    fontFamily: z.string().max(200),
    fontSize: z.number().finite().min(1).max(2000),
    color: colorSchema,
    bold: z.boolean(),
    italic: z.boolean(),
    underline: z.boolean(),
    strike: z.boolean(),
    highlight: colorSchema,
  })
  .partial()

const freeBulletSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('char'), char: z.string().min(1).max(4), color: colorSchema.optional() }),
  z.object({
    kind: z.literal('number'),
    format: z.enum(['arabic', 'alphaLower', 'alphaUpper', 'romanLower', 'romanUpper']),
    suffix: z.enum(['.', ')']),
    startAt: z.number().int().min(1).max(10_000).optional(),
  }),
])

const freeParagraphSchema = z.object({
  runs: z.array(z.object({ text: z.string().max(20_000), style: freeTextStyleSchema.optional() })),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  style: freeTextStyleSchema.optional(),
  bullet: freeBulletSchema.optional(),
  indent: lengthSchema.optional(),
  hanging: lengthSchema.optional(),
  spaceBefore: lengthSchema.optional(),
  spaceAfter: lengthSchema.optional(),
  lineHeight: z.number().finite().min(0.5).max(5).optional(),
})

const freeElementBase = {
  id: z.string().min(1),
  name: z.string().max(200).optional(),
  x: coordSchema,
  y: coordSchema,
  width: lengthSchema,
  height: lengthSchema,
  rotation: z.number().finite().min(-360).max(360).optional(),
  opacity: z.number().min(0).max(1).optional(),
}

const freeElementSchema = z.discriminatedUnion('kind', [
  z.object({
    ...freeElementBase,
    kind: z.literal('text'),
    paragraphs: z.array(freeParagraphSchema).max(500),
    style: freeTextStyleSchema,
    verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
    padding: z.tuple([lengthSchema, lengthSchema, lengthSchema, lengthSchema]).optional(),
    background: colorSchema.optional(),
    lineHeight: z.number().finite().min(0.5).max(5).optional(),
  }),
  z.object({
    ...freeElementBase,
    kind: z.literal('image'),
    assetId: z.string().min(1),
    fit: z.enum(['fill', 'contain', 'cover']).optional(),
    radius: lengthSchema.optional(),
  }),
])

/** Imagem embutida: só formatos que o navegador desenha, nunca outro esquema. */
export const assetSchema = z.object({
  id: z.string().min(1).max(200),
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/, 'imagem inválida'),
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
})

/**
 * Fonte embutida. O nome vai para o CSS e para o FontFace, então não aceita
 * aspas, sinais de marcação nem caracteres de controle; o arquivo só pode ser
 * uma fonte em base64.
 */
export const fontSchema = z.object({
  id: z.string().min(1).max(200),
  family: z
    .string()
    .min(1)
    .max(200)
    .refine(
      (v) => !/["\\<>;{}]/.test(v) && [...v].every((c) => c.charCodeAt(0) >= 32),
      'nome de fonte inválido',
    ),
  weight: z.enum(['normal', 'bold']),
  style: z.enum(['normal', 'italic']),
  dataUrl: z.string().regex(/^data:font\/(woff|woff2|ttf|otf);base64,[A-Za-z0-9+/=]+$/, 'fonte inválida'),
})

/** Campos comuns a todos os slides. */
const baseFields = {
  id: z.string().min(1),
  title: z.string(),
  overrides: overridesSchema.optional(),
}

export const slideSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseFields,
    type: z.literal('wordcloud'),
    wordLimitMode: z.enum(['one', 'range', 'unlimited']),
    maxWords: z.number().int().min(1).max(50),
  }),
  z.object({
    ...baseFields,
    type: z.literal('bar'),
    options: z.array(choiceOptionSchema).min(1),
    allowMultiple: z.boolean(),
  }),
  z.object({
    ...baseFields,
    type: z.literal('pie'),
    options: z.array(choiceOptionSchema).min(1),
    allowMultiple: z.boolean(),
  }),
  z.object({
    ...baseFields,
    type: z.literal('quiz'),
    options: z.array(choiceOptionSchema).min(1),
    allowMultiple: z.boolean(),
    correctOptionIds: z.array(z.string()).default([]),
    revealAnswer: z.boolean().default(false),
    showResponses: z.boolean().default(false),
  }),
  z.object({
    ...baseFields,
    type: z.literal('answer'),
    quizSlideId: z.string().min(1),
  }),
  z.object({
    ...baseFields,
    type: z.literal('text'),
    content: z.string(),
    align: z.enum(['left', 'center', 'right']),
    fontSize: z.number().int().min(8).max(200),
  }),
  z.object({
    ...baseFields,
    type: z.literal('free'),
    width: z.number().finite().min(100).max(10_000),
    height: z.number().finite().min(100).max(10_000),
    background: colorSchema,
    elements: z.array(freeElementSchema).max(500),
  }),
])

/**
 * Forma da apresentação, sem a conferência das imagens. Serve para o rascunho
 * do editor, que pode voltar sem as imagens (guardadas à parte, no IndexedDB):
 * a imagem que faltar aparece como espaço reservado.
 */
export const presentationShapeSchema = z.object({
  title: z.string(),
  slides: z.array(slideSchema),
  settings: settingsSchema.optional(),
  assets: z.record(z.string(), assetSchema).optional(),
  fonts: z.record(z.string(), fontSchema).optional(),
})

export const presentationSchema = presentationShapeSchema
  .superRefine((presentation, ctx) => {
    // Toda imagem citada por um slide livre precisa vir no arquivo.
    const assets = presentation.assets ?? {}
    presentation.slides.forEach((slide, i) => {
      if (slide.type !== 'free') return
      slide.elements.forEach((element, j) => {
        if (element.kind === 'image' && !assets[element.assetId]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['slides', i, 'elements', j, 'assetId'],
            message: `imagem "${element.assetId}" ausente em "assets"`,
          })
        }
      })
    })
  })

export type PresentationInput = z.infer<typeof presentationSchema>
```

---

## Apêndice C: regras de segurança do Firestore

Arquivo `firestore.rules`, integral.

```
rules_version = '2';

// Regras de segurança do Firestore para a Apresentação Interativa.
//
// Modelo de acesso (sem contas; cada dispositivo usa Auth Anônima):
//  - Qualquer pessoa com o CÓDIGO da sala pode ler a sala e as respostas
//    (o código funciona como uma "chave" de acesso).
//  - Apresentar exige o TOKEN secreto (na URL): fica num doc privado que os
//    clientes NÃO podem ler. Quem tem o token pode "reivindicar" a sala
//    (recarregar a página / trocar de navegador) e vira o dono; a plateia,
//    que só tem o código, não consegue apresentar.
//  - Só o dono atual da sala altera/exclui a sala, e só enquanto ela está no
//    ar: uma sala encerrada (`status: 'ended'`) não muda mais.
//  - Os gabaritos das perguntas ficam em rooms/{code}/secret/answers, que só o
//    dono lê; a plateia recebe cada gabarito pela sala, quando ele é revelado.
//  - Cada participante só pode criar/editar/excluir a PRÓPRIA resposta e o
//    PRÓPRIO registro de presença (rooms/{code}/participants/{uid}), com os
//    campos e tamanhos esperados, e só responde enquanto a sala está no ar.
//  - As imagens e as fontes dos slides livres (rooms/{code}/assets e
//    rooms/{code}/fonts) são lidas por todos na sala e gravadas só pelo dono.
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function roomPath(code) {
      return /databases/$(database)/documents/rooms/$(code);
    }

    // Uid dono registrado no doc privado da sala (fonte da verdade do controle).
    function presenterOwner(code) {
      return get(/databases/$(database)/documents/rooms/$(code)/private/presenter).data.ownerUid;
    }

    // Dono atual da sala: o mesmo critério que autoriza alterar o documento dela.
    function isRoomOwner(code) {
      return get(roomPath(code)).data.creatorUid == request.auth.uid
        || presenterOwner(code) == request.auth.uid;
    }

    // A sala ainda está no ar (aceita respostas).
    function isRoomLive(code) {
      return get(roomPath(code)).data.status == 'live';
    }

    match /rooms/{code} {
      allow read: if true;
      allow create: if isSignedIn()
        && request.resource.data.creatorUid == request.auth.uid
        && request.resource.data.status == 'live';
      // Dono atual (uid) OU quem acabou de reivindicar via token (doc privado),
      // e só com a sala no ar: encerrada, ela não muda mais (nem índice, nem
      // cronômetro, nem dono). Apresentar de novo abre uma sala nova.
      allow update: if isSignedIn()
        && (resource.data.creatorUid == request.auth.uid
            || presenterOwner(code) == request.auth.uid)
        && resource.data.status == 'live';
      allow delete: if isSignedIn()
        && (resource.data.creatorUid == request.auth.uid
            || presenterOwner(code) == request.auth.uid);

      // Doc privado com o token do apresentador. Ninguém lê (o token é segredo).
      // Para "reivindicar" o controle é preciso reenviar o MESMO token (que só
      // quem tem a URL conhece), o que autoriza definir ownerUid = próprio uid.
      match /private/{doc} {
        allow read: if false;
        allow create: if isSignedIn()
          && request.resource.data.ownerUid == request.auth.uid;
        allow update: if isSignedIn()
          && request.resource.data.token == resource.data.token
          && request.resource.data.ownerUid == request.auth.uid;
        allow delete: if false;
      }

      // Gabaritos das perguntas, só para o dono. São gravados no mesmo lote
      // que cria (ou reinicia) a sala, por isso a regra olha a sala DEPOIS da
      // escrita (`getAfter`): na criação, a sala ainda não existia antes.
      match /secret/{doc} {
        allow read: if isSignedIn() && isRoomOwner(code);
        allow create, update: if isSignedIn()
          && (getAfter(roomPath(code)).data.creatorUid == request.auth.uid
              || presenterOwner(code) == request.auth.uid);
        allow delete: if false;
      }

      // Presença: um doc por participante (id = uid). Serve para o apresentador
      // saber quantas pessoas estão na sala, mesmo antes de qualquer resposta.
      match /participants/{participantUid} {
        allow read: if true;
        allow create, update: if isSignedIn()
          && participantUid == request.auth.uid
          && request.resource.data.uid == request.auth.uid
          && request.resource.data.keys().hasOnly(['uid', 'name', 'joinedAt', 'lastSeenAt'])
          && (!('name' in request.resource.data)
              || (request.resource.data.name is string && request.resource.data.name.size() <= 40));
        allow delete: if isSignedIn() && participantUid == request.auth.uid;
      }

      // Imagens dos slides livres. Ficam fora do documento da sala (limite de
      // 1 MiB por documento) e são gravadas depois que ela existe.
      match /assets/{assetId} {
        allow read: if true;
        allow create, update, delete: if isSignedIn() && isRoomOwner(code);
      }

      // Fontes embutidas (de PowerPoints importados), divididas em partes.
      match /fonts/{fontId} {
        allow read: if true;
        allow create, update, delete: if isSignedIn() && isRoomOwner(code);
      }

      // Respostas: id `{slideId}__{uid}`, só os campos esperados, listas e
      // nomes com tamanho limitado, e só com a sala no ar (custa uma leitura
      // da sala por escrita). Apagar a própria resposta é sempre permitido.
      match /responses/{responseId} {
        allow read: if true;
        allow create, update: if isSignedIn()
          && request.resource.data.participantUid == request.auth.uid
          && request.resource.data.keys().hasOnly(['slideId', 'participantUid', 'type', 'value', 'participantName', 'createdAt'])
          && request.resource.data.slideId is string
          && request.resource.data.slideId.size() <= 200
          && responseId == request.resource.data.slideId + '__' + request.auth.uid
          && request.resource.data.type in ['word', 'choice']
          && request.resource.data.value is list
          && request.resource.data.value.size() <= 100
          && request.resource.data.createdAt is number
          && (!('participantName' in request.resource.data)
              || (request.resource.data.participantName is string
                  && request.resource.data.participantName.size() <= 40))
          && isRoomLive(code);
        allow delete: if isSignedIn()
          && resource.data.participantUid == request.auth.uid;
      }
    }
  }
}
```

---

## Apêndice D: arquivos de configuração

### `firebase.json`

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "auth": { "host": "127.0.0.1", "port": 9099 },
    "firestore": { "host": "127.0.0.1", "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  },
  "hosting": {
    "public": "dist-firebase",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "/assets/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "/",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      },
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      }
    ]
  }
}
```

### `.env.example`

```
# Configuração do Firebase (projeto Web).
# Copie este arquivo para `.env` e preencha com os dados do SEU projeto:
# Firebase Console, Configurações do projeto, Seus apps, Config do SDK.
#
# Estas chaves NÃO são segredo (são identificadores públicos do projeto);
# a proteção real dos dados é feita pelas Firestore Security Rules.

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Desenvolvimento com os emuladores locais do Auth e do Firestore (ver
# docs/11-desenvolvimento.md). Use num `.env.emulators.local`, com
# `npx vite --mode emulators`.
# VITE_FIREBASE_EMULATORS=true
```

### `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["vite.config.ts"]
}
```

### `eslint.config.js`

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'dist-firebase'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
```

### `.claude/launch.json` (atalho de execução local)

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    }
  ]
}
```

### `.github/workflows/deploy.yml`

```yaml
name: Deploy (GitHub Pages e Firebase Hosting)

on:
  push:
    branches: [main]
  workflow_dispatch:

# Permissões necessárias para publicar no GitHub Pages.
permissions:
  contents: read
  pages: write
  id-token: write

# Garante uma publicação por vez.
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      # Chaves do Firebase, definidas nos secrets do repositório
      # (Settings, Secrets and variables, Actions).
      # Valem para os dois builds abaixo.
      VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
      VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
      VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
      VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
      VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
      VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configurar Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Instalar dependências
        run: npm ci

      - name: Build (GitHub Pages)
        run: npm run build
        env:
          # base = "/<nome-do-repo>/" para os assets resolverem no Pages.
          VITE_BASE: /${{ github.event.repository.name }}/

      # O Firebase Hosting serve o site na raiz do domínio, então precisa de
      # um build próprio, com base "/" (ver vite.config.ts). O type-check já
      # rodou no passo anterior; aqui é só o empacotamento, em dist-firebase/.
      - name: Build (Firebase Hosting)
        run: npx vite build --mode firebase

      - name: Configurar Pages
        uses: actions/configure-pages@v5

      - name: Enviar artefato do Pages
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

      - name: Enviar artefato do Firebase Hosting
        uses: actions/upload-artifact@v4
        with:
          name: site-firebase
          path: ./dist-firebase
          if-no-files-found: error
          retention-days: 1

  # Publica as regras de segurança do Firestore (firestore.rules).
  #
  # O app depende das regras para funcionar: uma versão nova que usa uma coleção
  # ainda não liberada falha com `permission-denied` em produção. Por isso a
  # publicação no Pages espera este job: as regras entram antes do código.
  #
  # Só roda quando `firestore.rules` muda (ou no disparo manual): cada deploy
  # cria um "ruleset" novo no projeto, e republicar regras idênticas a cada push
  # só consumiria a cota à toa.
  regras-firestore:
    name: Publicar regras do Firestore
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          # Precisa do commit anterior para saber se as regras mudaram.
          fetch-depth: 0

      - name: Decidir se publica
        id: verificar
        env:
          SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          ANTES: ${{ github.event.before }}
        run: |
          if [ -z "$SERVICE_ACCOUNT" ] || [ -z "$PROJECT_ID" ]; then
            echo "publicar=false" >> "$GITHUB_OUTPUT"
            echo "::warning::Credenciais ausentes (FIREBASE_SERVICE_ACCOUNT e/ou VITE_FIREBASE_PROJECT_ID). As regras do Firestore NÃO foram publicadas; publique-as manualmente no console."
            exit 0
          fi

          # Disparo manual publica sempre; útil para forçar uma republicação.
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "publicar=true" >> "$GITHUB_OUTPUT"
            echo "Disparo manual: publicando as regras."
            exit 0
          fi

          # `before` vem zerado no primeiro push de uma branch e pode apontar
          # para um commit que sumiu depois de um force-push.
          BASE_VALIDA=1
          if [ -z "$ANTES" ] || [ "$ANTES" = "0000000000000000000000000000000000000000" ]; then
            BASE_VALIDA=0
          elif ! git cat-file -e "$ANTES^{commit}" 2>/dev/null; then
            BASE_VALIDA=0
          fi

          # Sem base de comparação confiável, publica por segurança.
          if [ "$BASE_VALIDA" = "0" ]; then
            echo "publicar=true" >> "$GITHUB_OUTPUT"
            echo "Sem commit anterior para comparar: publicando as regras."
            exit 0
          fi

          if git diff --name-only "$ANTES" "${{ github.sha }}" | grep -qx "firestore.rules"; then
            echo "publicar=true" >> "$GITHUB_OUTPUT"
            echo "firestore.rules mudou: publicando as regras."
          else
            echo "publicar=false" >> "$GITHUB_OUTPUT"
            echo "firestore.rules inalterado: nada a publicar."
          fi

      - name: Configurar Node
        if: steps.verificar.outputs.publicar == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Gravar credencial da conta de serviço
        if: steps.verificar.outputs.publicar == 'true'
        env:
          SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
        run: |
          # O arquivo fica no diretório temporário do runner, descartado ao fim
          # do job; a CLI o lê por GOOGLE_APPLICATION_CREDENTIALS.
          printf '%s' "$SERVICE_ACCOUNT" > "$RUNNER_TEMP/firebase-service-account.json"
          echo "GOOGLE_APPLICATION_CREDENTIALS=$RUNNER_TEMP/firebase-service-account.json" >> "$GITHUB_ENV"

      - name: Publicar regras
        if: steps.verificar.outputs.publicar == 'true'
        env:
          PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
        # Só `firestore:rules`: incluir `firestore:indexes` faria a CLI apagar
        # índices criados pelo console que não estejam versionados aqui.
        run: >
          npx --yes firebase-tools@15 deploy
          --only firestore:rules
          --project "$PROJECT_ID"
          --non-interactive

  deploy:
    needs: [build, regras-firestore]
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Publicar no GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4

  # Publica o mesmo site no Firebase Hosting (https://<projeto>.web.app e
  # https://<projeto>.firebaseapp.com), em paralelo com o GitHub Pages.
  #
  # Espera as regras pelo mesmo motivo do Pages: o código novo não vai ao ar
  # antes das regras de que ele depende. Os dois deploys são independentes
  # entre si: uma falha aqui não impede o Pages, e vice-versa.
  #
  # Usa a mesma conta de serviço das regras, que precisa também do papel
  # Firebase Hosting Admin (ver docs/11-desenvolvimento.md).
  hosting-firebase:
    name: Publicar no Firebase Hosting
    needs: [build, regras-firestore]
    runs-on: ubuntu-latest
    steps:
      - name: Verificar credenciais
        id: verificar
        env:
          SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
        run: |
          if [ -z "$SERVICE_ACCOUNT" ] || [ -z "$PROJECT_ID" ]; then
            echo "publicar=false" >> "$GITHUB_OUTPUT"
            echo "::warning::Credenciais ausentes (FIREBASE_SERVICE_ACCOUNT e/ou VITE_FIREBASE_PROJECT_ID). O site NÃO foi publicado no Firebase Hosting; o GitHub Pages segue normalmente."
          else
            echo "publicar=true" >> "$GITHUB_OUTPUT"
          fi

      # Só para o firebase.json, que diz à CLI o que publicar e com quais
      # cabeçalhos de cache.
      - name: Checkout
        if: steps.verificar.outputs.publicar == 'true'
        uses: actions/checkout@v4

      - name: Baixar o build do Firebase Hosting
        if: steps.verificar.outputs.publicar == 'true'
        uses: actions/download-artifact@v4
        with:
          name: site-firebase
          path: ./dist-firebase

      - name: Configurar Node
        if: steps.verificar.outputs.publicar == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Gravar credencial da conta de serviço
        if: steps.verificar.outputs.publicar == 'true'
        env:
          SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
        run: |
          printf '%s' "$SERVICE_ACCOUNT" > "$RUNNER_TEMP/firebase-service-account.json"
          echo "GOOGLE_APPLICATION_CREDENTIALS=$RUNNER_TEMP/firebase-service-account.json" >> "$GITHUB_ENV"

      - name: Publicar no Firebase Hosting
        if: steps.verificar.outputs.publicar == 'true'
        env:
          PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
        # Só `hosting`: as regras já foram tratadas pelo job acima, que só as
        # republica quando o arquivo muda.
        run: |
          npx --yes firebase-tools@15 deploy \
            --only hosting \
            --project "$PROJECT_ID" \
            --message "Commit ${GITHUB_SHA::7} (GitHub Actions, execução $GITHUB_RUN_NUMBER)" \
            --non-interactive
```

---

## Apêndice E: texto do prompt de IA

Conteúdo exibido no modal "Prompt de IA" (`src/utils/aiPrompt.ts`, constante `AI_IMPORT_PROMPT`). O usuário troca o texto entre colchetes pelo tema desejado.

```text
importPresentationFromFile` (ver `utils/validation.ts`) para que a
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
   - "content": texto exibido. Use "\n" para quebrar linha.
   - "align": "left", "center" ou "right".
   - "fontSize": número inteiro de 8 a 200 (tamanho em px). Títulos de seção
     costumam ficar bem entre 48 e 72; parágrafos entre 28 e 40.

   {
     "id": "s5",
     "type": "text",
     "title": "Boas-vindas",
     "content": "Vamos falar sobre dados\ne como interpretá-los",
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
      "title": "O que vem à sua mente ao ouvir \"dados\"?",
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
```
