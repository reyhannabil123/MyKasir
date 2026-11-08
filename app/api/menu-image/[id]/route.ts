import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { menuItems } from "@/lib/schema";
import { getUser } from "@/lib/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await db().select({ image: menuItems.image }).from(menuItems)
    .where(and(eq(menuItems.id, id), eq(menuItems.userId, user.id))).limit(1);
  const m = row?.image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
