import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadMenu } from "@/lib/menu";
import { MenuManager } from "@/components/MenuManager";

export const metadata: Metadata = { title: "Menu" };

export default async function Page() {
  const u = await requireUser();
  return <MenuManager data={await loadMenu(u.id)} />;
}
