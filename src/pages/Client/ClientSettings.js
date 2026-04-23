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
  RefreshControl,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../../../supabase";
import { ClientTabBar } from "../../components";

const REMINDER_OPTIONS = [
  { label: "5 dakika önce", value: 5 },
  { label: "10 dakika önce", value: 10 },
  { label: "15 dakika önce", value: 15 },
  { label: "30 dakika önce", value: 30 },
  { label: "1 saat önce", value: 60 },
  { label: "2 saat önce", value: 120 },
];

const MEASUREMENT_FIELDS = [
  { key: "weight", label: "Kilo", color: "#007AFF" },
  { key: "waist", label: "Bel", color: "#FF9500" },
  { key: "hip", label: "Kalça", color: "#AF52DE" },
  { key: "chest", label: "Göğüs", color: "#FF2D55" },
  { key: "arm", label: "Kol", color: "#34C759" },
  { key: "thigh", label: "Uyluk", color: "#5AC8FA" },
];

const toLocalDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const Divider = () => <View style={styles.divider} />;
const SectionHeader = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

const ClientSettings = ({ route }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    avatar_url: null,
    height: "",
    weight: "",
    target_weight: "",
    birth_date: "",
    age: "",
    gender: "",
    allergies: [],
    disliked_foods: [],
    meal_notif_before: 15,
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    height: "",
    weight: "",
    target_weight: "",
    birth_date: "",
    age: "",
    gender: "",
  });
  const [localAvatar, setLocalAvatar] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [allergyInput, setAllergyInput] = useState("");
  const [dislikedInput, setDislikedInput] = useState("");

  const [measurements, setMeasurements] = useState([]);
  const [measureModalVisible, setMeasureModalVisible] = useState(false);
  const [measureForm, setMeasureForm] = useState({
    weight: "",
    waist: "",
    hip: "",
    chest: "",
    arm: "",
    thigh: "",
    weight_unit: "kg",
    measurement_unit: "cm",
    notes: "",
    measured_at: toLocalDateStr(),
  });
  const [savingMeasure, setSavingMeasure] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);

  useEffect(() => {
    loadAll();
    if (route?.params?.openMeasurement) setMeasureModalVisible(true);
  }, []);

  const loadAll = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: prof } = await supabase
        .from("client_profiles")
        .select(
          "full_name, avatar_url, height, weight, target_weight, birth_date, age, gender, allergies, disliked_foods, meal_notif_before",
        )
        .eq("id", user.id)
        .single();

      if (prof) {
        const p = {
          full_name: prof.full_name || "",
          email: user.email,
          avatar_url: prof.avatar_url || null,
          height: prof.height ? String(prof.height) : "",
          weight: prof.weight ? String(prof.weight) : "",
          target_weight: prof.target_weight ? String(prof.target_weight) : "",
          birth_date: prof.birth_date || "",
          age: prof.age ? String(prof.age) : "",
          gender: prof.gender || "",
          allergies: prof.allergies || [],
          disliked_foods: prof.disliked_foods || [],
          meal_notif_before: prof.meal_notif_before || 15,
        };
        setProfile(p);
        setProfileForm({
          full_name: p.full_name,
          height: p.height,
          weight: p.weight,
          target_weight: p.target_weight,
          birth_date: p.birth_date,
          age: p.age,
          gender: p.gender,
        });
      }

      const { data: meas } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("client_id", user.id)
        .order("measured_at", { ascending: false })
        .limit(10);
      setMeasurements(meas || []);
    } catch (e) {
      console.log("ClientSettings loadAll:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, []);

  // ─── AVATAR ────────────────────────────────────────────────────────────────

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

  const uploadAvatar = async (uri) => {
    setUploadingAvatar(true);
    try {
      const ext = uri.split(".").pop() || "jpg";
      const fileName = `${userId}/avatar_client.${ext}`;
      const res = await fetch(uri);
      const blob = await res.blob();
      const buf = await new Response(blob).arrayBuffer();
      await supabase.storage
        .from("avatars")
        .upload(fileName, buf, { contentType: `image/${ext}`, upsert: true });
      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      return data.publicUrl + "?t=" + Date.now();
    } catch (e) {
      Alert.alert("Hata", "Fotoğraf yüklenemedi: " + e.message);
      return null;
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ─── PROFİL KAYDET ────────────────────────────────────────────────────────

  const saveProfile = async () => {
    if (!profileForm.full_name.trim()) {
      Alert.alert("Uyarı", "Ad Soyad zorunludur.");
      return;
    }
    setSaving(true);
    try {
      let avatarUrl = profile.avatar_url;
      if (localAvatar) avatarUrl = await uploadAvatar(localAvatar);

      const payload = {
        full_name: profileForm.full_name.trim(),
        avatar_url: avatarUrl,
        height: profileForm.height ? parseFloat(profileForm.height) : null,
        weight: profileForm.weight ? parseFloat(profileForm.weight) : null,
        target_weight: profileForm.target_weight
          ? parseFloat(profileForm.target_weight)
          : null,
        birth_date: profileForm.birth_date || null,
        age: profileForm.age ? parseInt(profileForm.age) : null,
        gender: profileForm.gender || null,
      };

      const { error } = await supabase
        .from("client_profiles")
        .update(payload)
        .eq("id", userId);
      if (error) throw error;
      setProfile((p) => ({
        ...p,
        ...payload,
        email: p.email,
        allergies: p.allergies,
        disliked_foods: p.disliked_foods,
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

  // ─── ALERJİ / SEVMEDİĞİ ───────────────────────────────────────────────────

  const addAllergy = async () => {
    const val = allergyInput.trim();
    if (!val) return;
    const updated = [...profile.allergies, val];
    await supabase
      .from("client_profiles")
      .update({ allergies: updated })
      .eq("id", userId);
    setProfile((p) => ({ ...p, allergies: updated }));
    setAllergyInput("");
  };

  const removeAllergy = async (item) => {
    const updated = profile.allergies.filter((a) => a !== item);
    await supabase
      .from("client_profiles")
      .update({ allergies: updated })
      .eq("id", userId);
    setProfile((p) => ({ ...p, allergies: updated }));
  };

  const addDisliked = async () => {
    const val = dislikedInput.trim();
    if (!val) return;
    const updated = [...profile.disliked_foods, val];
    await supabase
      .from("client_profiles")
      .update({ disliked_foods: updated })
      .eq("id", userId);
    setProfile((p) => ({ ...p, disliked_foods: updated }));
    setDislikedInput("");
  };

  const removeDisliked = async (item) => {
    const updated = profile.disliked_foods.filter((d) => d !== item);
    await supabase
      .from("client_profiles")
      .update({ disliked_foods: updated })
      .eq("id", userId);
    setProfile((p) => ({ ...p, disliked_foods: updated }));
  };

  // ─── BİLDİRİM ─────────────────────────────────────────────────────────────

  const saveReminderPref = async (value) => {
    setProfile((p) => ({ ...p, meal_notif_before: value }));
    await supabase
      .from("client_profiles")
      .update({ meal_notif_before: value })
      .eq("id", userId);
  };

  // ─── ÖLÇÜM ────────────────────────────────────────────────────────────────

  const saveMeasurement = async () => {
    const hasData = MEASUREMENT_FIELDS.some((f) => measureForm[f.key]);
    if (!hasData) {
      Alert.alert("Uyarı", "En az bir ölçüm değeri girin.");
      return;
    }
    setSavingMeasure(true);
    try {
      const payload = {
        client_id: userId,
        measured_at: measureForm.measured_at,
        weight_unit: measureForm.weight_unit,
        measurement_unit: measureForm.measurement_unit,
        notes: measureForm.notes || null,
      };
      MEASUREMENT_FIELDS.forEach((f) => {
        payload[f.key] = measureForm[f.key]
          ? parseFloat(measureForm[f.key])
          : null;
      });
      const { error } = await supabase
        .from("body_measurements")
        .upsert(payload, { onConflict: "client_id,measured_at" });
      if (error) throw error;
      setMeasureModalVisible(false);
      setMeasureForm({
        weight: "",
        waist: "",
        hip: "",
        chest: "",
        arm: "",
        thigh: "",
        weight_unit: "kg",
        measurement_unit: "cm",
        notes: "",
        measured_at: toLocalDateStr(),
      });
      await loadAll();
    } catch (e) {
      Alert.alert("Hata", e.message);
    } finally {
      setSavingMeasure(false);
    }
  };

  const deleteMeasurement = (id) => {
    Alert.alert("Ölçümü Sil", "Bu ölçüm silinsin mi?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await supabase.from("body_measurements").delete().eq("id", id);
          await loadAll();
        },
      },
    ]);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const reminderLabel =
    REMINDER_OPTIONS.find((o) => o.value === profile.meal_notif_before)
      ?.label || "15 dakika önce";
  const avatarUri = localAvatar || profile.avatar_url;

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );

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
        keyboardShouldPersistTaps="handled"
      >
        {/* ── PROFİL ───────────────────────────────────────────────────── */}
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
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.profileInput}
                value={profileForm.full_name}
                placeholder="Ad Soyad"
                onChangeText={(v) =>
                  setProfileForm((f) => ({ ...f, full_name: v }))
                }
              />
              <Text style={styles.profileEmail}>{profile.email}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
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
            <View style={{ flex: 1 }}>
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

        {/* ── KİŞİSEL BİLGİLER ────────────────────────────────────────── */}
        <SectionHeader title="Kişisel Bilgiler" />
        <View style={styles.card}>
          {[
            { key: "height", label: "Boy", placeholder: "170", suffix: "cm" },
            {
              key: "weight",
              label: "Mevcut Kilo",
              placeholder: "70",
              suffix: "kg",
            },
            {
              key: "target_weight",
              label: "Hedef Kilo",
              placeholder: "65",
              suffix: "kg",
            },
            { key: "age", label: "Yaş", placeholder: "25", suffix: "yaş" },
          ].map((field, i) => (
            <View key={field.key}>
              {i > 0 && <Divider />}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{field.label}</Text>
                <View style={styles.infoInputRow}>
                  <TextInput
                    style={styles.infoInput}
                    value={profileForm[field.key]}
                    placeholder={field.placeholder}
                    keyboardType="numeric"
                    onChangeText={(v) =>
                      setProfileForm((f) => ({ ...f, [field.key]: v }))
                    }
                  />
                  <Text style={styles.infoSuffix}>{field.suffix}</Text>
                </View>
              </View>
            </View>
          ))}

          <Divider />
          {/* Doğum Tarihi */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Doğum Tarihi</Text>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.datePickerText}>
                {profileForm.birth_date
                  ? formatDate(profileForm.birth_date)
                  : "Seçin"}
              </Text>
              <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={
                profileForm.birth_date
                  ? new Date(profileForm.birth_date + "T12:00:00")
                  : new Date(2000, 0, 1)
              }
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              minimumDate={new Date(1920, 0, 1)}
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === "ios");
                if (date) {
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, "0");
                  const d = String(date.getDate()).padStart(2, "0");
                  setProfileForm((f) => ({
                    ...f,
                    birth_date: `${y}-${m}-${d}`,
                  }));
                }
              }}
            />
          )}

          <Divider />
          {/* Cinsiyet */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cinsiyet</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {["kadın", "erkek"].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.genderBtn,
                    profileForm.gender === g && styles.genderBtnActive,
                  ]}
                  onPress={() => setProfileForm((f) => ({ ...f, gender: g }))}
                >
                  <Text
                    style={[
                      styles.genderBtnText,
                      profileForm.gender === g && styles.genderBtnTextActive,
                    ]}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Kaydet butonu */}
        </View>

        {/* ── ALERJİLER ─────────────────────────────────────────────────── */}
        <SectionHeader title="Alerjiler" />
        <View style={styles.card}>
          <View style={styles.tagContainer}>
            {profile.allergies.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.tag}
                onPress={() => removeAllergy(item)}
              >
                <Text style={styles.tagText}>{item}</Text>
                <Ionicons name="close" size={12} color="#FF3B30" />
              </TouchableOpacity>
            ))}
          </View>
          {profile.allergies.length > 0 && <Divider />}
          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagInput}
              placeholder="Alerji ekle (örn: fıstık)"
              value={allergyInput}
              onChangeText={setAllergyInput}
              onSubmitEditing={addAllergy}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.tagAddBtn} onPress={addAllergy}>
              <Ionicons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SEVMEDİĞİ BESİNLER ───────────────────────────────────────── */}
        <SectionHeader title="Sevmediği Besinler" />
        <View style={styles.card}>
          <View style={styles.tagContainer}>
            {profile.disliked_foods.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.tag,
                  { borderColor: "#FF9500", backgroundColor: "#FFF8EE" },
                ]}
                onPress={() => removeDisliked(item)}
              >
                <Text style={[styles.tagText, { color: "#FF9500" }]}>
                  {item}
                </Text>
                <Ionicons name="close" size={12} color="#FF9500" />
              </TouchableOpacity>
            ))}
          </View>
          {profile.disliked_foods.length > 0 && <Divider />}
          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagInput}
              placeholder="Besin ekle (örn: brokoli)"
              value={dislikedInput}
              onChangeText={setDislikedInput}
              onSubmitEditing={addDisliked}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.tagAddBtn, { backgroundColor: "#FF9500" }]}
              onPress={addDisliked}
            >
              <Ionicons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── BEDEN ÖLÇÜLERİ ───────────────────────────────────────────── */}
        <SectionHeader title="Beden Ölçümleri" />
        <View style={styles.card}>
          {measurements.length === 0 ? (
            <View style={styles.emptyMeas}>
              <Text style={styles.emptyMeasText}>Henüz ölçüm eklenmemiş</Text>
            </View>
          ) : (
            measurements.slice(0, 5).map((m, i) => (
              <View key={m.id}>
                {i > 0 && <Divider />}
                <View style={styles.measRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.measDate}>
                      {formatDate(m.measured_at)}
                    </Text>
                    <View style={styles.measValues}>
                      {MEASUREMENT_FIELDS.map((f) =>
                        m[f.key] ? (
                          <View key={f.key} style={styles.measChip}>
                            <Text
                              style={[styles.measChipLabel, { color: f.color }]}
                            >
                              {f.label}
                            </Text>
                            <Text style={styles.measChipValue}>
                              {m[f.key]}{" "}
                              {f.key === "weight"
                                ? m.weight_unit
                                : m.measurement_unit}
                            </Text>
                          </View>
                        ) : null,
                      )}
                    </View>
                    {m.notes ? (
                      <Text style={styles.measNotes}>{m.notes}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteMeasurement(m.id)}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <TouchableOpacity
            style={styles.addMeasBtn}
            onPress={() => {
              setMeasureForm({
                weight: "",
                waist: "",
                hip: "",
                chest: "",
                arm: "",
                thigh: "",
                weight_unit: "kg",
                measurement_unit: "cm",
                notes: "",
                measured_at: toLocalDateStr(),
              });
              setMeasureModalVisible(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color="#34C759" />
            <Text style={styles.addMeasBtnText}>Yeni Ölçüm Ekle</Text>
          </TouchableOpacity>
        </View>

        {/* ── BİLDİRİM ─────────────────────────────────────────────────── */}
        <SectionHeader title="Öğün Bildirimi" />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.reminderRow}
            onPress={() => setReminderModalVisible(true)}
          >
            <View style={styles.reminderIcon}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#34C759"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderLabel}>Öğün Hatırlatması</Text>
              <Text style={styles.reminderSub}>
                Öğün saatinden önce bildirim al
              </Text>
            </View>
            <Text style={styles.reminderValue}>{reminderLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <ClientTabBar />

      {/* ── ÖLÇÜM MODAL ──────────────────────────────────────────────── */}
      <Modal
        visible={measureModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMeasureModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setMeasureModalVisible(false)}
          />
          <View style={styles.measureModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Ölçüm</Text>
              <TouchableOpacity onPress={() => setMeasureModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Tarih</Text>
              <TextInput
                style={styles.fieldInput}
                value={measureForm.measured_at}
                onChangeText={(v) =>
                  setMeasureForm((f) => ({ ...f, measured_at: v }))
                }
                placeholder="YYYY-AA-GG"
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Kilo Birimi</Text>
                  <View style={styles.unitRow}>
                    {["kg", "lb"].map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[
                          styles.unitBtn,
                          measureForm.weight_unit === u && styles.unitBtnActive,
                        ]}
                        onPress={() =>
                          setMeasureForm((f) => ({ ...f, weight_unit: u }))
                        }
                      >
                        <Text
                          style={[
                            styles.unitBtnText,
                            measureForm.weight_unit === u &&
                              styles.unitBtnTextActive,
                          ]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Ölçüm Birimi</Text>
                  <View style={styles.unitRow}>
                    {["cm", "in"].map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[
                          styles.unitBtn,
                          measureForm.measurement_unit === u &&
                            styles.unitBtnActive,
                        ]}
                        onPress={() =>
                          setMeasureForm((f) => ({ ...f, measurement_unit: u }))
                        }
                      >
                        <Text
                          style={[
                            styles.unitBtnText,
                            measureForm.measurement_unit === u &&
                              styles.unitBtnTextActive,
                          ]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.measGrid}>
                {MEASUREMENT_FIELDS.map((field) => (
                  <View key={field.key} style={styles.measGridItem}>
                    <Text
                      style={[styles.measGridLabel, { color: field.color }]}
                    >
                      {field.label}
                    </Text>
                    <View style={styles.measGridInput}>
                      <TextInput
                        style={styles.measGridField}
                        value={measureForm[field.key]}
                        onChangeText={(v) =>
                          setMeasureForm((f) => ({ ...f, [field.key]: v }))
                        }
                        placeholder="--"
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.measGridUnit}>
                        {field.key === "weight"
                          ? measureForm.weight_unit
                          : measureForm.measurement_unit}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Not (opsiyonel)</Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  { minHeight: 60, textAlignVertical: "top" },
                ]}
                value={measureForm.notes}
                onChangeText={(v) =>
                  setMeasureForm((f) => ({ ...f, notes: v }))
                }
                placeholder="Özel notlar..."
                multiline
              />

              <TouchableOpacity
                style={[styles.saveMeasBtn, savingMeasure && { opacity: 0.6 }]}
                onPress={saveMeasurement}
                disabled={savingMeasure}
              >
                {savingMeasure ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveMeasBtnText}>Ölçümü Kaydet</Text>
                )}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── REMINDER MODAL ────────────────────────────────────────────── */}
      <Modal
        visible={reminderModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setReminderModalVisible(false)}
          />
          <View style={styles.reminderModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hatırlatma Zamanı</Text>
              <TouchableOpacity onPress={() => setReminderModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            {REMINDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={styles.reminderOption}
                onPress={() => {
                  saveReminderPref(opt.value);
                  setReminderModalVisible(false);
                }}
              >
                <Text style={styles.reminderOptionText}>{opt.label}</Text>
                {profile.meal_notif_before === opt.value && (
                  <Ionicons name="checkmark" size={20} color="#34C759" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

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
  avatar: { width: 70, height: 70, borderRadius: 35 },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#E5F9ED",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { fontSize: 26, fontWeight: "800", color: "#34C759" },
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 35,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: { fontSize: 17, fontWeight: "700", color: "#1C1C1E" },
  profileEmail: { fontSize: 13, color: "#8E8E93", marginTop: 2 },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  editProfileBtnText: { fontSize: 13, color: "#007AFF", fontWeight: "600" },
  profileInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: "#1C1C1E",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 13, color: "#8E8E93", fontWeight: "600" },
  saveBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#34C759",
    alignItems: "center",
  },
  saveBtnText: { fontSize: 13, color: "#FFF", fontWeight: "700" },

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

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoLabel: { fontSize: 14, color: "#1C1C1E" },
  infoInputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoInput: {
    fontSize: 14,
    color: "#1C1C1E",
    textAlign: "right",
    minWidth: 60,
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  infoSuffix: { fontSize: 13, color: "#8E8E93", width: 28 },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  datePickerText: { fontSize: 14, color: "#1C1C1E" },
  genderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
  },
  genderBtnActive: { backgroundColor: "#E5F9ED" },
  genderBtnText: { fontSize: 13, color: "#8E8E93", fontWeight: "600" },
  genderBtnTextActive: { color: "#34C759", fontWeight: "700" },
  saveAllBtn: {
    backgroundColor: "#34C759",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  saveAllBtnText: { fontSize: 14, color: "#FFF", fontWeight: "700" },

  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 14,
    paddingBottom: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF0EE",
    borderWidth: 1,
    borderColor: "#FF3B30",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { fontSize: 13, color: "#FF3B30", fontWeight: "600" },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  tagInput: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: "#1C1C1E",
  },
  tagAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },

  emptyMeas: { padding: 16, alignItems: "center" },
  emptyMeasText: { fontSize: 13, color: "#8E8E93" },
  measRow: { flexDirection: "row", alignItems: "flex-start", padding: 14 },
  measDate: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 6,
  },
  measValues: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  measChip: {
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  measChipLabel: { fontSize: 10, fontWeight: "700" },
  measChipValue: { fontSize: 12, color: "#1C1C1E", fontWeight: "600" },
  measNotes: { fontSize: 12, color: "#8E8E93", marginTop: 6 },
  addMeasBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  addMeasBtnText: { fontSize: 14, color: "#34C759", fontWeight: "700" },

  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  reminderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E5F9ED",
    justifyContent: "center",
    alignItems: "center",
  },
  reminderLabel: { fontSize: 14, color: "#1C1C1E", fontWeight: "600" },
  reminderSub: { fontSize: 12, color: "#8E8E93", marginTop: 1 },
  reminderValue: { fontSize: 13, color: "#34C759", fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  measureModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  reminderModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 12,
  },
  fieldInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1C1C1E",
  },
  unitRow: { flexDirection: "row", gap: 8 },
  unitBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  unitBtnActive: { backgroundColor: "#E5F9ED" },
  unitBtnText: { fontSize: 14, color: "#8E8E93", fontWeight: "600" },
  unitBtnTextActive: { color: "#34C759" },
  measGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  measGridItem: { width: "47%" },
  measGridLabel: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  measGridInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  measGridField: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1C1C1E" },
  measGridUnit: { fontSize: 12, color: "#8E8E93" },
  saveMeasBtn: {
    backgroundColor: "#34C759",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveMeasBtnText: { fontSize: 15, color: "#FFF", fontWeight: "700" },
  reminderOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  reminderOptionText: { fontSize: 15, color: "#1C1C1E" },
});

export default ClientSettings;
