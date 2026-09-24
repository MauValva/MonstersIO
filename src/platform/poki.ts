/**
 * Adaptador opcional para o Poki SDK.
 * O jogo continua funcionando normalmente fora da plataforma Poki.
 */
type PokiSdk = {
  init?: () => Promise<unknown>;
  gameLoadingFinished?: () => void;
  gameplayStart?: () => void;
  gameplayStop?: () => void;
  commercialBreak?: () => Promise<unknown>;
};

declare global {
  interface Window {
    PokiSDK?: PokiSdk;
  }
}

export const poki = {
  async init() {
    try {
      const sdkInit = window.PokiSDK?.init?.();
      if (!sdkInit) return false;

      await Promise.race([
        sdkInit,
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 3000);
        }),
      ]);
      return true;
    } catch {
      return false;
    }
  },
  loadingFinished() {
    window.PokiSDK?.gameLoadingFinished?.();
  },
  gameplayStart() {
    window.PokiSDK?.gameplayStart?.();
  },
  gameplayStop() {
    window.PokiSDK?.gameplayStop?.();
  },
  async commercialBreak() {
    try {
      await window.PokiSDK?.commercialBreak?.();
    } catch {
      // O jogo deve continuar mesmo se o SDK não estiver disponível.
    }
  },
};
