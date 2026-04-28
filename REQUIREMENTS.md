# 📋 Gereksinimler

Bu projeyi yerel ortamında çalıştırmak için aşağıdaki adımları takip et.

---

## 🛠 Geliştirme Ortamı

| Araç | Sürüm | İndirme |
|------|-------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Node.js ile gelir |
| Expo CLI | Latest | `npm install -g expo-cli` |
| Android Studio | Latest | [developer.android.com](https://developer.android.com/studio) |
| JDK | 17+ | Android Studio ile gelir |

---

## 📦 Gerekli Servisler

### 1. Supabase
- [supabase.com](https://supabase.com) adresinden ücretsiz hesap oluştur
- Yeni proje oluştur
- `supabase.js` dosyasına URL ve anon key'i ekle:
```js
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY";
```

### 2. Anthropic (Claude API)
- [anthropic.com](https://anthropic.com) adresinden API key al
- Supabase → Edge Functions → Secrets'a ekle:
  - `ANTHROPIC_API_KEY` = `sk-ant-...`

### 3. Firebase (Push Bildirimler)
- [console.firebase.google.com](https://console.firebase.google.com) adresinden proje oluştur
- Android uygulaması ekle → `google-services.json` indir
- `android/app/google-services.json` konumuna koy
- Google Cloud Console → Credentials → Service Account → JSON key indir
- Supabase → Secrets'a ekle:
  - `FCM_SERVICE_ACCOUNT` = JSON dosyasının içeriği

### 4. Resend (E-posta)
- [resend.com](https://resend.com) adresinden API key al
- Supabase → Secrets'a ekle:
  - `RESEND_API_KEY` = `re_...`

---

## 🗄 Supabase Kurulumu

### Tablolar
Aşağıdaki tabloları Supabase SQL editöründe oluştur:

```sql
-- Kullanıcı rolleri
create table profiles (
  id uuid references auth.users primary key,
  role text check (role in ('dietitian', 'client')),
  full_name text,
  created_at timestamptz default now()
);

-- Diyetisyen profilleri
create table dietitian_profiles (
  id uuid references auth.users primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Diyetisyen ayarları
create table dietitian_settings (
  id uuid default gen_random_uuid() primary key,
  dietitian_id uuid references auth.users unique,
  notif_new_client boolean default true,
  notif_client_left boolean default true,
  notif_program_ending boolean default true,
  notif_program_expired boolean default true,
  notif_appointment boolean default true,
  notif_appointment_before integer default 60,
  work_days integer[] default '{1,2,3,4,5}',
  work_start text default '09:00',
  work_end text default '18:00',
  push_token text,
  recommendations text,
  created_at timestamptz default now()
);

-- Danışan profilleri
create table client_profiles (
  id uuid references auth.users primary key,
  dietitian_id uuid references auth.users,
  full_name text,
  email text,
  height numeric,
  weight numeric,
  target_weight numeric,
  birth_date date,
  age integer,
  gender text,
  allergies text[],
  disliked_foods text[],
  avatar_url text,
  meal_notif_before integer default 15,
  push_token text,
  notif_appointment boolean default true,
  notif_appointment_before integer default 60,
  status text default 'pending',
  joined_at timestamptz,
  created_at timestamptz default now()
);

-- Diyet programları
create table diet_programs (
  id uuid default gen_random_uuid() primary key,
  dietitian_id uuid references auth.users,
  client_id uuid references auth.users,
  title text,
  week_start date,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- Program öğünleri
create table diet_meals (
  id uuid default gen_random_uuid() primary key,
  program_id uuid references diet_programs on delete cascade,
  meal_date date,
  day_of_week integer,
  meal_time text,
  meal_name text,
  meal_type text,
  calories integer,
  portion text,
  notes text,
  created_at timestamptz default now()
);

-- Öğün kayıtları
create table meal_logs (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references auth.users,
  meal_id uuid references diet_meals on delete cascade,
  status text check (status in ('eaten', 'skipped')),
  portion_note text,
  change_note text,
  photo_url text,
  logged_at timestamptz default now()
);

-- Diyetisyen reaksiyonları
create table meal_reactions (
  id uuid default gen_random_uuid() primary key,
  meal_log_id uuid references meal_logs on delete cascade,
  dietitian_id uuid references auth.users,
  reaction_type text default 'message',
  content text,
  created_at timestamptz default now()
);

-- Randevular
create table appointments (
  id uuid default gen_random_uuid() primary key,
  dietitian_id uuid references auth.users,
  client_id uuid references auth.users,
  appointment_date date,
  appointment_time text,
  duration_minutes integer default 30,
  notes text,
  status text default 'scheduled',
  created_at timestamptz default now()
);

-- Tarifler
create table recipes (
  id uuid default gen_random_uuid() primary key,
  dietitian_id uuid references auth.users,
  title text,
  description text,
  image_url text,
  calories integer,
  prep_time integer,
  ingredients jsonb,
  steps jsonb,
  is_shared boolean default false,
  created_at timestamptz default now()
);

-- Beden ölçümleri
create table body_measurements (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references auth.users,
  measured_at date,
  weight numeric,
  waist numeric,
  hip numeric,
  chest numeric,
  arm numeric,
  thigh numeric,
  weight_unit text default 'kg',
  measurement_unit text default 'cm',
  notes text,
  created_at timestamptz default now(),
  unique(client_id, measured_at)
);

-- Bildirimler
create table notifications (
  id uuid default gen_random_uuid() primary key,
  dietitian_id uuid references auth.users,
  type text,
  title text,
  body text,
  is_read boolean default false,
  created_at timestamptz default now()
);
```

### Storage Bucket'ları
Supabase → Storage'da şu bucket'ları oluştur (hepsi Public):
- `avatars`
- `recipe_images`
- `meal-photos`

### Edge Functions
Supabase → Edge Functions'da şu fonksiyonları oluştur:
- `parse-diet-pdf` — PDF analizi
- `analyze-meals` — Alışveriş listesi
- `send-push-notification` — Push bildirim
- `send-invite-email` — Davet emaili

Fonksiyon kodları `supabase/functions/` klasöründe bulunur.

---

## 🚀 Kurulum Adımları

```bash
# 1. Repoyu klonla
git clone https://github.com/kullaniciadi/diyet-life.git
cd diyet-life

# 2. Bağımlılıkları yükle
npm install

# 3. Android için çalıştır
npx expo run:android
```

---

## 📱 Gerekli Expo Paketleri

```bash
npx expo install \
  expo-notifications \
  expo-device \
  expo-image-picker \
  expo-document-picker \
  expo-file-system \
  expo-print \
  expo-sharing \
  @react-native-community/datetimepicker \
  react-native-calendars
```


## 🔐 .gitignore'a Eklenmesi Gerekenler

```
# Learn more https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files

# dependencies
node_modules/

# Expo
.expo/
dist/
web-build/
expo-env.d.ts

# Native
.kotlin/
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# Metro
.metro-health-check*

# debug
npm-debug.*
yarn-debug.*
yarn-error.*

# macOS
.DS_Store
*.pem

# local env files
.env*.local

# typescript
*.tsbuildinfo

# generated native folders
/ios
/android

google-services.json

```
