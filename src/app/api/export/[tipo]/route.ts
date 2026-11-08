import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isISODate, todayISO } from "@/lib/dates";
import { buildExport, exportFileName, isExportType } from "@/features/reports/exports";
import { ReportError, ReportTooLargeError, resolvePeriod } from "@/features/reports/queries";

export const dynamic = "force-dynamic";

function text(message: string, status: number) {
  return new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

/**
 * GET /api/export/{resumo|cidades|inadimplencia|caixa|vendas}?periodo=&de=&ate=
 * Somente proprietário. Responde CSV (Excel pt-BR) como anexo.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params;
  if (!isExportType(tipo)) return text("Tipo de exportação inválido.", 404);

  const user = await getCurrentUser();
  if (!user || !user.active) return text("Sessão expirada. Entre novamente.", 401);
  if (!user.isOwner) return text("Apenas o proprietário pode exportar relatórios.", 403);

  const sp = request.nextUrl.searchParams;
  const de = sp.get("de") ?? undefined;
  const ate = sp.get("ate") ?? undefined;
  // Sem ?periodo= mas com de/ate válidos, trata como período personalizado (ex.: exportar um dia do caixa).
  const periodo = sp.get("periodo") ?? (de && ate && isISODate(de) && isISODate(ate) ? "custom" : undefined);
  const { from, to } = resolvePeriod({ periodo, de, ate });
  const today = todayISO();

  try {
    const csv = await buildExport(tipo, from, to, today);
    const filename = exportFileName(tipo, from, to, today);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ReportTooLargeError) return text(e.message, 413);
    if (e instanceof ReportError) return text(e.message, 500);
    console.error("[export]", e);
    return text("Não foi possível gerar o arquivo. Tente novamente.", 500);
  }
}
