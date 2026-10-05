# Prompt aset Glubee untuk ChatGPT

Tinggal salin blok prompt ke ChatGPT, unduh hasilnya, lalu simpan dengan nama file yang tertera. Semua file taruh di `docs/design/assets-incoming/`. Trim, konversi WebP, dan pemasangan di kode dikerjakan setelahnya.

## Langkah 0: buka chat baru

1. Buka chat baru di ChatGPT.
2. Unggah gambar maskot asli. Pakai PNG besar dari klien bila ada; kalau tidak, pakai `public/brand/mascot.webp`.
3. Kirim blok pembuka di bawah ini bersama gambar tersebut.
4. Setelah ChatGPT menjawab, kirim prompt aset satu per satu di chat yang sama.

Setiap selesai 3 gambar, buka chat baru dan ulangi langkah 0. Chat yang terlalu panjang membuat karakternya mulai berubah.

```text
This image is "Glubee", the mascot of a blood sugar logging app. I will ask you for several new images of this exact character. Always keep these traits identical to the reference:

- Body: a rounded yellow HEXAGON (not round, not oval), shaped like a glucose meter.
- Face: a pale pink rounded screen with big glossy eyes, and a navy hair tuft above the screen.
- Two curved navy antennae with teardrop tips.
- Two pairs of translucent mint-green wings.
- Three navy buttons on the belly: two slanted capsules and a square middle button glowing cyan.
- Short orange arms and stubby orange legs, simple mitten hands.
- Style: soft painterly digital illustration with gentle shading, like a children's book. Not a 3D plastic render, not flat vector (unless I ask).

Rules for every image unless I say otherwise: full body, centered, transparent background, no text, no letters, no numbers, no watermark, no stinger, no needles, no medicine, no food.

Reply "Siap" and wait for my first request.
```

---

## Prioritas 1: enam pose (M1)

Kirim satu per satu. Satu prompt menghasilkan satu gambar.

**`mascot-wave.png`** (untuk masuk dan daftar akun)

```text
Generate the Glubee mascot standing and waving hello with its right arm raised high, smiling with mouth open, bright eyes, welcoming. Full body, centered, transparent background, portrait 1024x1536, no text.
```

**`mascot-point.png`** (untuk petunjuk onboarding dan empty state)

```text
Generate the Glubee mascot standing at a three-quarter angle, pointing to the viewer's right with one arm fully extended, friendly confident smile, as if showing where to tap. Full body, centered, transparent background, portrait 1024x1536, no text.
```

**`mascot-report.png`** (untuk halaman Laporan)

```text
Generate the Glubee mascot holding a blank white sheet of paper with both hands in front of its belly. The sheet shows only a simple light grey line chart, no words or numbers on it. Proud gentle smile. Full body, centered, transparent background, portrait 1024x1536.
```

**`mascot-cheer.png`** (setelah berhasil menyimpan catatan pertama)

```text
Generate the Glubee mascot doing a small happy jump with both arms raised, eyes closed in happy arcs, big smile, a few small simple yellow sparkle shapes around it. Full body, centered, transparent background, portrait 1024x1536, no text.
```

**`mascot-search.png`** (untuk riwayat kosong dan halaman 404)

```text
Generate the Glubee mascot leaning forward and holding a round magnifying glass up to one eye, curious and slightly puzzled expression, one antenna bent like a question mark. Full body, centered, transparent background, portrait 1024x1536, no text.
```

**`mascot-rest.png`** (untuk dashboard kosong)

```text
Generate the Glubee mascot sitting on the ground with its legs stretched forward, eyes peacefully closed, tiny content smile, wings relaxed. It should look calm and resting, not sick and not sad. Full body, centered, transparent background, square 1024x1024, no text.
```

---

## Prioritas 2: ikon kepala (M3)

**`mascot-head.png`** (untuk favicon, ikon aplikasi, avatar email)

```text
Generate a close-up portrait of the Glubee mascot: only the head and the top of the hexagon body, with the face screen filling most of the frame and both antennae fully visible. Use simplified, bold, clean shapes and lighter shading so it stays readable when shrunk to 32 pixels. Centered with even padding, square 1024x1024, transparent background, no text.
```

Cek dulu sebelum dikirim: perkecil gambar ke ukuran ikon tab browser. Kalau mata dan antena masih terlihat, berarti lolos.

---

## Prioritas 3: gambar pratinjau link WhatsApp (B3)

**`og-illustration.png`**

```text
Generate a wide landscape banner, 1536x1024. Solid deep navy background (#002A45). The Glubee mascot stands in the right third of the image, waving, softly lit. The left half of the image must stay completely empty plain navy, because text will be added there later. Add a few small soft yellow hexagon shapes floating sparsely near the mascot. No text, no letters, no logo.
```

Gambar ini tidak transparan, dan memang tidak perlu. Nanti dipotong ke ukuran 1200×630 dan teksnya ditambahkan lewat kode.

---

## Prioritas 4: maskot memegang layar (M2)

**`mascot-display.png`** (untuk landing dan form Catat, angka di layarnya ditulis lewat kode)

```text
Generate the Glubee mascot standing straight and holding, with both hands, a blank rounded rectangular display panel in front of its belly. The panel is pale mint (#DCECE6) with a thin navy border, perfectly flat, facing the viewer straight on (not tilted), and completely empty with no digits. Calm attentive smile, looking at the viewer. Full body, centered, transparent background, portrait 1024x1536.
```

Pilih hasil yang panelnya benar-benar lurus menghadap depan.

---

## Prioritas 5: bingkai animasi (M4)

Untuk dua prompt ini, buka chat baru dan unggah gambar maskot asli lagi. Bagian ini mengedit gambar asli, bukan membuat pose baru.

**`mascot-blink.png`**

```text
Edit this exact image. Change only the eyes: make them gently closed as soft curved lines, like a blink. Keep everything else pixel-identical: same pose, same size, same position, same colours. Transparent background.
```

**`mascot-wings-up.png`**

```text
Edit this exact image. Change only the wings: raise them higher as if in the middle of a flap. Keep everything else identical: same pose, same size, same position, same colours. Transparent background.
```

---

## Prioritas 6: versi garis satu warna (M5)

**`mascot-line.png`** (untuk PDF laporan dan cetak hitam putih)

```text
Redraw the Glubee mascot in its neutral standing pose as clean flat line art: single colour navy (#002A45) outlines only, uniform stroke weight, no shading, no gradients, no colour fills except solid navy for the hair tuft and the three belly buttons. Simple and printable in black and white. Square 1024x1024, transparent background, no text.
```

---

## Prioritas 7: simbol logo (B1)

Buat di chat baru tanpa pembuka maskot. Teks "glubee" jangan diminta ke AI, nanti disusun lewat kode.

**`logo-symbol.png`**

```text
Design a minimal logo symbol: a lowercase letter "b" formed by a small cute bee facing right. The bee's long wing forms the tall stem of the "b" and its round yellow body forms the bowl. Navy outline, flat vector style, exactly two colours: yellow #FFB915 and navy #002A45, no gradients, no shading. Centered on a transparent square 1024x1024 canvas. No other letters or text.
```

Simbol ini masih perlu persetujuan klien sebelum dipakai sebagai logo final.

---

## Opsional: bahan diskusi dengan klien (M6)

Jangan dipasang dulu, karena masih menunggu keputusan klien dan legal. Fungsinya hanya sebagai alternatif ekspresi status yang lebih tenang daripada versi marah, pusing, dan menjerit.

**`mascot-status-high.png`**

```text
Generate the Glubee mascot with a mildly concerned expression: eyebrows slightly raised, small closed mouth, one hand resting on its chest. Calm and caring, not angry, not panicking. Full body, centered, transparent background, portrait 1024x1536, no text.
```

**`mascot-status-low.png`**

```text
Generate the Glubee mascot with a gently worried, soft expression, holding a glass of water with both hands. Calm and attentive, not dizzy, no spiral eyes. Full body, centered, transparent background, portrait 1024x1536, no text.
```

**`mascot-status-urgent.png`**

```text
Generate the Glubee mascot with a serious, focused but calm expression, holding up a simple smartphone as if about to call someone, steady eyes. Not screaming, no sweat drops, no tears. Full body, centered, transparent background, portrait 1024x1536, no text.
```

---

## Sebelum dikirim, cek hasilnya

Tolak dan generate ulang bila salah satu ini terjadi:

- Tubuh jadi bulat atau oval, bukan heksagon.
- Tiga tombol di perut hilang, atau wajah bukan layar merah muda.
- Latar tidak transparan (kecuali gambar OG).
- Ada tulisan, huruf, atau angka yang tidak diminta.
- Tangan punya lima jari realistis, atau ada sengat.

Kalau ChatGPT terus memberi latar putih, kirim: `Make the background fully transparent and export as PNG.`
