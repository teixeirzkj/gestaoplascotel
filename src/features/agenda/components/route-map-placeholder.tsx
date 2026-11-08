import { Map as MapIcon, MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LatLng, RouteStop } from "../route";

/**
 * Espaço reservado para o mapa do roteiro.
 *
 * Interface (estável — o componente de mapa real deve aceitar as mesmas props):
 * - `stops`: paradas já ordenadas por `buildRouteStops()` (src/features/agenda/route.ts).
 *   Cada parada tem `position` (1..n), `coords` ({lat,lng} | null) e `approximate`
 *   (true quando a coordenada é o centro da cidade porque o cliente não tem latitude/longitude).
 * - `center`: centro sugerido (normalmente cities.latitude/longitude) ou null.
 * - `onSelectStop`: chamado com o id da parada (visit_customers.id) ao tocar num marcador.
 *
 * Nenhuma biblioteca de mapas é carregada hoje; o componente mostra a cobertura de coordenadas
 * para orientar o preenchimento de latitude/longitude nos cadastros.
 */
export type RouteMapProps = {
  stops: RouteStop[];
  center?: LatLng | null;
  onSelectStop?: (stopId: string) => void;
  className?: string;
};

export function RouteMapPlaceholder({ stops, center, className }: RouteMapProps) {
  const exact = stops.filter((s) => s.coords && !s.approximate).length;
  const approx = stops.filter((s) => s.approximate).length;
  const missing = stops.length - exact - approx;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-bg-elevated px-4 py-4 sm:px-5",
        "bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.06)_1px,transparent_0)] bg-[length:18px_18px]",
        className,
      )}
      role="note"
      aria-label="Mapa do roteiro (em breve)"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bronze-soft text-bronze">
          <MapIcon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-fg">Mapa do roteiro em breve</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">
            {stops.length === 0
              ? "Sem paradas para exibir."
              : `${stops.length} ${stops.length === 1 ? "parada" : "paradas"}: ${exact} com localização exata${approx ? `, ${approx} pelo centro da cidade` : ""}${missing ? `, ${missing} sem localização` : ""}.`}
          </p>
          {missing > 0 && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-fg-subtle">
              <MapPinOff className="h-3.5 w-3.5" aria-hidden />
              Use “Abrir no mapa” em cada parada para navegar pelo endereço.
            </p>
          )}
          {center && (
            <p className="tabular mt-1 text-[11.5px] text-fg-subtle">
              Centro: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
