"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { accountDestination, api } from "@/lib/ui";

// Pengguna yang masih masuk ("Ingat saya") langsung dibawa ke halamannya saat
// membuka beranda, halaman masuk, atau daftar, alih-alih melihat tombol "Masuk".
export function SignedInRedirect() {
  const router = useRouter();
  useEffect(() => {
    let ignore = false;
    api<{ signedIn: boolean; accountStatus: string | null }>("/api/auth/session")
      .then(({ data }) => {
        if (!ignore && data.signedIn) router.replace(accountDestination(data.accountStatus));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [router]);
  return null;
}
