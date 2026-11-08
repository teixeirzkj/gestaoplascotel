import { ContactRound } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatDateTime, formatPhone } from "@/lib/format";
import type { CustomerView } from "@/types/database";

function Row({ label, value, multiline }: { label: string; value: string | null | undefined; multiline?: boolean }) {
  return (
    <dl className="py-2.5">
      <dt className="text-[12px] font-medium text-fg-muted">{label}</dt>
      <dd className={multiline ? "mt-0.5 whitespace-pre-line break-words text-[14px] text-fg" : "mt-0.5 break-words text-[14px] text-fg"}>
        {value && value.trim() ? value : <span className="text-fg-subtle">Não informado</span>}
      </dd>
    </dl>
  );
}

/** Dados pessoais, endereço e referência do cliente. */
export function CustomerDetailsCard({ customer: c }: { customer: CustomerView }) {
  const city = c.city_name ? `${c.city_name}${c.city_state ? `/${c.city_state}` : ""}` : null;
  return (
    <Card>
      <CardHeader title="Dados do cliente" icon={<ContactRound className="h-4 w-4" />} />
      <CardBody className="pt-2 sm:pt-2">
        <div className="divide-y divide-line">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-line">
            <Row label="Telefone" value={c.phone ? formatPhone(c.phone) : null} />
            <Row label="WhatsApp" value={c.whatsapp ? formatPhone(c.whatsapp) : null} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-line">
            <Row label="Cidade" value={city} />
            <Row label="Bairro" value={c.neighborhood} />
          </div>
          <Row label="Endereço" value={c.address} />
          <Row label="Referência" value={c.reference} />
          {c.notes && <Row label="Observação do cadastro" value={c.notes} multiline />}
          <Row label="Cadastrado em" value={formatDateTime(c.created_at)} />
        </div>
      </CardBody>
    </Card>
  );
}
