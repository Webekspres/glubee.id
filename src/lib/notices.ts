// Naskah pemberitahuan kontak darurat dari docs/legal/internal/CONSENT_AND_NOTICES.MD (versi di
// APP_CONFIG.noticeVersions). Ubah naskah = naikkan versi di sini, config, dan notice_versions.

export const CONTACT_SHARE_TEXT =
  "Saya meminta Glubee mengundang kontak yang saya pilih. Jika kontak tersebut menyetujui, Glubee dapat mengirim informasi terbatas berupa nama saya, nilai dan satuan gula darah, waktu pengukuran, serta imbauan menghubungi saya ketika pemicu yang telah disetujui terjadi. Kontak juga dapat diberi tahu bila saya belum mencatat gula darah 24 jam setelah jadwal pemeriksaan terlewat. Saya memastikan alamat email yang saya masukkan benar dan saya berwenang mengundangnya.";

export const contactAcceptText = (inviter: string) =>
  `${inviter} mengundang Anda sebagai kontak darurat Glubee. Jika Anda menerima, Glubee dapat mengirim email terbatas ketika pengguna belum mencatat gula darah 24 jam setelah jadwal pemeriksaan terlewat dan, setelah fitur terkait divalidasi/diaktifkan, ketika pengguna mengonfirmasi nilai yang memenuhi pemicu bahaya. Email nilai dapat memuat nama pengguna, nilai, satuan, waktu pengukuran, dan imbauan menghubungi pengguna. Anda tidak memperoleh akun atau akses ke dashboard/riwayat. Anda dapat menolak sekarang atau berhenti melalui tautan pada email.`;

// CONSENT_AND_NOTICES §5: selama alert belum aktif, UI wajib mengatakannya.
export const CONTACT_ALERTS_PENDING =
  "Saat ini Glubee belum mengirim pemberitahuan apa pun kepada kontak darurat. Pemberitahuan baru berjalan setelah fiturnya disetujui dan divalidasi.";
