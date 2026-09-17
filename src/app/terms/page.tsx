import { LegalDocument } from "@/components/LegalDocument";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ version?: string }>;
}) {
  return <LegalDocument kind="terms" version={(await searchParams).version} />;
}
