import type { Metadata } from "next";
import { ResetForm } from "@/components/ResetForm";

export const metadata: Metadata = { title: "Kata sandi baru" };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <ResetForm token={(await params).token} />;
}
