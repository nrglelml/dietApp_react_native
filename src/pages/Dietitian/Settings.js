import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  Modal,
  Image,
  Switch,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../../supabase";
import { DietitianTabBar } from "../../components";
import {
  registerForPushNotifications,
  savePushToken,
  REMINDER_OPTIONS,
  DAYS_TR,
  DAYS_FULL_TR,
} from "../../services/notificationService";

const APP_VERSION = "1.0.0";

const SUBSCRIPTION_PLANS = {
  free: {
    label: "Ücretsiz",
    color: "#8E8E93",
    icon: "person-outline",
    limit: "5 danışan",
  },
  pro: {
    label: "Pro",
    color: "#007AFF",
    icon: "star-outline",
    limit: "Sınırsız danışan",
  },
  premium: {
    label: "Premium",
    color: "#AF52DE",
    icon: "diamond-outline",
    limit: "Sınırsız + Öncelikli destek",
  },
};

// ─── ANA COMPONENT ────────────────────────────────────────────────────────────

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  // Profil
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    avatar_url: null,
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "" });
  const [localAvatar, setLocalAvatar] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Ayarlar
  const [settings, setSettings] = useState({
    notif_new_client: true,
    notif_client_left: true,
    notif_program_ending: true,
    notif_program_expired: true,
    notif_appointment: true,
    notif_appointment_before: 60,
    work_days: [1, 2, 3, 4, 5],
    work_start: "09:00",
    work_end: "18:00",
    recommendations: "",
  });

  // Reminder seçici modal
  const [reminderModalVisible, setReminderModalVisible] = useState(false);

  // Abonelik (mock)
  const [plan] = useState("free");

  useEffect(() => {
    loadAll();
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    const token = await registerForPushNotifications();
    if (token) await savePushToken(token);
  };

  const loadAll = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Profil — dietitian_profiles ana kaynak
      const { data: dytProf } = await supabase
        .from("dietitian_profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();
      const fullName = dytProf?.full_name || "";
      const avatarUrl = dytProf?.avatar_url || null;
      setProfile({
        full_name: fullName,
        email: user.email,
        avatar_url: avatarUrl,
      });
      setProfileForm({ full_name: fullName });

      // Ayarlar
      const { data: s } = await supabase
        .from("dietitian_settings")
        .select("*")
        .eq("dietitian_id", user.id)
        .single();
      if (s) {
        setSettings({
          notif_new_client: s.notif_new_client ?? true,
          notif_client_left: s.notif_client_left ?? true,
          notif_program_ending: s.notif_program_ending ?? true,
          notif_program_expired: s.notif_program_expired ?? true,
          notif_appointment: s.notif_appointment ?? true,
          notif_appointment_before: s.notif_appointment_before ?? 60,
          work_days: s.work_days ?? [1, 2, 3, 4, 5],
          work_start: s.work_start ?? "09:00",
          work_end: s.work_end ?? "18:00",
          recommendations: s.recommendations || "",
        });
      }
    } catch (e) {
      console.log("loadAll error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, []);

  // ─── PROFİL ────────────────────────────────────────────────────────────────

  const pickAvatar = () => {
    Alert.alert("Profil Fotoğrafı", "Kaynak seçin", [
      {
        text: "Kamera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") return;
          const r = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!r.canceled) setLocalAvatar(r.assets[0].uri);
        },
      },
      {
        text: "Galeri",
        onPress: async () => {
          const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") return;
          const r = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!r.canceled) setLocalAvatar(r.assets[0].uri);
        },
      },
      { text: "İptal", style: "cancel" },
    ]);
  };

  const uploadAvatar = async (uri, userId) => {
    setUploadingAvatar(true);
    try {
      const ext = uri.split(".").pop() || "jpg";
      const fileName = `${userId}/avatar.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      await supabase.storage.from("avatars").upload(fileName, arrayBuffer, {
        contentType: `image/${ext}`,
        upsert: true,
      });
      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      return data.publicUrl + "?t=" + Date.now();
    } catch (e) {
      Alert.alert("Hata", "Fotoğraf yüklenemedi: " + e.message);
      return null;
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    if (!profileForm.full_name.trim()) {
      Alert.alert("Uyarı", "Ad Soyad zorunludur.");
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let avatarUrl = profile.avatar_url;
      if (localAvatar) avatarUrl = await uploadAvatar(localAvatar, user.id);

      await supabase
        .from("dietitian_profiles")
        .update({
          full_name: profileForm.full_name.trim(),
          avatar_url: avatarUrl,
        })
        .eq("id", user.id);
      // profiles tablosunu da güncelle (avatar_url yoksa sadece full_name)
      await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name.trim(),
        })
        .eq("id", user.id);

      setProfile((p) => ({
        ...p,
        full_name: profileForm.full_name.trim(),
        avatar_url: avatarUrl,
      }));
      setLocalAvatar(null);
      setEditingProfile(false);
      Alert.alert("✓", "Profil güncellendi.");
    } catch (e) {
      Alert.alert("Hata", e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── AYARLARI KAYDET ───────────────────────────────────────────────────────

  const saveSettings = async (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("dietitian_settings").upsert(
        {
          dietitian_id: user.id,
          ...merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "dietitian_id" },
      );
    } catch (e) {
      console.log("Settings save error:", e.message);
    }
  };

  const toggleNotif = (key) => saveSettings({ [key]: !settings[key] });

  const toggleWorkDay = (day) => {
    const days = settings.work_days.includes(day)
      ? settings.work_days.filter((d) => d !== day)
      : [...settings.work_days, day].sort();
    saveSettings({ work_days: days });
  };

  // ─── ÇIKIŞ ─────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert(
      "Çıkış Yap",
      "Hesabınızdan çıkmak istediğinizden emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Çıkış Yap",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: "Welcome" }],
              });
            } catch (error) {
              console.error("Çıkış yapılırken hata oluştu:", error.message);
            }
          },
        },
      ],
    );
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );

  const avatarUri = localAvatar || profile.avatar_url;
  const planInfo = SUBSCRIPTION_PLANS[plan];
  const reminderLabel =
    REMINDER_OPTIONS.find((o) => o.value === settings.notif_appointment_before)
      ?.label || "1 saat önce";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ayarlar</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#34C759"
          />
        }
      >
        {/* ── PROFİL KARTI ─────────────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            onPress={editingProfile ? pickAvatar : undefined}
            style={styles.avatarWrapper}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {profile.full_name ? profile.full_name[0].toUpperCase() : "D"}
                </Text>
              </View>
            )}
            {editingProfile && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={12} color="#FFF" />
              </View>
            )}
            {uploadingAvatar && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#FFF" />
              </View>
            )}
          </TouchableOpacity>

          {editingProfile ? (
            <View style={styles.profileEditForm}>
              <TextInput
                style={styles.profileInput}
                value={profileForm.full_name}
                onChangeText={(v) =>
                  setProfileForm((f) => ({ ...f, full_name: v }))
                }
                placeholder="Ad Soyad"
              />
              <Text style={styles.profileEmail}>{profile.email}</Text>
              <View style={styles.profileEditBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setEditingProfile(false);
                    setLocalAvatar(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={saveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Kaydet</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {profile.full_name || "Ad Soyad"}
              </Text>
              <Text style={styles.profileEmail}>{profile.email}</Text>
              <TouchableOpacity
                style={styles.editProfileBtn}
                onPress={() => setEditingProfile(true)}
              >
                <Ionicons name="pencil-outline" size={14} color="#007AFF" />
                <Text style={styles.editProfileBtnText}>Profili Düzenle</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── ABONELİK ─────────────────────────────────────────────────── */}
        <SectionHeader title="Abonelik" />
        <View style={styles.card}>
          <View style={styles.planRow}>
            <View
              style={[
                styles.planIconWrap,
                { backgroundColor: planInfo.color + "20" },
              ]}
            >
              <Ionicons name={planInfo.icon} size={22} color={planInfo.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planLabel}>{planInfo.label} Plan</Text>
              <Text style={styles.planLimit}>{planInfo.limit}</Text>
            </View>
            {plan === "free" && (
              <TouchableOpacity style={styles.upgradeBtn}>
                <Text style={styles.upgradeBtnText}>Yükselt</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── BİLDİRİMLER ──────────────────────────────────────────────── */}
        <SectionHeader title="Bildirimler" />
        <View style={styles.card}>
          <NotifRow
            icon="person-add-outline"
            iconColor="#34C759"
            label="Yeni Danışan Eklendiğinde"
            value={settings.notif_new_client}
            onToggle={() => toggleNotif("notif_new_client")}
          />
          <Divider />
          <NotifRow
            icon="person-remove-outline"
            iconColor="#FF3B30"
            label="Danışan Ayrıldığında"
            value={settings.notif_client_left}
            onToggle={() => toggleNotif("notif_client_left")}
          />
          <Divider />
          <NotifRow
            icon="warning-outline"
            iconColor="#FF9500"
            label="Program Bitiyor (3 gün kala)"
            value={settings.notif_program_ending}
            onToggle={() => toggleNotif("notif_program_ending")}
          />
          <Divider />
          <NotifRow
            icon="alert-circle-outline"
            iconColor="#FF3B30"
            label="Program Süresi Doldu"
            value={settings.notif_program_expired}
            onToggle={() => toggleNotif("notif_program_expired")}
          />
          <Divider />
          <NotifRow
            icon="calendar-outline"
            iconColor="#007AFF"
            label="Randevu Hatırlatması"
            value={settings.notif_appointment}
            onToggle={() => toggleNotif("notif_appointment")}
          />
          {settings.notif_appointment && (
            <TouchableOpacity
              style={styles.subRow}
              onPress={() => setReminderModalVisible(true)}
            >
              <Text style={styles.subRowLabel}>Hatırlatma zamanı</Text>
              <View style={styles.subRowValue}>
                <Text style={styles.subRowValueText}>{reminderLabel}</Text>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </View>
            </TouchableOpacity>
          )}
        </View>
        {/* ── ÖNERİLER ─────────────────────────────────────────────────── */}
        <SectionHeader title="Danışan Önerileri" />
        <View style={styles.card}>
          <Text style={[styles.subLabel, { paddingBottom: 4 }]}>
            Tüm danışanlarınızın ana sayfasında görünecek
          </Text>
          <TextInput
            style={styles.recommendationsInput}
            placeholder="Öğünlerinizi belirtilen saatlerde tüketin...&#10;Günde en az 2.5 Lt su için...&#10;Tuz tüketimini sınırlandırın..."
            value={settings.recommendations}
            onChangeText={(v) =>
              setSettings((s) => ({ ...s, recommendations: v }))
            }
            onBlur={() =>
              saveSettings({ recommendations: settings.recommendations })
            }
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
        </View>
        {/* ── ÇALIŞMA SAATLERİ ─────────────────────────────────────────── */}
        <SectionHeader title="Çalışma Saatleri" />
        <View style={styles.card}>
          <Text style={styles.subLabel}>Çalışma Günleri</Text>
          <View style={styles.daysRow}>
            {DAYS_TR.map((day, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.dayBtn,
                  settings.work_days.includes(i) && styles.dayBtnActive,
                ]}
                onPress={() => toggleWorkDay(i)}
              >
                <Text
                  style={[
                    styles.dayBtnText,
                    settings.work_days.includes(i) && styles.dayBtnTextActive,
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Divider />
          <Text style={[styles.subLabel, { marginTop: 12 }]}>
            Çalışma Saatleri
          </Text>
          <View style={styles.timeRow}>
            <View style={styles.timeInput}>
              <Text style={styles.timeLabel}>Başlangıç</Text>
              <TextInput
                style={styles.timeField}
                value={settings.work_start}
                onChangeText={(v) =>
                  setSettings((s) => ({ ...s, work_start: v }))
                }
                onBlur={() => saveSettings({ work_start: settings.work_start })}
                placeholder="09:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <Ionicons
              name="arrow-forward"
              size={18}
              color="#C7C7CC"
              style={{ marginTop: 20 }}
            />
            <View style={styles.timeInput}>
              <Text style={styles.timeLabel}>Bitiş</Text>
              <TextInput
                style={styles.timeField}
                value={settings.work_end}
                onChangeText={(v) =>
                  setSettings((s) => ({ ...s, work_end: v }))
                }
                onBlur={() => saveSettings({ work_end: settings.work_end })}
                placeholder="18:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>
        </View>

        {/* ── UYGULAMA HAKKINDA ─────────────────────────────────────────── */}
        <SectionHeader title="Uygulama" />
        <View style={styles.card}>
          <InfoRow label="Sürüm" value={`v${APP_VERSION}`} />
          <Divider />
          <InfoRow label="Geliştirici" value="DietApp Team" />
          <Divider />
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkRowText}>Gizlilik Politikası</Text>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkRowText}>Kullanım Koşulları</Text>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* ── ÇIKIŞ ────────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <DietitianTabBar />

      {/* ── REMINDER SEÇİCİ MODAL ─────────────────────────────────────── */}
      <Modal
        visible={reminderModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reminderModal}>
            <View style={styles.reminderModalHeader}>
              <Text style={styles.reminderModalTitle}>Hatırlatma Zamanı</Text>
              <TouchableOpacity onPress={() => setReminderModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {REMINDER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.reminderOption}
                  onPress={() => {
                    saveSettings({ notif_appointment_before: opt.value });
                    setReminderModalVisible(false);
                  }}
                >
                  <Text style={styles.reminderOptionText}>{opt.label}</Text>
                  {settings.notif_appointment_before === opt.value && (
                    <Ionicons name="checkmark" size={20} color="#34C759" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── ALT COMPONENT'LAR ────────────────────────────────────────────────────────

const SectionHeader = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

const Divider = () => <View style={styles.divider} />;

const NotifRow = ({ icon, iconColor, label, value, onToggle }) => (
  <View style={styles.notifRow}>
    <View style={[styles.notifIcon, { backgroundColor: iconColor + "18" }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <Text style={styles.notifLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: "#E5E5EA", true: "#34C75960" }}
      thumbColor={value ? "#34C759" : "#FFF"}
      ios_backgroundColor="#E5E5EA"
    />
  </View>
);

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1C1C1E" },

  // Profil
  profileCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  avatarWrapper: { position: "relative" },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E5F9ED",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { fontSize: 28, fontWeight: "800", color: "#34C759" },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  avatarOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  profileEmail: { fontSize: 13, color: "#8E8E93", marginTop: 2 },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  editProfileBtnText: { fontSize: 13, color: "#007AFF", fontWeight: "600" },
  profileEditForm: { flex: 1 },
  profileInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: "#1C1C1E",
    marginBottom: 4,
  },
  profileEditBtns: { flexDirection: "row", gap: 8, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, color: "#8E8E93", fontWeight: "600" },
  saveBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#34C759",
    alignItems: "center",
  },
  saveBtnText: { fontSize: 14, color: "#FFF", fontWeight: "700" },

  // Section
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  divider: { height: 1, backgroundColor: "#F2F2F7", marginLeft: 16 },

  // Plan
  planRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  planIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  planLabel: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  planLimit: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  upgradeBtn: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  upgradeBtnText: { fontSize: 13, color: "#FFF", fontWeight: "700" },

  // Bildirim
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notifIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  notifLabel: { flex: 1, fontSize: 14, color: "#1C1C1E", fontWeight: "500" },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginLeft: 58,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  subRowLabel: { fontSize: 13, color: "#8E8E93" },
  subRowValue: { flexDirection: "row", alignItems: "center", gap: 4 },
  subRowValueText: { fontSize: 13, color: "#007AFF", fontWeight: "600" },

  // Çalışma saatleri
  subLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  daysRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexWrap: "wrap",
  },
  dayBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  dayBtnActive: { backgroundColor: "#E5F9ED" },
  dayBtnText: { fontSize: 12, fontWeight: "700", color: "#8E8E93" },
  dayBtnTextActive: { color: "#34C759" },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  timeInput: { flex: 1 },
  timeLabel: { fontSize: 12, color: "#8E8E93", marginBottom: 4 },
  timeField: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    textAlign: "center",
  },

  // Info
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  infoLabel: { fontSize: 14, color: "#1C1C1E" },
  infoValue: { fontSize: 14, color: "#8E8E93" },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  linkRowText: { fontSize: 14, color: "#1C1C1E" },

  // Çıkış
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    padding: 16,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#FF3B30",
  },
  logoutText: { fontSize: 16, color: "#FF3B30", fontWeight: "700" },

  // Reminder modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  reminderModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "60%",
    padding: 20,
  },
  reminderModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  reminderModalTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  reminderOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  reminderOptionText: { fontSize: 15, color: "#1C1C1E" },
  recommendationsInput: {
    margin: 12,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#1C1C1E",
    minHeight: 180,
    lineHeight: 22,
  },
});

export default Settings;
