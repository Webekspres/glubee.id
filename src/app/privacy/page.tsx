import { LegalDocument } from "@/components/LegalDocument";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kebijakan privasi" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ version?: string }>;
}) {
  return (
    <LegalDocument kind="privacy" version={(await searchParams).version} />
  );
}
