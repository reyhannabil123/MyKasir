import type { Metadata } from "next";
import { ResetForm } from "@/components/ResetForm";

export const metadata: Metadata = { title: "Lupa kata sandi" };
export default function Page() { return <ResetForm />; }
