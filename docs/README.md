# Dokumentasi Glubee

Dokumentasi dipisahkan dari source framework agar root project tetap bersih saat scaffolding.

## Struktur

```text
docs/
├── IMPLEMENTATION_PLAN_SELF_HOST.md   # urutan kerja migrasi ke VPS (ADR-0001)
├── product/
│   ├── BRD.MD
│   └── FRD.MD
├── engineering/
│   ├── SRS.MD
│   └── adr/
│       └── 0001-self-host-supabase-on-vps.md
├── planning/
│   ├── CLICKUP_BACKLOG.json
│   ├── CLICKUP_DEPENDENCIES.json
│   ├── CLICKUP_IMPORT.md
│   ├── CLICKUP_IMPORT_LOG.json         # ID task ClickUp + riwayat sinkronisasi
│   ├── SPRINT_1_REVIEW.md
│   └── SPRINT_2_REVIEW.md
├── legal/
│   ├── public/
│   │   ├── PRIVACY_POLICY.MD
│   │   └── TERMS_AND_CONDITIONS.MD
│   ├── internal/
│   │   ├── CONSENT_AND_NOTICES.MD
│   │   └── LEGAL_OPERATIONS.MD
│   └── archive/0.1-draft/             # versi lama untuk pembuktian consent
└── design/
    └── README.md                       # visual varian B dan aset yang belum final
```

Operasional production (provision VPS, nginx, backup, akses database) ada di [`deploy/README.md`](../deploy/README.md).

## Urutan baca

1. [BRD](product/BRD.MD)
2. [FRD](product/FRD.MD)
3. [SRS](engineering/SRS.MD), [ADR](engineering/adr/), dan [deploy/README](../deploy/README.md)
4. [Consent and Notices](legal/internal/CONSENT_AND_NOTICES.MD)
5. [Privacy Policy](legal/public/PRIVACY_POLICY.MD) dan [Terms and Conditions](legal/public/TERMS_AND_CONDITIONS.MD)
6. [Legal Operations](legal/internal/LEGAL_OPERATIONS.MD)

Aturan kerja developer/AI agent tetap berada di [`AGENTS.MD`](../AGENTS.MD) pada root repository. Status desain ada di [design/README](design/README.md): brief visual klien (varian B) sudah diterapkan sementara; font berlisensi, logo final, dan PNG maskot transparan masih ditunggu dari klien.
