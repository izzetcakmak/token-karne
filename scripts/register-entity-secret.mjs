/**
 * Entity Secret kayıt scripti — bir kez çalıştır, tekrar çalıştırma!
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerEntitySecretCiphertext, initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

// .env dosyasını yükle
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");

// Basit .env okuyucu
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const [k, ...v] = line.split("=");
  if (k && v.length) process.env[k.trim()] = v.join("=").trim();
}

const apiKey = process.env.CIRCLE_DEVELOPER_CONTROLLED_API_KEY || process.env.CIRCLE_API_KEY;
if (!apiKey) {
  console.error("HATA: CIRCLE_DEVELOPER_CONTROLLED_API_KEY .env dosyasında bulunamadı.");
  process.exit(1);
}

// Zaten kayıtlı mı kontrol et
if (process.env.CIRCLE_ENTITY_SECRET?.length === 64) {
  console.log("Entity secret zaten kayıtlı (.env içinde CIRCLE_ENTITY_SECRET mevcut). Tekrar çalıştırmaya gerek yok.");
  process.exit(0);
}

// 1. 32-byte rastgele secret üret
const entitySecret = crypto.randomBytes(32).toString("hex");

// 2. Recovery dosyası dizinini oluştur
const recoveryDir = "/home/user/app/.circle";
fs.mkdirSync(recoveryDir, { recursive: true });
const recoveryPath = path.join(recoveryDir, "recovery_file.dat");

// 3. Circle'a kaydet
console.log("Entity secret Circle'a kaydediliyor...");
let response;
try {
  response = await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: recoveryDir,
  });
} catch (err) {
  console.error("Kayıt hatası:", err?.message || err);
  process.exit(1);
}

// Recovery dosyasını yaz (SDK yazmadıysa)
if (response?.data?.recoveryFile && !fs.existsSync(recoveryPath)) {
  fs.writeFileSync(recoveryPath, response.data.recoveryFile);
}
console.log(`Recovery dosyası: ${recoveryPath}`);

// 4. .env dosyasına ekle
fs.appendFileSync(envPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`, "utf-8");
console.log("CIRCLE_ENTITY_SECRET .env dosyasına eklendi.");

// 5. Doğrula
try {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
  await client.listWalletSets({ pageSize: 1 });
  console.log("Doğrulama başarılı — entity secret aktif.");
} catch (err) {
  console.error("Doğrulama hatası:", err?.message || err);
  process.exit(1);
}

console.log("TAMAMLANDI. Lütfen recovery dosyasını şimdi indirip güvenli bir yere kaydet.");
