/**
 * Roteiro de campo — utilitário puro (sem dependências de servidor/cliente).
 *
 * Arquitetura preparada para mapas: `buildRouteStops()` normaliza os clientes de uma visita em paradas
 * ordenadas com coordenadas opcionais. Hoje a UI apenas lista as paradas; quando houver integração de mapa,
 * o componente de mapa recebe exatamente `RouteStop[]` (ver RouteMapPlaceholder).
 *
 * Ordem: `stop_order` definido manualmente (↑/↓) primeiro; sem ordem, por bairro e depois nome.
 * Coordenadas: as do cliente (customers.latitude/longitude); na falta, as da cidade marcadas como aproximadas.
 */
import type { VisitCustomerStatus } from "@/types/database";

export type LatLng = { lat: number; lng: number };

export type RouteStopInput = {
  visitCustomerId: string;
  customerId: string;
  stopOrder: number | null;
  status: VisitCustomerStatus;
  notes: string | null;
  fullName: string;
  phone: string | null;
  whatsapp: string | null;
  neighborhood: string | null;
  address: string | null;
  reference: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type RouteStop = {
  /** id de visit_customers */
  id: string;
  customerId: string;
  /** posição 1..n na rota */
  position: number;
  status: VisitCustomerStatus;
  notes: string | null;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  neighborhood: string | null;
  address: string | null;
  reference: string | null;
  /** Coordenadas da parada, se conhecidas */
  coords: LatLng | null;
  /** true quando `coords` vem do centro da cidade (cliente sem coordenadas) */
  approximate: boolean;
};

function toCoords(lat: number | string | null | undefined, lng: number | string | null | undefined): LatLng | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { lat: a, lng: b };
}

/** Compara clientes para a rota: ordem manual > bairro > nome. */
export function compareStops(a: RouteStopInput, b: RouteStopInput): number {
  const ao = a.stopOrder ?? Number.POSITIVE_INFINITY;
  const bo = b.stopOrder ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  const an = (a.neighborhood ?? "").trim();
  const bn = (b.neighborhood ?? "").trim();
  if (an !== bn) {
    if (!an) return 1;
    if (!bn) return -1;
    return an.localeCompare(bn, "pt-BR", { sensitivity: "base" });
  }
  return a.fullName.localeCompare(b.fullName, "pt-BR", { sensitivity: "base" });
}

export function buildRouteStops(
  customers: RouteStopInput[],
  cityCenter?: { latitude: number | string | null; longitude: number | string | null } | null,
): RouteStop[] {
  const fallback = cityCenter ? toCoords(cityCenter.latitude, cityCenter.longitude) : null;
  return [...customers].sort(compareStops).map((c, i) => {
    const own = toCoords(c.latitude, c.longitude);
    return {
      id: c.visitCustomerId,
      customerId: c.customerId,
      position: i + 1,
      status: c.status,
      notes: c.notes,
      name: c.fullName,
      phone: c.phone,
      whatsapp: c.whatsapp,
      neighborhood: c.neighborhood,
      address: c.address,
      reference: c.reference,
      coords: own ?? fallback,
      approximate: !own && Boolean(fallback),
    };
  });
}

/** Move a parada `id` uma posição para cima (-1) ou para baixo (+1). Retorna a nova ordem de ids. */
export function moveStop(ids: string[], id: string, direction: -1 | 1): string[] {
  const idx = ids.indexOf(id);
  const target = idx + direction;
  if (idx < 0 || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}
