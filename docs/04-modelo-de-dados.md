# 04 — Modelo de dados

Todo o domínio está em [`src/types/presentation.ts`](../src/types/presentation.ts).

## Tipos do domínio

### Apresentação e sala

```ts
interface Presentation {
  title: string
  slides: Slide[]
  settings?: Partial<PresentationSettings>  // ausente/parcial => padrões
}

interface Room extends Presentation {
  creatorUid: string        // dono atual (quem criou ou reivindicou com o token)
  currentSlideIndex: number // slide no ar; === slides.length => slide final
  status: 'live' | 'ended'
  createdAt: number         // epoch ms
  updatedAt: number
  timers?: Record<string, SlideTimer>  // cronômetro de cada slide, pelo id
  revealedSlideIds?: string[]          // gabaritos cujo suspense já terminou
}

interface SlideTimer {
  endsAt: number | null   // instante final enquanto corre; null quando parado
  remainingMs: number     // o que sobrou quando parado (0 = tempo esgotado)
}
```

`Presentation` é a estrutura **serializável** (import/export JSON).
`Room` é ela mais os campos que só existem depois de publicada.

`timers` guarda **um registro por slide**, e não um cronômetro só: o
apresentador pode sair de uma pergunta no meio da contagem e voltar depois, e
cada slide precisa lembrar em que pé estava. Ver
[07](07-tempo-real-e-comunicacao.md#cronômetro).

### Slides

```ts
type SlideType = 'wordcloud' | 'bar' | 'pie' | 'quiz' | 'answer' | 'text'

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
recebe respostas próprias.

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
rooms/{code}                          <- documento da sala (Room)
  private/presenter                   <- { token, ownerUid, createdAt }  (ilegível para clientes)
  participants/{uid}                  <- ParticipantDoc (presença)
  responses/{slideId}__{uid}          <- ResponseDoc
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

### `rooms/{code}/responses/{slideId}__{uid}`

Id **determinístico**: `${slideId}__${participantUid}`. Consequências:

- cada participante tem no máximo **uma** resposta por slide;
- reenviar sobrescreve, sem duplicar;
- limpar a resposta é um `deleteDoc` direto, sem consulta;
- assinar a própria resposta é um `onSnapshot` de documento (barato), enquanto o
  apresentador assina a coleção filtrada por `slideId`.

## Formato JSON (import/export)

O JSON exportado é exatamente um `Presentation`:

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
    "quizTimerSeconds": 20
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
(Zod, união discriminada por `type`).

### Compatibilidade

O schema foi construído para **aceitar arquivos antigos**:

- `settings` é opcional e parcial — o que faltar recebe o padrão;
- `overrides` é opcional em todo slide;
- num slide `quiz`, `correctOptionIds` e `revealAnswer` têm `.default()`, então
  um JSON gerado sem esses campos importa como pergunta sem gabarito.

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
