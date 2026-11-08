import type { InstallmentView, VisitCustomerStatus, VisitStatus } from "@/types/database";

export type CityOption = { id: string; name: string; state: string };

/** Visita resumida para listas, calendário e histórico */
export type VisitSummary = {
  id: string;
  cityId: string;
  cityName: string;
  cityState: string;
  visitDate: string;
  visitTime: string | null;
  notes: string | null;
  status: VisitStatus;
  total: number;
  attended: number;
};

/** Cliente sugerido por customers_to_visit (para pré-seleção ao agendar) */
export type VisitCandidate = {
  customerId: string;
  fullName: string;
  neighborhood: string | null;
  balance: number;
  overdueAmount: number;
  needsVisit: boolean;
  reason: string;
  /** pré-marcado: em atraso ou pediu visita presencial */
  preselect: boolean;
};

/** Demais clientes ativos da cidade */
export type CityCustomerOption = {
  customerId: string;
  fullName: string;
  neighborhood: string | null;
  balance: number;
};

export type VisitCandidates = { suggested: VisitCandidate[]; others: CityCustomerOption[] };

/** Cliente dentro do detalhe da visita */
export type VisitCustomerDetail = {
  id: string;
  customerId: string;
  status: VisitCustomerStatus;
  notes: string | null;
  stopOrder: number | null;
  updatedAt: string;
  fullName: string;
  phone: string | null;
  whatsapp: string | null;
  neighborhood: string | null;
  address: string | null;
  reference: string | null;
  latitude: number | null;
  longitude: number | null;
  balance: number;
  overdueAmount: number;
  reason: string | null;
  /** Parcela em aberto mais antiga (para "Receber" / "Adiar") */
  oldestOpen: InstallmentView | null;
  openCount: number;
};

export type VisitDetail = {
  id: string;
  cityId: string;
  cityName: string;
  cityState: string;
  cityLatitude: number | null;
  cityLongitude: number | null;
  visitDate: string;
  visitTime: string | null;
  notes: string | null;
  status: VisitStatus;
  createdAt: string;
  createdByName: string | null;
  customers: VisitCustomerDetail[];
};

/** Visita no roteiro do dia */
export type RouteVisit = {
  id: string;
  cityId: string;
  cityName: string;
  cityState: string;
  cityLatitude: number | null;
  cityLongitude: number | null;
  visitTime: string | null;
  status: VisitStatus;
  notes: string | null;
  customers: VisitCustomerDetail[];
};

/** Cidade com necessidade de visita e sem visita futura agendada */
export type CityNeedingVisit = {
  cityId: string;
  cityName: string;
  cityState: string;
  overdue: number;
  overdueCustomers: number;
  visitRequests: number;
  lastVisitDate: string | null;
};
