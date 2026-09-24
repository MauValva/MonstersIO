# Refactoring Report

## Current Architecture

O entry point `src/main.ts` cria a aplicação PixiJS, carrega assets, monta a hierarquia visual (`stage > ui/world > containers`), cria player, ovos, ninhos, inimigos e estação de upgrades, mantém o estado de gameplay e executa o ticker completo.

Os módulos já separados são `assets.ts` (manifesto de assets), `art-textures.ts` (recortes de atlases), `upgrade-assets.ts` (carregamento/retry de assets de upgrades) e `platform/poki.ts` (adaptador opcional do Poki). O restante da implementação está lexicalmente dentro de `bootstrap`, compartilhando closures para acessar o estado.

O loop atual, em ordem aproximada, trata animações/spawn visual de ovos, input e movimento do player, cobertura de bushes, animação dos ovos carregados, contato com upgrades, coleta, tutoriais, visibilidade/IA dos rivais, roubo, depósitos, respawn, entrega no ninho/evolução, câmera, boot cover, evolução, juice de moeda e indicador de navegação.

## Problems Found

- `main.ts` tem 2.343 linhas e funciona como inicializador, composição de cena, modelo de estado, controlador de sistemas e view.
- A função `bootstrap` possui dependências lexicais muito amplas; várias funções só podem ser testadas ou reutilizadas dentro dela.
- Configurações de mundo, progressão, spawn, posicionamento inicial, constantes de interação e valores de animação estão misturados à construção da cena.
- Gameplay e apresentação estão acoplados: coleta, entrega, evolução e compra atualizam diretamente sprites, textos, overlays e efeitos.
- O estado é compartilhado por muitas rotinas (`delivered`, `currency`, `carriedEggs`, flags de tutorial, estado de upgrades, inimigos e animações), tornando a ordem do ticker sensível.
- Criação de UI e regras de upgrade vivem no mesmo trecho, embora o loader de assets de upgrades já esteja corretamente isolado.
- A criação das entidades e suas atualizações globais estão misturadas: eggs/pool/spawn, inimigos/IA, player/progressão e tutorial não têm fronteiras explícitas.

Não foram alterados comportamentos aparentemente estranhos nesta etapa. Observações para revisão posterior incluem o placeholder geométrico da UI de upgrades, `EGG_STYLES` sem uso visível, labels de estágio criados mas ocultos e a flag `upgradePoints`, que é incrementada mas não participa da compra.

## Proposed Architecture

Será feita uma extração incremental, mantendo `main.ts` como compositor e preservando a ordem existente do ticker:

```text
src/
  config/
    game-config.ts       # mundo, câmera, estágios, posições e balanceamento existente
  game/
    types.ts             # Point e contratos compartilhados sem comportamento
  world/
    scene-builders.ts    # helpers de labels, superfícies e criação visual pequena
  systems/               # extraídos gradualmente quando as dependências estiverem claras
    eggs/                # pool, coleta, carregamento, respawn e entrega
    enemies/             # entidades rivais e IA
    progression/         # thresholds, evolução e preview
    tutorial/            # triggers e indicadores
  ui/                    # HUD, upgrades e indicadores, extraídos após estabilizar o estado
  main.ts                # bootstrap, composição e orquestração explícita do loop
```

A primeira fase move apenas dados/configuração e tipos, porque isso reduz o acoplamento sem alterar a semântica. Sistemas com fortes dependências de closures serão extraídos em fases posteriores como factories/controllers que recebem dependências explícitas; não serão criadas classes apenas para trocar uma closure por uma propriedade.

## Dependency Map

- `main/bootstrap` → Pixi `Application`, assets, mundo, UI, sistemas e Poki.
- `World/Camera` → `WORLD`, `PLAYABLE_BOUNDS`, player e viewport/resizes.
- `Player/Input` → input do joystick, upgrades de speed/pickup, estágio visual, bushes e ovos carregados.
- `Egg/Spawn` → egg atlas, pool, `EGG_SPAWN_CONFIG`, posição do player, ninho, bushes e camada visual.
- `EnemySystem` → ovos ativos, player, bases rivais, bushes/visibilidade e regras de roubo/depósito.
- `Progression` → ovos entregues, `STAGES`, player, preview do ninho, efeitos e desbloqueio da estação.
- `UpgradeSystem/UI` → moeda, níveis, stats do player, loader de assets e Poki pause/resume.
- `Tutorial` → evolução, upgrades, primeiro rival visto, quantidade carregada, bushes, ninho e indicador de navegação.
- `HUD/Ranking` → delivered, currency, stats de upgrade e scores dos três participantes.
- `Poki` → lifecycle de loading, gameplay start/stop e commercial break; chamadas devem permanecer nos mesmos eventos.

## Refactoring Plan

1. **Phase 1 — types/config/constants:** concluída. Tipos e configuração foram movidos sem mudar valores ou referências de gameplay.
2. **Phase 2 — world/camera/input:** parcialmente concluída. A composição visual estática do mundo foi extraída; câmera e input permanecem no compositor para preservar a ordem do loop.
3. **Phase 3 — eggs/spawn:** separar pool, spawn director e operações de carregamento/entrega com dependências explícitas.
4. **Phase 4 — enemies:** separar criação/IA/depósito/roubo, preservando a posição no loop.
5. **Phase 5 — player/progression:** separar estado visual, thresholds, evolução e preview do ninho.
6. **Phase 6 — UI/upgrades:** separar renderização e comandos de compra sem alterar custos, layout ou lifecycle Poki.
7. **Phase 7 — tutorial/FTUE:** extrair triggers por último, mantendo todas as condições existentes.
8. **Phase 8 — cleanup/validation:** build, typecheck, lint/testes disponíveis, busca de imports/referências e revisão manual no navegador.

## Baseline and Validation

O baseline será registrado pelos comandos disponíveis no projeto antes de cada fase. O projeto possui `npm run build`, mas não declara scripts separados de lint ou testes.

## Final Architecture

Implementada até a fase segura atual. O entry point ainda compõe o jogo e orquestra o loop, mas a configuração, os tipos compartilhados e a composição visual estática do mundo já possuem módulos próprios. As fases de sistemas dinâmicos e UI permanecem planejadas para uma continuação, pois exigem mover estado compartilhado sem transformar o God File em um God Object.

## Files Created

- `src/game/types.ts` — tipos compartilhados mínimos (`Point`).
- `src/config/game-config.ts` — constantes e dados estáticos extraídos sem alteração de valores.
- `src/world/world-scene.ts` — criação de terreno, shorelines, camada de obstáculos e bushes.

## Files Modified

- `src/main.ts` — usa os módulos de configuração e mundo; mantém a orquestração e a ordem do ticker.

## Behavior Preservation

- Nenhum valor de configuração ou balanceamento foi alterado.
- A ordem do ticker permaneceu intacta; somente a construção inicial do mundo foi movida para uma função chamada no mesmo ponto da inicialização.
- A randomização e a ordem de inserção dos bushes foram preservadas.
- A integração Poki e todos os handlers de input continuam em `main.ts`, sem mudança de chamada.

## Validation

- `npm run build` — passou após a Phase 1 e novamente após a Phase 2 (`tsc -b` + `vite build`).
- Não há scripts de lint ou testes declarados em `package.json`.
- Busca estrutural com `rg` — confirmou que os valores extraídos não permanecem duplicados em `main.ts`.
- `main.ts` passou de 2.343 para 2.168 linhas; a composição estática extraída ocupa 75 linhas e a configuração 74 linhas.

## Risks / Manual Testing Required

Mesmo com build/typecheck, a integração visual precisa ser verificada no navegador: joystick, resize, câmera, coleta/entrega, roubo, bushes, evolução, tutorial, upgrades e Poki quando disponível.

## Future Improvements

- Avaliar as observações registradas em `Problems Found` sem misturá-las à refatoração.
- Adicionar testes unitários para regras puras de spawn, progressão e custos depois que suas dependências forem extraídas.
- Avaliar profiling/otimizações separadamente; esta refatoração não altera algoritmos por performance.
