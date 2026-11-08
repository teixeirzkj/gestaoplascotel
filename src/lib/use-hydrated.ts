"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false no servidor e durante a hidratação; true depois que o app está interativo.
 * Uso: `initial={useEnterInitial()}` — conteúdo renderizado no servidor aparece imediatamente
 * (sem ficar em opacity:0 até o JS carregar), e o que monta depois (navegação, abas, listas
 * filtradas, modais) mantém a animação de entrada.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** Valor para a prop `initial` de componentes motion com variants "hidden"/"show". */
export function useEnterInitial(): "hidden" | false {
  return useHydrated() ? "hidden" : false;
}
