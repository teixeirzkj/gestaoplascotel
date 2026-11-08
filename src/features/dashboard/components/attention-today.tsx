import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { getAttentionToday } from "../queries";
import { SeeAllLink, safeLoad } from "./section";
import { SectionError } from "./section-error";
import { AttentionList } from "./attention-list";

/** Itens mostrados no desktop (lg+). */
const LIMIT = 8;
/** Itens mostrados no celular/tablet: mantém as Ações rápidas perto dos KPIs. */
const MOBILE_LIMIT = 3;

/**
 * Lista completa de "Atenção hoje" na central de cobranças.
 * A aba `atencao` é atendida por /cobrancas; enquanto ela não existir, o parâmetro cai na aba
 * padrão "Todas", que contém todas as parcelas em aberto agregadas aqui.
 */
export const ATTENTION_FULL_HREF = "/cobrancas?aba=atencao";

/** "Atenção hoje": clientes que precisam de ação no dia, agrupados e ordenados por urgência. */
export async function AttentionToday() {
  const res = await safeLoad(() => getAttentionToday(LIMIT));
  if (!res.ok) return <SectionError title="Atenção hoje indisponível" />;
  const { items, total } = res.data;
  const totalLabel = `${total} ${total === 1 ? "cliente" : "clientes"}`;
  const mobileShown = Math.min(items.length, MOBILE_LIMIT);

  return (
    <Card className="min-w-0 overflow-hidden border-bronze/25">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
            {total > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bronze opacity-50" />}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-bronze" />
          </span>
          <h2 className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.06em] text-fg sm:tracking-[0.12em]">Atenção hoje</h2>
          {total > 0 && (
            <span
              className="tabular shrink-0 whitespace-nowrap rounded-full bg-bronze-soft px-2 py-0.5 text-[12px] font-semibold text-bronze"
              title={totalLabel}
            >
              {total}
              {/* Abaixo de 400px só o número aparece; a palavra continua para leitores de tela. */}
              <span className="max-[400px]:sr-only"> {total === 1 ? "cliente" : "clientes"}</span>
            </span>
          )}
        </div>
        {total > 0 && <SeeAllLink href={ATTENTION_FULL_HREF} />}
      </div>

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Tudo em dia por hoje"
          description="Nenhuma cobrança vencendo, atraso, promessa ou pagamento aguardando confirmação."
        />
      ) : (
        <>
          <AttentionList items={items} mobileLimit={MOBILE_LIMIT} />
          {/* Sem border-t: o último item visível no celular já tem a divisória da lista (divide-y). */}
          {total > mobileShown && (
            <div className="px-4 py-3 text-center sm:px-5 lg:hidden">
              <SeeAllLink href={ATTENTION_FULL_HREF} label={`Ver mais ${total - mobileShown} na página de cobranças`} />
            </div>
          )}
          {total > items.length && (
            <div className="hidden border-t border-line px-4 py-3 text-center sm:px-5 lg:block">
              <SeeAllLink href={ATTENTION_FULL_HREF} label={`Ver mais ${total - items.length} na página de cobranças`} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
