import { getUser } from "@/lib/auth";

export async function GET() {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const m = user.qrisImage.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
