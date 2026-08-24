# Documentação técnica

Documentação da **Apresentação Interativa** — aplicação web estilo *Mentimeter*
em que o apresentador cria slides, a plateia participa pelo celular e os
resultados aparecem ao vivo.

O [README da raiz](../README.md) é o guia rápido (o que é, como rodar, como
publicar). Esta pasta detalha **como o projeto é por dentro**, um assunto por
arquivo.

## Índice

| Documento | Assunto |
| --- | --- |
| [01 — Visão geral](01-visao-geral.md) | O que a aplicação faz, para quem, e o vocabulário do domínio |
| [02 — Arquitetura](02-arquitetura.md) | Stack, camadas, roteamento, build e deploy |
| [03 — Estrutura de pastas](03-estrutura-de-pastas.md) | Mapa de cada pasta e arquivo de `src/` |
| [04 — Modelo de dados](04-modelo-de-dados.md) | Tipos do domínio, coleções do Firestore e formato JSON |
| [05 — Tipos de slide](05-tipos-de-slide.md) | Os 6 tipos, seus campos e como cada um se comporta |
| [06 — Configurações](06-configuracoes.md) | Opções globais, sobrescritas por slide e resolução |
| [07 — Tempo real e comunicação](07-tempo-real-e-comunicacao.md) | Assinaturas, presença, autenticação e regras de segurança |
| [08 — Componentes e estado](08-componentes.md) | Catálogo de componentes, hooks e stores |
| [09 — Fluxos de uso](09-fluxos-de-uso.md) | Passo a passo do apresentador e do participante |
| [10 — Exportações e integrações](10-exportacoes.md) | JSON, PDF, prompt de IA e encurtador de URL |
| [11 — Desenvolvimento](11-desenvolvimento.md) | Rodar localmente, scripts, convenções e solução de problemas |

## Como manter esta documentação

Cada documento aponta para os arquivos-fonte que descreve. Ao mexer no código,
atualize o documento correspondente:

| Mudou… | Atualize |
| --- | --- |
| `src/types/presentation.ts` | [04](04-modelo-de-dados.md) e [05](05-tipos-de-slide.md) |
| `src/utils/validation.ts` | [04](04-modelo-de-dados.md), [10](10-exportacoes.md) e `src/utils/aiPrompt.ts` |
| `src/utils/settings.ts` | [06](06-configuracoes.md) |
| `firestore.rules` | [07](07-tempo-real-e-comunicacao.md) |
| Novo componente/hook | [03](03-estrutura-de-pastas.md) e [08](08-componentes.md) |
