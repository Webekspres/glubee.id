# Dokumentasi Glubee

Dokumentasi dipisahkan dari source framework agar root project tetap bersih saat scaffolding.

## Struktur

```text
docs/
├── product/
│   ├── BRD.MD
│   └── FRD.MD
├── engineering/
│   └── SRS.MD
├── planning/
│   ├── CLICKUP_BACKLOG.json
│   ├── CLICKUP_DEPENDENCIES.json
│   ├── CLICKUP_IMPORT.md
│   ├── CLICKUP_IMPORT_LOG.json
│   └── SPRINT_1_REVIEW.md
├── legal/
│   ├── public/
│   │   ├── PRIVACY_POLICY.MD
│   │   └── TERMS_AND_CONDITIONS.MD
│   └── internal/
│       ├── CONSENT_AND_NOTICES.MD
│       └── LEGAL_OPERATIONS.MD
└── design/
    └── README.md
```

## Urutan baca

1. [BRD](product/BRD.MD)
2. [FRD](product/FRD.MD)
3. [SRS](engineering/SRS.MD)
4. [Consent and Notices](legal/internal/CONSENT_AND_NOTICES.MD)
5. [Privacy Policy](legal/public/PRIVACY_POLICY.MD) dan [Terms and Conditions](legal/public/TERMS_AND_CONDITIONS.MD)
6. [Legal Operations](legal/internal/LEGAL_OPERATIONS.MD)

Aturan kerja developer/AI agent tetap berada di [`AGENTS.MD`](../AGENTS.MD) pada root repository. Dokumen desain final belum dibuat karena masih menunggu brand guideline, desain, dan aset maskot klien.
