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
  RefreshControl,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../../../supabase";
import { ClientTabBar } from "../../components";
const { width } = Dimensions.get("window");

const toLocalDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const todayStr = toLocalDateStr();

const DAYS_TR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
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

const formatDateTR = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
};

// Basit çizgi grafik
const LineChart = ({ data, color = "#34C759", unit = "kg" }) => {
  if (!data || data.length < 2) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartW = width - 64;
  const chartH = 80;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * chartW;
    const y = chartH - ((d.value - min) / range) * chartH;
    return { x, y, ...d };
  });

  const pathD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  return (
    <View style={{ height: chartH + 30, marginTop: 8 }}>
      <View style={{ position: "relative", height: chartH }}>
        {/* Yatay kılavuz çizgileri */}
        {[0, 0.5, 1].map((f, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: chartH * f,
              height: 1,
              backgroundColor: "#F2F2F7",
            }}
          />
        ))}
        {/* SVG benzeri path — React Native'de doğal SVG yok, noktaları göster */}
        {pts.map((p, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: p.x - 4,
              top: p.y - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: color,
              borderWidth: 2,
              borderColor: "#FFF",
            }}
          />
        ))}
        {/* Çizgiler */}
        {pts.slice(1).map((p, i) => {
          const prev = pts[i];
          const dx = p.x - prev.x;
          const dy = p.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={i}
              style={{
                position: "absolute",
                left: prev.x,
                top: prev.y,
                width: len,
                height: 2,
                backgroundColor: color + "60",
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: "left center",
              }}
            />
          );
        })}
      </View>
      {/* X ekseni etiketleri */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        {pts.map((p, i) => (
          <Text key={i} style={{ fontSize: 9, color: "#C7C7CC" }}>
            {formatDateTR(p.date)}
          </Text>
        ))}
      </View>
    </View>
  );
};

const HomeClient = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientData, setClientData] = useState(null);
  const [activeProgram, setActiveProgram] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [mealLogs, setMealLogs] = useState({});
  const [nextAppointment, setNextAppointment] = useState(null);
  const [weightHistory, setWeightHistory] = useState([]);
  const [latestMeasurement, setLatestMeasurement] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Profil
      const { data: profile } = await supabase
        .from("client_profiles")
        .select("full_name, weight, target_weight, height, birth_date")
        .eq("id", user.id)
        .single();
      if (profile) {
        setClientName(profile.full_name || "");
        setClientData(profile);
      }

      // Aktif program
      const { data: program } = await supabase
        .from("diet_programs")
        .select("*")
        .eq("client_id", user.id)
        .gte("end_date", todayStr)
        .order("end_date", { ascending: false })
        .limit(1)
        .single();

      if (program) {
        setActiveProgram(program);

        // Bugünün öğünleri
        const { data: meals } = await supabase
          .from("diet_meals")
          .select("*")
          .eq("program_id", program.id)
          .eq("meal_date", todayStr)
          .order("meal_time");
        setTodayMeals(meals || []);

        // Meal logs
        if (meals?.length) {
          const mealIds = meals.map((m) => m.id);
          const { data: logs } = await supabase
            .from("meal_logs")
            .select("*")
            .eq("client_id", user.id)
            .in("meal_id", mealIds);
          const logMap = {};
          (logs || []).forEach((l) => {
            logMap[l.meal_id] = l;
          });
          setMealLogs(logMap);
        }
      }

      // Yaklaşan randevu
      const { data: appt } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", user.id)
        .eq("status", "scheduled")
        .gte("appointment_date", todayStr)
        .order("appointment_date")
        .order("appointment_time")
        .limit(1)
        .single();
      setNextAppointment(appt);

      // Kilo geçmişi (son 6 ölçüm)
      const { data: measurements } = await supabase
        .from("body_measurements")
        .select("measured_at, weight")
        .eq("client_id", user.id)
        .not("weight", "is", null)
        .order("measured_at", { ascending: false })
        .limit(6);
      if (measurements?.length) {
        setLatestMeasurement(measurements[0]);
        setWeightHistory(
          [...measurements].reverse().map((m) => ({
            date: m.measured_at,
            value: parseFloat(m.weight),
          })),
        );
      }
    } catch (e) {
      console.log("HomeClient loadAll error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, []);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Günaydın";
    if (h < 18) return "İyi günler";
    return "İyi akşamlar";
  };

  const getBMI = () => {
    if (!clientData?.weight || !clientData?.height) return null;
    const bmi = clientData.weight / Math.pow(clientData.height / 100, 2);
    return bmi.toFixed(1);
  };

  const getProgress = () => {
    if (!clientData?.weight || !clientData?.target_weight) return null;
    const start = parseFloat(clientData.weight);
    const target = parseFloat(clientData.target_weight);
    const current = latestMeasurement?.weight
      ? parseFloat(latestMeasurement.weight)
      : start;
    if (start === target) return 100;
    const progress = ((start - current) / (start - target)) * 100;
    return Math.min(100, Math.max(0, progress)).toFixed(0);
  };

  const eatenCount = Object.values(mealLogs).filter(
    (l) => l.status === "eaten",
  ).length;
  const progress = getProgress();
  const bmi = getBMI();

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
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
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name}>{clientName || "Danışan"}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => navigation.navigate("ClientSettings")}
          >
            <Ionicons name="person-circle-outline" size={40} color="#34C759" />
          </TouchableOpacity>
        </View>

        {/* ÖZET KARTLAR */}
        <View style={styles.statsRow}>
          {clientData?.weight && (
            <View style={styles.statCard}>
              <Ionicons name="scale-outline" size={18} color="#007AFF" />
              <Text style={styles.statValue}>
                {latestMeasurement?.weight || clientData.weight}
              </Text>
              <Text style={styles.statUnit}>kg</Text>
            </View>
          )}
          {clientData?.target_weight && (
            <View style={styles.statCard}>
              <Ionicons name="flag-outline" size={18} color="#34C759" />
              <Text style={styles.statValue}>{clientData.target_weight}</Text>
              <Text style={styles.statUnit}>hedef kg</Text>
            </View>
          )}
          {bmi && (
            <View style={styles.statCard}>
              <Ionicons name="body-outline" size={18} color="#FF9500" />
              <Text style={styles.statValue}>{bmi}</Text>
              <Text style={styles.statUnit}>BMI</Text>
            </View>
          )}
        </View>

        {/* İLERLEME */}
        {progress !== null && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🎯 Hedefe İlerleme</Text>
              <Text style={styles.progressPct}>{progress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressSub}>
              {clientData.weight} kg → {clientData.target_weight} kg
            </Text>
          </View>
        )}

        {/* KİLO GRAFİĞİ */}
        {weightHistory.length >= 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📈 Kilo Takibi</Text>
            <LineChart data={weightHistory} color="#34C759" unit="kg" />
            <TouchableOpacity
              style={styles.addMeasurementBtn}
              onPress={() =>
                navigation.navigate("ClientSettings", { openMeasurement: true })
              }
            >
              <Ionicons name="add-circle-outline" size={16} color="#34C759" />
              <Text style={styles.addMeasurementText}>Ölçüm Ekle</Text>
            </TouchableOpacity>
          </View>
        )}

        {weightHistory.length < 2 && (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("ClientSettings", { openMeasurement: true })
            }
          >
            <View style={styles.emptyMeasurement}>
              <Ionicons name="analytics-outline" size={32} color="#C7C7CC" />
              <Text style={styles.emptyMeasurementText}>
                Kilo takibini başlatmak için ölçüm ekle
              </Text>
              <View style={styles.addMeasurementBtn}>
                <Ionicons name="add-circle-outline" size={16} color="#34C759" />
                <Text style={styles.addMeasurementText}>İlk Ölçümü Ekle</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* BUGÜNÜN ÖĞÜNLERİ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🍽 Bugünün Öğünleri</Text>
            {todayMeals.length > 0 && (
              <Text style={styles.mealCount}>
                {eatenCount}/{todayMeals.length}
              </Text>
            )}
          </View>
          {todayMeals.length === 0 ? (
            <View style={styles.noMeals}>
              <Text style={styles.noMealsText}>
                {activeProgram
                  ? "Bugün için öğün yok"
                  : "Aktif diyet programın bulunmuyor"}
              </Text>
            </View>
          ) : (
            todayMeals.slice(0, 4).map((meal) => {
              const log = mealLogs[meal.id];
              return (
                <TouchableOpacity
                  key={meal.id}
                  style={styles.mealRow}
                  onPress={() => navigation.navigate("ClientCalendar")}
                >
                  <View
                    style={[
                      styles.mealStatus,
                      log?.status === "eaten"
                        ? styles.mealEaten
                        : log?.status === "skipped"
                          ? styles.mealSkipped
                          : styles.mealPending,
                    ]}
                  >
                    <Ionicons
                      name={
                        log?.status === "eaten"
                          ? "checkmark"
                          : log?.status === "skipped"
                            ? "close"
                            : "time-outline"
                      }
                      size={12}
                      color={
                        log?.status === "eaten"
                          ? "#34C759"
                          : log?.status === "skipped"
                            ? "#FF3B30"
                            : "#C7C7CC"
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealName}>{meal.meal_name}</Text>
                    {meal.meal_time && (
                      <Text style={styles.mealTime}>
                        {meal.meal_time.slice(0, 5)}
                      </Text>
                    )}
                  </View>
                  {meal.calories && (
                    <Text style={styles.mealCal}>{meal.calories} kcal</Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
          {todayMeals.length > 4 && (
            <TouchableOpacity
              onPress={() => navigation.navigate("ClientCalendar")}
              style={styles.showAllBtn}
            >
              <Text style={styles.showAllText}>
                Tümünü Gör ({todayMeals.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* YAKLAŞAN RANDEVU */}
        {nextAppointment && (
          <View style={[styles.card, styles.apptCard]}>
            <View style={styles.apptIcon}>
              <Ionicons name="calendar" size={22} color="#007AFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.apptLabel}>Yaklaşan Randevu</Text>
              <Text style={styles.apptDate}>
                {formatDateTR(nextAppointment.appointment_date)} —{" "}
                {nextAppointment.appointment_time?.slice(0, 5)}
              </Text>
              {nextAppointment.notes && (
                <Text style={styles.apptNotes} numberOfLines={1}>
                  {nextAppointment.notes}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* AKTİF PROGRAM */}
        {activeProgram && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Aktif Program</Text>
            <Text style={styles.programTitle}>{activeProgram.title}</Text>
            <View style={styles.programDates}>
              <Text style={styles.programDate}>
                {formatDateTR(activeProgram.start_date)} —{" "}
                {formatDateTR(activeProgram.end_date)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewProgramBtn}
              onPress={() => navigation.navigate("ClientCalendar")}
            >
              <Text style={styles.viewProgramText}>Programı Görüntüle</Text>
              <Ionicons name="chevron-forward" size={14} color="#34C759" />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <ClientTabBar />
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: { fontSize: 13, color: "#8E8E93" },
  name: { fontSize: 22, fontWeight: "800", color: "#1C1C1E" },
  avatarBtn: { padding: 4 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  statValue: { fontSize: 18, fontWeight: "800", color: "#1C1C1E" },
  statUnit: { fontSize: 10, color: "#8E8E93", fontWeight: "600" },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },

  progressPct: { fontSize: 15, fontWeight: "800", color: "#34C759" },
  progressBar: {
    height: 8,
    backgroundColor: "#F2F2F7",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: { height: "100%", backgroundColor: "#34C759", borderRadius: 4 },
  progressSub: { fontSize: 12, color: "#8E8E93" },

  emptyMeasurement: { alignItems: "center", gap: 8, paddingVertical: 8 },
  emptyMeasurementText: { fontSize: 13, color: "#8E8E93", textAlign: "center" },
  addMeasurementBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  addMeasurementText: { fontSize: 13, color: "#34C759", fontWeight: "600" },

  mealCount: { fontSize: 13, color: "#34C759", fontWeight: "700" },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  mealStatus: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  mealEaten: { backgroundColor: "#E5F9ED" },
  mealSkipped: { backgroundColor: "#FFF0EE" },
  mealPending: { backgroundColor: "#F2F2F7" },
  mealName: { fontSize: 14, color: "#1C1C1E", fontWeight: "500" },
  mealTime: { fontSize: 12, color: "#8E8E93" },
  mealCal: { fontSize: 12, color: "#FF9500", fontWeight: "600" },
  noMeals: { paddingVertical: 16, alignItems: "center" },
  noMealsText: { fontSize: 13, color: "#8E8E93" },
  showAllBtn: { paddingTop: 10, alignItems: "center" },
  showAllText: { fontSize: 13, color: "#34C759", fontWeight: "600" },

  apptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EEF4FF",
  },
  apptIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  apptLabel: {
    fontSize: 11,
    color: "#007AFF",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  apptDate: { fontSize: 15, fontWeight: "700", color: "#1C1C1E", marginTop: 2 },
  apptNotes: { fontSize: 12, color: "#8E8E93", marginTop: 2 },

  programTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  programDates: { marginBottom: 10 },
  programDate: { fontSize: 13, color: "#8E8E93" },
  viewProgramBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewProgramText: { fontSize: 13, color: "#34C759", fontWeight: "600" },
});

export default HomeClient;
