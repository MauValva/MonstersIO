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
5. **Phase 5 — player/progression:** concluída. Player e regras de progressão foram separados; preview visual permanece no compositor.
6. **Phase 6 — UI/upgrades:** separar renderização e comandos de compra sem alterar custos, layout ou lifecycle Poki.
7. **Phase 7 — tutorial/FTUE:** extrair triggers por último, mantendo todas as condições existentes.
8. **Phase 8 — cleanup/validation:** build, typecheck, lint/testes disponíveis, busca de imports/referências e revisão manual no navegador.

## Phase 4 — Enemy System

### Architecture

Foi criado `src/systems/enemies/enemy-system.ts` como factory sem singleton. O sistema encapsula criação dos rivais e ninhos, estado individual, seleção de targets, movimento, coleta, filas de ovos dos inimigos, daze, roubo, depósitos, animações de depósito, score e escalonamento visual. A orquestração permanece no `main.ts`, com chamadas separadas para preservar a ordem do ticker.

### Extracted responsibilities and state

Saíram do `main.ts`:

- tipo `Enemy`;
- criação dos dois ninhos rivais e dos dois inimigos, incluindo posições, frames, cores, sprites e velocidade;
- coleção de inimigos e bases rivais;
- `enemyDepositAnimations`;
- seleção do ovo mais próximo e movimentação/targeting;
- coleta de ovos, retorno ao ninho e follow dos ovos carregados;
- início e atualização do depósito rival;
- resolução de roubo player → enemy e enemy → player;
- `dazedUntil`, score `collected` e escalonamento visual dos rivais.

### Public API

- `enemies` — coleção fonte de verdade dos rivais, usada pelo ranking e pela seleção contextual do chaser.
- `enemyBases` — bases criadas pelo sistema, mantidas para a hierarquia visual.
- `updateVisibility(rivalsActive)` — preserva a visibilidade sincronizada dos rivais e ninhos.
- `updateAI(dt, activeChaser)` — executa seleção de alvo, movimento, coleta, retorno e follow.
- `resolveStealing()` — executa o roubo exatamente no ponto original do ticker.
- `updateDeposits(dt)` — atualiza animações e release dos depósitos rivais.
- `refreshVisualScales(progressionScale)` — atualiza escala dos rivais e ovos carregados após progressão.

### Dependencies

O sistema recebe somente o necessário: `world`, `eggLayer`, frames/textura dos rivais, uma função de criação de labels, getters da posição do player e tempo, escala dos ovos carregados, callbacks para respawn e contador legado, além de uma API estrutural mínima do EggSystem.

### EggSystem Integration

Não há import circular. O EnemySystem recebe uma interface estrutural com ovos ativos, fila do player, `addCarriedEgg`, `takeAllCarriedEggs`, `releaseEgg` e escala de ovos. A coleta rival lê `eggSystem.eggs`; roubo move ovos através da API da fila; depósitos liberam ovos através do EggSystem. Pool, spawn e ovos carregados do player continuam pertencendo ao EggSystem.

### Player Integration

O sistema consulta apenas a posição do player, tempo atual, escala dos ovos carregados e callbacks de integração. A decisão de qual rival é o `activeChaser`, assim como movimento/input/hidden state, continua no compositor.

### Tutorial Integration

As flags `firstEnemySeen`, `redIntroChaseCompleted`, `redIntroChaseHadEggs`, `hideTutorialCompleted` e os triggers de bush/ninho continuam em `main.ts`. O EnemySystem emite apenas o callback do roubo do primeiro rival para preservar o encerramento do intro chase; não move regras de FTUE.

### Loop Order

A ordem anterior foi mantida:

1. movimento do player e atualização de hidden state;
2. pickup de ovos;
3. descoberta/ativação visual dos rivais;
4. escolha do `activeChaser` no `main.ts`;
5. `enemySystem.updateAI(dt, activeChaser)`;
6. `enemySystem.updateDeposits(dt)`;
7. respawn de ovos;
8. `enemySystem.resolveStealing()`;
9. depósito do player, progressão e follow final da fila.

O sistema não foi transformado em um único update global, para não mover IA, depósito e roubo entre essas etapas.

## Phase 5 — Player / Progression

### Architecture

Foram criados dois factories independentes:

- `src/systems/player/player-system.ts` — ownership do container do player, arte, olhos, cloud, pickup indicator, stats de movimento/pickup, redraw visual, movimento limitado aos bounds e idle animation.
- `src/systems/progression/progression-system.ts` — ownership de `delivered`, estágio atual, thresholds, escala visual, cálculo de próximo estágio e resultado de evolução.

O `main.ts` continua como compositor: calcula input/joystick, consulta posição para câmera, controla tutorial/UI/efeitos e distribui as consequências de uma evolução para Player, EggSystem e EnemySystem.

### Extracted responsibilities and state

Do Player saíram:

- criação do container, body, eyes, cloud, sprite de evolução e pickup indicator;
- stats iniciais `speed: 280` e `pickupRadius: 92`;
- redraw de arte, escalas, cores, cloud e pickup radius;
- movimento com input externo, bounds e bloqueio durante evolução;
- idle float e rotação baseada na intenção de movimento.

Da Progression saíram:

- `delivered` como fonte única de verdade;
- estágio atual, anteriormente `skinIndex`;
- cálculo do estágio desbloqueado após uma entrega;
- thresholds e próximo threshold via `STAGES` já existente;
- sinalização `shouldEvolve` e confirmação do estágio ao fim da animação.

O preview do ninho, partículas, overlay, currency juice, desbloqueio da upgrade station e flags de tutorial permaneceram no compositor por serem apresentação/orquestração de outros domínios.

### Public API

`PlayerSystem` expõe `player`, `playerEvolution`, `pickupIndicator`, `upgrades`, `redraw`, `move` e `updateIdleVisual`.

`ProgressionSystem` expõe getters `delivered`, `stageIndex` e `visualScale`, além de `getNextThreshold`, `recordDelivery` e `completeEvolution`.

`recordDelivery` altera a quantidade entregue e retorna `{ delivered, unlockedIndex, shouldEvolve }`; não conhece UI, efeitos, tutorial, EggSystem ou EnemySystem.

### Dependencies and integration

Player recebe apenas world, frames de evolução, textura cloud e getters do estágio. Input e DOM continuam fora. Câmera continua fora e consulta `player.position` como antes.

Progression importa somente configuração de estágios. Ao receber uma entrega, o compositor mantém as mesmas consequências e chama `startEvolutionFeedback`; ao concluir o efeito, chama `completeEvolution`, redesenha o player, atualiza escalas através de `eggSystem.refreshScales()`/`enemySystem.refreshVisualScales()` e atualiza UI/preview.

EggSystem e EnemySystem não foram absorvidos por Player ou Progression. Ambos continuam recebendo a atualização visual via APIs já existentes.

### Delivered ownership

`delivered` agora é escrito somente por `progression.recordDelivery` e lido como `progression.delivered` por preview, HUD, thresholds, tutorial de ninho e efeitos de entrega. `baseVisualDelivered` continua sendo um valor temporário de apresentação do preview durante o depósito e não é uma segunda fonte de progresso lógico.

### Legacy carried state

`carried` foi analisado e permanece temporariamente. Em pickup e roubos ele acompanha `eggSystem.carriedEggs.length`, mas durante a conclusão do depósito ele é zerado antes do release/takeAll da fila visual. Nesse intervalo do mesmo tick, `carried` representa ovos ainda disponíveis para gameplay/tutorial, enquanto a fila ainda contém os ovos em animação de depósito. Substituí-lo cegamente por `eggSystem.carriedEggs.length` mudaria condições de tutorial, chase e depósito nesse ponto; a migração fica para uma fase de estado/tutorial com testes manuais.

### upgradePoints and currency

`currency` permaneceu no compositor porque é consumida diretamente pela UI de upgrades e compra. `upgradePoints` nasce em `0`, é incrementado por `depositedCount` e não possui leitores encontrados por busca estrutural; não foi removido nesta fase, conforme solicitado, e permanece em `Future Improvements`.

### Legacy State

`carried` permanece no `main.ts`. A Phase 4 confirmou que ele ainda é lido por tutorial, intro chase, escolha do chaser, condição de depósito e UI/gameplay. O EnemySystem atualiza esse contador por callback quando ocorre roubo/resgate; a fila real continua sendo `eggSystem.carriedEggs`. A remoção segura fica para uma futura fase de integração de estado.

## Phase 3 — Eggs / Spawn

### Architecture

Foi criado `src/systems/eggs/egg-system.ts` como factory, sem singleton e sem classe global. O factory mantém a fonte única de verdade para ovos do mundo, pool, motion state, fila carregada pelo player e hide animations. A API retornada expõe somente operações necessárias à composição do jogo: `spawnEgg`, `releaseEgg`, `getActiveWorldEggs`, `countActiveWorldEggs`, `spawnDirectorEgg`, `randomRespawnDelay`, `updateWorldEggMotion`, `startBushHideAnimation`, `updateCarriedEggBushAnimations`, `refreshScales`, `addCarriedEgg` e `takeAllCarriedEggs`.

### Extracted responsibilities and state

Saíram do `main.ts`:

- `eggs`, `eggPool`, `eggMotion` e `eggSerial`;
- criação, posicionamento seguro, frame, escala inicial e animação de spawn;
- lifecycle de release/pooling;
- `carriedEggs` como fila pertencente ao sistema;
- `eggHideAnimations` e `eggsInHideAnimation`;
- escala de ovos do mundo, escala carregada e distância da fila;
- spawn director, validação contra player/ninho/ovos/bushes e delay de respawn;
- animação visual dos ovos do mundo e transição hide/unhide nos bushes.

### Dependencies and integration boundaries

O sistema recebe explicitamente a camada Pixi, frames, resolução do atlas, bounds via configuração, e getters para estágio atual, posição do player, posição do ninho e escalas da fila. Recebe a lista de bushes somente no momento do spawn director ou da animação de esconder.

O `main.ts` ainda mantém temporariamente:

- `carried`, como contador legado usado por tutorial, IA e depósito; a fila real agora é `eggSystem.carriedEggs` e o relatório registra esse ponto para remoção na fase de integração de estado;
- `depositingEggs`/`depositArrivals`, porque a entrega no ninho altera progressão, moeda, evolução, tutorial e efeitos;
- ovos carregados por inimigos e `enemyDepositAnimations`, porque a Phase 4 tratará a fronteira EnemySystem.

### EnemySystem, Progression and Tutorial

A IA continua lendo `eggSystem.eggs` para procurar ovos e usa `addCarriedEgg`/`takeAllCarriedEggs` para roubo e resgate. Nenhuma função de IA foi movida ou reordenada.

O depósito do player continua no mesmo trecho do ticker e chama `eggSystem.releaseEgg` somente no mesmo momento em que antes chamava `releaseEgg`; delivered, moeda, upgrade points, thresholds e evolução continuam no `main.ts`.

Os triggers de tutorial continuam observando `carried` e as mesmas condições de inimigo, bush e ninho. Nenhuma regra de FTUE foi movida ou duplicada.

### Loop order

O update visual dos ovos foi substituído por `eggSystem.updateWorldEggMotion(dt, time)` exatamente no ponto original. A coleta, resolução de roubo, depósito, respawn e follow da fila continuam em seus pontos originais do ticker. A extração não consolidou essas chamadas em um único `update`, justamente para não alterar a ordem.

## Baseline and Validation

O baseline será registrado pelos comandos disponíveis no projeto antes de cada fase. O projeto possui `npm run build`, mas não declara scripts separados de lint ou testes.

## Final Architecture

Implementada até a Phase 5. O entry point ainda compõe o jogo e orquestra o loop, mas configuração, tipos, mundo estático, ovos/spawn, rivais, player e regras de progressão agora possuem fronteiras próprias. Tutorial, input/joystick, preview visual e UI permanecem no compositor para as próximas fases.

## Files Created

- `src/game/types.ts` — tipos compartilhados mínimos (`Point`).
- `src/config/game-config.ts` — constantes e dados estáticos extraídos sem alteração de valores.
- `src/world/world-scene.ts` — criação de terreno, shorelines, camada de obstáculos e bushes.
- `src/systems/eggs/egg-system.ts` — fonte de verdade para ovos, pool, spawn e fila do player.
- `src/systems/enemies/enemy-system.ts` — criação, IA, roubo, depósitos e score dos rivais.
- `src/systems/player/player-system.ts` — entidade visual, stats e movimento do player.
- `src/systems/progression/progression-system.ts` — delivered, estágio e regras de threshold/evolução.

## Files Modified

- `src/main.ts` — usa os módulos de configuração, mundo, ovos e rivais; mantém a orquestração e a ordem do ticker.
- `src/main.ts` — integra PlayerSystem e ProgressionSystem, mantendo input, câmera, UI, tutorial e efeitos.

## Behavior Preservation

- Nenhum valor de configuração ou balanceamento foi alterado.
- A ordem do ticker permaneceu intacta; somente a construção inicial do mundo foi movida para uma função chamada no mesmo ponto da inicialização.
- A randomização e a ordem de inserção dos bushes foram preservadas.
- A integração Poki e todos os handlers de input continuam em `main.ts`, sem mudança de chamada.
- As chamadas de visibilidade, IA, depósitos e roubo dos rivais permanecem separadas nos mesmos pontos relativos do ticker.
- A movimentação do player continua no mesmo ponto do ticker, agora delegada a `playerSystem.move`.
- A entrega continua alterando moeda, efeitos e tutorial no mesmo ponto; somente o ownership de `delivered` e do estágio foi movido.

## Validation

- `npm run build` — passou após a Phase 1 e novamente após a Phase 2 (`tsc -b` + `vite build`).
- `npm run build` — passou após a Phase 3 (`tsc -b` + `vite build`; 727 módulos transformados).
- Não há scripts de lint ou testes declarados em `package.json`.
- Busca estrutural com `rg` — confirmou que os valores extraídos não permanecem duplicados em `main.ts`.
- Busca estrutural com `rg` — confirmou que pool, motion map, serial, fila e hide animation não são mais declarados em `main.ts`.
- `main.ts` passou de 2.343 para 1.959 linhas; `egg-system.ts` possui 229 linhas.
- `npm run build` — passou após a Phase 4 (`tsc -b` + `vite build`; 728 módulos transformados).
- Busca estrutural com `rg` — confirmou que declarações antigas de `Enemy`, `enemyDepositAnimations`, `updateEnemy` e `resolveStealing` não permanecem em `main.ts`.
- `main.ts` passou de 1.959 para 1.734 linhas; `enemy-system.ts` possui 241 linhas.
- `npm run build` — passou após a Phase 5 (`tsc -b` + `vite build`; 730 módulos transformados).
- Busca estrutural com `rg` — confirmou que `delivered` e `skinIndex` não são mais estados locais do `main.ts`; o único `delivered` local restante pertence ao cache de UI/preview.
- Busca estrutural com `rg` — confirmou que `upgradePoints` só nasce e incrementa no depósito, sem consumidores atuais.
- `main.ts` passou de 1.734 para 1.647 linhas; `player-system.ts` possui 87 linhas e `progression-system.ts` 35 linhas.

## Risks / Manual Testing Required

Mesmo com build/typecheck, a integração visual precisa ser verificada no navegador: joystick, resize, câmera, coleta/entrega, roubo, bushes, evolução, tutorial, upgrades e Poki quando disponível.

Checklist específico da Phase 3:

- ovos iniciais aparecem nas mesmas posições;
- pickup funciona e a fila segue o player;
- primeiro ovo e demais ovos mantêm suas distâncias;
- escala acompanha evolução;
- esconder nos bushes e sair do bush continuam funcionando;
- depósito e animação de depósito continuam funcionando;
- respawn mantém quantidade, zonas e delay;
- inimigos continuam encontrando/coletando ovos;
- roubo continua funcionando;
- evolução continua ocorrendo nos mesmos thresholds.

Checklist específico da Phase 4:

- ambos os inimigos aparecem corretamente;
- nests rivais aparecem corretamente;
- inimigos começam/ativam no mesmo momento;
- inimigos encontram e coletam ovos;
- filas de ovos dos inimigos aparecem corretamente;
- inimigos retornam aos ninhos;
- depósitos aumentam score corretamente;
- ranking recebe os scores corretos;
- perseguição ocorre nas mesmas condições;
- bushes continuam escondendo o player;
- roubo player → enemy e enemy → player continuam funcionando;
- daze/stun continua funcionando;
- intro chase e tutorial de bush continuam iguais;
- evolução não altera incorretamente a IA;
- escalonamento visual dos inimigos continua correto.

Checklist específico da Phase 5:

- player inicia na mesma posição;
- movimento por joystick mantém velocidade, direção e bounds;
- idle float e rotação permanecem iguais;
- pickup radius e speed continuam com os mesmos valores;
- sprite, cloud, olhos e escalas permanecem iguais;
- progressão usa os mesmos thresholds;
- entrega atualiza HUD, moeda e preview corretamente;
- evolução inicia e termina nos mesmos tempos;
- EggSystem e EnemySystem recebem as escalas após evolução;
- upgrade station continua desbloqueando na mesma evolução;
- tutorial e câmera continuam consultando o estado correto;
- depósito mantém a diferença temporária entre `carried` e fila visual.

## Future Improvements

- Avaliar as observações registradas em `Problems Found` sem misturá-las à refatoração.
- Adicionar testes unitários para regras puras de spawn, progressão e custos depois que suas dependências forem extraídas.
- Avaliar profiling/otimizações separadamente; esta refatoração não altera algoritmos por performance.
- Na próxima fase, avaliar a remoção segura do contador legado `carried` somente junto da integração de estado do EnemySystem/Tutorial; não foi alterado nesta fase.
- `upgradePoints` permanece sem consumidores e deve ser revisado em cleanup futuro.
