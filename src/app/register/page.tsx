import { AuthForm } from "@/components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buat akun" };

export default function Page() {
  return <AuthForm mode="register" />;
}
