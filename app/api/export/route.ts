import { getUser } from "@/lib/auth";
import { loadReport } from "@/lib/reports";
import { buildPdf, buildXlsx } from "@/lib/export";
import { parsePeriode, rangeOf, wibDay } from "@/lib/range";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const periode = parsePeriode(url.searchParams.get("periode") ?? undefined);
  const { from, to } = rangeOf(periode);
  const report = await loadReport(user.id, from, to);
  const name = `mykasir-laporan-${wibDay(from)}${periode === "today" || periode === "yesterday" ? "" : `-sd-${wibDay(new Date(to.getTime() - 1))}`}.${format}`;
  const body = format === "pdf" ? await buildPdf(report, user.shopName) : await buildXlsx(report, user.shopName);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
