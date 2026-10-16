# Monster.io — Auditoria de Game Design do Grass World

## Escopo e método

Este documento descreve o comportamento encontrado no código atual. Ele não propõe nem implementa mudanças no Water World.

As conclusões são classificadas assim:

- **Comprovado:** a regra é executada por uma função chamada pelo runtime atual.
- **Configurado/condicional:** existe no código, mas depende de estado, tempo, posição ou outro gatilho.
- **Intenção não confirmada:** comentários, nomes ou configuração sugerem uma intenção, mas a execução não garante o comportamento.
- **Risco/inconsistência:** há uma divergência, limite ou comportamento que merece validação.

Referências principais: `src/main.ts`, `src/config/game-config.ts`, `src/config/level-design-config.ts`, `src/levels/grass/grass-level-design.ts`, `src/systems/eggs/egg-system.ts`, `src/systems/enemies/enemy-system.ts`, `src/systems/events/fugitive-egg-system.ts`, `src/systems/events/gold-mine-system.ts`, `src/systems/pacing/pacing-director.ts` e `src/systems/tutorial/tutorial-system.ts`.

## 1. Resumo executivo

O Grass World é um arena vertical de coleta e retorno. O jogador começa na parte inferior, em torno de `(3000, 3300)`, coleta ovos, retorna ao Nest em `(3000, 3500)`, deposita a fila e transforma cada ovo depositado em progresso local e moeda. A progressão é cumulativa e possui dez evoluções Grass. A décima evolução visual não conclui o mundo: ela apenas coloca o sistema em estado de portal, que exige mais ovos até o requisito local `230`.

O fluxo real é:

```text
inicialização
  → 20 ovos iniciais + 4 power-ups fixos + rivais ativos
  → coleta e fila atrás do player
  → retorno ao Nest
  → animação de depósito, moeda e progresso
  → evolução quando o threshold é atingido
  → oportunidade pós-evolução / novas rotas
  → evolução 3: Fugitive e tutorial da estação de upgrade
  → exploração superior: desbloqueio da Egg Mine
  → evolução 10: portal ativo
  → mais 42 ovos depositados, até 230 no total
  → animação do portal
  → CampaignManager seleciona Water World
  → reset de jornada e entrada da nova Scene
```

O que é obrigatório para concluir Grass:

1. depositar progresso suficiente para chegar à evolução 10 (`188` ovos depositados);
2. depositar mais ovos até `230` no total;
3. completar a animação/transição do portal.

O que é opcional ou condicional: power-ups, upgrades, arbustos, Fugitive, Egg Mine, inimigos roubando ovos e oportunidades do PacingDirector. Embora alguns sejam apresentados pelo tutorial, eles não são necessários para o portal.

O jogo tem forte condução de baixo para cima, mas ela é uma combinação de geometria, distribuição de ovos, zonas de oportunidade e pesos do PacingDirector; não é um trilho obrigatório.

## 2. Loop principal da experiência

### Primeiro frame e entrada

`bootstrap()` cria uma única aplicação PixiJS, um único ticker e uma câmera. O `LevelManager` inicia `grass-world`; o runtime da cena entra, posiciona o player em `GRASS_LEVEL_DESIGN.player.initialPosition`, reposiciona rivais, inicia o tutorial e chama `spawnInitialPowerUps()`.

Antes da primeira ação do jogador, o Grass executa:

- cria 20 ovos em `GRASS_LEVEL_DESIGN.eggs.initialPositions`;
- cria quatro power-ups nos placements iniciais;
- mantém dois rivais e suas bases no mapa;
- aponta o tutorial para o ovo mais próximo com o target `EGG`;
- deixa o Nest na parte inferior do mundo.

`startGameplay()` só marca o início da sessão quando o jogador inicia a interação; o preload de upgrades é disparado nesse momento. A existência do preload não significa que o jogador já tenha acesso à estação.

### Primeira coleta

No loop principal, a coleta ocorre quando um ovo normal ou especial está dentro do alcance do player. O ovo é transferido para `eggSystem.carriedEggs`, a variável de compatibilidade `carried` é atualizada, o ovo passa a seguir o player e são executados feedback de escala, flash, tremor e som.

O primeiro tutorial mantém `EGG` até duas coletas; depois aponta para `NEST`. A coleta também solicita uma oportunidade `NEAR_LEVEL_UP` ao PacingDirector e agenda reposição do ovo.

### Primeiro retorno e depósito

Quando o player entra no raio do Nest (`170`) carregando pelo menos um ovo, `updateDepositFeedback()` inicia o depósito. O sistema:

- congela a fila em `depositingEggs`;
- registra a entrega na progressão antes do fim visual da animação;
- envia ovos um por um ao Nest;
- aplica pulso no Nest, partículas, som e shake;
- soma moedas no final do lote;
- soma progresso por `progressionValue`;
- libera os ovos do sistema;
- decide se há evolução, portal ou apenas atualização normal.

O fato de `recordDelivery()` ocorrer no início do depósito é importante: o progresso lógico é registrado antes que o último ovo termine de voar visualmente. A HUD usa `baseVisualDelivered` durante a animação para evitar revelar todo o progresso antes da chegada visual.

### Primeira evolução

Os thresholds Grass são cumulativos. Quando o depósito termina e `delivery.shouldEvolve` é verdadeiro, uma animação é enfileirada depois de `DEPOSIT_FEEDBACK.evolutionDelay = 0.18`. A evolução mostra o monstro, VFX, banner e nível. Ao terminar, `progression.completeEvolution(evolutionTarget)` fixa o estágio visual.

Depois de cada evolução, `finishEvolutionSequence()` solicita `POST_EVOLUTION` ao PacingDirector e o jogo pode criar uma oportunidade de ovos ou exploração.

### Exploração e retorno

O player se move dentro de `PLAYABLE_BOUNDS`. A velocidade inicial é `280`; o alcance inicial é `92`. A fila de ovos acompanha o player com espaçamento controlado por `getCarriedEggGap()`, e o sistema de stack muda a apresentação conforme a quantidade carregada.

O retorno é incentivado por três sinais:

- a própria HUD muda para “Return to NEST”/“Carrying … — return to NEST”;
- o PacingDirector considera `RETURNING_HOME` e evita criar breadcrumbs desnecessários para um player com fila pesada;
- um rival próximo pode perseguir e roubar a fila.

### Compra de upgrade

Na evolução Grass local `2` — terceira evolução visual — `finishEvolutionSequence()` chama `unlockUpgradeStationTutorial()`. A estação se torna acessível quando os assets estão prontos, e a HUD de tutorial aponta para `UPGRADE`.

Existem dois upgrades:

| Upgrade | Valor inicial | Incremento | Custo inicial | Aumento do custo |
|---|---:|---:|---:|---:|
| Speed | 280 | +45 | 5 | +5 por compra |
| Pickup range | 92 | +18 | 5 | +5 por compra |

O clique da carta só compra se `currency >= cost`. A moeda é descontada, o nível da carta aumenta e o player é redesenhado. Não há limite máximo configurado.

### Conclusão do Grass

Ao atingir o décimo estágio Grass, o sistema não troca imediatamente de mundo. O estado passa a `PORTAL_ACTIVE`, mas o portal só pode ser completado quando `delivered >= 230`. O lote final chama `completePortal()`, marca o mundo no `CampaignManager`, entra em `TRANSITIONING` e inicia a animação do portal.

Quando o portal atinge a escala de revelação (`portalScale >= 90`), `activateNextCampaignWorld()` carrega e ativa Water World. A migração usa a animação existente e o reset de jornada do Checkpoint 8.2; não há alteração da ordem da campanha.

## 3. Mapa e exploração

### Dimensões e limites

`WORLD` define largura `6200`, altura `8400`, topo `-4200` e fundo `4200`. A câmera usa zoom `0.64`.

Com os gaps de tela atuais, os limites calculados são aproximadamente:

| Limite | Valor |
|---|---:|
| Esquerda | 234.375 |
| Direita | 5965.625 |
| Topo | -3903.125 |
| Fundo | 3926.5625 |

O player é restringido a esses limites em `player-system.ts`. O Nest fica em `(3000, 3500)` e o player inicia em `(3000, 3300)`. A direção natural é, portanto, para valores de `y` menores, isto é, para cima na tela/mundo.

### Elementos fixos

| Elemento | Posição / regra | Fonte |
|---|---|---|
| Player inicial | `(3000, 3300)` | `grass-level-design.ts` |
| Nest | `(3000, 3500)`; raio 170 | `grass-level-design.ts` |
| Base rival 1 | `(2200, 850)` | `grass-level-design.ts` |
| Base rival 2 | `(4700, -1500)` | `grass-level-design.ts` |
| Rival 1 | `(2200, 850)` | `grass-level-design.ts` |
| Rival 2 | `(4400, -1200)` | `grass-level-design.ts` |
| Plantas/decoração | 20 posições entre `(2450,2650)` e `(4200,-3450)` | `game-config.ts` |
| Obstáculos/arbustos | instanciados pela cena Grass | `grass-level.ts` / `world-scene.ts` |

Os rivais começam ativos porque `RIVALS_START_ACTIVE = true`. O código ainda mantém uma condição alternativa de ativação por estágio (`stageIndex >= 1`), mas ela não é o caminho observado no início atual.

### Condução vertical

Há evidência executável de condução para cima:

- o Nest e o player estão na área inferior;
- ovos iniciais existem em regiões progressivamente superiores;
- `getCurrentRegion(y)` classifica o eixo vertical como `Nest` (`y > 2700`), `Exploration` (`y > 500`), `EnemyTerritory` (`y > -2200`) e `GoldMine` acima disso;
- `PacingDirector.targetRegion()` avança `Nest → Exploration → EnemyTerritory → GoldMine`;
- pesos de `forward`, `forwardExplorationWeight` e `targetRegion` favorecem oportunidades à frente;
- a Egg Mine só é desbloqueada quando o player entra em uma região superior permitida.

Isso confirma a intenção de uma jornada vertical, mas não obriga o jogador a visitar todas as regiões. O player pode retornar ao Nest a qualquer momento e pode progredir usando ovos, rivais e oportunidades em posições variadas.

### Câmera

`getCameraTarget()` centraliza o player com clamps nos limites do mundo. O ticker atualiza suavemente a câmera quando não está em evolução. Durante evolução, portal, HUD e câmera são temporariamente controlados pela sequência visual. Shake e punch são aplicados em coleta, depósito, evolução e eventos.

## 4. Matriz 3×3 do mundo

O código chama a linha central de `ML/MC/MR`, não `CL/CC/CR`. A tabela abaixo usa o nome implementado e, entre parênteses, a convenção solicitada.

As divisões são calculadas sobre `PLAYABLE_BOUNDS`, não sobre `WORLD` inteiro. Aproximadamente:

- colunas: `234.375–2144.792`, `2144.792–4055.208`, `4055.208–5965.625`;
- linhas: `-3903.125–-1293.229`, `-1293.229–1316.667`, `1316.667–3926.563`.

| Região | Bounds aproximados | Ovos / oportunidades | Power-ups | Eventos e restrições |
|---|---|---|---|---|
| TL | x 234–2145, y -3903–-1293 | `ENEMY_TERRITORY`/GoldMine; zonas superiores esquerdas | permitido; Orbit inicial aqui | Egg Mine permitida; Fugitive não é permitido pela lista Grass |
| TC | x 2145–4055, y -3903–-1293 | GoldMine e oportunidades superiores | permitido | Egg Mine permitida; não há zona de oportunidade central explícita |
| TR | x 4055–5966, y -3903–-1293 | `ENEMY_TERRITORY`/GoldMine; zonas superiores direitas | permitido; Speed inicial aqui | Egg Mine permitida; Fugitive não é permitido |
| ML (CL) | x 234–2145, y -1293–1317 | Enemy territory e zona `Enemy_Left_01` | permitido | Fugitive permitido; disputa com inimigos possível |
| MC (CC) | x 2145–4055, y -1293–1317 | zona central lógica, mas oportunidades configuradas são laterais | não aparece na lista de power-up regions | Fugitive permitido; nenhuma zona normal central dedicada |
| MR (CR) | x 4055–5966, y -1293–1317 | Enemy territory e zona `Enemy_Right_01` | permitido | Fugitive permitido; disputa com inimigos possível |
| BL | x 234–2145, y 1317–3927 | área Nest/exploração inferior; zona `Nest_Left_Lower` | permitido; Range inicial aqui | ovos SAFE/EXPLORATION; não é GoldMine |
| BC | x 2145–4055, y 1317–3927 | Nest e aproximação inicial; `Nest` não é célula de oportunidade única | não aparece na lista `powerUpRegions` | Nest fica aqui; depósito e tutorial acontecem aqui |
| BR | x 4055–5966, y 1317–3927 | área Nest/exploração inferior; zona `Nest_Right_Lower` | permitido; Magnet inicial aqui | ovos SAFE/EXPLORATION; não é GoldMine |

### Observações da matriz

`LEVEL_DESIGN_CONFIG.powerUpRegions` é `TL, TC, TR, ML, MR, BL, BR`; MC/BC ficam fora da lista geral. Porém, os quatro placements fixos são explicitamente válidos e caem em TL, TR, BL e BR. A configuração permite mais regiões do que as posições iniciais usam.

`EGG_SPAWN_CONFIG.zones` usa retângulos diferentes da matriz: SAFE `(2500–3500, 2850–3850)`, EXPLORATION `(1500–4700, 650–2850)` e ENEMY_TERRITORY `(700–5500, -2200–650)`. Portanto, “região lógica” e “zona de spawn de ovos” não são a mesma divisão.

## 5. As dez evoluções Grass

Os estágios Grass são `STAGES.slice(0, 10)`. O threshold é cumulativo de ovos depositados; ovos carregados só são usados para exibir proximidade e não ativam a evolução antes do depósito.

| Evolução | Threshold cumulativo | Incremento desde a anterior | Escala | Novidade observável / impacto |
|---:|---:|---:|---:|---|
| 1 | 0 | 0 | 1.00 | estado inicial Hatchling; tutorial e 20 ovos iniciais |
| 2 | 4 | 4 | 1.14 | player maior; evolução pós-depósito e oportunidades posteriores |
| 3 | 16 | 12 | 1.30 | Alpha; primeira Fugitive automática e desbloqueio da estação/tutorial de upgrade |
| 4 | 30 | 14 | 1.50 | Legendary; escala visual maior |
| 5 | 48 | 18 | 1.62 | Ember; escala visual maior |
| 6 | 69 | 21 | 1.76 | Mystic; escala visual maior |
| 7 | 94 | 25 | 1.90 | Titan; escala visual maior |
| 8 | 122 | 28 | 2.04 | Celestial; o cloud do player desaparece a partir deste índice (`stageIndex >= 7`) |
| 9 | 153 | 31 | 2.18 | Ancient; escala visual maior |
| 10 | 188 | 35 | 2.32 | Apex; portal fica ativo, mas ainda não conclui o mundo |

A escala influencia player, ovos, fila e rivais. Não há no código uma tabela Grass que altere diretamente velocidade, alcance, capacidade ou velocidade dos inimigos por evolução. A velocidade inicial permanece `280`; o rival permanece `155`, embora a apresentação do rival seja escalada até `1.16` por `refreshVisualScales()`.

O ponto de desaceleração é claro: os incrementos necessários aumentam de 4 até 35. Depois da evolução 10, o portal exige `230 - 188 = 42` ovos adicionais, uma etapa mais longa que qualquer incremento individual anterior.

Eventos configurados por evolução:

- após cada evolução: pedido `POST_EVOLUTION` ao PacingDirector;
- na evolução local índice `1` — segunda evolução visual — o sistema arma o tutorial de esconderijo quando ele ainda não foi concluído;
- na evolução local índice `2` — terceira evolução visual — o sistema introduz upgrade e dispara a primeira Fugitive;
- o rival já está ativo desde o início por configuração;
- a Egg Mine não é liberada pelo threshold; é liberada por posição e transição de região.

## 6. Ovos e coleta

### Spawn inicial

O Grass começa com 20 posições fixas em `INITIAL_EGG_POSITIONS`, incluindo posições próximas ao Nest, exploração e áreas superiores. O player não precisa esperar um spawn aleatório para iniciar.

### População contínua

Parâmetros principais:

| Parâmetro | Valor |
|---|---:|
| `activeTarget` | 44 |
| `baselineTarget` | 28 |
| `visibleFloor` | 2 |
| `nearbyFloor` | 4 |
| checagem populacional | 2.8 s |
| pocket padrão | 3 ovos |
| distância mínima do player | 300 |
| distância mínima do Nest | 170 |
| distância entre ovos | 220 |
| distância de pocket | 520–980 |
| respawn | 1.5–4 s |

`updateSessionPacing()` cria pockets quando a população visível ou próxima está baixa, ou quando o total cai abaixo do baseline. O preenchimento é bloqueado durante depósito, evolução e atividade principal da Egg Mine. Depois da coleta, há um caminho separado de respawn via `spawnDirectorEgg()`.

`spawnDirectorEgg()` escolhe uma das zonas SAFE, EXPLORATION ou ENEMY_TERRITORY que esteja abaixo de seu target, tenta até 24 posições e evita player, Nest, ovos existentes e arbustos. A busca mantém ovos fora da área imediata do jogador, mas não garante que todos estejam fora da câmera.

### Clusters e oportunidades

Entre 10 e 24 segundos, o primeiro cluster de 3 ovos é garantido quando a condição de população permite. O PacingDirector também cria clusters/breadcrumbs:

- após evolução, normalmente 8 ovos;
- `EggBreadcrumb`, normalmente 3;
- `ExplorationBreadcrumb`, normalmente 5;
- oportunidades normais, até 8 ovos (`normalEggCount`).

O layout pós-primeira evolução contém 10 posições fixas, mas pode ser substituído por uma zona escolhida pelo PacingDirector. Posições inválidas são descartadas por distância do player, distância do Nest, sobreposição de ovos, arbustos e limites.

### Ovos roubados e recuperados

Cada rival pode carregar até `ENEMY_EGG_CAPACITY = 8`. Rivais coletam ovos `NORMAL` e `COIN`, mas não ovos de Fugitive. Ao atingir 8, voltam à base. A base recebe os ovos com uma animação de aproximadamente `0.52 s`, usando espaçamento de `0.055 s` entre ovos.

Se o rival estiver perto do player, ele pode tirar a fila do player; se o player encostar em ovos carregados pelo rival, recupera um ovo e o rival fica atordoado por 4 segundos. A regra de roubo é uma interação de distância, não uma colisão física complexa.

### Coin Egg

Ovo normal vale `1` moeda e `1` progresso. Coin Egg vale `10` moedas e normalmente `1` progresso. Coin Eggs são gerados nas ondas da Egg Mine; o código também os usa em showcases de QA. A moeda só é creditada no final do depósito, não na coleta.

## 7. Nest e depósito

O Nest é a zona de retorno, não um botão. O depósito inicia quando a distância ao Nest é menor que `interactionRadius = 170` e `carried > 0`.

Parâmetros da animação:

- lote de até 4 ovos: referência `smallDepositMax`;
- lote de até 9 ovos: referência `mediumDepositMax`;
- duração por voo: `0.22–0.46 s`;
- intervalo inicial: `0.12 s`;
- intervalo mínimo: `0.035 s`;
- aceleração do intervalo: `0.008` por ovo acima de três;
- atraso antes da próxima evolução: `0.18 s`;
- pulso normal do Nest: `1.035`;
- pulso final: `1.1`.

O depósito concede:

- `progressionValue` para progressão;
- `coinValue` para moeda;
- pontuação histórica `playerCollected`;
- efeitos de impacto, som, partículas e shake.

Carregar muitos ovos aumenta a recompensa potencial, mas aumenta a exposição ao roubo. O código marca `heavyStackThreshold = 10`; com uma fila pesada voltando ao Nest, o PacingDirector evita redirecionar o player para uma oportunidade. A fila visual muda de `TRAIL` para compactação/esconderijo conforme necessário.

## 8. Inimigos e bases

O Grass cria dois rivais, com duas bases. Os rivais são visualmente distintos: vermelho em `(2200,850)` e roxo em `(4400,-1200)`. A velocidade base é `155`; durante a perseguição introdutória, o rival pode usar pelo menos `320`.

Comportamento:

1. rival procura o ovo coletável mais próximo;
2. pode priorizar um interesse de Egg Mine ou Fugitive quando a intensidade do evento supera a oportunidade normal;
3. coleta ovos num raio de `72`;
4. segue fila com `FOLLOW_DISTANCE = 68`;
5. ao carregar 8 ovos, vai à própria base;
6. deposita e libera os ovos;
7. quando o player carrega ovos, o rival mais próximo pode persegui-lo até que a fila seja depositada, roubada ou a perseguição seja encerrada.

O código não contém escalada de velocidade ou percepção por evolução. A dificuldade cresce principalmente pela exposição espacial, pela distribuição dos ovos, pela presença de eventos e pelo peso de disputa. A interação com arbustos é indireta: o player deixa de ser perseguido quando fica escondido, e a IA recebe `chasingPlayer = false`.

Risco: o comentário de “rival ativo após primeira evolução” existe, mas `RIVALS_START_ACTIVE = true` faz os rivais já serem visíveis desde a entrada. A experiência real é mais agressiva do que uma leitura isolada do comentário poderia sugerir.

## 9. Arbustos e esconderijos

Os arbustos pertencem à cena Grass e são colocados na camada foreground, acima dos demais elementos. O player pode esconder-se quando está dentro da área normalizada do arbusto; o teste usa a distância elíptica com fator `< 0.8`.

Quando o player entra escondido com ovos:

- a fila muda para `COMPACTING`;
- os ovos convergem para um anchor entre player e arbusto;
- cada ovo recebe slot, jitter e atraso de cascata;
- a fila fica em `COMPACT`;
- o rival deixa de perseguir imediatamente o player oculto.

Ao sair, a fila passa para `RELEASING` e os ovos são liberados em função da distância percorrida. A distância de liberação usa o gap da fila multiplicado por `0.72`.

O tutorial é armado depois da segunda coleta de ovos, quando não há outro objetivo tutorial ativo. A etiqueta visível é `HIDE`. O sistema não concede moeda nem progresso direto: a recompensa é estratégica, reduzindo o risco de roubo e permitindo reposicionar a fila.

O esconderijo é opcional para concluir Grass, mas é uma mecânica importante para ensinar proteção da fila. O código de spawn evita colocar oportunidades de primeira evolução dentro do volume de arbustos.

## 10. Power-ups

### Placements iniciais confirmados

| Power-up | Posição | Célula lógica | Efeito |
|---|---:|---|---|
| Orbit | `(1350,-2750)` | TL | orbitação da fila por 12 s |
| Speed | `(4750,-2750)` | TR | velocidade ×1.4 por 10 s |
| Range | `(1350,2700)` | BL | alcance ×1.75 por 10 s |
| Magnet | `(4750,2700)` | BR | magnetismo ×1.8 por 8 s; raio ×5 |

Isso confirma exatamente o setup TL Orbit, TR Speed, BL Range, BR Magnet.

### Regras comuns

O sistema cria o power-up com animação de entrada de `0.42 s`, escala/pulso e leve flutuação. Ao coletar, remove a entidade, ativa o efeito e atualiza a HUD. `canActivate()` sempre retorna verdadeiro; coletar o mesmo tipo novamente renova a duração. Não existe lock global efetivo apesar de `globalCooldown` aparecer no debug.

| Tipo | Duração | Intensidade / regra | Cooldown usado no spawn |
|---|---:|---|---:|
| Speed | 10 s | velocidade ×1.4 | 35 s |
| Range | 10 s | alcance ×1.75; indicador expande em 0.26 s e contrai em 0.30 s | 35 s |
| Magnet | 8 s | atração ×1.8, raio ×5, velocidade 230–680, até 100 ovos | 75 s |
| Orbit | 12 s | orbit speed 1.2, padding 14, anéis espaçados 58, transição 0.4 s | 50 s |

O cooldown é usado pela seleção/reserva de oportunidades e respawn, mas não impede a ativação direta de uma entidade já existente. O pool normal remove o tipo coletado e tenta gerar outro em uma posição válida.

As sinergias são reais: Orbit depende contextualmente de fila carregada (`carriedEggs >= 6` para seleção do Director), Magnet recebe peso maior perto de muitos ovos, Speed recebe peso maior em EnemyTerritory e Range recebe peso maior quando há ovos visíveis.

## 11. Fugitive / Unicorn Egg

O Grass habilita o Fugitive, com regiões permitidas `ML`, `MC` e `MR`, isto é, a faixa central da matriz lógica. O primeiro evento automático ocorre em `finishEvolutionSequence()` quando `evolutionTarget === 2`, equivalente à terceira evolução visual.

O primeiro spawn aparece aproximadamente `150` à frente no eixo X e `720` acima do player, limitado pelos bounds. O evento automático não depende do PacingDirector; eventos posteriores podem ser criados por oportunidades `Fugitive`.

Parâmetros:

- alerta: raio `300`;
- captura: raio `64`;
- estado de proximidade: `128`;
- velocidade base: `205`;
- multiplicador próximo: `1.08`;
- multiplicador distante: `0.82`;
- direção para cima: bias `0.62`;
- afastamento do player: bias `0.72`;
- steering: `4.5`;
- atraso do alerta: `0.22 s`;
- máximo configurado: `8 s`;
- jackpot: `12` ovos numa área de raio `140–420`;
- interesse dos rivais: após `0.75 s`;
- cooldown: `90 s`.

O estado começa `DORMANT`, passa a `ALERT` com `?`, depois `CHASE`, e usa `!` em `NEAR_CAPTURE`. Ao tocar no ovo, `onCapture()` gera o jackpot. A lógica de escape está comentada no código; portanto, atualmente o Fugitive não é encerrado por abandono ou pelo timeout configurado. Ele permanece até captura ou cleanup de cena.

O jackpot pode atrair rivais por `enemyContestMaximumDistance = 1450`. A sinergia com Speed e Orbit é de gameplay emergente, não uma regra direta do Fugitive: o player pode usar Speed para encurtar a perseguição e Orbit para carregar/organizar ovos.

## 12. Egg Mine / Gold Mine

A Egg Mine começa `LOCKED` e usa apenas regiões lógicas `TL`, `TC` e `TR`. O desbloqueio ocorre quando o player muda de região e entra em uma dessas células superiores; não é diretamente amarrado a uma evolução.

Após desbloqueada, a primeira posição é escolhida fora da câmera quando possível, a pelo menos `520` do player. As posições fixas candidatas são:

- `(3100,-3100)`;
- `(1500,-3000)`;
- `(4700,-3000)`;
- `(2200,-1850)`;
- `(4000,-1850)`.

Parâmetros de interação:

- raio de ativação: `250`;
- raio ativo: `310`;
- raio de interesse dos rivais: `1450`;
- atraso configurado antes do primeiro spawn: `7–18 s`;
- `minUnlockTime = 60` e `pityUnlockTime = 105` existem na configuração, mas a decisão observada de unlock é disparada pela transição de região;
- cooldown após esgotamento: `30 s`;
- desaparecimento: `0.5 s`;
- distância mínima de respawn: `850`.

Depois de ativada, a mina executa as ondas sem exigir que o player permaneça dentro do raio:

| Onda | Tempo | Ovos normais | Coin Eggs |
|---:|---:|---:|---:|
| 1 | 1.0 s | 3 | 0 |
| 2 | 2.0 s | 3 | 1 |
| 3 | 3.2 s | 3 | 2 |
| 4 | 4.6 s | 2 | 3 |
| 5 / final | 6.2 s | 6 | 6 |

O total nominal é **29 ovos: 17 normais e 12 Coin Eggs**. A recompensa pode ser limitada pelo orçamento de `activeTarget` e por `maxRewardEggs = 30`. O código cria os ovos em anéis de raio crescente, com base `120`, incremento `55` por onda e máximo `330`.

O jackpot final dispara flash, anel, 34 partículas e despawn. A mina fica exausta, aguarda cooldown e pode reaparecer em outra posição superior. O evento cumpre função de recompensa de alta intensidade e ponto de atração para rival, não é requisito do portal.

## 13. Pacing Director

O PacingDirector avalia a sessão a cada `0.75 s`. Ele recebe uma fotografia com progressão depositada, ovos carregados, ovos próximos/visíveis, rivais, região, intenção, power-ups, tutorial, evolução e estado da Egg Mine.

### Gatilhos

| Gatilho | Condição real | Decisão possível | Estado |
|---|---|---|---|
| Coleta / proximidade do nível | cada coleta pede `NEAR_LEVEL_UP` | existente, breadcrumb ou cluster | implementado |
| Pós-evolução | `finishEvolutionSequence()` pede `POST_EVOLUTION` | exploração, ovos existentes ou breadcrumb | implementado |
| Período vazio | sem oportunidade relevante por pelo menos `5 s` | recompensa garantida ou surpresa | implementado |
| Estagnação no Nest | região Nest, sem coleta/evolução por `8 s` | exploração | implementado |
| Fila pesada retornando | `>=10` ovos e intenção `RETURNING_HOME` | usa oportunidade existente, não desvia | implementado |
| Alternância recompensa/surpresa | readiness, cooldown, player explorando sem inimigos | Fugitive, power-up, cluster ou breadcrumb | implementado/condicional |

O Director usa `targetRegion()` para avançar verticalmente. Se está no Nest, busca Exploration; em Exploration, EnemyTerritory; em EnemyTerritory, GoldMine. Há pesos `forward = 1.35`, `forwardExplorationWeight = 1.25`, `backwardWeight = 0.35` e `sideExplorationWeight = 0.85`.

### Evitação de monotonia

O Director mantém histórico dos últimos tipos, penaliza repetição de tipo (`0.5`), repetição de categoria (`0.58`) e repetição de direção (`0.72`). Mantém até quatro oportunidades recentes, reserva zonas por `12 s` e aplica cooldown de zona de `10 s`.

O canal surpresa precisa de pelo menos `8 s`, readiness acima de `0.2`, ausência de recuperação/intensidade alta, player explorando e ausência de inimigos próximos. A readiness sobe `0.075/s` em condições normais e chega a pelo menos `0.92` após `25 s` sem surpresa.

### Limitações

O Director decide uma oportunidade, mas a entrega pode falhar por falta de posição ou conflito. Nesse caso, preserva o orçamento e tenta novamente após `0.9 s`. Isso é comprovado. Não há uma garantia matemática de que toda decisão será visível ou executada, especialmente em zonas ocupadas, câmeras estreitas e alta densidade de ovos.

## 14. Tutorial e guidance

O Grass possui um `TutorialSystem` próprio, habilitado, com sete objetivos:

1. `opening-egg-collection` → `EGG`;
2. `opening-nest-deposit` → `NEST`;
3. `hide-in-bush` → `BUSH`;
4. `recover-from-enemy` → `ENEMY`;
5. `collect-magnet` → `MAGNET`;
6. `visit-egg-mine` → `GOLD_MINE`;
7. `upgrade-station` → `UPGRADE`.

O target visual usa `DirectionalArrowTrail` e uma etiqueta sobre a direção. Os textos confirmados são `PICK UP`, `HIDE`, `STEAL`, `MAGNET`, `Egg Mine`; o target Nest não recebe texto.

| Etapa | Trigger real | Conclusão real | Observação |
|---|---|---|---|
| Ovo | entrada da cena aponta para ovo mais próximo | após duas coletas, aponta para Nest | o código não exige que o ovo indicado seja o primeiro coletado |
| Nest | duas coletas ou sequência inicial | primeiro depósito limpa `NEST` | depósito exige estar dentro de 170 |
| Arbusto | depois de pelo menos 2 ovos carregados, sem target ativo | target é limpo ao deixar a condição de esconder | ensina proteção da fila |
| Inimigo | roubo/primeiro encontro produz `enemyTutorialPending` | recuperação limpa o target e aponta ao Nest | o rival já pode estar ativo desde o começo |
| Magnet | coleta do Magnet limpa target | coleta do tipo Magnet | depende do placement/respawn estar disponível |
| Egg Mine | entrada em região permitida desbloqueia mina | proximidade ativa/limpa target | target pode aparecer antes da mina estar visualmente pronta |
| Upgrade | evolução 3 chama unlock tutorial | primeira compra limpa target | o painel usa mão sobre Speed e depois Pickup range |

O `TutorialSystem` registra objetivos concluídos na sessão e não os repete automaticamente em uma reentrada normal. A implementação não mostra uma camada textual longa de instruções; o guidance é principalmente alvo, seta, etiquetas e mão no painel.

## 15. Economia e upgrades

Moedas são concedidas no final do depósito. A origem é `eggData.coinValue`: ovo normal vale `1`; Coin Egg vale `10`. O progresso também é calculado no depósito, usando `progressionValue`, normalmente `1`.

A compra é local à jornada atual. O Checkpoint 8.2 introduziu `resetForNewWorld()` em `main.ts`: zera moeda, níveis de upgrade, pontos, atributos do player, power-ups e fila quando a transição real de Scene é ativada. Pausar, retomar ou reentrar na mesma Scene não executa esse reset.

O painel fica disponível a partir da terceira evolução visual, mas o custo inicial baixo (`5`) permite a primeira compra assim que o jogador tiver depositado moedas suficientes. Não existe limite ou custo baseado diretamente na evolução. O ritmo esperado é, portanto, controlado por depósitos e Coin Eggs, não por threshold de evolução.

## 16. Portal e conclusão do Grass

O requisito real do portal Grass é **230 ovos depositados localmente**.

O passo a passo confirmado:

1. o jogador chega ao estágio 10 Grass em `188` ovos;
2. `completeEvolution(9)` deixa `ProgressionSystem` em `PORTAL_ACTIVE`;
3. o Nest/portal continua aceitando progresso;
4. são necessários mais `42` ovos para `portalReady`;
5. o lote que cruza 230 chama `completePortal()` apenas ao final do depósito;
6. `CampaignManager.completeCurrentWorld()` registra Grass como concluído;
7. `beginTransition()` bloqueia o fluxo normal e inicia `pendingPortalTransition`;
8. `startEvolutionFeedback(progression.stages.length)` inicia a animação especial do portal;
9. quando a escala chega a 90, `activateNextCampaignWorld()` pede o próximo id ao CampaignManager;
10. `LevelManager` carrega e ativa Water World;
11. ao terminar a animação, gameplay e camadas da nova Scene são reexibidos.

Input fica bloqueado durante `evolving`: joystick é desativado, overlay recebe modo estático e as camadas do mundo são escondidas durante a revelação. O cleanup da Scene antiga limpa ovos, inimigos, power-ups, mina, oportunidades e tutorial da Scene, mas preserva a aplicação, câmera, HUD e sessão compartilhada.

O portal não é concluído automaticamente na evolução 10. Essa separação é uma das regras mais importantes para planejar outro mundo.

## 17. Linha do tempo conceitual

| Momento | Objetivo do jogador | Recompensa | Tensão / exploração | Possível monotonia |
|---|---|---|---|---|
| Início | localizar e coletar ovos | fila e feedback imediato | Nest seguro, rival já ativo | baixo volume inicial pode parecer tutorializado |
| Primeira coleta | completar a fila mínima e seguir seta | próxima orientação | retorno ao Nest | depende da clareza do guidance |
| Primeiro depósito | aprender o loop coleta-retorno | moeda + progresso | rival pode pressionar | lotes pequenos têm pouca decisão |
| Evoluções 2–3 | explorar e depositar | escala, oportunidades, upgrade/Fugitive | mapa abre verticalmente | thresholds começam a crescer |
| Primeiro upgrade | gastar moeda em Speed/Range | atributo permanente na jornada | decidir economia | custo baixo pode reduzir escolha |
| Exploração | procurar ovos, power-ups e eventos | mais moeda/progresso | inimigos e distância do Nest | regiões centrais sem oportunidades podem esvaziar |
| Fugitive | perseguir e capturar | jackpot de 12 ovos | fuga, rival atraído | escape não está implementado |
| Egg Mine | viajar para região superior e ativar | ondas e Coin Eggs | alta intensidade e disputa | depende do desbloqueio por região |
| Evoluções 4–9 | repetir coleta/depósito em escala maior | mudanças visuais e oportunidades | thresholds incrementais maiores | pouca alteração estrutural de regras |
| Evolução 10 | atingir 188 depositados | Apex + portal ativo | ainda exige 42 ovos | forte prolongamento após a grande evolução |
| Portal | completar 230 depositados | transição de mundo | input e câmera controlados | animação é curta e não tem escolha |
| Water World | nova jornada | reset de moeda/upgrade/progresso local | nova Scene | o design Water ainda não foi auditado aqui |

Não há telemetria suficiente neste código para estimar minutos até cada etapa. Os tempos descritos no documento são timers de sistemas, não duração esperada de uma partida.

## 18. Análise crítica de game design

### Pontos fortes

- Loop de coleta, fila e depósito é legível e possui feedback audiovisual abundante.
- O risco de carregar muitos ovos dá motivo para decidir entre continuar explorando e voltar.
- A condução vertical é consistente entre geometria, regiões, zonas e PacingDirector.
- Rivais podem roubar e também ser usados como fonte de recuperação, criando decisões além de “evitar inimigo”.
- Fugitive e Egg Mine funcionam como picos de intensidade e produzem recompensas diferentes.
- Power-ups têm placements legíveis e sinergias contextuais.
- A evolução é clara visualmente e o portal tem uma etapa final separada.

### Pontos fracos ou riscos

- As dez evoluções Grass alteram principalmente escala, cor e apresentação; não há mudanças equivalentes de regras, velocidade ou comportamento de inimigos por estágio.
- Os incrementos de ovos crescem até 35, e os 42 ovos pós-evolução 10 podem parecer uma repetição longa depois do clímax visual.
- Rivais ativos desde o primeiro frame podem conflitar com a leitura de tutorial inicial.
- A fuga do Fugitive está comentada; o evento pode permanecer indefinidamente até captura.
- `minUnlockTime` e `pityUnlockTime` da Egg Mine aparecem configurados, mas não são o gatilho principal observado; a entrada em região é o desbloqueio real.
- A matriz central MC/CC não possui placement inicial nem zona normal dedicada de oportunidade, embora seja permitida para Fugitive.
- `activeTarget` de 44, baseline 28 e targets por zona têm responsabilidades diferentes; a quantidade visível pode variar significativamente entre momentos.
- O PacingDirector possui fallback e decisão probabilística; um tipo de oportunidade não é garantia de que o jogador verá aquele conteúdo.
- A pontuação `playerCollected` é histórica local e não constitui uma condição de conclusão; moedas/progresso são os recursos funcionalmente importantes.

### Evolução: visual versus gameplay

O ganho mecânico mais concreto da progressão é indireto: evolução libera eventos, upgrade e novos pedidos de pacing. A própria evolução não altera a velocidade base do player, a capacidade de ovos, o raio do Nest ou a velocidade base do rival. Portanto, se a intenção for que cada estágio mude o comportamento do mundo, essa intenção ainda não está comprovada pelo Grass atual.

## 19. Classificação CORE / CONFIGURÁVEL / ESPECÍFICO

| Sistema | Classificação | Evidência / limite |
|---|---|---|
| Pixi Application, ticker e câmera | CORE | uma aplicação e um loop compartilhados |
| GameSession, CampaignManager, LevelManager, SceneRuntime | CORE | infraestrutura de Scenes e campanha |
| ProgressionSystem | CORE com configuração | thresholds, stages e portal recebem `WorldEvolutionConfig` |
| PlayerSystem | CORE com adaptação visual | atributos e lógica são compartilhados; sprites variam por Scene |
| EggSystem | CORE com configuração parcial | coleta/fila são comuns; posições iniciais e pós-evolução variam |
| EnemySystem | CORE com layout configurável | bases e posições vêm de `WorldLevelDesignConfig` |
| PacingDirector | CORE com config/zonas configuráveis | tipos e algoritmo são compartilhados; zonas e pesos podem variar |
| TutorialSystem | CORE com config por Scene | Grass habilitado; Water atualmente desabilitado |
| PowerUpManager | CORE com placements configuráveis | efeitos são globais e compartilhados; tipos permitidos são por mundo |
| Arbustos/obstáculos Grass | ESPECÍFICO | pertencem à cena Grass e à estratégia de esconder a fila |
| Fugitive | CONFIGURÁVEL | Grass habilita, regiões e threshold são por design |
| Egg Mine | CONFIGURÁVEL | Grass habilita, regiões e posições podem variar |
| Portal Grass → Water | ESPECÍFICO da campanha atual | Water não possui requisito de portal no fluxo atual |
| Nest/deposito | CORE com parâmetros | raio, posição e design podem variar; sistema é compartilhado |
| Placements dos quatro power-ups | ESPECÍFICO do Grass | valores atuais formam o mapa TL/TR/BL/BR |
| Thresholds e escalas Grass | ESPECÍFICO do Grass | `WORLD_EVOLUTION_CONFIGS` separa Grass e Water |

## 20. Lacunas e riscos encontrados

1. **Fugitive sem escape ativo:** `abandonDistance`, `abandonTime` e `maxChaseDuration` estão configurados, mas o bloco de encerramento está comentado.
2. **Tempo de unlock da Egg Mine:** `minUnlockTime` e `pityUnlockTime` não aparecem como condições efetivas no caminho de entrada por região.
3. **Terminologia da matriz:** o código usa `ML/MC/MR`, enquanto o planejamento usa `CL/CC/CR`.
4. **Regiões com semânticas diferentes:** matriz lógica, regiões verticais (`Nest`, `Exploration`, `EnemyTerritory`, `GoldMine`) e zonas retangulares de spawn não coincidem exatamente.
5. **Rivais no opening:** `RIVALS_START_ACTIVE = true` torna o rival ativo desde o início, apesar de parte da lógica parecer preparada para ativação posterior.
6. **Progressão carregada versus depositada:** a evolução funcional usa depósito; o PacingDirector também calcula `effectiveProgress` com ovos carregados para guidance de proximidade. Esses dois números não devem ser confundidos.
7. **Pacing probabilístico:** a presença de um tipo em `allowedOpportunityTypes` não garante spawn, e a reserva de zona pode cancelar uma oportunidade.
8. **Limite de ovos:** `activeTarget`, `baselineTarget`, `maxRewardEggs` e targets por zona podem limitar recompensas de eventos. A recompensa nominal da Egg Mine pode ser truncada quando a população já está cheia.
9. **Reset entre mundos:** o Checkpoint 8.2 agora zera moedas, upgrades, atributos, fila, power-ups e progressão local na ativação real de uma nova Scene. O reset não ocorre em pausa, reentrada ou simples portal ativo.
10. **Water fora do escopo:** este relatório não valida se o Water World produz uma experiência equivalente ou diferente; isso deve ser planejado depois deste retrato factual do Grass.

## Conclusão

O Grass World já possui uma identidade clara de “coletar, carregar sob risco, esconder quando necessário, retornar ao Nest e subir pelo mapa”. Os sistemas de progressão, pacing, rivais, Fugitive, Egg Mine e power-ups sustentam essa identidade, mas a maior parte das dez evoluções continua sendo progressão visual e desbloqueio de conteúdo, não mudança profunda de regras.

Para o planejamento do Water World, os elementos mais claramente essenciais são: fila de ovos, risco de retorno, depósito com feedback, progressão local, um objetivo espacial compreensível e alternância entre recompensa garantida e eventos de surpresa. Positions, zonas, thresholds, eventos habilitados, tutorial e placements são pontos que o código já permite configurar por Scene. Nenhuma nova mecânica Water é proposta neste relatório.
