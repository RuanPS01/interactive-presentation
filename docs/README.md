# Documentação técnica

Documentação da **Apresentação Interativa**, aplicação web estilo *Mentimeter*
em que o apresentador cria slides, a plateia participa pelo celular e os
resultados aparecem ao vivo.

O [README da raiz](../README.md) é o guia rápido (o que é, como rodar, como
publicar). Esta pasta detalha **como o projeto é por dentro**, um assunto por
arquivo.

## Índice

| Documento | Assunto |
| --- | --- |
| [01. Visão geral](01-visao-geral.md) | O que a aplicação faz, para quem, e o vocabulário do domínio |
| [02. Arquitetura](02-arquitetura.md) | Stack, camadas, roteamento, build e deploy |
| [03. Estrutura de pastas](03-estrutura-de-pastas.md) | Mapa de cada pasta e arquivo de `src/` |
| [04. Modelo de dados](04-modelo-de-dados.md) | Tipos do domínio, coleções do Firestore (inclusive os gabaritos protegidos), formato JSON e o que fica no navegador |
| [05. Tipos de slide](05-tipos-de-slide.md) | Os 7 tipos, seus campos e como cada um se comporta (inclusive a edição do slide livre e a versão estática) |
| [06. Configurações](06-configuracoes.md) | Opções globais, sobrescritas por slide e resolução |
| [07. Tempo real e comunicação](07-tempo-real-e-comunicacao.md) | Como o sincronismo em tempo real funciona, assinaturas, presença, gabarito protegido, encerramento da sala, autenticação e regras de segurança |
| [08. Componentes e estado](08-componentes.md) | Catálogo de componentes, hooks e stores, layout do editor e do projetor |
| [09. Fluxos de uso](09-fluxos-de-uso.md) | Passo a passo do apresentador, do participante e do modo leitura |
| [10. Exportações e integrações](10-exportacoes.md) | Importar e exportar (JSON e PowerPoint, com fontes embutidas), PDF, download dos slides, modo leitura, prompt de IA e encurtador de URL |
| [11. Desenvolvimento](11-desenvolvimento.md) | Rodar localmente (inclusive com os emuladores do Firebase), scripts, convenções e solução de problemas |
| [Especificação completa](especificacao-completa.md) | Documento único que reúne todos os anteriores, com requisitos, o funcionamento do sincronismo em tempo real, exemplos de execução por tipo de slide, algoritmos, apêndices com código de referência e guia para embutir a funcionalidade em outro projeto |

## Como manter esta documentação

Cada documento aponta para os arquivos-fonte que descreve. Ao mexer no código,
atualize o documento correspondente:

| Mudou | Atualize |
| --- | --- |
| `src/types/presentation.ts` | [04](04-modelo-de-dados.md) e [05](05-tipos-de-slide.md) |
| `src/utils/validation.ts` | [04](04-modelo-de-dados.md), [10](10-exportacoes.md) e `src/utils/aiPrompt.ts` |
| `src/utils/settings.ts` | [06](06-configuracoes.md) |
| `firestore.rules` | [07](07-tempo-real-e-comunicacao.md) (e a pipeline republica sozinha); teste com os emuladores ([11](11-desenvolvimento.md#emuladores-do-firebase)) |
| `firebase.json` | [02](02-arquitetura.md), [03](03-estrutura-de-pastas.md) e [11](11-desenvolvimento.md) |
| `.github/workflows/deploy.yml` | [02](02-arquitetura.md) e [11](11-desenvolvimento.md) |
| Novo componente/hook | [03](03-estrutura-de-pastas.md) e [08](08-componentes.md) |
| `src/components/ui/` (componentes genéricos) | [08](08-componentes.md#ui-componentes-genéricos) |
| `src/lib/rooms.ts` (`saveAndRestartRoom`) | [07](07-tempo-real-e-comunicacao.md#edição-de-uma-sala-em-andamento) e [09](09-fluxos-de-uso.md#editar-uma-sala-em-andamento) |
| `src/lib/rooms.ts` (`setCurrentSlide`, `endRoom`) | [07](07-tempo-real-e-comunicacao.md#encerramento-da-sala) e [09](09-fluxos-de-uso.md#encerrar-a-apresentação) |
| `src/lib/answers.ts`, `markAnswerRevealed` | [04](04-modelo-de-dados.md), [05](05-tipos-de-slide.md#gabarito-protegido) e [07](07-tempo-real-e-comunicacao.md#gabarito-protegido) |
| `src/lib/shortUrl.ts`, `RoomCodeDialog` | [09](09-fluxos-de-uso.md#mostrar-e-projetar-o-código) e [10](10-exportacoes.md#encurtador-do-link-da-sala) |
| `src/store/editorDraft.ts`, `src/lib/draftStorage.ts` | [04](04-modelo-de-dados.md#armazenamento-no-navegador), [08](08-componentes.md#rascunho-da-criação-editordraft) e [09](09-fluxos-de-uso.md#rascunho-da-criação) |
| `src/utils/staticSlides.ts`, `exportSlidesPdf.ts`, `useSlideDownload`, `ViewPage` | [05](05-tipos-de-slide.md#slides-estáticos-download-e-modo-leitura), [09](09-fluxos-de-uso.md#modo-leitura) e [10](10-exportacoes.md#baixar-os-slides-no-fim) |
| `EditorWorkspace`, `EditorToolbar`, `SlideList`, `PresentPage` (layout) | [08](08-componentes.md) |
| `src/lib/assets.ts` (imagens) | [04](04-modelo-de-dados.md) e [07](07-tempo-real-e-comunicacao.md#imagens-dos-slides-livres) |
| `src/components/free/`, `src/utils/richText*.ts` | [05](05-tipos-de-slide.md#free---slide-livre) e [08](08-componentes.md#free-slide-livre) |
| `src/utils/pptx/` | [05](05-tipos-de-slide.md#o-que-vem-de-um-powerpoint), [09](09-fluxos-de-uso.md#importar-um-powerpoint) e [10](10-exportacoes.md#importar) |
| `src/utils/pptxExport/` | [05](05-tipos-de-slide.md#o-que-vai-para-um-powerpoint), [09](09-fluxos-de-uso.md#exportar-um-powerpoint) e [10](10-exportacoes.md#exportar-powerpoint) |
| `src/utils/fonts/`, `src/lib/fonts.ts` | [04](04-modelo-de-dados.md), [07](07-tempo-real-e-comunicacao.md#fontes-embutidas) e [10](10-exportacoes.md#fontes-embutidas) |
| `src/lib/` ou `src/hooks/` (escritas e assinaturas do Firestore) | [07](07-tempo-real-e-comunicacao.md#como-o-sincronismo-funciona) |
| Qualquer um dos itens acima | Também a [especificação completa](especificacao-completa.md), que consolida tudo num único arquivo |
