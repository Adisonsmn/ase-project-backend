# Deploy ke Azure Container Apps

Aplikasi dikemas sebagai container (`Dockerfile`) dan dijalankan di Azure
Container Apps. Dipilih karena bisa *scale-to-zero* — tidak ada traffic berarti
tidak ada biaya komputasi, cocok untuk proyek lab dengan traffic kecil.

---

## Prasyarat

```bash
# Azure CLI
winget install Microsoft.AzureCLI      # Windows
brew install azure-cli                 # macOS

az login
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

Siapkan dua secret JWT, masing-masing dari perintah berikut (jalankan dua kali,
nilainya **wajib berbeda**):

```bash
openssl rand -base64 48
```

Jangan pakai nilai yang sama dengan `.env` lokal. Production punya secret sendiri.

---

## 1. Buat resource group

```bash
az group create --name ase-backend-rg --location southeastasia
```

Region `southeastasia` (Singapura) dipilih agar dekat dengan database Supabase
di `ap-southeast-1`, sehingga latensi query rendah.

## 2. Deploy pertama

```bash
az containerapp up \
  --name ase-backend \
  --resource-group ase-backend-rg \
  --location southeastasia \
  --source . \
  --ingress external \
  --target-port 3001
```

Satu perintah ini membuat Container Apps environment, membuat container
registry, membangun image dari `Dockerfile`, lalu men-deploy-nya. Butuh
beberapa menit.

Deploy pertama **akan gagal start** karena environment variable belum diisi.
Itu wajar — lanjut ke langkah berikutnya.

## 3. Simpan secret

Secret disimpan di penyimpanan rahasia Azure, bukan sebagai environment
variable biasa, supaya nilainya tidak terbaca saat seseorang melihat
konfigurasi container app.

```bash
az containerapp secret set \
  --name ase-backend \
  --resource-group ase-backend-rg \
  --secrets \
    database-url="postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" \
    jwt-access="<hasil openssl pertama>" \
    jwt-refresh="<hasil openssl kedua>"
```

`DATABASE_URL` **wajib** memakai Session Pooler Supabase, bukan direct
connection — lihat Troubleshooting di bawah.

## 4. Pasang environment variable

```bash
az containerapp update \
  --name ase-backend \
  --resource-group ase-backend-rg \
  --set-env-vars \
    NODE_ENV=production \
    CORS_ORIGIN=https://frontend-anda.example.com \
    DATABASE_URL=secretref:database-url \
    JWT_ACCESS_SECRET=secretref:jwt-access \
    JWT_REFRESH_SECRET=secretref:jwt-refresh
```

**Jangan set `PORT`.** Container sudah memakai 3001 (lihat `ENV PORT` di
`Dockerfile`), sesuai `--target-port` di langkah 2. Kalau `PORT` diisi nilai lain, aplikasi tetap sehat di dalam
container tapi tidak bisa dijangkau dari luar — gejalanya membingungkan karena
log menunjukkan server berjalan normal.

## 5. Atur skala

```bash
az containerapp update \
  --name ase-backend \
  --resource-group ase-backend-rg \
  --min-replicas 0 \
  --max-replicas 1
```

`min-replicas 0` membuat container berhenti saat tidak ada traffic.
Konsekuensinya request pertama setelah idle butuh beberapa detik (cold start).

`max-replicas 1` **wajib**: rate limiter menyimpan hitungan di memori, jadi dua
replica berarti dua hitungan terpisah dan pembatas login jadi dua kali lebih
longgar dari yang diinginkan.

## 6. Verifikasi

```bash
FQDN=$(az containerapp show --name ase-backend --resource-group ase-backend-rg \
  --query properties.configuration.ingress.fqdn -o tsv)

curl https://$FQDN/health
curl https://$FQDN/health/ready
```

`/health/ready` harus membalas `database.ok: true`. Kalau `false`, berarti
`DATABASE_URL` salah.

Cek juga dokumentasi API di browser: `https://$FQDN/api/v1/docs`

## 7. Isi data awal (sekali saja)

```bash
az containerapp exec \
  --name ase-backend \
  --resource-group ase-backend-rg \
  --command "bun prisma/seed.ts"
```

Harus muncul `Kategori sistem: 13` dan `Ide penambahan income: 18`.

Tanpa langkah ini, kategori bawaan dan daftar ide income kosong — aplikasi
jalan tapi isinya hampa. Perintah ini aman diulang.

---

## Deploy berikutnya

```bash
az containerapp up --name ase-backend --resource-group ase-backend-rg --source .
```

Migrasi database berjalan otomatis saat container start (`prisma migrate deploy`
di `CMD`). Kalau migrasi gagal, container berhenti dan revisi lama tetap
melayani permintaan.

---

## Sebelum demo: matikan cold start

```bash
az containerapp update --name ase-backend --resource-group ase-backend-rg --min-replicas 1
```

Kembalikan ke `0` setelah selesai supaya tidak terus menagih biaya:

```bash
az containerapp update --name ase-backend --resource-group ase-backend-rg --min-replicas 0
```

---

## Biaya

Dengan scale-to-zero dan traffic kecil, pemakaian seharusnya sangat kecil.
Tetap pasang budget alert di **Cost Management** portal Azure supaya tidak ada
kejutan.

Cek pemakaian kapan saja:

```bash
az consumption usage list --output table
```

---

## Troubleshooting

### `Konfigurasi environment tidak valid: { CORS_ORIGIN: [...] }`

Bukan bug. Server sengaja menolak start kalau `CORS_ORIGIN` kosong saat
`NODE_ENV=production`. Isi variable itu.

### `JWT_REFRESH_SECRET harus berbeda dari JWT_ACCESS_SECRET`

Kedua secret bernilai sama. Ini pengaman supaya access token tidak bisa dipakai
sebagai refresh token.

### `P1001: Can't reach database server at db.<ref>.supabase.co`

`DATABASE_URL` memakai direct connection Supabase, yang hanya punya alamat
IPv6. Ganti ke **Session Pooler**:

```
# Direct connection — IPv6-only, hindari
postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres

# Session pooler — pakai ini
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Perhatikan dua bedanya: username jadi `postgres.<project-ref>`, dan host jadi
`aws-0-<region>.pooler.supabase.com`.

### `P1013: The provided database string is invalid`

Connection string terbawa tanda kutip. Ini sering terjadi saat menguji lokal
dengan `docker run --env-file .env`, karena Docker tidak melepas tanda kutip
dari `DATABASE_URL="postgresql://..."`. Hapus tanda kutipnya di env file yang
dipakai Docker. Di Azure tidak terjadi karena nilainya diisi tanpa kutip.

### Aplikasi sehat di log tapi tidak bisa diakses

Port di dalam container tidak cocok dengan `--target-port`. Pastikan `PORT`
tidak diisi di environment variable Azure.

### Container restart terus-menerus

Lihat log:

```bash
az containerapp logs show --name ase-backend --resource-group ase-backend-rg --follow
```

Penyebab paling sering ada di baris pertama: environment variable kurang, atau
migrasi gagal.

---

## Menguji image secara lokal

```bash
docker build -t ase-backend:local .

# env file TANPA tanda kutip, dan TANPA baris PORT
docker run --rm -p 3001:3001 --env-file .env.docker ase-backend:local

curl http://localhost:3001/health/ready
```
