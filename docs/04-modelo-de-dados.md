# 04 — Modelo de dados

Todo o domínio está em [`src/types/presentation.ts`](../src/types/presentation.ts).

## Tipos do domínio

### Apresentação e sala

```ts
interface Presentation {
  title: string
  slides: Slide[]
  settings?: Partial<PresentationSettings>  // ausente/parcial => padrões
  assets?: PresentationAssets               // imagens dos slides livres, pelo id
  fonts?: PresentationFonts                 // fontes embutidas usadas, pelo id
}

interface Room extends Omit<Presentation, 'assets' | 'fonts'> {
  creatorUid: string        // dono atual (quem criou ou reivindicou com o token)
  currentSlideIndex: number // slide no ar; === slides.length => slide final
  status: 'live' | 'ended'
  createdAt: number         // epoch ms
  updatedAt: number
  timers?: Record<string, SlideTimer>  // cronômetro de cada slide, pelo id
  revealedSlideIds?: string[]          // gabaritos cujo suspense já terminou
  revision?: number                    // quantas vezes a sala foi editada depois de iniciada
}

interface SlideTimer {
  endsAt: number | null   // instante final enquanto corre; null quando parado
  remainingMs: number     // o que sobrou quando parado (0 = tempo esgotado)
}
```

`Presentation` é a estrutura **serializável** (import/export JSON).
`Room` é ela mais os campos que só existem depois de publicada, **sem as
imagens e sem as fontes**: elas vão para as subcoleções `assets` e `fonts`
(ver abaixo), para o documento da sala continuar pequeno.

`revision` começa ausente (vale 0) e soma 1 a cada edição feita pelo
apresentador numa sala já iniciada. A edição recomeça a apresentação do
primeiro slide; é por esse número que a tela do participante percebe a mudança
e mostra o aviso "O apresentador atualizou a apresentação". Ver
[07](07-tempo-real-e-comunicacao.md#edição-de-uma-sala-em-andamento).

`timers` guarda **um registro por slide**, e não um cronômetro só: o
apresentador pode sair de uma pergunta no meio da contagem e voltar depois, e
cada slide precisa lembrar em que pé estava. Ver
[07](07-tempo-real-e-comunicacao.md#cronômetro).

### Slides

```ts
type SlideType = 'wordcloud' | 'bar' | 'pie' | 'quiz' | 'answer' | 'text' | 'free'

interface SlideBase {
  id: string
  type: SlideType
  title: string
  overrides?: SlideOverrides  // ajustes só deste slide
}
```

Cada tipo acrescenta seus campos — detalhes em [05](05-tipos-de-slide.md).

Dois auxiliares de tipo, usados o tempo todo:

```ts
type ChoiceSlide = BarSlide | PieSlide | QuizSlide   // têm options + allowMultiple
isChoiceSlide(slide): slide is ChoiceSlide
isInteractiveSlide(slide): slide is WordCloudSlide | ChoiceSlide  // recebe respostas
```

`isInteractiveSlide` é um *type predicate*: quem passa por ele já pode acessar
`options` sem checagem extra. `text` e `answer` ficam de fora — nenhum dos dois
recebe respostas próprias. O slide livre (`free`) também fica de fora: é só
exibição.

### Slide livre

O slide livre é uma moldura lógica de tamanho fixo com elementos posicionados
em px dessa moldura. A tela escala a moldura inteira de uma vez, então texto e
imagens mantêm a proporção em qualquer aparelho.

```ts
interface FreeSlide extends SlideBase {
  type: 'free'
  width: number            // 1920 no 16:9, 1440 no 4:3
  height: number           // 1080 nos dois
  background: string       // cor '#rrggbb'
  elements: FreeElement[]  // ordem de desenho: o último fica na frente
}

type FreeElement = FreeTextElement | FreeImageElement

// Comum aos dois
{ id, name?, x, y, width, height, rotation?, opacity? }

interface FreeTextElement {
  kind: 'text'
  style: FreeTextStyle                 // estilo base da caixa
  paragraphs: FreeTextParagraph[]
  verticalAlign?: 'top' | 'middle' | 'bottom'
  padding?: [number, number, number, number]  // cima, direita, baixo, esquerda
  background?: string
  lineHeight?: number
}

interface FreeTextParagraph {
  runs: { text: string; style?: FreeTextStyle }[]
  align?: 'left' | 'center' | 'right' | 'justify'
  style?: FreeTextStyle
  bullet?: { kind: 'char'; char: string; color?: string }
         | { kind: 'number'; format: FreeNumbering; suffix: '.' | ')'; startAt?: number }
  indent?: number; hanging?: number    // margem e recuo do marcador
  spaceBefore?: number; spaceAfter?: number; lineHeight?: number
}

interface FreeTextStyle {  // tudo opcional: o que falta é herdado
  fontFamily?, fontSize?, color?, bold?, italic?, underline?, strike?, highlight?
}

interface FreeImageElement {
  kind: 'image'
  assetId: string                       // chave em Presentation.assets
  fit?: 'fill' | 'contain' | 'cover'    // padrão: fill (estica)
  radius?: number                       // cantos arredondados
}
```

O estilo de um trecho vale nesta ordem: o do trecho, o do parágrafo e o da
caixa. Os utilitários de [`src/utils/richText.ts`](../src/utils/richText.ts)
aplicam formatação num intervalo de caracteres, partindo e juntando trechos
para o modelo continuar enxuto.

### Imagens (`PresentationAsset`)

```ts
interface PresentationAsset {
  id: string        // 'img_' + início do hash SHA-1 do conteúdo
  dataUrl: string   // data:image/(jpeg|webp|png|gif);base64,...
  width: number
  height: number
}
type PresentationAssets = Record<string, PresentationAsset>
```

Toda imagem entra comprimida por [`src/utils/images.ts`](../src/utils/images.ts):
no máximo 1920 px no lado maior e 900 mil caracteres de data URL, JPEG quando
é opaca e WebP ou PNG quando tem transparência. Como o id vem do conteúdo, a
mesma imagem usada em vários slides é guardada uma vez só, e um id nunca aponta
para uma versão antiga.

### Fontes embutidas (`PresentationFont`)

```ts
interface PresentationFont {
  id: string                    // 'font_' + início do hash SHA-1 (nome, estilo e arquivo)
  family: string                // o nome que os textos usam em fontFamily
  weight: 'normal' | 'bold'
  style: 'normal' | 'italic'
  dataUrl: string               // data:font/woff;base64,...
}
type PresentationFonts = Record<string, PresentationFont>
```

Vêm dos PowerPoints importados: cada estilo embutido no arquivo (normal,
negrito, itálico, negrito itálico) vira um registro. Os textos não guardam
referência à fonte: usam o nome da família, como qualquer outra fonte, e a
fonte só precisa estar registrada no navegador (`FontFace`) para valer. As
fontes ficam guardadas em WOFF, cerca de metade do tamanho do TrueType. A
apresentação leva só as famílias que algum texto usa (`pickFonts`).

### Respostas e presença

```ts
interface ResponseDoc {
  slideId: string
  participantUid: string
  type: 'word' | 'choice'
  value: string[]            // palavras/frases enviadas, ou ids das opções
  participantName?: string   // só quando a sala pede identificação
  createdAt: number
}

interface ParticipantDoc {
  uid: string
  name?: string
  joinedAt: number
  lastSeenAt: number
}
```

## Coleções do Firestore

```
rooms/{code}                          documento da sala (Room)
  private/presenter                   { token, ownerUid, createdAt }  (ilegível para clientes)
  participants/{uid}                  ParticipantDoc (presença)
  responses/{slideId}__{uid}          ResponseDoc
  assets/{assetId}                    { dataUrl, width, height, createdAt }
  fonts/{fontId} e fonts/{fontId}~N   { fontId, family, weight, style, part, parts, data, createdAt }
```

### `rooms/{code}`

O **id do documento é o próprio código da sala** (6 caracteres). Criar uma sala
sorteia códigos até achar um livre (até 6 tentativas) e grava a sala e o
documento privado numa **escrita em lote atômica** — ver `createRoom` em
[`src/lib/rooms.ts`](../src/lib/rooms.ts).

### `rooms/{code}/private/presenter`

Guarda o **token secreto do apresentador**. As regras proíbem leitura por
qualquer cliente: quem tem o token (pela URL) prova a posse reenviando-o num
`update`, o que autoriza definir `ownerUid` como o próprio uid.

### `rooms/{code}/participants/{uid}`

Presença. O id é o uid, então reentradas **atualizam** o mesmo documento em vez
de duplicar. É escrito com `merge: true`, preservando o `joinedAt` original.

Sem heartbeat periódico: a escrita acontece ao abrir a sala e quando o nome
muda. Um heartbeat multiplicaria as escritas por participante e por minuto, o
que pesa no plano gratuito sem mudar a contagem que interessa — quem entrou na
sala conta como participante.

### `rooms/{code}/assets/{assetId}`

Uma imagem por documento, com o mesmo id do `PresentationAsset`. Ficam fora do
documento da sala por dois motivos: o limite de 1 MiB por documento e o fato
de a sala ser lida por todos os aparelhos a cada troca de slide. Cada imagem é
lida uma vez por aparelho e guardada em memória
([`src/lib/assets.ts`](../src/lib/assets.ts)). Todos leem; só o dono da sala
grava e apaga. Ver [07](07-tempo-real-e-comunicacao.md#imagens-dos-slides-livres).

### `rooms/{code}/fonts/{fontId}`

As fontes embutidas, pelo mesmo motivo das imagens. Uma fonte pode passar do
limite de um documento, então o `dataUrl` é dividido em partes de 700 mil
caracteres: a primeira tem o id da fonte e as outras, `{fontId}~1`,
`{fontId}~2`... Cada documento repete família, estilo e o total de partes, e a
leitura junta tudo numa consulta só à subcoleção
([`src/lib/fonts.ts`](../src/lib/fonts.ts)). Todos leem; só o dono da sala
grava e apaga. Ver [07](07-tempo-real-e-comunicacao.md#fontes-embutidas).

### `rooms/{code}/responses/{slideId}__{uid}`

Id **determinístico**: `${slideId}__${participantUid}`. Consequências:

- cada participante tem no máximo **uma** resposta por slide;
- reenviar sobrescreve, sem duplicar;
- limpar a resposta é um `deleteDoc` direto, sem consulta;
- assinar a própria resposta é um `onSnapshot` de documento (barato), enquanto o
  apresentador assina a coleção filtrada por `slideId`.

## Formato JSON (import/export)

O JSON exportado é exatamente um `Presentation`. Quando há slides livres com
imagens ou fontes embutidas, ele leva também os campos `assets` e `fonts` com
as que estão em uso (as que deixaram de ser usadas não vão), então o arquivo
é autossuficiente:

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
    "slideAspect": "16:9"
  },
  "slides": [
    { "id": "s1", "type": "text", "title": "Abertura",
      "content": "Bem-vindos", "align": "center", "fontSize": 64 },
    { "id": "s2", "type": "quiz", "title": "O que é uma mediana?",
      "allowMultiple": false, "correctOptionIds": ["s2o2"], "revealAnswer": true,
      "options": [
        { "id": "s2o1", "label": "A média dos valores" },
        { "id": "s2o2", "label": "O valor central" }
      ] }
  ]
}
```

A validação está em [`src/utils/validation.ts`](../src/utils/validation.ts)
(Zod, união discriminada por `type`). No slide livre, as cores precisam estar
em `#rrggbb` (ou `#rrggbbaa`), porque vão direto para o CSS; as imagens só
aceitam data URL de PNG, JPEG, WebP ou GIF; e toda imagem citada por um
elemento precisa existir em `assets`, senão o arquivo é recusado com o caminho
do elemento. Nas fontes, o arquivo só pode ser um data URL de fonte (WOFF,
WOFF2, TTF ou OTF) e o nome da família não aceita aspas, sinais de marcação nem
caracteres de controle, porque vai para o CSS e para o `FontFace`.

### Compatibilidade

O schema foi construído para **aceitar arquivos antigos**:

- `settings` é opcional e parcial — o que faltar recebe o padrão;
- `overrides` é opcional em todo slide;
- num slide `quiz`, `correctOptionIds` e `revealAnswer` têm `.default()`, então
  um JSON gerado sem esses campos importa como pergunta sem gabarito;
- `assets`, `fonts` e `settings.slideAspect` são opcionais; sem o formato,
  vale 16:9.

Um JSON exportado antes destas mudanças (só `title` + `slides` com os quatro
tipos originais) continua importando sem erro.

## Números derivados

Ficam em [`src/utils/aggregate.ts`](../src/utils/aggregate.ts), como funções
puras sobre `ResponseDoc[]`:

| Função | Devolve |
| --- | --- |
| `aggregateWords` | `{ text, value }[]` por frequência (case-insensitive, mantém a 1ª grafia) |
| `aggregateChoices` | `{ id, label, votes }[]` na ordem definida pelo apresentador |
| `totalVotes` | Soma dos votos |
| `totalWords` | Total de textos enviados na nuvem |
| `answeredCount` | Participantes **distintos que responderam** aquele slide |
| `namedResponses` | `{ uid, name, answers[] }[]`, com ids de opção traduzidos para o rótulo |
| `responseSummary` | O texto do rodapé: “8 responderam”, com o total de envios só quando ele pode ser diferente |

> **`answeredCount` não é o total de participantes.** Esse número vem da coleção
> `participants` (ver [07](07-tempo-real-e-comunicacao.md#presença)); a distinção
> é o que faz o rodapé mostrar “12 participantes · 8 responderam”.

> **Por que o rodapé nem sempre mostra os dois números.** Numa escolha única —
> ou numa nuvem de uma palavra por pessoa — cada participante envia exatamente
> um item, então “8 responderam · 8 voto(s)” diria a mesma coisa duas vezes.
> `responseSummary` só acrescenta o total quando o slide permite mais de um
> envio (`allowMultiple`, ou `wordLimitMode` diferente de `one`). Vale para a
> tela e para o PDF.
