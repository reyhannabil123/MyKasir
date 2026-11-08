# MyKasir

Web kasir untuk UMKM. Dibangun dengan Next.js, database Postgres di Neon, dan dideploy ke Vercel.

## Status pembuatan

| Tahap | Isi | Status |
|---|---|---|
| 1 | Fondasi: proyek, database, sign up/login, kerangka halaman, pengaturan | Selesai |
| 2 | Menu: kategori, varian, tambah/edit/hapus/urutkan, stok, foto | Selesai |
| 3 | Pesanan dan pembayaran: QRIS, tunai, bayar nanti, diskon, upload QRIS | Selesai |
| 4 | Bayar nanti (Tandai lunas), struk, riwayat | Selesai |
| 5 | Laporan, pengeluaran, tutup kasir, ekspor | Selesai |
| 6 | Penyempurnaan akhir | Selesai |

## Deploy (sekali saja)

### 1. Taruh kode di GitHub
Buat repository baru di GitHub (boleh private), lalu upload isi folder ini ke sana.

### 2. Buat database di Neon
1. Daftar gratis di <https://neon.com>, lalu buat project baru (pilih region Singapore).
2. Buka **Connect** di dashboard Neon, pilih **Pooled connection**, lalu salin connection string-nya. Ini nilai `DATABASE_URL`.
3. Buka **SQL Editor** di Neon, buka file `db/schema.sql` dari proyek ini, tempel seluruh isinya, lalu klik **Run**. Ini membuat semua tabel.

### 3. Deploy ke Vercel
1. Daftar di <https://vercel.com> dengan akun GitHub, klik **Add New > Project**, lalu pilih repository tadi.
2. Di bagian **Environment Variables**, isi dua nilai:
   - `DATABASE_URL`: connection string dari Neon.
   - `AUTH_SECRET`: teks acak minimal 32 karakter. Buat dengan `openssl rand -base64 32`, atau ketik asal sekitar 40 karakter.
3. Klik **Deploy**. Setelah selesai, buka alamatnya, daftar akun, dan mulai pakai.

## Menjalankan di komputer sendiri
```bash
npm install
cp .env.example .env.local   # lalu isi DATABASE_URL dan AUTH_SECRET
npm run dev                  # buka http://localhost:3000
```

## Catatan teknis
- Login memakai email dan kata sandi (di-hash dengan bcrypt), sesi disimpan di cookie httpOnly bertanda tangan.
- Foto menu dan gambar QRIS diperkecil di browser lalu disimpan sebagai teks di database, jadi tidak butuh layanan penyimpanan terpisah.
- Hari laporan dihitung dengan zona waktu WIB (UTC+7).
- Skema database ada di `lib/schema.ts`. Setelah mengubahnya, jalankan `npm run db:generate` untuk membuat SQL baru.
