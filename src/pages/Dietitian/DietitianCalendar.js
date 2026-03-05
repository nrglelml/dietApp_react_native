import React, { useState, useEffect, useCallback, useRef } from "react";
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
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, LocaleConfig } from "react-native-calendars";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../../../supabase";
import { DietitianTabBar } from "../../components";

LocaleConfig.locales["tr"] = {
  monthNames: [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ],
  monthNamesShort: [
    "Oca",
    "Şub",
    "Mar",
    "Nis",
    "May",
    "Haz",
    "Tem",
    "Ağu",
    "Eyl",
    "Eki",
    "Kas",
    "Ara",
  ],
  dayNames: [
    "Pazar",
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
  ],
  dayNamesShort: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  today: "Bugün",
};
LocaleConfig.defaultLocale = "tr";

const STATUS_CONFIG = {
  scheduled: { label: "Bekliyor", color: "#FF9500", bg: "#FFF3E0" },
  completed: { label: "Tamamlandı", color: "#34C759", bg: "#E5F9ED" },
  cancelled: { label: "İptal", color: "#FF3B30", bg: "#FFF0EE" },
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

const toLocalDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDateTR = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const timeStrToDate = (timeStr) => {
  const [h, m] = (timeStr || "09:00").split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

const dateToTimeStr = (date) => {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

const todayStr = toLocalDateStr();

const emptyForm = () => ({
  client_id: "",
  clientName: "",
  appointment_date: todayStr,
  appointment_time: "09:00",
  duration_minutes: 30,
  notes: "",
  status: "scheduled",
});

const getAvatarColor = (name) => {
  const colors = [
    "#34C759",
    "#007AFF",
    "#FF9500",
    "#AF52DE",
    "#FF2D55",
    "#5AC8FA",
  ];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
};

const DietitianCalendar = () => {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markedDates, setMarkedDates] = useState({});

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // DateTimePicker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerTime, setPickerTime] = useState(new Date());

  const selectedDateRef = useRef(todayStr);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchAppointments(), fetchClients()]);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAppointments(), fetchClients()]);
    setRefreshing(false);
  }, []);

  const fetchClients = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("client_profiles")
      .select("id, full_name")
      .eq("dietitian_id", user.id)
      .eq("status", "active")
      .order("full_name");
    if (data) setClients(data);
  };

  const fetchAppointments = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("appointments")
      .select("*, client_profiles(full_name)")
      .eq("dietitian_id", user.id)
      .order("appointment_date")
      .order("appointment_time");

    if (error) {
      console.error("Fetch error:", error);
      return;
    }

    if (data) {
      setAppointments(data);
      buildMarkedDates(data, selectedDateRef.current);
    }
  };

  const buildMarkedDates = (appts, selDate) => {
    const marks = {};
    appts.forEach((a) => {
      const d = a.appointment_date;
      if (!marks[d]) marks[d] = { dots: [], marked: true };
      const color = STATUS_CONFIG[a.status]?.color || "#007AFF";
      if (marks[d].dots.length < 3) marks[d].dots.push({ color });
    });
    marks[selDate] = {
      ...(marks[selDate] || {}),
      selected: true,
      selectedColor: "#34C759",
    };
    setMarkedDates({ ...marks });
  };

  const handleDayPress = (day) => {
    const d = day.dateString;
    selectedDateRef.current = d;
    setSelectedDate(d);
    buildMarkedDates(appointments, d);
  };

  const dayAppointments = appointments.filter(
    (a) => a.appointment_date === selectedDate,
  );

  // FORM
  const openCreate = () => {
    setEditingId(null);
    const f = { ...emptyForm(), appointment_date: selectedDate };
    setForm(f);
    setPickerDate(new Date(selectedDate + "T12:00:00"));
    setPickerTime(timeStrToDate("09:00"));
    setModalVisible(true);
  };

  const openEdit = (appt) => {
    setEditingId(appt.id);
    const f = {
      client_id: appt.client_id,
      clientName: appt.client_profiles?.full_name || "",
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time?.slice(0, 5) || "09:00",
      duration_minutes: appt.duration_minutes || 30,
      notes: appt.notes || "",
      status: appt.status || "scheduled",
    };
    setForm(f);
    setPickerDate(new Date(appt.appointment_date + "T12:00:00"));
    setPickerTime(timeStrToDate(appt.appointment_time?.slice(0, 5) || "09:00"));
    setModalVisible(true);
  };

  const onDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setPickerDate(date);
      setForm((f) => ({ ...f, appointment_date: toLocalDateStr(date) }));
    }
  };

  const onTimeChange = (event, time) => {
    setShowTimePicker(false);
    if (time) {
      setPickerTime(time);
      setForm((f) => ({ ...f, appointment_time: dateToTimeStr(time) }));
    }
  };

  const handleSave = async () => {
    if (!form.client_id) {
      Alert.alert("Uyarı", "Lütfen bir danışan seçin.");
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const payload = {
        dietitian_id: user.id,
        client_id: form.client_id,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time + ":00",
        duration_minutes: form.duration_minutes,
        notes: form.notes.trim() || null,
        status: form.status,
      };

      if (editingId) {
        const { error } = await supabase
          .from("appointments")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("appointments").insert(payload);
        if (error) throw error;
      }

      const savedDate = form.appointment_date;
      setModalVisible(false);
      await fetchAppointments();
      // Kaydedilen tarihe git
      selectedDateRef.current = savedDate;
      setSelectedDate(savedDate);
    } catch (error) {
      Alert.alert("Hata", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert(
      "Randevuyu Sil",
      "Bu randevuyu silmek istediğinizden emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await supabase.from("appointments").delete().eq("id", id);
            await fetchAppointments();
          },
        },
      ],
    );
  };

  const handleStatusChange = async (id, status) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    await fetchAppointments();
  };

  // ─── RENDER ──────────────────────────────────────────────

  const renderAppointmentCard = (appt) => {
    const st = STATUS_CONFIG[appt.status] || STATUS_CONFIG.scheduled;
    const clientName = appt.client_profiles?.full_name || "—";
    return (
      <View key={appt.id} style={styles.apptCard}>
        <View style={styles.apptTimeCol}>
          <Text style={styles.apptTime}>
            {appt.appointment_time?.slice(0, 5)}
          </Text>
          <Text style={styles.apptDuration}>{appt.duration_minutes}dk</Text>
          <View style={[styles.apptLine, { backgroundColor: st.color }]} />
        </View>
        <View style={styles.apptBody}>
          <View style={styles.apptHeader}>
            <View style={styles.apptClientRow}>
              <View
                style={[
                  styles.apptAvatar,
                  { backgroundColor: getAvatarColor(clientName) },
                ]}
              >
                <Text style={styles.apptAvatarText}>
                  {clientName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.apptClientName}>{clientName}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.statusText, { color: st.color }]}>
                {st.label}
              </Text>
            </View>
          </View>
          {appt.notes ? (
            <Text style={styles.apptNotes} numberOfLines={2}>
              {appt.notes}
            </Text>
          ) : null}
          <View style={styles.apptActions}>
            {appt.status !== "completed" && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleStatusChange(appt.id, "completed")}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color="#34C759"
                />
                <Text style={[styles.actionBtnText, { color: "#34C759" }]}>
                  Tamamlandı
                </Text>
              </TouchableOpacity>
            )}
            {appt.status !== "cancelled" && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleStatusChange(appt.id, "cancelled")}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color="#FF3B30"
                />
                <Text style={[styles.actionBtnText, { color: "#FF3B30" }]}>
                  İptal
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => openEdit(appt)}
            >
              <Ionicons name="pencil-outline" size={16} color="#007AFF" />
              <Text style={[styles.actionBtnText, { color: "#007AFF" }]}>
                Düzenle
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(appt.id)}>
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const upcoming = appointments
    .filter(
      (a) => a.appointment_date > selectedDate && a.status === "scheduled",
    )
    .slice(0, 5);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#34C759"
          />
        }
      >
        <StatusBar barStyle="dark-content" />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Takvim</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Ionicons name="add" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.calendarWrapper}>
          <Calendar
            onDayPress={handleDayPress}
            markedDates={markedDates}
            markingType="multi-dot"
            theme={{
              todayTextColor: "#34C759",
              arrowColor: "#34C759",
              textDayFontWeight: "500",
              textMonthFontWeight: "700",
              selectedDayBackgroundColor: "#34C759",
            }}
          />
        </View>

        <View style={styles.daySection}>
          <View style={styles.daySectionHeader}>
            <Text style={styles.daySectionTitle}>
              {selectedDate === todayStr ? "Bugün" : formatDateTR(selectedDate)}
            </Text>
            <Text style={styles.daySectionCount}>
              {dayAppointments.length} randevu
            </Text>
          </View>
          {dayAppointments.length === 0 ? (
            <View style={styles.emptyDay}>
              <Ionicons name="calendar-outline" size={40} color="#E5E5EA" />
              <Text style={styles.emptyDayTitle}>Bu gün için randevu yok</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openCreate}>
                <Ionicons name="add" size={16} color="#34C759" />
                <Text style={styles.emptyAddText}>Randevu Ekle</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.apptList}>
              {dayAppointments.map(renderAppointmentCard)}
            </View>
          )}
        </View>

        {upcoming.length > 0 && (
          <View style={styles.upcomingSection}>
            <Text style={styles.upcomingTitle}>Yaklaşan Randevular</Text>
            {upcoming.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.upcomingCard}
                onPress={() =>
                  handleDayPress({ dateString: a.appointment_date })
                }
              >
                <View style={styles.upcomingDateBox}>
                  <Text style={styles.upcomingDay}>
                    {new Date(
                      a.appointment_date + "T12:00:00",
                    ).toLocaleDateString("tr-TR", { day: "numeric" })}
                  </Text>
                  <Text style={styles.upcomingMonth}>
                    {new Date(
                      a.appointment_date + "T12:00:00",
                    ).toLocaleDateString("tr-TR", { month: "short" })}
                  </Text>
                </View>
                <View style={styles.upcomingInfo}>
                  <Text style={styles.upcomingClient}>
                    {a.client_profiles?.full_name}
                  </Text>
                  <Text style={styles.upcomingTime}>
                    {a.appointment_time?.slice(0, 5)} · {a.duration_minutes} dk
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
      <DietitianTabBar />
      {/* RANDEVU MODAL */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingId ? "Randevuyu Düzenle" : "Yeni Randevu"}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#8E8E93" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Danışan */}
                <Text style={styles.fieldLabel}>Danışan *</Text>
                <TouchableOpacity
                  style={[
                    styles.fieldInput,
                    form.client_id && styles.fieldInputSelected,
                  ]}
                  onPress={() => setClientPickerVisible(true)}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={form.client_id ? "#34C759" : "#8E8E93"}
                  />
                  <Text
                    style={[
                      styles.fieldInputText,
                      form.client_id && { color: "#1C1C1E" },
                    ]}
                  >
                    {form.clientName || "Danışan seçin"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#C7C7CC" />
                </TouchableOpacity>

                {/* Tarih */}
                <Text style={styles.fieldLabel}>Tarih *</Text>
                <TouchableOpacity
                  style={[styles.fieldInput, styles.fieldInputSelected]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={18} color="#34C759" />
                  <Text
                    style={[
                      styles.fieldInputText,
                      { color: "#1C1C1E", flex: 1 },
                    ]}
                  >
                    {formatDateTR(form.appointment_date)}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#C7C7CC" />
                </TouchableOpacity>

                {/* Saat */}
                <Text style={styles.fieldLabel}>Saat *</Text>
                <TouchableOpacity
                  style={[styles.fieldInput, styles.fieldInputSelected]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={18} color="#34C759" />
                  <Text
                    style={[
                      styles.fieldInputText,
                      { color: "#1C1C1E", flex: 1 },
                    ]}
                  >
                    {form.appointment_time}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#C7C7CC" />
                </TouchableOpacity>

                {/* Süre */}
                <Text style={styles.fieldLabel}>Süre</Text>
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.durationChip,
                        form.duration_minutes === d &&
                          styles.durationChipActive,
                      ]}
                      onPress={() =>
                        setForm((f) => ({ ...f, duration_minutes: d }))
                      }
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          form.duration_minutes === d &&
                            styles.durationChipTextActive,
                        ]}
                      >
                        {d < 60 ? `${d}dk` : `${d / 60}sa`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Durum */}
                <Text style={styles.fieldLabel}>Durum</Text>
                <View style={styles.statusRow}>
                  {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.statusChip,
                        { borderColor: val.color },
                        form.status === key && { backgroundColor: val.bg },
                      ]}
                      onPress={() => setForm((f) => ({ ...f, status: key }))}
                    >
                      <Text
                        style={[styles.statusChipText, { color: val.color }]}
                      >
                        {val.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Not */}
                <Text style={styles.fieldLabel}>Not</Text>
                <TextInput
                  style={[
                    styles.fieldInput,
                    {
                      alignItems: "flex-start",
                      paddingTop: 12,
                      minHeight: 80,
                      textAlignVertical: "top",
                      fontSize: 15,
                      color: "#0000",
                    },
                  ]}
                  placeholder="Randevu hakkında not..."
                  value={form.notes}
                  onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                  multiline
                />

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editingId ? "Güncelle" : "Randevu Oluştur"}
                    </Text>
                  )}
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DANIŞAN SEÇİCİ */}
      <Modal
        visible={clientPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setClientPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "60%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Danışan Seç</Text>
              <TouchableOpacity onPress={() => setClientPickerVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {clients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.clientPickerRow}
                  onPress={() => {
                    setForm((f) => ({
                      ...f,
                      client_id: c.id,
                      clientName: c.full_name,
                    }));
                    setClientPickerVisible(false);
                  }}
                >
                  <View
                    style={[
                      styles.clientPickerAvatar,
                      { backgroundColor: getAvatarColor(c.full_name) },
                    ]}
                  >
                    <Text style={styles.clientPickerAvatarText}>
                      {c.full_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.clientPickerName}>{c.full_name}</Text>
                  {form.client_id === c.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#34C759"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DATE PICKER */}
      {showDatePicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
          locale="tr-TR"
        />
      )}

      {/* TIME PICKER */}
      {showTimePicker && (
        <DateTimePicker
          value={pickerTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onTimeChange}
          is24Hour={true}
          locale="tr-TR"
        />
      )}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1C1C1E" },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarWrapper: {
    backgroundColor: "#FFF",
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  daySection: { paddingHorizontal: 16, paddingTop: 16 },
  daySectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  daySectionTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  daySectionCount: { fontSize: 13, color: "#8E8E93", fontWeight: "600" },
  emptyDay: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyDayTitle: { fontSize: 15, color: "#8E8E93", fontWeight: "600" },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: "#34C759",
    borderRadius: 10,
    marginTop: 4,
  },
  emptyAddText: { fontSize: 14, color: "#34C759", fontWeight: "700" },
  apptList: { gap: 10 },
  apptCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  apptTimeCol: { alignItems: "center", width: 44 },
  apptTime: { fontSize: 13, fontWeight: "700", color: "#1C1C1E" },
  apptDuration: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  apptLine: { width: 2, flex: 1, borderRadius: 1, marginTop: 6, minHeight: 20 },
  apptBody: { flex: 1 },
  apptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  apptClientRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  apptAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  apptAvatarText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  apptClientName: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "700" },
  apptNotes: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
    lineHeight: 18,
  },
  apptActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 4,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  actionBtnText: { fontSize: 12, fontWeight: "600" },
  upcomingSection: { paddingHorizontal: 16, marginTop: 24 },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 10,
  },
  upcomingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  upcomingDateBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#E5F9ED",
    justifyContent: "center",
    alignItems: "center",
  },
  upcomingDay: { fontSize: 16, fontWeight: "800", color: "#34C759" },
  upcomingMonth: { fontSize: 10, fontWeight: "600", color: "#34C759" },
  upcomingInfo: { flex: 1 },
  upcomingClient: { fontSize: 14, fontWeight: "700", color: "#1C1C1E" },
  upcomingTime: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 14,
  },
  fieldInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldInputSelected: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#34C759",
  },
  fieldInputText: { fontSize: 15, color: "#8E8E93" },
  durationRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
  },
  durationChipActive: { backgroundColor: "#E5F9ED" },
  durationChipText: { fontSize: 13, fontWeight: "600", color: "#8E8E93" },
  durationChipTextActive: { color: "#34C759" },
  statusRow: { flexDirection: "row", gap: 8 },
  statusChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    borderColor: "#E5E5EA",
  },
  statusChipText: { fontSize: 12, fontWeight: "700" },
  saveBtn: {
    backgroundColor: "#34C759",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  clientPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  clientPickerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  clientPickerAvatarText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  clientPickerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
  },
});

export default DietitianCalendar;
