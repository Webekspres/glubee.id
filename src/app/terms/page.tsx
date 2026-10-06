import { LegalDocument } from "@/components/LegalDocument";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Syarat dan ketentuan" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ version?: string }>;
}) {
  return <LegalDocument kind="terms" version={(await searchParams).version} />;
}
