# Monster.IO — port Pixi.js

Protótipo jogável em Vite + TypeScript + Pixi.js, criado separado dos scripts Unity existentes.

## Rodar

```bash
npm install
npm run dev
```

## Build para publicação

```bash
npm run build
```

O conteúdo de `dist/` é o build estático para hospedagem. A integração opcional com o Poki SDK está isolada em `src/platform/poki.ts`; o jogo continua funcionando sem o SDK no desenvolvimento.

## Mecânicas incluídas

- movimentação exclusivamente por joystick digital virtual;
- suporte responsivo para desktop e mobile;
- coleta de ovos espalhados pelo mapa;
- transporte dos ovos até a base;
- evolução por quantidade de ovos entregues;
- desbloqueio visual de skins/evoluções;
- câmera acompanhando o jogador;
- placeholders desenhados em Pixi.js, prontos para substituição por sprites.
