# Monster.IO — auditoria e otimizações seguras

Data: 22/09/2026. Escopo: todos os arquivos de src, HTML/CSS, dependências instaladas, public/assets e build de produção. Nenhum asset original foi alterado ou apagado. MB = 1.000.000 bytes; MiB = 1.048.576 bytes.

## BASELINE / BEFORE vs AFTER

| Categoria | Antes | Depois | Diferença |
|---|---:|---:|---:|
| total | 13.689 MB | 13.584 MB | -105.523 bytes |
| javascript | 0.628 MB | 0.628 MB | 422 bytes |
| images | 13.060 MB | 12.954 MB | -105.519 bytes |
| audio | 0.000 MB | 0.000 MB | 0 bytes |
| fonts | 0.000 MB | 0.000 MB | 0 bytes |
| other | 0.001 MB | 0.001 MB | -426 bytes |

- Arquivos na build: 25 → 23; imagens: 12 → 11. Originais em public: 12 imagens + README, preservados.
- Economia total: 0.106 MB (0.8%).
- JS gzip somado por chunk: 0.191 MB → 0.191 MB. O pequeno aumento de JS financia o controle de memória/cache; não houve redução artificial de funcionalidades do renderer.
- Imagens solicitadas no boot: 11, 12.954 MB, antes e depois. Ground.jpg não era baixado no gameplay; sua exclusão reduz o pacote publicado, não o download inicial.
- Loading passou de 11 awaits sequenciais para solicitações concorrentes via Promise.all/Assets.load. Bytes não mudaram; redução de latência é esperada, não cronometrada em rede real. Browser/loader continuam controlando concorrência.
- Texturas ativas estimadas: 52.17 MiB antes/depois, RGBA8, sem mipmaps. Não contabiliza canvas, buffers, MSAA, textos, caches do navegador e cópias CPU. Uma cópia decodificada CPU adicional pode consumir aproximadamente outro 52.17 MiB.
- Não existem arquivos de áudio/fontes na build. SDK externo da Poki e tráfego de anúncios não entram nestes totais.

## CRITICAL

1. **Retenção ilimitada de ovos entregues — corrigida.** Ovos invisíveis ficavam em eggs, eggMotion e eggLayer enquanto cada respawn alocava outros. Os loops cresciam com o total histórico de entregas. Agora releaseEgg remove referências ativas e devolve até 20 containers/sprites ao pool; excedentes são destruídos sem destruir texturas compartilhadas. Memória ainda cresce legitimamente com ovos realmente carregados, pois a fila segue ilimitada.
2. **Imagens são 95.4% da build original.** Reduções expressivas de download/GPU dependem da segunda etapa autorizada de assets. Alterar PNG para WebP, sozinho, não reduz a textura RGBA descomprimida.
3. **Sem profiling em GPU/mobile físico.** Este ambiente não disponibilizou navegador conectado (inventário vazio). Não há medição de FPS, draw calls, VRAM real, primeiro frame ou thermal throttling. Testes headless não substituem isso.

## HIGH IMPACT

- **UI e máscara do ninho por frame — corrigidas:** updateUI era chamado no ticker enquanto rivais estavam ativos e player visível. Sort de ranking, formatação, buttons.clear e máscara/indicador eram refeitos mesmo sem mudanças. Estados são comparados antes de reconstruir. Avanço de depósito/evolução continua atualizando o preview.
- **Fila de ovos escondendo/saindo do arbusto — corrigida:** some para cada ovo sobre todas as animações virava O(Q²). Set de pertencimento mantém consulta média O(1), percurso total O(Q).
- **Loading serial — corrigido:** as 11 imagens independentes iniciam juntas; cache Pixi preservado.
- **Reduzir Plant, UpgradeBase, Enemies e enemyNest:** candidatos prioritários após aprovação; ver dimensões e economia abaixo.
- **Adiar UI de upgrades:** UI_Upgrades + UpgradeBase representam 2.501 MB e ~12 MiB RGBA. Estação só aparece na segunda evolução. Refatorar sua construção/carregamento com promessa única, fallback e tratamento de erro em etapa posterior; não implementado para evitar pausas/arte faltando.

## MEDIUM IMPACT

- Busca de alvo dos rivais agora faz uma passagem O(E), em vez de filter + sort O(E log E); mantém primeiro candidato em empates.
- Contagem de ovos ativos não cria array por frame. Seleção de zona ainda usa filtros/sort, mas apenas em spawn (normalmente a cada 2–5 s; até 24 tentativas). Com 20 ovos alvo, um grid não se justifica.
- Ground.jpg e README de arte excluídos da publicação por manifesto compartilhado. Vite continua servindo public no desenvolvimento; produção inclui somente GAME_ASSETS. Novos arquivos públicos de runtime devem ser adicionados ao manifesto/plugin, inclusive futuros áudios/fontes.
- Pool para partículas de moeda poderia ajudar em depósitos enormes. Hoje cria Q Graphics por depósito; cada uma dura 0,7 s após atraso de 0,08×índice. Pool/cache de GraphicsContext exigiria validar ownership e render; não aplicado.
- Considerar culling visual depois de medir. Nenhuma entidade teve AI desligada por distância: rivais distantes continuam coletando e alterando ranking, portanto sleep poderia mudar gameplay.

## LOW IMPACT

- Removidos cálculos de nearbyEgg sem uso e atribuições repetidas de textos; custo mínimo de upgrade calculado sem Object.keys/map/spread no frame.
- Nomes de ovos usam Container.label, API atual; avisos de filhos em Sprite/Graphics ainda existem na UI e precisam de refatoração cuidadosa de hierarquia.
- Restam objetos pequenos de câmera/toGlobal, callbacks em buscas, dois rivais filtrados/ordenados para escolher perseguidor. Prioridade inferior aos assets e à retenção já corrigida.

## LARGE TEXTURES — inventário completo

Tamanho visual em CSS px estimado pelo código, câmera 0,64 no mundo; efeitos/HUD são em tela. Para DPR 2, multiplicar necessidade física por 2. Overshoots, transparência e animação não foram confundidos com conteúdo útil. Nenhuma recomendação abaixo foi executada.

| Asset (base public/assets/Arts) | Resolução | Disco | GPU RGBA8 | Render aproximado | Recomendação |
|---|---:|---:|---:|---|---|
| Eggs/spr_Eggs.png | 1774×887 | 1.360 MB | 6.00 MiB | frame 354,8×295,7; mapa até ~53×44 CSS px, fora overshoot; fila menor | PROBABLY SAFE: atlas perto de 900×450; preservar grade 5×3 e rever frames fracionários |
| Enemy/Enemies.png | 1774×887 | 1.549 MB | 6.00 MiB | até ~83×83 CSS px por frame | SAFE TO REDUCE: candidato 512×256 (256×256/frame) |
| Environment/enemyNest.png | 1774×887 | 2.317 MB | 6.00 MiB | ~148×148 CSS px por frame | PROBABLY SAFE: 768×384; compensar scale 0,26 para manter tamanho |
| Environment/Ground.jpg | 1254×1254 | 0.106 MB | 6.00 MiB | não renderizado | CONFIRMED UNUSED: excluído apenas da build |
| Environment/Nest_Player.png | 256×256 | 0.130 MB | 0.25 MiB | ~147×147 CSS px | REVIEW MANUALLY: manter 256×256; DPR 2 já pede ~295 px |
| Environment/Plant.png | 1322×1190 | 0.872 MB | 6.00 MiB | ~79–174 CSS px; variação aleatória e progressão | SAFE TO REDUCE: 512×461, preservando proporção |
| Environment/Tile_Ground_V2.png | 2172×724 | 1.648 MB | 6.00 MiB | repetição ~195×195 CSS px; margem ~176 px | PROBABLY SAFE: 1536×512; reescalar tileScale e largura da margem para manter padrão |
| Environment/UpgradeBase.png | 1269×1240 | 1.478 MB | 6.00 MiB | ~110×112 CSS px | SAFE TO REDUCE: 384×375 |
| Player/PlayerCloud.png | 512×256 | 0.118 MB | 0.50 MiB | quadro até ~174×87 CSS px; conteúdo ocupa só uma parte | REVIEW MANUALLY: trim com orig/trim e offsets; não reduzir cegamente |
| Player/Player_EvoMonster.png | 2095×1080 | 2.334 MB | 8.63 MiB | player até ~155×199 CSS px; preview ~260×334; efeito ~488×627 CSS px no pico 1,2× | REVIEW MANUALLY: manter resolução até validar efeito em DPR 2 |
| UI/UI_HUD.png | 644×318 | 0.125 MB | 0.78 MiB | resizeUI redefine scale: plates até 172×62 e ranking 278×170 CSS px; seta 56×46; label 108×34 | REVIEW MANUALLY: manter; não há folga uniforme para DPR 2 |
| UI/UI_Upgrades.png | 1983×793 | 1.024 MB | 6.00 MiB | painel 820×720 antes da escala responsiva (até 1); card 230×520 | REVIEW MANUALLY: painel já amplia frame 594×602; separar regiões antes de reduzir |

Maior textura residente: Player_EvoMonster (8.63 MiB). Sete outros atlases/sprites ficam perto de 6 MiB cada (incluindo chão, plantas, base e UI). Não existem quadrados exatos 1024²/2048²; dimensões não convencionais também custam memória. Ground.jpg teria 6.00 MiB se carregado, mas não entra no total residente.

## Transparência, trim e uso

Bounding box usa alpha > 0; limite final exclusivo. Porcentagem de trim considera apenas margem externa, não buracos internos. Alpha parcial foi contado separadamente em assets.json. Muitos pixels têm alpha parcial; não converter imagens com alpha para JPEG indiscriminadamente.

| Asset | Usa alpha | Pixels alpha=0 | Bounding box útil | Área externa removível | Onde usado |
|---|---|---:|---|---:|---|
| spr_Eggs.png | sim | 48.4% | (146, 6)–(1774, 887) | 8.9% | spawnEgg/fila/depósitos; grade 5×3 |
| Enemies.png | sim | 21.7% | (0, 0)–(1774, 887) | 0.0% | createEnemy; 2 rivais, grade 2×1 |
| enemyNest.png | sim | 25.8% | (0, 0)–(1774, 887) | 0.0% | createEnemyBase; 2 ninhos, grade 2×1 |
| Ground.jpg | não | 0.0% | (0, 0)–(1254, 1254) | 0.0% | sem referência no jogo |
| Nest_Player.png | sim | 23.4% | (0, 25)–(256, 256) | 9.8% | nestSprite no ninho principal |
| Plant.png | sim | 50.8% | (35, 39)–(1302, 1190) | 7.3% | 20 arbustos, colisão elíptica/ocultação |
| Tile_Ground_V2.png | não | 0.0% | (0, 0)–(2172, 724) | 0.0% | grass/water e 4 margens; 3 frames 724×724 |
| UpgradeBase.png | sim | 48.9% | (91, 0)–(1206, 1222) | 13.4% | upgradeBaseSprite no mundo |
| PlayerCloud.png | sim | 93.6% | (14, 0)–(150, 82) | 91.5% | nuvens do player/rivais |
| Player_EvoMonster.png | sim | 68.6% | (14, 157)–(2095, 1080) | 15.1% | player, preview do ninho, efeito de evolução; grade 5×2 |
| UI_HUD.png | sim | 74.5% | (4, 54)–(644, 318) | 17.5% | contadores/ranking/seta/label; recortes em coordenadas fixas |
| UI_Upgrades.png | sim | 49.9% | (0, 64)–(1963, 770) | 11.9% | painel/cards/ícones/botões; coordenadas fixas |

PlayerCloud tem conteúdo de apenas 136×82 em 512×256: trim externo pode eliminar ~91,5% da área. A imagem recebe anchor 0,5 e tamanho explícito: recorte simples deslocaria e ampliaria a nuvem. Requer metadados orig/trim ou compensação rigorosa. Player/Eggs têm bastante transparência interna por frame; trim global quebraria a grade. Preview do player usa frações de área útil codificadas, que também precisam ser preservadas. Não há pipeline de packing/trim existente nem JSON de atlas.

## TOP 20 LARGEST FILES — baseline

| # | Arquivo | Tamanho |
|---:|---|---:|
| 1 | dist/assets/Arts/Player/Player_EvoMonster.png | 2.334 MB |
| 2 | dist/assets/Arts/Environment/enemyNest.png | 2.317 MB |
| 3 | dist/assets/Arts/Environment/Tile_Ground_V2.png | 1.648 MB |
| 4 | dist/assets/Arts/Enemy/Enemies.png | 1.549 MB |
| 5 | dist/assets/Arts/Environment/UpgradeBase.png | 1.478 MB |
| 6 | dist/assets/Arts/Eggs/spr_Eggs.png | 1.360 MB |
| 7 | dist/assets/Arts/UI/UI_Upgrades.png | 1.024 MB |
| 8 | dist/assets/Arts/Environment/Plant.png | 0.872 MB |
| 9 | dist/assets/index-Byk_U7yV.js | 0.356 MB |
| 10 | dist/assets/Arts/Environment/Nest_Player.png | 0.130 MB |
| 11 | dist/assets/Arts/UI/UI_HUD.png | 0.125 MB |
| 12 | dist/assets/Arts/Player/PlayerCloud.png | 0.118 MB |
| 13 | dist/assets/Arts/Environment/Ground.jpg | 0.106 MB |
| 14 | dist/assets/WebGLRenderer-BfcyeE-8.js | 0.072 MB |
| 15 | dist/assets/RenderTargetSystem-CCFzFWpe.js | 0.053 MB |
| 16 | dist/assets/WebGPURenderer-C5r52euw.js | 0.046 MB |
| 17 | dist/assets/browserAll-BfabkqlK.js | 0.043 MB |
| 18 | dist/assets/CanvasRenderer-Ipi84Rg3.js | 0.018 MB |
| 19 | dist/assets/webworkerAll-CLxXgGbG.js | 0.016 MB |
| 20 | dist/assets/BitmapFont-f1B9I87f.js | 0.013 MB |

Listas completas e ordenadas de antes/depois: build-before.json e build-after.json. No resultado final saem Ground.jpg/README, e mudam hashes/tamanhos dos chunks JS.

## UNUSED ASSETS / duplicados

- **CONFIRMED UNUSED:** public/assets/Arts/Environment/Ground.jpg e public/assets/Arts/README.md não são consumidos em runtime. Preservados no projeto, omitidos de dist.
- **POSSIBLY UNUSED:** nenhum arquivo adicional identificado. Há regiões sem uso em atlases (ex.: ícone capacity, HUD full, ovos posteriores aos estágios usados), mas isso não autoriza remover o arquivo/recortar a folha.
- Tiles_Ground.png visto em uma etapa anterior não existe no snapshot atual desta auditoria; não foi excluído nesta etapa.
- Busca cobriu imports, Assets.load, HTML/CSS, caminhos dinâmicos, manifests e JSONs; não há outro loader de assets, catálogo remoto ou JSON de atlas no projeto. Seleção dinâmica ocorre por frame dentro das folhas carregadas.
- SHA-256 de todos os arquivos em assets.json: nenhum duplicado byte a byte entre os originais. As cópias public/dist são esperadas e validadas. Ninhos inimigos e ninho principal são variantes, não duplicados comprovados. Similaridade perceptual de imagens não foi medida; nenhum arquivo foi removido por semelhança visual.

## TEXTURE RESIZE CANDIDATES — somente proposta

“SAFE TO REDUCE” indica boa folga matemática para DPR 2 nos usos atuais, não autorização para editar. Sempre comparar visualmente em mobile/desktop, todas as fases e animações.

| Asset | Dimensões propostas | Economia GPU aproximada | Classe |
|---|---|---:|---|
| Enemies.png | 1774×887 → 512×256 | 5.50 MiB (91.7%) | SAFE TO REDUCE |
| enemyNest.png | 1774×887 → 768×384 | 4.88 MiB (81.3%) | PROBABLY SAFE |
| Plant.png | 1322×1190 → 512×461 | 5.10 MiB (85.0%) | SAFE TO REDUCE |
| UpgradeBase.png | 1269×1240 → 384×375 | 5.45 MiB (90.8%) | SAFE TO REDUCE |
| spr_Eggs.png | 1774×887 → 900×450 | 4.46 MiB (74.3%) | PROBABLY SAFE |
| Tile_Ground_V2.png | 2172×724 → 1536×512 | 3.00 MiB (50.0%) | PROBABLY SAFE |

- Enemies usa width/height explícitos; enemyNest usa scale nativo e precisa compensação após resize.
- Ovos usam scale sobre frames: ao reduzir o atlas, compensar escala para não encolher ovos e a fila. A grade atual 1774/5 e 887/3 produz frames fracionários; evitar bleed exige revisão de bordas/extrusão.
- Chão usa tileScale e groundTileSize na margem: compensar ambos ao reduzir para manter frequência e largura visual. Tile_Ground_V2 (2172 px) e Player_EvoMonster (2095 px) superam 2048; confirmar MAX_TEXTURE_SIZE nos aparelhos alvo, sem assumir limite universal.
- Player_EvoMonster não é candidato automático: evolução em tela usa até 1,2×176×2,32 por 1,2×226×2,32 (~490×629 CSS px), acima do quadro fonte 419×540. Aumentar compressão ou reduzir agravaria perda.
- UI_Upgrades mistura painel já ampliado com ícones pequenos: otimizar por região exige repacking e atualização de coordenadas. UI_HUD é pequeno e usado perto da resolução nativa.

## FORMAT CONVERSION CANDIDATES — somente proposta

Economias abaixo são **cenários de planejamento de 30–60% do arquivo**, não medições nem promessa de qualidade. Lossless pode economizar menos ou até aumentar tamanho; é necessário codificar cópias e comparar antes de aprovar. Nenhuma conversão foi executada.

| Asset | Experimento recomendado | Economia hipotética no disco |
|---|---|---:|
| Tile_Ground_V2.png | WebP opaco; JPEG somente após avaliar emendas | 0.494 MB–0.989 MB |
| Player_EvoMonster.png | WebP lossless primeiro; lossy com alpha somente após aprovação | 0.700 MB–1.400 MB |
| enemyNest.png | WebP lossless primeiro; lossy com alpha somente após aprovação | 0.695 MB–1.390 MB |
| Enemies.png | WebP lossless primeiro; lossy com alpha somente após aprovação | 0.465 MB–0.929 MB |
| Plant.png | WebP lossless primeiro; lossy com alpha somente após aprovação | 0.262 MB–0.523 MB |
| UpgradeBase.png | WebP lossless primeiro; lossy com alpha somente após aprovação | 0.443 MB–0.887 MB |
| spr_Eggs.png | WebP lossless primeiro; lossy com alpha somente após aprovação | 0.408 MB–0.816 MB |
| UI_Upgrades.png | WebP lossless primeiro; lossy com alpha somente após aprovação | 0.307 MB–0.614 MB |

Sprites transparentes: preservar alpha (PNG/WebP). Chão é totalmente opaco e permite testar WebP/JPEG, com atenção a emendas, areia e texturas de água. Nest_Player e UI_HUD já são pequenos: baixa prioridade. Formato de download não muda por si só a estimativa RGBA8 de GPU.

## Atlases / batching / efeitos

- Já existem folhas para 10 evoluções, 15 ovos, 2 inimigos, 2 ninhos, 3 tiles, UI/HUD. Frames compartilham TextureSource: custo GPU é por folha, não por sprite nem por frame.
- 11 fontes carregadas, centenas de recortes/instâncias não significam centenas de uploads. Mesma nuvem e plantas são reutilizadas.
- Não há BlurFilter, displacement, filtros customizados, pós-processamento, blend modes especiais ou shaders customizados. Há uma máscara Graphics na versão colorida do preview do ninho; foi preservada e sua geometria agora só é refeita ao mudar progresso/fase.
- Seis TilingSprites de chão, Graphics de indicadores/joystick/overlays, textos e sprites intercalados podem criar limites de batch; contagem real depende do backend e dispositivo. Não foi inventado número de draw calls.
- Não existe sorting global por profundidade em cada frame. Ordem de addChild/setChildIndex preserva plantas na frente e ovos atrás dos personagens. Reordenar por textura poderia mudar a aparência.
- Arc do upgrade redesenha enquanto carregando interação; efeito é pequeno e temporário. Overlay de evolução ocupa tela, mas só aparece no evento, sem blur. O ninho não recebe filtro sobre o mundo inteiro.
- Depois de resize autorizado, considerar atlas compacto de props (plantas/base/ninho/nuvem) em até 1024/2048 com padding/extrusão e metadata orig/trim. Não juntar chão de repetição com UI nem criar uma folha gigante. Atlasing sozinho não garante menos draw calls, já que Pixi faz batching de múltiplas texturas.

## PERFORMANCE FINDINGS — ticker, entidades e GC

Um callback de gameplay no app.ticker; retorna durante menu de upgrade/anúncio. Renderer/ticker da aplicação continuam próprios do Pixi.

Sistemas por frame, na ordem geral:

1. Tempo, spawn/alerta da estação, animação de disponibilidade de upgrade.
2. Bob/rotação/escala de nascimento dos ovos ativos e flash de coleta.
3. Movimento/clamp do player, cobertura de 20 arbustos, transição esconder/sair e follow da fila.
4. Idle float/rotação, distância à estação e arco da interação; abertura do menu.
5. Colisão player–ovos e tutoriais; ativação, perseguidor e movimento dos 2 rivais.
6. Depósitos dos rivais, diretor de respawn e roubo de filas.
7. Depósito do player, entregas escalonadas, progressão/moeda/evolução.
8. Câmera/shake/checagem do boot, partículas da evolução, preview e moeda voando.
9. Conversão de coordenadas para indicadores de navegação e posição/rotação na tela.

Não há queries DOM por frame; leituras de window.innerWidth/Height não são buscas DOM. Há temporários de toGlobal/câmera, find/reduce de tutoriais e filter/sort de 2 inimigos; custo baixo comparado ao vazamento anterior. Textos não são recriados no ticker: Text do Pixi 8.20.1 já ignora atribuições iguais, mas isso não evitava strings, sorting e Graphics.clear. Cache aplicado corta esse trabalho antes de entrar no setter.

### Fila ilimitada — análise 10/20/30/50

| Ovos Q | Sprites/containers da fila | Follow normal | Consulta antiga durante hide (pior limite Q²) | Agora | Duração depósito |
|---:|---|---|---:|---|---:|
| 10 | 10 + 10 | O(10) | até 100 comparações | O(10) | 1,015 s |
| 20 | 20 + 20 | O(20) | até 400 | O(20) | 1,565 s |
| 30 | 30 + 30 | O(30) | até 900 | O(30) | 2,115 s |
| 50 | 50 + 50 | O(50) | até 2.500 | O(50) | 3,215 s |

O limite Q² é conservador: some para cedo ao achar o item. Após patch, Set acompanha precisamente início/fim/release da animação. Não há sorting nem listeners por ovo. Cada ovo atualiza transform/interpolação; roubo varre fila por rival O(2Q). Depósito e moeda continuam proporcionais a Q; 50 moedas são 50 Graphics temporários, últimos terminam ~4,62 s após início do efeito. Fila ilimitada inevitavelmente permite custo ilimitado em sessões extremas; não impusemos limite visual/gameplay.

### Ovos do mapa

Alvo 20, timer acumulado no ticker, respawn 2–5 s, até 24 tentativas por spawn. Não há setInterval por ovo. Bob/rotação continuam iguais. eggs agora contém apenas objetos vivos (mapa, filas e depósitos), não histórico já entregue. Reserva de até 20 containers reaproveita Sprite e reseta textura, visibilidade, posição, escala e rotação do filho. Remoção não destrói atlas compartilhado. Não foi alterada a distribuição original de zonas.

### AI / colisões

Dois rivais; busca de ovo linear só quando alvo falta/foi invalidado. Movimento segue o alvo; não há pathfinding. Cobertura de arbustos é principalmente do player. Player–ovos O(E), player–arbustos O(20), roubos O(2Q), bases/upgrade O(1). Não há todos-contra-todos geral. Broad phase/grid/quadtree não se justifica com esta população. Reduzir updates de inimigos distantes alteraria coleta/ranking; mantido.

### Objetos temporários / listeners

22 Graphics por evolução, destruídos ao final (evento raro, até 9 evoluções). Q Graphics de moeda por depósito, destruídos ao terminar. Há listeners de resize para UI/cobertura/overlay, e joystick registrados uma vez no bootstrap. Não há reinicialização/teardown de jogo no produto atual: sem crescimento por frame de listeners. Uma futura opção de reiniciar aplicação precisa remover listeners e destruir app. Timer de timeout do SDK permanece no máximo 3 s; não é vazamento contínuo.

## Áudio / fontes / cache

- Nenhum áudio, música, codec/bitrate/duração a auditar; nenhum loader de áudio.
- Nenhum arquivo de fonte. Pixi Text usa Arial 700/900; CSS Inter com fallback system-ui/sans-serif, sem @font-face ou download. WOFF2 não traria economia aqui.
- Cada imagem carregada uma vez via Assets.load; recortes compartilham source. Cache do Pixi preservado, sem unload de fontes vivas. Não existem carregamentos duplicados detectados.
- Cache HTTP/CDN e compressão Brotli/gzip são configuração de hospedagem, não comprovados pelo build local. Assets têm nomes estáveis; ao substituir arquivos na publicação, cuidar de invalidação/versionamento no host.

## Bundle / tree shaking / loading

- Bundler verificado: Vite **6.4.3**, TypeScript, Rollup/esbuild; Pixi instalado **8.20.1** (package.json declara ^8.14.0). Não foi feita atualização de dependência.
- Imports ESM nomeados permitem tree shaking; Pixi declara módulos de registro com sideEffects. Chunks WebGL/WebGPU/Canvas são dependências dinâmicas do autoDetectRenderer; não equivalem a todos baixados no boot. BitmapFont/Filter aparecerem como arquivo não prova uso do recurso no jogo.
- Produção minificada; nenhum .map publicado. Total JS/gzip inclui todos os chunks, e não é medida exata do caminho inicial.
- Não alterados imports para caminhos internos nem removidos backends/fallbacks. Tal alteração só compensa após medir e validar aparelhos alvo. Maior economia está em imagens, não dependências pequenas transitivas.
- **BOOT:** HTML/CSS, JS inicial/renderer detectado, script SDK externo. **GAMEPLAY ESSENTIAL:** chão, player, nuvem, ovos, planta, ninho, HUD, inimigos/ninhos (rivais começam ativos). **SECONDARY/OPTIONAL:** UI de upgrades e sua base; candidato a lazy load. **LATE GAME:** frames de evolução/ovos já embutidos em folhas essenciais; separar exigiria editar spritesheets, não aplicado.
- Assets.load continua em cache e agora usa carregamento concorrente. Não há tela de loading de progresso; bootCover só é criado após assets. Um loader visível desde o HTML é melhoria de UX futura, sem bytes economizados por si só.

## Poki SDK / renderer / mobile

- Preservados init(), gameLoadingFinished(), gameplayStart(), gameplayStop() e commercialBreak(). Anúncios continuam temporariamente comentados, como antes.
- init começa antes dos assets; aguarda SDK com race de até 3 s; loadingFinished após construção da cena; start na primeira entrada do joystick; stop ao abrir upgrades, start ao fechar. Código do adaptador não foi alterado.
- Limites preexistentes: timeout pode permitir loadingFinished antes de init realmente resolver; loadingFinished ocorre antes do primeiro frame renderizado. Não alteramos esse contrato nesta rodada; validar sequência real dentro da Poki antes de reorganizar.
- Renderer: antialias true, resizeTo window, resolution = min(devicePixelRatio, 2), autoDensity não explicitado; CSS já fixa canvas em 100%. DPR 3 fica limitado a 2 (~56% menos pixels que DPR 3), não é ganho novo desta rodada. DPR 2 ainda usa 4× pixels de DPR 1. Não reduzimos qualidade.
- Mobile: texturas (52.17 MiB) + cópias CPU + framebuffer/MSAA + textos podem elevar bastante memória real. Pool/cache reduzem pressão de CPU/GC, mas assets ainda precisam da etapa 2. Não alegamos FPS/thermal/crash corrigidos sem aparelhos e profiling.

## CHANGES APPLIED

| Arquivo | Alteração | Motivo / impacto esperado |
|---|---|---|
| src/main.ts | Pool limitado + release de ovos/mapa de animação | Evitar crescimento com entregas históricas, menos alocação e scans |
| src/main.ts | Estado de UI/preview + remoção de escritas repetidas | Cortar sorting, strings e reconstrução de Graphics sem alteração |
| src/main.ts | Set para ovos em animação | Remover busca quadrática temporária da fila |
| src/main.ts | Busca linear de alvo + contagem sem filter | Menos arrays/sort/GC |
| src/main.ts | Carregamento concorrente, label atual | Menor cadeia de latência; sem mudança de imagem |
| src/assets.ts | Manifesto único dos 11 assets | Loader e publicação concordam |
| vite.config.ts | Emite somente manifesto na produção | Exclui 105.945 bytes de arquivos sem uso, mantendo originais |
| scripts/audit-assets.ps1, audit-build.mjs | Inventário/hash/alpha/dimensões/build | Auditoria reproduzível sem reencode |
| scripts/verify-runtime.mjs | Regressão de lógica com classes Pixi reais e renderer/SDK simulados | Verificar pooling/fila/depósito/cache/referências |
| reports/* | Relatórios e baselines | Comparação e candidatos revisáveis |

## MANUAL APPROVAL REQUIRED — etapa 2

Por instrução explícita do pedido, ficaram apenas reportados: resize dos seis candidatos; conversão/compressão de qualquer imagem; trim da nuvem e frames transparentes; repacking/alteração de spritesheets, offsets e pivots. Gerar derivados e conservar originais. Começar por Plant, UpgradeBase, Enemies e enemyNest; depois ovos/chão; manter player/UI até comparação visual das fases maiores. Nenhuma dessas operações foi executada.

Lazy loading, culling, pool de partículas e imports menores são recomendações técnicas futuras que exigem validação, não foram tratados como aprovação obrigatória de assets.

## VALIDAÇÃO FINAL

- Build de produção antes e depois executada com sucesso: tsc -b + vite build --base ./.
- 11 arquivos emitidos comparados byte a byte com originais; 47 recortes de atlas verificados dentro dos limites. Dimensões fracionárias existentes preservadas.
- Teste headless usa Container/Sprite/Texture/Graphics/Text reais do Pixi; simula Application/Assets/DOM/Poki. Boot e ordem init/loadingFinished/start, 120 ticks, UI sem reconstruir máscara, filas 10/20/30/50, 5.000 ciclos de criação/release, pool ≤20, texturas não destruídas e depósito de 50 ovos creditando 500 moedas passaram.
- Esse teste não decodifica/renderiza imagens numa GPU, não executa SDK remoto nem mede performance real. Há avisos preexistentes do Pixi sobre filhos em Sprite/Graphics. Não foram convertidos em refatoração visual nesta etapa.
- Navegador conectado indisponível: revisão visual de desktop/mobile, FPS/draw calls, network waterfall, memória real e fluxo de anúncios na Poki seguem como validações de dispositivo; não apresentados como concluídos.
- Reproduzir: npm run build; node scripts/audit-build.mjs after; node scripts/verify-runtime.mjs. Inventário: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/audit-assets.ps1. Regenerar relatório: node scripts/write-audit-report.mjs.

## Fontes técnicas

Evidência principal: código local do jogo e Pixi instalado, incluindo AbstractText.mjs (setter com early return), TextureSource.mjs (mipmaps padrão desativados), autoDetectRenderer.mjs (imports dinâmicos) e package.json (exports/sideEffects). Referências oficiais consultadas: [PixiJS: texturas](https://pixijs.com/8.x/guides/components/textures) e [Poki: SDK overview & events](https://developers.poki.com/guide/sdk-overview). Os números deste relatório vêm dos arquivos locais, não de benchmarks dessas páginas.
