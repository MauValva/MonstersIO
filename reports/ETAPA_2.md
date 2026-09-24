# Monster.IO — etapa 2: assets e carregamento

22/09/2026. Esta etapa usou a auditoria existente, sem repeti-la. Seis derivados PNG foram adotados em sequência: quatro props/personagens, depois ovos e chão. Todos os originais permanecem intactos em public/assets/Arts; hashes SHA-256 conferidos. Player_EvoMonster, UI_HUD, UI_Upgrades, PlayerCloud e Nest_Player não foram regravados nem convertidos.

## BEFORE / AFTER

| Medida | Antes da etapa 2 | Depois |
|---|---:|---:|
| Build completa em dist | 13.584 MB | **6.876 MB** |
| Imagens publicadas | 12.954 MB | 6.245 MB |
| JS, todos os chunks | 0.628 MB | 0.630 MB |
| Texturas RGBA8, todas as imagens | 52.17 MiB | **23.94 MiB** |
| Imagens no caminho crítico de boot | 11 / 12.954 MB | **9 / 5.041 MB** |
| Texturas das imagens de boot, antes do preload | 52.17 MiB | 17.40 MiB |

MB decimal; MiB binário. GPU é largura×altura×4 por fonte inteira, incluindo padding; não é VRAM medida. Não inclui buffers do renderer, textos, caches e cópias CPU. Assets carregados, mas ainda invisíveis, podem só ser enviados à GPU quando usados. Lazy loading adia trabalho/bytes; não elimina os assets do pacote final.

## SAVINGS

- Build completa: **6.708 MB / 49.4%** a menos.
- Imagens ao longo da partida: **6.709 MB / 51.8%** a menos.
- Imagens necessárias antes do primeiro gameplay: **7.913 MB / 61.1%** a menos.
- GPU teórica de todas as imagens: **28.23 MiB / 54.1%** a menos.
- Os quatro primeiros assets sozinhos economizam **20.89 MiB**, já próximos da meta de ~21 MiB. Ovos e chão levam o total para ~24 MiB.
- Tempo real de download, FPS e VRAM não foram cronometrados em navegador/dispositivo. A redução de bytes e dimensões é medida em arquivos; o ganho de tempo depende da rede e decodificação.

## Medições por grupo

Cada linha abaixo corresponde a uma build de produção executada com sucesso antes de seguir ao grupo seguinte.

| Etapa | Build | Texturas RGBA8 |
|---|---:|---:|
| Antes da etapa 2 | 13.584 MB | 52.17 MiB |
| Depois dos 4 assets | 8.413 MB | 31.28 MiB |
| Depois dos ovos | 7.472 MB | 26.90 MiB |
| Depois do chão | 6.875 MB | 23.94 MiB |
| Final, com lazy loading | 6.876 MB | 23.94 MiB total; 17.40 MiB no boot |

Dados completos: [metrics.json](stage2/metrics.json), [quatro assets](build-stage2-props.json), [ovos](build-stage2-eggs.json), [chão](build-stage2-ground.json), [final](build-stage2-final.json). O baseline da etapa 1 foi preservado em stage2/baseline/build-after.json.

## MODIFIED ASSETS — derivados, não originais

| Original em Arts | Resolução original | Novo PNG em Optimized | Disco original → novo | GPU original → nova | Compensação |
|---|---:|---|---:|---:|---|
| Enemy/Enemies.png | 1774×887 | 520×260; conteúdo 256×256/frame | 1.549 MB → 0.178 MB | 6.00 MiB → 0.52 MiB | width/height 112×112 mantidos; anchor 0,5; escala de progressão inalterada |
| Environment/Plant.png | 1322×1190 | 512×461; conteúdo 512×461/frame | 0.872 MB → 0.168 MB | 6.00 MiB → 0.90 MiB | width/height aleatórios originais mantidos, inclusive flip e progressão; dados de ocultação intactos |
| Environment/UpgradeBase.png | 1269×1240 | 384×375; conteúdo 384×375/frame | 1.478 MB → 0.181 MB | 6.00 MiB → 0.55 MiB | 172×175 unidades mantidos, inclusive após binding assíncrono; trigger inalterado |
| Environment/enemyNest.png | 1774×887 | 776×388; conteúdo 384×384/frame | 2.317 MB → 0.519 MB | 6.00 MiB → 1.15 MiB | scale = 887×0,26/384 = 0,6005729167; tamanho continua 230,62×230,62 no mundo |
| Eggs/spr_Eggs.png | 1774×887 | 920×462; conteúdo 180×150/frame | 1.360 MB → 0.418 MB | 6.00 MiB → 1.62 MiB | scale do sprite × (354,8/180) = ×1,9711111111; escala do container/fila intacta |
| Environment/Tile_Ground_V2.png | 2172×724 | 1548×516; conteúdo 512×512/frame | 1.648 MB → 1.051 MB | 6.00 MiB → 3.05 MiB | tileScale ×724/512 = ×1,4140625; largura de margem continua 275,12 unidades |

### Método e proteção de frames

- Sharp/libvips, kernel **Lanczos3**, alpha pré-multiplicado durante a reamostragem; PNG truecolor/alpha sem quantização de paleta. Nenhum nearest-neighbor, JPEG ou WebP lossy foi usado.
- Frames de Enemies/enemyNest foram extraídos e reduzidos isoladamente. O conteúdo útil soma 512×256 e 768×384, respectivamente; padding de 2 px em cada lado de cada frame produz os arquivos finais **520×260** e **776×388**. As bordas extrudadas evitam interpolação com o frame vizinho, sem reduzir o conteúdo alvo.
- Plant 512×461 e UpgradeBase 384×375 usam o arredondamento de dimensões indicado; variação de aspect ratio de raster inferior a 0,1%. O tamanho/proporção no mundo continua definido pelas mesmas width/height de antes.
- Ovos: conteúdo de 15 frames **180×150**, grade 5×3. Com padding, pitch de cada célula **184×154**, atlas **920×462**. Coordenadas de origem/destino no novo atlas são inteiras. Recortes da origem usam limites de pixel arredondados por célula (erro máximo 0,4 px de origem), isolados antes do resize; tamanho lógico usa o grid original 354,8×295,666… . Isso evita contaminação pelo ovo vizinho sem manter recortes fracionários no novo atlas.
- Chão: conteúdo dos 3 frames **512×512**, total útil 1536×512; atlas com guardas **1548×516**. Cada tile foi filtrado no centro de uma repetição 3×3 de si mesmo, sem misturar água/grama/margem de células vizinhas. Guardas usam borda periódica. Não houve redesenho das artes.
- Todos os 42.680 pixels de guarda foram comparados com sua origem esperada; frames do novo atlas verificados como inteiros. A GPU estimada inclui os pixels extras de guarda.

### Equivalência de escala

- Ninho rival: antes 887×0,26 = **230,62** unidades; depois 384×0,6005729167 = **230,62**. Anchor 0,5 e posição preservados.
- Ovo, escala base: antes 354,8×0,19 = **67,412** unidades de largura; depois 180×(0,19×1,9711111111) = **67,412**. Mesma equivalência vertical. Multiplicadores de spawn/progressão, fila e rivais permanecem iguais.
- Repetição do chão: antes 724×0,42 = **304,08** unidades; depois 512×0,59390625 = **304,08**. Margens: antes 724×0,38 = **275,12**; depois 512×0,53734375 = **275,12**. Câmera 0,64 preservada.
- Enemies continuam 112×112 antes da escala de progressão; UpgradeBase 172×175. Plantas preservam as dimensões sorteadas, flip, posição e dimensões usadas em getBushCover.
- Snapshot determinístico compara geometria anterior e nova em todas as 10 fases, tolerância de 1e-8: player, inimigos, ninhos, planta/ocultação, base, ovos no spawn/progressão e repetição/margens. Passou.

## WEBP TEST — não adotado nesta rodada

Os WebP estão apenas em reports/stage2/comparisons; não entram em public, no manifesto nem em dist. O jogo usa os PNGs otimizados. Recomendação: a economia lossless foi relevante nos seis derivados; pode ser adotada numa próxima troca de formato após smoke test dos aparelhos alvo.

| Derivado | PNG bytes | WebP lossless bytes | Economia adicional | Pixels visíveis diferentes / alpha diferente |
|---|---:|---:|---:|---:|
| Enemies.png | 177.870 | 132.944 | 25.3% | 0 / 0 |
| Plant.png | 168.387 | 117.894 | 30.0% | 0 / 0 |
| UpgradeBase.png | 180.743 | 140.360 | 22.3% | 0 / 0 |
| enemyNest.png | 518.602 | 409.622 | 21.0% | 0 / 0 |
| spr_Eggs.png | 418.381 | 314.466 | 24.8% | 0 / 0 |
| Tile_Ground_V2.png | 1.050.537 | 739.820 | 29.6% | 0 / 0 |

Somados: **2.515 MB PNG → 1.855 MB WebP**, potencial adicional de **0.659 MB / 26.2%**. Igualdade verificada após decodificar PNG e WebP: alpha idêntico e RGB idêntico onde alpha > 0. RGB de pixels totalmente transparentes não afeta o resultado visual. Comparação é contra o PNG reduzido, não contra o original de alta resolução.

## Validação visual disponível / VISUAL RISKS

Inspecionadas comparações lado a lado do original reduzido diretamente ao tamanho de tela e do derivado no mesmo tamanho, sobre fundo escuro. Mantêm leitura, cores, formas e tamanho; não observada perda relevante nessas provas. As imagens são referências por composição em software, **não screenshots do renderer do jogo**.

| Asset | Quadro da prova em pixels físicos (~DPR 2) | Maior MAE médio por frame (RGB sobre fundo) | Prova |
|---|---:|---:|---|
| enemy | 166×166 | 0.853/255 | [comparação](stage2/comparisons/enemy.png) |
| plant | 348×348 | 0.485/255 | [comparação](stage2/comparisons/plant.png) |
| upgradeBase | 220×224 | 0.749/255 | [comparação](stage2/comparisons/upgradeBase.png) |
| enemyNest | 296×296 | 0.789/255 | [comparação](stage2/comparisons/enemyNest.png) |
| eggs | 140×117 | 0.585/255 | [comparação](stage2/comparisons/eggs.png) |
| ground | 390×390 | 0.329/255 | [comparação](stage2/comparisons/ground.png) |

MAE é só diagnóstico da prova: mede diferenças causadas por reamostragem em duas etapas e não constitui garantia de percepção ou um benchmark de GPU. Ovos foram comparados em até 140×117 para cobrir spawn nas fases maiores; as 15 variantes estão na prova.

As repetições de chão antes/depois também foram inspecionadas. Existem descontinuidades artísticas preexistentes, especialmente na água; elas permanecem. Não surgiram linhas brancas/pretas nas composições de referência. A margem não deve repetir horizontalmente no jogo; a prova 3×3 expõe ambas as direções para comparação.

| Tile | Diferença RGB entre bordas esquerda/direita (antes → depois) | topo/base (antes → depois) | Prova |
|---|---:|---:|---|
| grama | 14.22 → 13.92 | 0.05 → 0.06 | [repetição 3×3](stage2/comparisons/ground-repeat-0.png) |
| margem | 81.09 → 79.28 | 5.58 → 5.48 | [repetição 3×3](stage2/comparisons/ground-repeat-1.png) |
| água | 11.14 → 10.84 | 7.09 → 6.99 | [repetição 3×3](stage2/comparisons/ground-repeat-2.png) |

Essa métrica mede a diferença entre bordas, não quantidade de seams. Ainda requer validação visual manual dentro do jogo em WebGL/mobile: câmera em movimento, margens/cantos e água, minificação dos inimigos/ninhos, arbustos escondendo filas, todas as variantes de ovos e abertura do upgrade. Nenhum navegador conectado estava disponível nesta sessão. Não afirmar equivalência visual absoluta sem esse teste. Mantivemos todos os originais e reversão individual justamente para acomodar essa validação.

## Lazy loading do upgrade

- Boot aguarda **9** imagens essenciais. **UI_Upgrades original + UpgradeBase otimizado** (1.204 MB) começam a carregar na primeira entrada de gameplay; não bloqueiam o início da partida nem PokiSDK.gameplayStart.
- src/upgrade-assets.ts mantém uma Promise compartilhada da transação e promises individuais. Chamadas simultâneas usam a mesma operação; tentativas seguintes reaproveitam recursos concluídos/em andamento pelo loader e cache do Pixi. Só o pedido que falhou é refeito.
- A UI é montada com source geométrica sem bitmap; painel e estação ficam invisíveis até os dois assets estarem prontos. Frames são ligados à textura real e a base mantém 172×175. O placeholder é destruído depois do binding.
- A estação continua dependendo da segunda evolução. Se chegar nesse ponto com download pendente, mostra estado de carregamento; se falhar, mostra “Upgrades unavailable. Tap to retry.”. O jogo continua, sem painel com arte faltando. A tentativa manual compartilha a mesma Promise, e a estação aparece quando ambas as artes estiverem prontas.
- Testados: preload sem desbloqueio antecipado, concorrência, cache, falha enquanto o outro recurso está pendente, duas falhas consecutivas na integração e recuperação pelo retry. UI não aparece incompleta; recurso já concluído não é baixado de novo.
- Eventos e adaptador Poki preservados. AI, velocidades, spawns, progressão, quantidades, câmera, level design e triggers não foram alterados. Em rede lenta/falha, a disponibilidade visual do upgrade fica condicionada à conclusão do download, conforme requisito de carregamento seguro.

## PlayerCloud — correção da análise e proposta, não executada

**A estimativa anterior de 136×82 / 91,5% estava incorreta.** A análise da etapa 1 desenhou a imagem com GDI antes de ler alpha; o PNG tem metadado de 300 DPI e foi implicitamente escalado para ~32% nessa cópia. O arquivo não mudou: hash continua o mesmo. Nesta etapa, leitura direta dos pixels RGBA encontrou:

- Arquivo: **512×256**.
- Bounding box alpha > 0: **x=44, y=0, largura=424, altura=256**.
- Crop exato possível: 424×256, economia **17,1875% / 0,086 MiB**, e não 91,5%.
- Com guarda de 2 px em atlas: 428×260, economia ~15,1% / 0,076 MiB.

Proposta para uma etapa futura: copiar o retângulo (44,0,424,256) sem resize, extrudar 2 px e usar metadados de trim do Pixi. Exemplo de textura, **somente proposta**:

~~~ts
new Texture({
  source: croppedCloudSource, // hipotético bitmap 428×260, com guarda de 2 px
  frame: new Rectangle(2, 2, 424, 256),
  orig: new Rectangle(0, 0, 512, 256),
  trim: new Rectangle(44, 0, 424, 256),
});
~~~

Manter anchor (0,5,0,5), pivot, posições e width/height atuais. orig conserva o tamanho lógico 512×256; trim recoloca a arte 44 px à direita dentro desse quadro. Para o player com width=118×fase, o limite esquerdo continua (44−256)×118×fase/512; y continua (0−128)×59×fase/256 + 52×fase. Para rivais, aplicar as dimensões já existentes 124×62 e posição y=48, seguidas da escala do container. Assim não é preciso mover personagens nem alterar nuvens individualmente. O crop simétrico preserva o centro, e os metadados mantêm a referência exata de anchor/pivot.

Não geramos derivado nem alteramos PlayerCloud. Dado o ganho corrigido pequeno, prioridade inferior a adotar os WebP lossless já comparados. [Medição direta](stage2/cloud-analysis.json).

## Arquivos / reversão

- Derivados: public/assets/Optimized/*.png. Originais: public/assets/Arts, inalterados.
- src/assets.ts mantém ORIGINAL_ASSETS e seis overrides em GAME_ASSETS. Para reverter um asset, remover somente seu override (ou apontá-lo a ORIGINAL_ASSETS.chave) e executar build. gridTextures reconhece o caminho original sem padding; compensações de escala são calculadas pela resolução carregada.
- src/art-textures.ts concentra recortes com guardas. src/main.ts compensa escala e integra carregamento adiado. src/upgrade-assets.ts contém a Promise compartilhada.
- Sharp é dependência **de desenvolvimento**, usada somente no pipeline; não entra no bundle de runtime. package-lock atualizado; nenhuma atualização de Pixi/Vite foi solicitada ou aplicada.
- stage2/baseline contém snapshots anteriores de main.ts, assets.ts, package.json/lock e métricas. São referência/reversão, não entram na publicação.
- reports/OTIMIZACAO.md e seus baselines continuam como histórico da etapa 1. A seção de PlayerCloud deste relatório substitui a estimativa antiga de trim.

## Validação final

- Builds de produção dos quatro assets, ovos, chão e final: **passaram** (TypeScript + Vite).
- Hashes de todos os originais preservados; conteúdo dos 11 assets emitidos corresponde ao manifesto.
- **47** recortes em limites válidos; frames otimizados inteiros; **42.680** pixels de borda verificados.
- Geometria anterior/depois nas 10 fases passou; regressões de filas 10/20/30/50, 5.000 ciclos e depósito de 50 ovos/500 moedas passaram.
- Lazy loader: sucesso, chamadas concorrentes, falha/retry, sucesso parcial e ausência de pedidos duplicados passaram.
- Avisos preexistentes do Pixi sobre filhos em Sprite/Graphics permanecem; não refatorados fora deste escopo.
- Pendente: teste visual em navegador/mobile real e validação do SDK no ambiente Poki. Não foram medidos FPS, VRAM real nem tempo real de primeiro frame.

Reprodução: npm run build; node scripts/verify-runtime.mjs; node scripts/verify-runtime.mjs --upgrade-failure; node scripts/verify-upgrade-loader.mjs; node scripts/verify-art.mjs. Derivados: node scripts/optimize-art.mjs props, depois eggs, depois ground. Métricas finais: node scripts/audit-build.mjs stage2-final; node scripts/write-stage2-report.mjs.

## NEXT RECOMMENDATIONS

1. Testar a build atual nos dispositivos alvo, com foco nos riscos visuais listados. Reverter individualmente qualquer derivado que não passe.
2. Considerar a troca dos seis derivados para WebP lossless: potencial adicional de 0.659 MB, sem mudar sua estimativa GPU. Não executada nesta etapa.
3. Manter Player_EvoMonster, HUD, UI_Upgrades e Nest_Player nas versões atuais. PlayerCloud só após avaliar o ganho corrigido pequeno e aprovar o trim com metadados.

Referências de implementação: [Sharp resize/Lanczos](https://sharp.pixelplumbing.com/api-resize/), [Sharp output/lossless WebP](https://sharp.pixelplumbing.com/api-output/) e [Pixi Texture/frame/orig/trim](https://pixijs.com/8.x/guides/components/textures). Os números são medições locais dos arquivos, não promessas dessas fontes.
