# 06 — Configurações (globais e por slide)

Fonte: [`src/utils/settings.ts`](../src/utils/settings.ts) e
[`src/types/presentation.ts`](../src/types/presentation.ts).

## As opções

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
}
```

Tamanhos aceitos: **10 a 200 px** (`FONT_SIZE_RANGE`).
Cronômetro: **0 a 300 s** (`QUIZ_TIMER_RANGE`).

| Opção | O que muda |
| --- | --- |
| **Permitir limpar e trocar a resposta** | Ligado: o participante vê “Limpar resposta” / “Limpar tudo” e pode escolher de novo. Desligado: a resposta vira definitiva — na escolha única o primeiro toque encerra; na múltipla escolha só o **desmarcar** é bloqueado (senão a pessoa não conseguiria terminar a própria seleção); na nuvem de palavras, os itens enviados perdem o botão de remover. |
| **Solicitar o nome antes de entrar na sala** | Ligado: quem abre `/room/<código>` preenche o nome antes de ver qualquer slide. O nome fica salvo por sala neste dispositivo, acompanha o registro de presença e vai junto de cada resposta. |
| **Identificar as respostas com o nome** | Ligado: abaixo do slide (e no PDF) aparece a lista “Nome: resposta”. **Depende** de “Solicitar o nome”. Nos slides de alternativas a lista só aparece se o slide também autorizar mostrar as respostas (ver [05](05-tipos-de-slide.md#quiz--alternativas-sem-gráfico)). |
| **Tamanho do título** | Título do slide no projetor (e, limitado a 30 px, no celular). |
| **Tamanho dos rótulos** | Eixos e legendas dos gráficos, contador acima das barras, textos de instrução, nomes na lista de identificação e o rodapé de contagem. |
| **Tamanho do corpo** | Conteúdo principal: alternativas do `quiz`/gabarito e os controles do participante. Nos slides de texto, quem manda é o `fontSize` do próprio slide. |
| **Tempo do cronômetro** | Segundos que uma pergunta (`quiz`) fica aberta. Ao zerar, as respostas são encerradas e a apresentação passa para o slide de resposta. `0` deixa a pergunta sem cronômetro. |
| **Formato dos slides** | Proporção da prévia no editor e da moldura dos slides livres: 16:9 (padrão, 1920 x 1080) ou 4:3 (1440 x 1080). Só global. |

### Formato dos slides

Fica na seção "Formato dos slides" das Opções e também acima da prévia do
editor, para trocar sem abrir o modal. A prévia de qualquer slide passa a ser
desenhada numa moldura desse tamanho e escalada para caber na coluna
([`ScaledFrame`](../src/components/slides/ScaledFrame.tsx)), então o que se vê
no editor é a composição que o projetor terá.

Os slides livres usam o formato como tamanho da moldura (`SLIDE_FRAMES`). Ao
trocar o formato, os slides livres que estavam na moldura antiga são
reenquadrados por `fitFreeSlideToFrame`
([`src/utils/freeSlide.ts`](../src/utils/freeSlide.ts)): o conteúdo é escalado
por igual para caber e centralizado, sem distorcer texto nem imagem. Um slide
livre com tamanho próprio (vindo de um PowerPoint com outra proporção, quando
a importação foi adicionada ao fim de uma apresentação em outro formato) fica
como está e aparece com faixas nas bordas.

Um slide livre criado pelo botão de adicionar nasce no formato atual. Os
slides de um PowerPoint nascem no formato do arquivo; quando a importação
substitui tudo (ou o editor está vazio), a apresentação adota esse formato.

### Cronômetro das perguntas

O tempo só tem efeito em slides `quiz`
([`slideTimerSeconds`](../src/utils/timer.ts)); nos demais o controle aparece
desativado, com a explicação. Um slide pode ter tempo próprio pela sobrescrita
`quizTimerSeconds` — inclusive `0`, para deixar **aquela** pergunta sem
cronômetro numa apresentação que tem tempo em todas as outras.

A contagem aparece só na tela do apresentador. O cronômetro pausa quando ele
sai do slide e retoma quando volta; se já tinha zerado, continua zerado. Quem
encerra a votação é sempre o projetor, não o relógio de cada celular. Ver
[07](07-tempo-real-e-comunicacao.md#cronômetro) e
[05](05-tipos-de-slide.md#cronômetro).

## Global × por slide

- **Globais**: botão **Opções** na barra do editor
  ([`PresentationSettingsButton`](../src/components/editor/PresentationSettingsButton.tsx)).
  Valem para todos os slides e vão para o Firestore em `room.settings`.
- **Por slide**: seção **“Opções deste slide”** no painel de configuração
  ([`SlideSettingsSection`](../src/components/editor/SlideSettingsSection.tsx)).
  O que for alterado ali é gravado em `slide.overrides` e vale só para ele.

```ts
type SlideOverrides = Partial<Omit<PresentationSettings, 'askName' | 'slideAspect'>>
```

> **Por que `askName` não tem versão por slide:** o nome é pedido **uma única
> vez, antes de entrar na sala** — antes de existir “slide atual”. Uma
> sobrescrita por slide não teria momento para acontecer. O formato dos slides
> também é só global: ele é a moldura de todos os slides livres, que precisam
> combinar entre si no projetor. As outras opções aceitam sobrescrita.

O slide livre não mostra a seção "Opções deste slide": ele não recebe
respostas, não tem cronômetro e não usa os tamanhos de fonte globais (cada
texto tem o próprio tamanho).

Na interface, cada opção booleana do slide é um seletor de três estados —
**Herdar da apresentação (sim/não)**, **Sim**, **Não**; cada tamanho de fonte
tem uma caixa “personalizar” que libera o controle deslizante; e o cronômetro
tem a mesma caixa, liberando um campo numérico (valor exato, não deslizante).
Quando um slide tem sobrescritas, a seção mostra um selo com quantas são.

## Como o valor efetivo é calculado

```ts
resolveSlideSettings(global, slide) =>
  { ...DEFAULT_SETTINGS, ...global, ...slide.overrides }
```

Com dois ajustes de coerência aplicados depois da mesclagem:

1. `identifyResponses` só permanece verdadeiro se **`askName` global** for
   verdadeiro — um slide não consegue identificar respostas numa sala que nunca
   pediu o nome.
2. Em slides `text`, `bodyFontSize` recebe o `slide.fontSize`, mantendo o
   controle que já existia como a fonte da verdade do corpo desse tipo.

Onde é usado:

| Tela | Chamada |
| --- | --- |
| Prévia do editor | `resolveSlideSettings(settings, selectedSlide)` em [`EditorWorkspace`](../src/components/editor/EditorWorkspace.tsx) |
| Projetor | `resolveSlideSettings(room?.settings, currentSlide)` em [`PresentPage`](../src/pages/PresentPage.tsx) |
| Celular | `resolveSlideSettings(room?.settings, currentSlide)` em [`RoomPage`](../src/pages/RoomPage.tsx) |
| PDF | `resolveSlideSettings(settings, slide)` em [`exportPdf`](../src/utils/exportPdf.ts) |

No celular os tamanhos são **limitados** (`Math.min`) para o texto não estourar
a tela pequena: título até 30 px, corpo até 22–28 px conforme o controle.

## Persistência

- **No editor**: dentro do `editorStore` (memória). Some ao recarregar a página
  — exporte o JSON para não perder.
- **Na sala**: gravadas em `room.settings` na criação (`createRoom` completa os
  padrões, porque o Firestore rejeita `undefined`). Numa sala já iniciada, o
  apresentador muda as opções (globais e por slide) pelo botão **Editar** da
  tela de apresentação; `saveAndRestartRoom` em
  [`src/lib/rooms.ts`](../src/lib/rooms.ts) grava tudo e recomeça a
  apresentação do primeiro slide, depois de uma confirmação. Ver
  [09](09-fluxos-de-uso.md#editar-uma-sala-em-andamento).
- **No JSON**: opcional e parcial; a importação completa o que faltar.

Uma mudança em `room.settings` chega a todos os navegadores conectados pela
mesma assinatura da sala, sem ninguém precisar recarregar. Se a edição ligar
**Solicitar o nome**, quem já estava na sala sem nome passa a ver o pedido de
nome antes do primeiro slide.

### Por que salvar recomeça a apresentação

Um tempo de cronômetro novo só valeria para as perguntas que ainda não
começaram, e uma pergunta já encerrada continuaria congelada com a regra
antiga. Recomeçar zera os cronômetros e os gabaritos revelados, então a
configuração salva vale igual para todos os slides, do primeiro ao último.
