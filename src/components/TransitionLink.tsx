"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps } from "react";

// Durasi animasi keluar; harus sama dengan .is-leaving di globals.css.
const EXIT_MS = 170;

// Putar animasi keluar pada <main>, lalu jalankan navigasi. Tanpa animasi bila
// pengguna memilih "kurangi gerakan".
export function leavePage(navigate: () => void) {
  const main = document.getElementById("main");
  if (!main || matchMedia("(prefers-reduced-motion: reduce)").matches) return navigate();
  main.classList.add("is-leaving");
  setTimeout(navigate, EXIT_MS);
  // Bila navigasi gagal atau lambat, tampilkan lagi halaman lama agar layar tidak kosong.
  setTimeout(() => main.classList.remove("is-leaving"), 2000);
}

// Pengganti next/link untuk navigasi internal: halaman lama memudar dulu, lalu
// halaman baru masuk dengan animasi page-enter.
export function TransitionLink({ onNavigate, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const path = usePathname();
  return (
    <Link
      {...props}
      onNavigate={(event) => {
        onNavigate?.(event);
        const href = typeof props.href === "string" ? props.href : (props.href.pathname ?? "/");
        if (href.split("?")[0] === path) return;
        event.preventDefault();
        leavePage(() =>
          props.replace
            ? router.replace(href, { scroll: props.scroll })
            : router.push(href, { scroll: props.scroll }),
        );
      }}
    />
  );
}
