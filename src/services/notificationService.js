import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "../../supabase";
// ─── TEMEL AYARLAR ────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── İZİN + TOKEN ─────────────────────────────────────────────────────────────

export const registerForPushNotifications = async () => {
  if (!Device.isDevice) {
    console.log("Push bildirimler sadece gerçek cihazda çalışır.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Bildirim izni verilmedi.");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "DietApp Bildirimleri",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#34C759",
    });
    await Notifications.setNotificationChannelAsync("appointments", {
      name: "Randevu Hatırlatmaları",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#007AFF",
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (e) {
    console.log("Token alınamadı:", e.message);
    return null;
  }
};

// Token'ı Supabase'e kaydet
export const savePushToken = async (token) => {
  if (!token) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("dietitian_settings")
    .upsert(
      { dietitian_id: user.id, push_token: token },
      { onConflict: "dietitian_id" },
    );
};

// ─── AYARLARI YÜKlE ───────────────────────────────────────────────────────────

export const loadSettings = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("dietitian_settings")
    .select("*")
    .eq("dietitian_id", user.id)
    .single();

  return data;
};

// ─── ANLИК BİLDİRİM GÖNDER ───────────────────────────────────────────────────

export const sendLocalNotification = async ({
  title,
  body,
  data = {},
  channelId = "default",
}) => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null, // anlık
  });
};

// ─── RANDEVU HATIRLATMASI PLANLA ─────────────────────────────────────────────

export const scheduleAppointmentReminder = async ({
  appointmentId,
  appointmentDate,
  appointmentTime,
  clientName,
  minutesBefore,
}) => {
  // Önce aynı randevu için eski bildirimi iptal et
  await cancelAppointmentReminder(appointmentId);

  const [hour, minute] = appointmentTime.split(":").map(Number);
  const appointmentDateTime = new Date(appointmentDate);
  appointmentDateTime.setHours(hour, minute, 0, 0);

  const triggerDate = new Date(
    appointmentDateTime.getTime() - minutesBefore * 60 * 1000,
  );

  if (triggerDate <= new Date()) return null; // Zaten geçmiş

  const beforeText = formatMinutes(minutesBefore);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "📅 Randevu Hatırlatması",
      body: `${clientName} ile randevunuz ${beforeText} sonra.`,
      data: { appointmentId, type: "appointment" },
      sound: true,
    },
    trigger: { date: triggerDate, channelId: "appointments" },
  });

  // Bildirim ID'sini sakla (iptal için)
  return id;
};

export const cancelAppointmentReminder = async (appointmentId) => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.appointmentId === appointmentId) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
};

export const cancelAllAppointmentReminders = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

// ─── ETKİNLİK BİLDİRİMLERİ ───────────────────────────────────────────────────

export const notifyNewClient = async (clientName) => {
  const n = {
    type: "new_client",
    title: "🎉 Yeni Danışan",
    body: `${clientName} danışanlarınıza katıldı.`,
  };
  await Promise.all([
    sendLocalNotification({ ...n, data: { type: n.type } }),
    saveNotificationToDB(n),
  ]);
};

export const notifyClientLeft = async (clientName) => {
  const n = {
    type: "client_left",
    title: "👋 Danışan Ayrıldı",
    body: `${clientName} danışan listenizden çıkarıldı.`,
  };
  await Promise.all([
    sendLocalNotification({ ...n, data: { type: n.type } }),
    saveNotificationToDB(n),
  ]);
};

export const notifyProgramEnding = async (clientName, daysLeft) => {
  const body =
    daysLeft === 0
      ? `${clientName}'in programı bugün bitiyor.`
      : `${clientName}'in programı ${daysLeft} gün sonra bitiyor.`;
  const n = { type: "program_ending", title: "⚠️ Program Bitiyor", body };
  await Promise.all([
    sendLocalNotification({ ...n, data: { type: n.type } }),
    saveNotificationToDB(n),
  ]);
};

export const notifyProgramExpired = async (clientName) => {
  const n = {
    type: "program_expired",
    title: "🔴 Program Süresi Doldu",
    body: `${clientName}'in program süresi doldu. Yeni program oluşturmanız gerekiyor.`,
  };
  await Promise.all([
    sendLocalNotification({ ...n, data: { type: n.type } }),
    saveNotificationToDB(n),
  ]);
};

// ─── PROGRAM BİTİŞ KONTROLÜ (uygulama açıldığında çalıştır) ─────────────────

export const checkProgramExpirations = async (settings) => {
  if (!settings?.notif_program_ending && !settings?.notif_program_expired)
    return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const todayStr = new Date().toISOString().split("T")[0];
  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);
  const in3DaysStr = in3Days.toISOString().split("T")[0];

  // Aktif danışanların programlarını çek
  const { data: programs } = await supabase
    .from("diet_programs")
    .select("*, client_profiles(full_name)")
    .eq("dietitian_id", user.id)
    .gte("end_date", todayStr)
    .lte("end_date", in3DaysStr);

  if (!programs) return;

  for (const prog of programs) {
    const clientName = prog.client_profiles?.full_name || "Danışan";
    const endDate = new Date(prog.end_date);
    const today = new Date(todayStr);
    const daysLeft = Math.round((endDate - today) / (1000 * 60 * 60 * 24));

    if (daysLeft === 0 && settings?.notif_program_ending) {
      await notifyProgramEnding(clientName, 0);
    } else if (daysLeft <= 3 && settings?.notif_program_ending) {
      await notifyProgramEnding(clientName, daysLeft);
    }
  }

  // Süresi dolmuş programları kontrol et
  if (settings?.notif_program_expired) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data: expired } = await supabase
      .from("diet_programs")
      .select("*, client_profiles(full_name)")
      .eq("dietitian_id", user.id)
      .eq("end_date", yesterdayStr); // dün biten = bugün süresi doldu

    if (expired) {
      for (const prog of expired) {
        const clientName = prog.client_profiles?.full_name || "Danışan";
        await notifyProgramExpired(clientName);
      }
    }
  }
};

// ─── YARDIMCI ────────────────────────────────────────────────────────────────

export const formatMinutes = (minutes) => {
  if (minutes < 60) return `${minutes} dakika`;
  if (minutes === 60) return "1 saat";
  if (minutes < 1440) return `${Math.round(minutes / 60)} saat`;
  if (minutes === 1440) return "1 gün";
  return `${Math.round(minutes / 1440)} gün`;
};

export const REMINDER_OPTIONS = [
  { label: "15 dakika önce", value: 15 },
  { label: "30 dakika önce", value: 30 },
  { label: "1 saat önce", value: 60 },
  { label: "2 saat önce", value: 120 },
  { label: "3 saat önce", value: 180 },
  { label: "6 saat önce", value: 360 },
  { label: "1 gün önce", value: 1440 },
  { label: "2 gün önce", value: 2880 },
  { label: "3 gün önce", value: 4320 },
];

export const DAYS_TR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
export const DAYS_FULL_TR = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];
