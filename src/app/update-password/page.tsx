import { AuthForm } from "@/components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ganti password" };

export default function Page() {
  return <AuthForm mode="update-password" />;
}
