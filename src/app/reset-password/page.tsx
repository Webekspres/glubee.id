import { AuthForm } from "@/components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pulihkan akses" };

export default function Page() {
  return <AuthForm mode="reset-password" />;
}
