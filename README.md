# 🥗 Diyet Life

> Diyetisyen ve danışan arasındaki beslenme sürecini dijitalleştiren mobil uygulama.

---

## 📱 Uygulama Hakkında

**Diyet Life**, diyetisyenlerin danışanlarını daha etkin yönetmesini ve danışanların beslenme programlarını kolayca takip etmesini sağlayan bir React Native mobil uygulamasıdır.

---

## ✨ Özellikler

### Diyetisyen Tarafı
- 👥 **Danışan Yönetimi** — Danışan listesi, profil detayları, alerji ve sevmediği besinler
- 📋 **Program Oluşturma** — Günlük öğün programı oluşturma, tarif kütüphanesinden öğün ekleme, önceki programı kopyalama
- 🤖 **PDF'den Program** — Diyet programı PDF'ini Claude AI ile analiz ederek otomatik program oluşturma
- 📅 **Randevu Takvimi** — Randevu oluşturma, düzenleme, durum takibi
- 🍽 **Öğün Takibi** — Danışanların öğün fotoğraflarını görme, emoji/mesaj ile reaksiyon gönderme
- 📊 **İstatistikler** — Danışan başarı oranları, öğün uyumu
- 🛒 **Alışveriş Listesi** — Claude AI ile haftalık programdan PDF alışveriş listesi oluşturma
- 🔔 **Bildirimler** — Yeni danışan, program bitiş, randevu hatırlatması

### Danışan Tarafı
- 🏠 **Ana Sayfa** — Kilo takibi, BMI hesabı, günlük öğünler, hedefe ilerleme
- 📆 **Öğün Takvimi** — Günlük öğün takibi, yedim/yemedim işaretleme, not ve fotoğraf ekleme
- 💬 **Diyetisyen Mesajları** — Diyetisyenden gelen emoji ve mesaj reaksiyonlarını görme
- 📖 **Tarifler** — Diyetisyenin paylaştığı tarifleri görme ve alışveriş listesi oluşturma
- ⚙️ **Ayarlar** — Profil, beden ölçümleri, alerjiler, sevmediği besinler, bildirim tercihleri
- 🔔 **Push Bildirimler** — Yeni program, randevu, diyetisyen reaksiyonu bildirimleri

---

## 🛠 Teknolojiler

| Katman | Teknoloji |
|--------|-----------|
| Mobile | React Native + Expo |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| AI | Claude API (Anthropic) |
| Push Bildirim | Firebase Cloud Messaging (FCM) |
| Edge Functions | Supabase Edge Functions (Deno) |
| Email | Resend API |

---

## 🗄 Veritabanı Yapısı

```
profiles              — Kullanıcı rolleri (dietitian / client)
dietitian_profiles    — Diyetisyen profil bilgileri
dietitian_settings    — Diyetisyen ayarları ve bildirim tercihleri
client_profiles       — Danışan profil bilgileri
diet_programs         — Diyet programları
diet_meals            — Program öğünleri
meal_logs             — Danışan öğün kayıtları (fotoğraf, not, durum)
meal_reactions        — Diyetisyen reaksiyonları
appointments          — Randevular
recipes               — Tarif kütüphanesi
body_measurements     — Danışan beden ölçümleri
notifications         — Bildirim geçmişi
```

---

## 🤖 AI Özellikleri

### PDF'den Program Oluşturma
Diyetisyen, hazır diyet programını PDF olarak yükler. Claude AI PDF'i analiz ederek öğünleri tarihlere göre ayırır ve düzenlenebilir program formatına dönüştürür.

### Alışveriş Listesi
Haftalık program öğünleri Claude AI'ya gönderilir. AI malzemeleri kategorilere ayırarak (Et & Balık, Sebze & Meyve, Tahıl vs.) PDF alışveriş listesi oluşturur.


## 🔔 Bildirim Senaryoları

| Olay | Alıcı |
|------|-------|
| Danışan daveti onayladı | Diyetisyen |
| Yeni program oluşturuldu | Danışan |
| Danışan öğün işaretledi | Diyetisyen |
| Diyetisyen reaksiyon gönderdi | Danışan |
| Randevu oluşturuldu | Her ikisi |
| Randevu hatırlatması | Her ikisi |
| Program bitiyor (3 gün kala) | Diyetisyen |
| Program süresi doldu | Diyetisyen |

---

## 📸 Ekran Görüntüleri

> *(Eklenecek)*

---

## 📄 Lisans

Bu proje özel kullanım içindir.

---

---

## 📋 Kurulum Gereksinimleri

Detaylı kurulum talimatları için [REQUIREMENTS.md](./REQUIREMENTS.md) dosyasına bakın.

---

<p align="center">
  <strong>Diyet Life</strong> — Sağlıklı yaşam, dijital takip
</p>
