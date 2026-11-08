import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Daftar" };
export default function Page() { return <AuthForm mode="signup" />; }
