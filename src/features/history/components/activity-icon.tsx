import { createElement } from "react";
import { activityIcon } from "../constants";

/** Ícone da ação registrada (estável: resolve o componente do mapa estático). */
export function ActivityIcon({ action, entityType, className }: { action: string; entityType: string | null; className?: string }) {
  return createElement(activityIcon(action, entityType), { className, "aria-hidden": true });
}
