import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getUser()) redirect("/");
  return <div className="authwrap">{children}</div>;
}
