import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../supabase";
import { ClientTabBar } from "../../components";

const DAYS_TR = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
const MONTHS_TR = [
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
];

const toLocalDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
};

const formatDayHeader = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  const isToday = dateStr === toLocalDateStr();
  return {
    day: DAYS_TR[d.getDay()],
    date: `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`,
    isToday,
  };
};

const ClientCalendar = () => {
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [meals, setMeals] = useState([]);
  const [mealLogs, setMealLogs] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [programRange, setProgramRange] = useState(null);

  // Log modal
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [logStatus, setLogStatus] = useState("eaten");
  const [portionNote, setPortionNote] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [savingLog, setSavingLog] = useState(false);

  useEffect(() => {
    initLoad();
  }, []);
  useEffect(() => {
    if (clientId) fetchDayData();
  }, [selectedDate, clientId]);

  const initLoad = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setClientId(user.id);

    // Program tarih aralığını öğren
    const { data: program } = await supabase
      .from("diet_programs")
      .select("start_date, end_date")
      .eq("client_id", user.id)
      .gte("end_date", toLocalDateStr())
      .order("end_date", { ascending: false })
      .limit(1)
      .single();

    if (program)
      setProgramRange({ start: program.start_date, end: program.end_date });
    setLoading(false);
  };

  const fetchDayData = async () => {
    try {
      // Aktif program öğünleri
      const { data: program } = await supabase
        .from("diet_programs")
        .select("id")
        .eq("client_id", clientId)
        .lte("start_date", selectedDate)
        .gte("end_date", selectedDate)
        .limit(1)
        .single();

      if (program) {
        const { data: dayMeals } = await supabase
          .from("diet_meals")
          .select("*")
          .eq("program_id", program.id)
          .eq("meal_date", selectedDate)
          .order("meal_time");
        setMeals(dayMeals || []);

        // Loglar
        if (dayMeals?.length) {
          const { data: logs } = await supabase
            .from("meal_logs")
            .select("*")
            .eq("client_id", clientId)
            .in(
              "meal_id",
              dayMeals.map((m) => m.id),
            );
          const logMap = {};
          (logs || []).forEach((l) => {
            logMap[l.meal_id] = l;
          });
          setMealLogs(logMap);
        } else {
          setMealLogs({});
        }
      } else {
        setMeals([]);
        setMealLogs({});
      }

      // Randevular
      const { data: appts } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .eq("appointment_date", selectedDate)
        .order("appointment_time");
      setAppointments(appts || []);
    } catch (e) {
      console.log("fetchDayData error:", e.message);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDayData();
    setRefreshing(false);
  }, [clientId, selectedDate]);

  const openLogModal = (meal) => {
    setSelectedMeal(meal);
    const existing = mealLogs[meal.id];
    setLogStatus(existing?.status || "eaten");
    setPortionNote(existing?.portion_note || "");
    setChangeNote(existing?.change_note || "");
    setLogModalVisible(true);
  };

  const saveLog = async () => {
    if (!selectedMeal || !clientId) return;
    setSavingLog(true);
    try {
      const existing = mealLogs[selectedMeal.id];
      const payload = {
        client_id: clientId,
        meal_id: selectedMeal.id,
        status: logStatus,
        portion_note: portionNote.trim() || null,
        change_note: changeNote.trim() || null,
        logged_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("meal_logs").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("meal_logs").insert(payload);
      }

      setLogModalVisible(false);
      await fetchDayData();
    } catch (e) {
      Alert.alert("Hata", e.message);
    } finally {
      setSavingLog(false);
    }
  };

  const deleteLog = async () => {
    const existing = mealLogs[selectedMeal?.id];
    if (!existing) return;
    Alert.alert("Logu Sil", "Bu öğün kaydı silinsin mi?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await supabase.from("meal_logs").delete().eq("id", existing.id);
          setLogModalVisible(false);
          await fetchDayData();
        },
      },
    ]);
  };

  const { day, date, isToday } = formatDayHeader(selectedDate);
  const eatenCount = Object.values(mealLogs).filter(
    (l) => l.status === "eaten",
  ).length;
  const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const eatenCalories = meals
    .filter((m) => mealLogs[m.id]?.status === "eaten")
    .reduce((sum, m) => sum + (m.calories || 0), 0);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setSelectedDate(addDays(selectedDate, -1))}
        >
          <Ionicons name="chevron-back" size={22} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.dayInfo}>
          <Text style={styles.dayName}>{isToday ? "Bugün" : day}</Text>
          <Text style={styles.dayDate}>{date}</Text>
        </View>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setSelectedDate(addDays(selectedDate, 1))}
        >
          <Ionicons name="chevron-forward" size={22} color="#1C1C1E" />
        </TouchableOpacity>
      </View>

      {/* BUGÜN butonu */}
      {!isToday && (
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={() => setSelectedDate(toLocalDateStr())}
        >
          <Text style={styles.todayBtnText}>Bugüne Dön</Text>
        </TouchableOpacity>
      )}

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
        {/* ÖZET */}
        {meals.length > 0 && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <Ionicons name="checkmark-circle" size={14} color="#34C759" />
              <Text style={styles.summaryText}>
                {eatenCount}/{meals.length} öğün
              </Text>
            </View>
            {totalCalories > 0 && (
              <View style={styles.summaryChip}>
                <Ionicons name="flame-outline" size={14} color="#FF9500" />
                <Text style={styles.summaryText}>
                  {eatenCalories}/{totalCalories} kcal
                </Text>
              </View>
            )}
          </View>
        )}

        {/* RANDEVULAR */}
        {appointments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Randevu</Text>
            {appointments.map((appt) => (
              <View key={appt.id} style={styles.apptCard}>
                <View style={styles.apptTime}>
                  <Text style={styles.apptTimeText}>
                    {appt.appointment_time?.slice(0, 5)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.apptTitle}>Diyetisyen Randevusu</Text>
                  {appt.notes && (
                    <Text style={styles.apptNotes}>{appt.notes}</Text>
                  )}
                </View>
                <View
                  style={[
                    styles.apptStatus,
                    {
                      backgroundColor:
                        appt.status === "completed" ? "#E5F9ED" : "#EEF4FF",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color:
                        appt.status === "completed" ? "#34C759" : "#007AFF",
                    }}
                  >
                    {appt.status === "completed"
                      ? "Tamamlandı"
                      : appt.status === "cancelled"
                        ? "İptal"
                        : "Planlandı"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ÖĞÜNLER */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🍽 Öğünler</Text>
          {meals.length === 0 ? (
            <View style={styles.noMeals}>
              <Ionicons name="restaurant-outline" size={40} color="#E5E5EA" />
              <Text style={styles.noMealsText}>
                Bu gün için öğün planlanmamış
              </Text>
            </View>
          ) : (
            meals.map((meal) => {
              const log = mealLogs[meal.id];
              return (
                <TouchableOpacity
                  key={meal.id}
                  style={styles.mealCard}
                  onPress={() => openLogModal(meal)}
                  activeOpacity={0.8}
                >
                  <View style={styles.mealTimeCol}>
                    <Text style={styles.mealTimeText}>
                      {meal.meal_time?.slice(0, 5) || "--:--"}
                    </Text>
                  </View>
                  <View style={styles.mealBody}>
                    <Text style={styles.mealName}>{meal.meal_name}</Text>
                    {meal.portion && (
                      <Text style={styles.mealPortion}>{meal.portion}</Text>
                    )}
                    {meal.notes && (
                      <Text style={styles.mealNotes} numberOfLines={2}>
                        {meal.notes}
                      </Text>
                    )}
                    {log?.portion_note && (
                      <Text style={styles.logNote}>📝 {log.portion_note}</Text>
                    )}
                    <View style={styles.mealMeta}>
                      {meal.calories && (
                        <View style={styles.metaChip}>
                          <Ionicons
                            name="flame-outline"
                            size={11}
                            color="#FF9500"
                          />
                          <Text style={styles.metaChipText}>
                            {meal.calories} kcal
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.logStatusBadge,
                      log?.status === "eaten"
                        ? styles.logEaten
                        : log?.status === "skipped"
                          ? styles.logSkipped
                          : styles.logPending,
                    ]}
                  >
                    <Ionicons
                      name={
                        log?.status === "eaten"
                          ? "checkmark"
                          : log?.status === "skipped"
                            ? "close"
                            : "ellipse-outline"
                      }
                      size={14}
                      color={
                        log?.status === "eaten"
                          ? "#34C759"
                          : log?.status === "skipped"
                            ? "#FF3B30"
                            : "#C7C7CC"
                      }
                    />
                    <Text
                      style={[
                        styles.logStatusText,
                        {
                          color:
                            log?.status === "eaten"
                              ? "#34C759"
                              : log?.status === "skipped"
                                ? "#FF3B30"
                                : "#C7C7CC",
                        },
                      ]}
                    >
                      {log?.status === "eaten"
                        ? "Yedim"
                        : log?.status === "skipped"
                          ? "Yemedim"
                          : "Kayıt yok"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <ClientTabBar />

      {/* LOG MODAL */}
      <Modal
        visible={logModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setLogModalVisible(false)}
          />
          <View style={styles.logModal}>
            <View style={styles.logModalHeader}>
              <Text style={styles.logModalTitle}>
                {selectedMeal?.meal_name}
              </Text>
              <TouchableOpacity onPress={() => setLogModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {selectedMeal?.notes && (
              <Text style={styles.logModalNotes}>{selectedMeal.notes}</Text>
            )}

            {/* Durum seçimi */}
            <Text style={styles.logFieldLabel}>Durum</Text>
            <View style={styles.statusRow}>
              {[
                {
                  value: "eaten",
                  label: "Yedim",
                  icon: "checkmark-circle",
                  color: "#34C759",
                },
                {
                  value: "skipped",
                  label: "Yemedim",
                  icon: "close-circle",
                  color: "#FF3B30",
                },
              ].map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.statusBtn,
                    logStatus === s.value && {
                      borderColor: s.color,
                      backgroundColor: s.color + "12",
                    },
                  ]}
                  onPress={() => setLogStatus(s.value)}
                >
                  <Ionicons
                    name={s.icon}
                    size={20}
                    color={logStatus === s.value ? s.color : "#C7C7CC"}
                  />
                  <Text
                    style={[
                      styles.statusBtnText,
                      { color: logStatus === s.value ? s.color : "#8E8E93" },
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notlar */}
            <Text style={styles.logFieldLabel}>Porsiyon / Miktar Notu</Text>
            <TextInput
              style={styles.logInput}
              placeholder="Örn: Yarım porsiyon yedim..."
              value={portionNote}
              onChangeText={setPortionNote}
              multiline
            />

            <Text style={styles.logFieldLabel}>Değişiklik Notu</Text>
            <TextInput
              style={styles.logInput}
              placeholder="Örn: Tavuk yerine balık yedim..."
              value={changeNote}
              onChangeText={setChangeNote}
              multiline
            />

            <View style={styles.logModalBtns}>
              {mealLogs[selectedMeal?.id] && (
                <TouchableOpacity
                  style={styles.deleteLogBtn}
                  onPress={deleteLog}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.saveLogBtn, savingLog && { opacity: 0.6 }]}
                onPress={saveLog}
                disabled={savingLog}
              >
                {savingLog ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveLogBtnText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
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

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  dayInfo: { alignItems: "center" },
  dayName: { fontSize: 16, fontWeight: "800", color: "#1C1C1E" },
  dayDate: { fontSize: 13, color: "#8E8E93" },

  todayBtn: {
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#E5F9ED",
    borderRadius: 20,
  },
  todayBtnText: { fontSize: 13, color: "#34C759", fontWeight: "700" },

  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  summaryText: { fontSize: 12, color: "#1C1C1E", fontWeight: "600" },

  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 8,
  },

  apptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EEF4FF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  apptTime: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  apptTimeText: { fontSize: 14, fontWeight: "800", color: "#007AFF" },
  apptTitle: { fontSize: 14, fontWeight: "700", color: "#1C1C1E" },
  apptNotes: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  apptStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

  noMeals: { alignItems: "center", paddingVertical: 30, gap: 8 },
  noMealsText: { fontSize: 14, color: "#8E8E93" },

  mealCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  mealTimeCol: { width: 44, alignItems: "center", paddingTop: 2 },
  mealTimeText: { fontSize: 13, fontWeight: "700", color: "#007AFF" },
  mealBody: { flex: 1 },
  mealName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  mealPortion: { fontSize: 12, color: "#8E8E93", marginBottom: 2 },
  mealNotes: {
    fontSize: 12,
    color: "#8E8E93",
    lineHeight: 16,
    marginBottom: 4,
  },
  logNote: { fontSize: 12, color: "#34C759", marginBottom: 4 },
  mealMeta: { flexDirection: "row", gap: 6 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaChipText: { fontSize: 10, color: "#FF9500", fontWeight: "600" },
  logStatusBadge: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 56,
  },
  logEaten: { backgroundColor: "#E5F9ED" },
  logSkipped: { backgroundColor: "#FFF0EE" },
  logPending: { backgroundColor: "#F2F2F7" },
  logStatusText: { fontSize: 10, fontWeight: "700" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  logModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  logModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  logModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1C1C1E",
    flex: 1,
    marginRight: 10,
  },
  logModalNotes: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 12,
    lineHeight: 18,
  },
  logFieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 12,
    marginBottom: 6,
  },
  statusRow: { flexDirection: "row", gap: 10 },
  statusBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    borderRadius: 12,
  },
  statusBtnText: { fontSize: 14, fontWeight: "700" },
  logInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1C1C1E",
    minHeight: 44,
  },
  logModalBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    paddingBottom: 10,
  },
  deleteLogBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FFF0EE",
    justifyContent: "center",
    alignItems: "center",
  },
  saveLogBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
  },
  saveLogBtnText: { fontSize: 15, color: "#FFF", fontWeight: "700" },
});

export default ClientCalendar;
