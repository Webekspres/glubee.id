import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { APP_CONFIG } from "@/lib/config";
import type { ReactNode } from "react";
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|https?:\/\/[^\s]+|`[^`]+`)/g)
    .map((part, i) =>
      part.startsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith("http") ? (
        <a key={i} href={part}>
          {part}
        </a>
      ) : part.startsWith("`") ? (
        <span key={i}>{part.slice(1, -1)}</span>
      ) : (
        part
      ),
    );
}
export async function LegalDocument({
  kind,
  version,
}: {
  kind: "terms" | "privacy";
  version?: string;
}) {
  const old = version === "0.1-draft";
  if (version && !old && version !== APP_CONFIG.legalVersion) notFound();
  const content = await readFile(
    join(
      process.cwd(),
      "docs/legal",
      old ? "archive/0.1-draft" : "public",
      kind === "terms" ? "TERMS_AND_CONDITIONS.MD" : "PRIVACY_POLICY.MD",
    ),
    "utf8",
  );
  return (
    <main id="main" className="container page legal">
      <p className="notice">
        Dokumen draf untuk pengujian. Fitur pengingat, kontak darurat, dan
        penghapusan mandiri belum tersedia pada versi Sprint 2. Naskah ini
        menunggu review hukum sebelum rilis publik.
      </p>
      {content
        .trim()
        .split(/\n\s*\n/)
        .map((block, i) => {
          if (block.startsWith("# "))
            return (
              <h1 key={i} style={{ marginTop: 28 }}>
                {inline(block.slice(2))}
              </h1>
            );
          if (block.startsWith("## "))
            return <h2 key={i}>{inline(block.slice(3))}</h2>;
          if (block.startsWith("- "))
            return (
              <ul key={i}>
                {block.split("\n").map((s, j) => (
                  <li key={j}>{inline(s.replace(/^- /, ""))}</li>
                ))}
              </ul>
            );
          if (/^\d+\. /.test(block))
            return (
              <ol key={i}>
                {block.split("\n").map((s, j) => (
                  <li key={j}>{inline(s.replace(/^\d+\. /, ""))}</li>
                ))}
              </ol>
            );
          return (
            <p key={i} style={{ whiteSpace: "pre-line" }}>
              {inline(block)}
            </p>
          );
        })}
    </main>
  );
}
