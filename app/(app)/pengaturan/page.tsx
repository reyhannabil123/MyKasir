import type { Metadata } from "next";
import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { QrisSection } from "@/components/QrisSection";
import { PasswordForm } from "@/components/PasswordForm";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function Page() {
  const u = await requireUser();
  const [qr] = await db().select({ v: sql<string | null>`case when ${users.qrisImage} = '' then null else left(md5(${users.qrisImage}), 8) end` }).from(users).where(eq(users.id, u.id));
  return (
    <div className="stack-lg" style={{ maxWidth: 640 }}>
      <header className="ph"><div><h1>Pengaturan</h1><p className="sub">{u.email}</p></div></header>
      <QrisSection url={qr.v ? `/api/qris?v=${qr.v}` : null} />
      <PasswordForm />
      <SettingsForm user={{ shopName: u.shopName, address: u.address, whatsapp: u.whatsapp, receiptFooter: u.receiptFooter, paperWidth: u.paperWidth, theme: u.theme }} />
    </div>
  );
}
