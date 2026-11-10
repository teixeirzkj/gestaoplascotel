import { z } from "zod";
import { formatBRL, formatDate } from "@/lib/format";
import { normalizePixKey } from "@/lib/pix";

/** Etapas do calendário de cobrança, em ordem de prioridade (a mais urgente primeiro). */
export const MESSAGE_KINDS = ["promise", "overdue_15", "overdue_7", "overdue_3", "due_today", "before_due", "thanks"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const KIND_META: Record<MessageKind, { label: string; short: string; tone: "danger" | "warning" | "info" | "success" | "brand"; section: string }> = {
  promise: { label: "Promessa de pagamento para hoje", short: "Promessa hoje", tone: "brand", section: "Promessas para hoje" },
  overdue_15: { label: "Atraso de 15 dias ou mais", short: "Atraso 15+ dias", tone: "danger", section: "Em atraso" },
  overdue_7: { label: "Atraso de 7 dias ou mais", short: "Atraso 7+ dias", tone: "danger", section: "Em atraso" },
  overdue_3: { label: "Atraso de 3 dias ou mais", short: "Atraso 3+ dias", tone: "warning", section: "Em atraso" },
  due_today: { label: "Vence hoje", short: "Vence hoje", tone: "warning", section: "Vencem hoje" },
  before_due: { label: "Lembrete antes do vencimento", short: "Lembrete", tone: "info", section: "Lembretes de vencimento" },
  thanks: { label: "Agradecimento pelo pagamento", short: "Agradecimento", tone: "success", section: "Agradecimentos" },
};

/** Variáveis disponíveis nos textos. */
export const TEMPLATE_VARIABLES: { key: string; description: string }[] = [
  { key: "nome", description: "Primeiro nome do cliente" },
  { key: "nome_completo", description: "Nome completo" },
  { key: "empresa", description: "Nome da empresa" },
  { key: "valor", description: "Valor da cobrança (R$)" },
  { key: "vencimento", description: "Data de cobrança (DD/MM/AAAA)" },
  { key: "dias_atraso", description: "Dias em atraso" },
  { key: "saldo", description: "Saldo devedor total do cliente" },
  { key: "pix_bloco", description: "Instruções + código Pix copia e cola (vazio se não houver chave)" },
  { key: "saldo_bloco", description: "Frase com o saldo restante (só no agradecimento)" },
];

export const DEFAULT_TEMPLATES: Record<MessageKind, string> = {
  before_due:
    "Olá, {nome}! Tudo bem? Aqui é da {empresa}.\n\nPassando para lembrar que sua parcela de *{valor}* vence em *{vencimento}*.{pix_bloco}\n\nQualquer dúvida, é só responder esta mensagem. Obrigado!",
  due_today:
    "Olá, {nome}! Aqui é da {empresa}.\n\nSua parcela de *{valor}* vence *hoje* ({vencimento}).{pix_bloco}\n\nSe já pagou, por favor desconsidere e, se puder, nos envie o comprovante. Obrigado!",
  overdue_3:
    "Olá, {nome}, tudo bem? Aqui é da {empresa}.\n\nNão identificamos o pagamento da parcela de *{valor}*, com vencimento em {vencimento}.{pix_bloco}\n\nSe já pagou, envie o comprovante por aqui. Se precisar combinar uma nova data, é só responder.",
  overdue_7:
    "Olá, {nome}. Aqui é da {empresa}.\n\nA parcela de *{valor}* (vencimento {vencimento}) está em aberto há {dias_atraso} dias. Podemos te ajudar a regularizar?{pix_bloco}\n\nResponda esta mensagem para combinarmos a melhor forma.",
  overdue_15:
    "Olá, {nome}. Aqui é da {empresa}.\n\nAinda consta em aberto o valor de *{valor}*, vencido em {vencimento}. Gostaríamos de resolver isso junto com você.\n\nPodemos conversar hoje? Se preferir, combinamos uma nova data.{pix_bloco}",
  promise:
    "Olá, {nome}! Aqui é da {empresa}.\n\nConforme combinado, hoje é o dia do pagamento de *{valor}*.{pix_bloco}\n\nObrigado pela atenção!",
  thanks: "Olá, {nome}! Aqui é da {empresa}.\n\nRecebemos seu pagamento de *{valor}*. Muito obrigado!{saldo_bloco}\n\nQualquer coisa, estamos à disposição.",
};

const step = z.object({ enabled: z.boolean() });

export const messageSettingsSchema = z.object({
  enabled: z.boolean(),
  pix: z.object({
    key: z
      .string()
      .trim()
      .max(77)
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .refine((v) => v === null || normalizePixKey(v) !== null, "Chave Pix inválida (use CPF, CNPJ, e-mail, celular ou chave aleatória)"),
    name: z.string().trim().min(2, "Informe o nome do recebedor").max(25, "Máximo de 25 caracteres (padrão do Pix)"),
    city: z.string().trim().min(2, "Informe a cidade").max(15, "Máximo de 15 caracteres (padrão do Pix)"),
  }),
  steps: z.object({
    before_due: step.extend({ days: z.coerce.number().int().min(1, "Mínimo 1 dia").max(10, "Máximo 10 dias") }),
    due_today: step,
    overdue_3: step,
    overdue_7: step,
    overdue_15: step,
    promise: step,
    thanks: step,
  }),
  templates: z.record(z.string(), z.string().max(1200, "Texto muito longo (máx. 1200 caracteres)")).default({}),
});
export type MessageSettings = z.output<typeof messageSettingsSchema>;
export type MessageSettingsInput = z.input<typeof messageSettingsSchema>;

export const DEFAULT_MESSAGE_SETTINGS: MessageSettings = {
  enabled: true,
  pix: { key: null, name: "PLASCOTEL", city: "JACOBINA" },
  steps: {
    before_due: { enabled: true, days: 3 },
    due_today: { enabled: true },
    overdue_3: { enabled: true },
    overdue_7: { enabled: true },
    overdue_15: { enabled: true },
    promise: { enabled: true },
    thanks: { enabled: true },
  },
  templates: {},
};

export function templateFor(settings: MessageSettings, kind: MessageKind): string {
  const custom = settings.templates[kind];
  return custom && custom.trim() ? custom : DEFAULT_TEMPLATES[kind];
}

export type TemplateContext = {
  fullName: string;
  company: string;
  amount: number;
  dueDate?: string | null;
  daysOverdue?: number;
  balance?: number | null;
  pixCode?: string | null;
};

/** Monta o texto final substituindo as variáveis. Variáveis desconhecidas ficam como estão. */
export function renderTemplate(template: string, ctx: TemplateContext, kind: MessageKind): string {
  const first = ctx.fullName.trim().split(/\s+/)[0] ?? ctx.fullName;
  const pixBlock = ctx.pixCode
    ? `\n\nPara pagar via Pix, copie o código abaixo e cole no app do seu banco (opção *Pix Copia e Cola*):\n\n${ctx.pixCode}`
    : "";
  const balanceBlock =
    kind === "thanks" && ctx.balance !== undefined && ctx.balance !== null
      ? ctx.balance > 0
        ? `\n\nSaldo restante: *${formatBRL(ctx.balance)}*.`
        : "\n\nSua compra está *quitada*!"
      : "";
  const vars: Record<string, string> = {
    nome: capitalize(first),
    nome_completo: ctx.fullName.trim(),
    empresa: ctx.company,
    valor: formatBRL(ctx.amount),
    vencimento: ctx.dueDate ? formatDate(ctx.dueDate) : "",
    dias_atraso: String(Math.max(0, ctx.daysOverdue ?? 0)),
    saldo: formatBRL(ctx.balance ?? 0),
    pix_bloco: pixBlock,
    saldo_bloco: balanceBlock,
  };
  return template.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? vars[k] : m)).replace(/\n{3,}/g, "\n\n").trim();
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}
