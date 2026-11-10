import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { OptOutToggle } from "./opt-out-toggle";

/** Ficha do cliente: recebe ou não mensagens de cobrança pelo WhatsApp. */
export async function MessagesOptOutCard({ customerId }: { customerId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("messages_opt_out, messages_opt_out_reason, messages_opt_out_at")
    .eq("id", customerId)
    .maybeSingle();
  if (!data) return null;
  return (
    <OptOutToggle
      customerId={customerId}
      optOut={data.messages_opt_out}
      detail={data.messages_opt_out ? [data.messages_opt_out_reason, data.messages_opt_out_at ? `desde ${formatDateTime(data.messages_opt_out_at)}` : null].filter(Boolean).join(" · ") : null}
    />
  );
}
