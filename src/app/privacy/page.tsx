import { LegalDocument } from "@/components/LegalDocument";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ version?: string }>;
}) {
  return (
    <LegalDocument kind="privacy" version={(await searchParams).version} />
  );
}
