# 01 — Visão geral

## O que é

Aplicação web de **apresentações interativas em tempo real**. O apresentador
monta uma sequência de slides no navegador, inicia a apresentação e recebe um
**código de 6 caracteres** (e um QR Code). A plateia abre o link no celular,
digita o código e responde ao que está na tela; os resultados aparecem ao vivo
no projetor.

Duas características definem o projeto:

- **Sem servidor próprio.** O frontend é 100% estático (hospedável no GitHub
  Pages). Tempo real e persistência vêm do **Firebase (Cloud Firestore +
  Autenticação Anônima)**.
- **Sem cadastro.** Ninguém cria conta. Cada dispositivo recebe um uid anônimo
  do Firebase; o controle da apresentação é provado por um **token secreto na
  URL** do apresentador.

## Para quem

| Papel | Como entra | O que pode fazer |
| --- | --- | --- |
| **Apresentador** | Cria a sala em `/create` e vai para `/present/<código>/<token>` | Monta slides, controla a navegação, vê os resultados, exporta PDF |
| **Participante** | Abre `/room/<código>` (link, QR ou digitando o código) | Responde ao slide atual; a tela acompanha o apresentador |

Não há administrador, moderador nem limite de participantes por sala.

## Vocabulário do domínio

| Termo | Significado |
| --- | --- |
| **Apresentação** (`Presentation`) | Título + lista de slides + opções globais. É o que se exporta/importa em JSON. |
| **Sala** (`Room`) | Uma apresentação publicada no Firestore, com código, dono, slide atual e status. |
| **Código da sala** | 6 caracteres de um alfabeto sem `O/0` e `I/1`, para ser digitado sem ambiguidade. |
| **Token do apresentador** | Segredo de 24 caracteres na URL de apresentação. Quem o tem controla a sala. |
| **Slide** | Uma tela da apresentação. Seis tipos — ver [05](05-tipos-de-slide.md). |
| **Resposta** (`ResponseDoc`) | O que um participante enviou num slide. Um documento por participante **por slide**. |
| **Participante** (`ParticipantDoc`) | Registro de presença: existe assim que a pessoa abre a sala, mesmo sem responder. |
| **Gabarito** | Slide `answer`, gerado automaticamente, que revela a alternativa correta de um `quiz`. |

## O que a aplicação faz

- **Editor de slides** com prévia ao vivo e três colunas independentes
  (adicionar/listar, configurar, pré-visualizar).
- **Seis tipos de slide**: nuvem de palavras, gráfico de barras, gráfico de
  pizza, alternativas sem gráfico (pergunta e resposta), slide de gabarito
  automático e texto simples.
- **Opções globais e por slide**: troca de resposta, pedido de nome,
  identificação das respostas e tamanhos de fonte (título, rótulos, corpo).
- **Tempo real**: cada mudança de slide e cada resposta aparecem
  instantaneamente para todos, via assinaturas do Firestore.
- **Contagem separada** de *participantes conectados* e de *quem já respondeu*.
- **Compartilhamento**: código grande, QR Code ampliado e **link curto** para
  quem prefere digitar.
- **Importar/exportar JSON** da apresentação e **exportar PDF** dos resultados.
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
