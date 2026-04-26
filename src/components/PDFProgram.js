import React, { useState, useMemo } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Calendar, LocaleConfig } from "react-native-calendars";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../../supabase";

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
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
    "Pazar",
  ],
  dayNamesShort: ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"],
  today: "Bugün",
};
LocaleConfig.defaultLocale = "tr";

const MEAL_TYPES = ["Kahvaltı", "Ara Öğün", "Öğle", "İkindi", "Akşam", "Gece"];
const DAY_SHORTS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const emptyMeal = () => ({
  id: Date.now() + Math.random(),
  meal_type: "",
  meal_time: "",
  meal_name: "",
  calories: "",
  portion: "",
  notes: "",
  showOptional: false,
});

const getDayShort = (dateStr) =>
  DAY_SHORTS[new Date(dateStr + "T12:00:00").getDay()];

const formatDateTR = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const getDaysBetween = (startStr, endStr) => {
  if (!startStr || !endStr) return [];
  const days = [];
  const current = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const timeStrToDate = (timeStr) => {
  const [h, m] = (timeStr || "08:00").split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const dateToTimeStr = (date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const today = new Date().toISOString().split("T")[0];

const PDFProgram = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { clientId, clientName } = route.params || {};

  // Adım: 1=tarih+pdf, 2=düzenle+kaydet
  const [step, setStep] = useState(1);

  // Tarihler
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectingStart, setSelectingStart] = useState(true);

  // PDF
  const [pdfFile, setPdfFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState("");

  // Program verisi
  const [programTitle, setProgramTitle] = useState("");
  const [meals, setMeals] = useState({});
  const [openDay, setOpenDay] = useState(null);
  const [saving, setSaving] = useState(false);

  // TimePicker
  const [activeTimePicker, setActiveTimePicker] = useState(null);
  const [pickerTime, setPickerTime] = useState(new Date());

  const programDays = useMemo(
    () => getDaysBetween(startDate, endDate),
    [startDate, endDate],
  );
  const totalMeals = Object.values(meals).reduce((sum, d) => sum + d.length, 0);

  const markedDates = useMemo(() => {
    if (!startDate) return {};
    const marks = {};
    if (!endDate || startDate === endDate) {
      marks[startDate] = {
        startingDay: true,
        endingDay: true,
        color: "#34C759",
        textColor: "#FFF",
      };
      return marks;
    }
    getDaysBetween(startDate, endDate).forEach((d, i, arr) => {
      if (i === 0)
        marks[d] = { startingDay: true, color: "#34C759", textColor: "#FFF" };
      else if (i === arr.length - 1)
        marks[d] = { endingDay: true, color: "#34C759", textColor: "#FFF" };
      else marks[d] = { color: "#E5F9ED", textColor: "#34C759" };
    });
    return marks;
  }, [startDate, endDate]);

  // ─── PDF SEÇ ──────────────────────────────────────────────────

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPdfFile(result.assets[0]);
      }
    } catch (e) {
      Alert.alert("Hata", "PDF seçilemedi: " + e.message);
    }
  };

  // ─── PDF ANALİZ ───────────────────────────────────────────────

  const parsePDF = async () => {
    if (!startDate || !endDate) {
      Alert.alert("Uyarı", "Lütfen önce tarih aralığını seçin.");
      return;
    }
    if (!pdfFile) {
      Alert.alert("Uyarı", "Lütfen bir PDF dosyası seçin.");
      return;
    }

    setParsing(true);
    setParseProgress("PDF okunuyor...");

    try {
      // PDF'i base64'e çevir
      const base64 = await FileSystem.readAsStringAsync(pdfFile.uri, {
        encoding: "base64",
      });

      setParseProgress("Claude analiz ediyor...");

      const { data, error } = await supabase.functions.invoke(
        "parse-diet-pdf",
        {
          body: {
            pdfBase64: base64,
            startDate,
            endDate,
            clientName,
          },
        },
      );

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      setParseProgress("Öğünler yükleniyor...");

      // API sonucunu meals formatına çevir
      const parsedMeals = {};
      if (data.meals) {
        Object.entries(data.meals).forEach(([dateStr, dayMeals]) => {
          if (dateStr >= startDate && dateStr <= endDate) {
            parsedMeals[dateStr] = (dayMeals || []).map((m) => ({
              ...emptyMeal(),
              meal_type: m.meal_type || "",
              meal_time: m.meal_time || "",
              meal_name: m.meal_name || "",
              calories: m.calories ? String(m.calories) : "",
              portion: m.portion || "",
              notes: m.notes || "",
              showOptional: !!(m.calories || m.portion || m.notes),
            }));
          }
        });
      }

      setMeals(parsedMeals);
      if (data.program_title) setProgramTitle(data.program_title);
      else setProgramTitle(`${clientName} - Diyet Programı`);

      const mealCount = Object.values(parsedMeals).reduce(
        (s, d) => s + d.length,
        0,
      );
      setStep(2);
      setOpenDay(Object.keys(parsedMeals)[0] || null);
      Alert.alert(
        "✓ Analiz Tamamlandı",
        `${mealCount} öğün bulundu. Düzenleyip kaydedebilirsiniz.`,
      );
    } catch (e) {
      Alert.alert("Hata", "PDF analiz edilemedi: " + e.message);
    } finally {
      setParsing(false);
      setParseProgress("");
    }
  };

  // ─── ÖĞÜN CRUD ────────────────────────────────────────────────

  const addMeal = (dateStr) => {
    setMeals((prev) => ({
      ...prev,
      [dateStr]: [...(prev[dateStr] || []), emptyMeal()],
    }));
  };
  const updateMeal = (dateStr, mealId, field, value) => {
    setMeals((prev) => ({
      ...prev,
      [dateStr]: (prev[dateStr] || []).map((m) =>
        m.id === mealId ? { ...m, [field]: value } : m,
      ),
    }));
  };
  const removeMeal = (dateStr, mealId) => {
    setMeals((prev) => ({
      ...prev,
      [dateStr]: (prev[dateStr] || []).filter((m) => m.id !== mealId),
    }));
  };
  const toggleOptional = (dateStr, mealId) => {
    setMeals((prev) => ({
      ...prev,
      [dateStr]: (prev[dateStr] || []).map((m) =>
        m.id === mealId ? { ...m, showOptional: !m.showOptional } : m,
      ),
    }));
  };

  const openTimePicker = (dateStr, meal) => {
    setPickerTime(timeStrToDate(meal.meal_time || "08:00"));
    setActiveTimePicker({ dateStr, mealId: meal.id });
  };
  const onTimeChange = (event, selected) => {
    if (Platform.OS === "android") setActiveTimePicker(null);
    if (selected && activeTimePicker) {
      updateMeal(
        activeTimePicker.dateStr,
        activeTimePicker.mealId,
        "meal_time",
        dateToTimeStr(selected),
      );
    }
  };

  // ─── KAYDET ───────────────────────────────────────────────────

  const handleSave = async () => {
    if (totalMeals === 0) {
      Alert.alert("Uyarı", "En az bir öğün eklemelisiniz.");
      return;
    }
    for (const dateStr of programDays) {
      for (const meal of meals[dateStr] || []) {
        if (!meal.meal_name.trim()) {
          Alert.alert(
            "Eksik Bilgi",
            `${formatDateTR(dateStr)} için öğün adı giriniz.`,
          );
          setOpenDay(dateStr);
          return;
        }
        if (!meal.meal_time.trim()) {
          Alert.alert(
            "Eksik Bilgi",
            `${formatDateTR(dateStr)} için öğün saati giriniz.`,
          );
          setOpenDay(dateStr);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: program, error: programError } = await supabase
        .from("diet_programs")
        .insert({
          dietitian_id: user.id,
          client_id: clientId,
          week_start: startDate,
          start_date: startDate,
          end_date: endDate,
          title: programTitle.trim() || `${clientName} - Diyet Programı`,
        })
        .select()
        .single();
      if (programError) throw programError;

      const allMeals = [];
      for (const dateStr of programDays) {
        for (const meal of meals[dateStr] || []) {
          allMeals.push({
            program_id: program.id,
            meal_date: dateStr,
            day_of_week: new Date(dateStr + "T12:00:00").getDay(),
            meal_time: meal.meal_time,
            meal_name: meal.meal_name.trim(),
            meal_type: meal.meal_type || null,
            calories: meal.calories ? parseInt(meal.calories) : null,
            portion: meal.portion.trim() || null,
            notes: meal.notes.trim() || null,
          });
        }
      }
      if (allMeals.length > 0) {
        const { error: mealsError } = await supabase
          .from("diet_meals")
          .insert(allMeals);
        if (mealsError) throw mealsError;
      }
      Alert.alert(
        "Program Oluşturuldu! 🎉",
        `${clientName} için diyet programı kaydedildi.\n${formatDateTR(startDate)} — ${formatDateTR(endDate)}`,
        [{ text: "Tamam", onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert(
        "Hata",
        "Program kaydedilirken sorun oluştu: " + error.message,
      );
    } finally {
      setSaving(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────

  const renderMealCard = (dateStr, meal) => (
    <View key={meal.id} style={styles.mealCard}>
      <View style={styles.mealCardHeader}>
        <View style={styles.mealCardHeaderLeft}>
          <View style={styles.mealDot} />
          <Text style={styles.mealCardTitle}>
            {meal.meal_name || "Yeni Öğün"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => removeMeal(dateStr, meal.id)}>
          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <Text style={styles.inputLabel}>Öğün Tipi</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 8 }}
      >
        {MEAL_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, meal.meal_type === type && styles.chipActive]}
            onPress={() => updateMeal(dateStr, meal.id, "meal_type", type)}
          >
            <Text
              style={[
                styles.chipText,
                meal.meal_type === type && styles.chipTextActive,
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        <View style={[styles.inputWrapper, { flex: 1 }]}>
          <Text style={styles.inputLabel}>Saat *</Text>
          <TouchableOpacity
            style={[
              styles.input,
              styles.timePickerBtn,
              meal.meal_time && styles.timePickerBtnSelected,
            ]}
            onPress={() => openTimePicker(dateStr, meal)}
          >
            <Ionicons
              name="time-outline"
              size={15}
              color={meal.meal_time ? "#34C759" : "#8E8E93"}
            />
            <Text
              style={[
                styles.timePickerText,
                meal.meal_time && { color: "#1C1C1E" },
              ]}
            >
              {meal.meal_time || "Seç"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.inputWrapper, { flex: 2.2, marginLeft: 8 }]}>
          <Text style={styles.inputLabel}>Öğün Adı *</Text>
          <TextInput
            style={[
              styles.input,
              { minHeight: 52, textAlignVertical: "top", paddingTop: 10 },
            ]}
            placeholder="Yulaf ezmesi, muz, süt..."
            value={meal.meal_name}
            onChangeText={(v) => updateMeal(dateStr, meal.id, "meal_name", v)}
            multiline
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.optionalToggle}
        onPress={() => toggleOptional(dateStr, meal.id)}
      >
        <Ionicons
          name={meal.showOptional ? "chevron-up" : "chevron-down"}
          size={14}
          color="#34C759"
        />
        <Text style={styles.optionalToggleText}>
          {meal.showOptional ? "Detayları Gizle" : "Kalori, Porsiyon, Not Ekle"}
        </Text>
      </TouchableOpacity>

      {meal.showOptional && (
        <View>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Kalori</Text>
              <TextInput
                style={styles.input}
                placeholder="350"
                value={meal.calories}
                keyboardType="numeric"
                onChangeText={(v) =>
                  updateMeal(dateStr, meal.id, "calories", v)
                }
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1.5, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Porsiyon</Text>
              <TextInput
                style={styles.input}
                placeholder="1 kase, 200g..."
                value={meal.portion}
                onChangeText={(v) => updateMeal(dateStr, meal.id, "portion", v)}
              />
            </View>
          </View>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Notlar</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: "top" }]}
              placeholder="Öğün hakkında not..."
              value={meal.notes}
              multiline
              onChangeText={(v) => updateMeal(dateStr, meal.id, "notes", v)}
            />
          </View>
        </View>
      )}
    </View>
  );

  const renderDay = (dateStr) => {
    const isOpen = openDay === dateStr;
    const dayMeals = meals[dateStr] || [];
    return (
      <View key={dateStr} style={styles.dayAccordion}>
        <TouchableOpacity
          style={[styles.dayHeader, isOpen && styles.dayHeaderOpen]}
          onPress={() => setOpenDay(isOpen ? null : dateStr)}
          activeOpacity={0.7}
        >
          <View style={styles.dayHeaderLeft}>
            <View style={[styles.dayBadge, isOpen && styles.dayBadgeActive]}>
              <Text
                style={[
                  styles.dayBadgeText,
                  isOpen && styles.dayBadgeTextActive,
                ]}
              >
                {getDayShort(dateStr)}
              </Text>
            </View>
            <View>
              <Text style={[styles.dayLabel, isOpen && styles.dayLabelActive]}>
                {getDayShort(dateStr)}
              </Text>
              <Text style={styles.dayDate}>{formatDateTR(dateStr)}</Text>
            </View>
          </View>
          <View style={styles.dayHeaderRight}>
            {dayMeals.length > 0 && (
              <View style={styles.mealCountBadge}>
                <Text style={styles.mealCountText}>{dayMeals.length} öğün</Text>
              </View>
            )}
            <Ionicons
              name={isOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={isOpen ? "#34C759" : "#C7C7CC"}
            />
          </View>
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.dayContent}>
            {dayMeals.length === 0 ? (
              <View style={styles.emptyDay}>
                <Ionicons name="restaurant-outline" size={28} color="#E5E5EA" />
                <Text style={styles.emptyDayText}>
                  Bu gün için öğün eklenmedi
                </Text>
              </View>
            ) : (
              dayMeals.map((meal) => renderMealCard(dateStr, meal))
            )}
            <TouchableOpacity
              style={styles.addMealBtn}
              onPress={() => addMeal(dateStr)}
            >
              <Ionicons name="add-circle" size={20} color="#34C759" />
              <Text style={styles.addMealText}>Öğün Ekle</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step === 2 ? setStep(1) : navigation.goBack())}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>PDF'den Program</Text>
          <Text style={styles.headerSubtitle}>{clientName}</Text>
        </View>
        {step === 2 && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.saveBtnText}>Kaydet</Text>
            )}
          </TouchableOpacity>
        )}
        {step === 1 && <View style={{ width: 72 }} />}
      </View>

      {/* ADIM GÖSTERGESİ */}
      <View style={styles.stepBar}>
        <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
          <Text
            style={[styles.stepDotText, step >= 1 && styles.stepDotTextActive]}
          >
            1
          </Text>
        </View>
        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
          <Text
            style={[styles.stepDotText, step >= 2 && styles.stepDotTextActive]}
          >
            2
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.stepLabel}>
            {step === 1 ? "Tarih & PDF Seç" : "Düzenle & Kaydet"}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <>
            {/* TARİH SEÇİMİ */}
            <Text style={styles.sectionTitle}>Program Tarihleri</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[styles.dateCard, startDate && styles.dateCardSelected]}
                onPress={() => {
                  setSelectingStart(true);
                  setCalendarVisible(true);
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={startDate ? "#34C759" : "#8E8E93"}
                />
                <View>
                  <Text style={styles.dateCardLabel}>Başlangıç</Text>
                  <Text
                    style={[
                      styles.dateCardValue,
                      startDate && { color: "#34C759" },
                    ]}
                  >
                    {startDate ? formatDateTR(startDate) : "Tarih seç"}
                  </Text>
                </View>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={16} color="#C7C7CC" />
              <TouchableOpacity
                style={[styles.dateCard, endDate && styles.dateCardSelected]}
                onPress={() =>
                  startDate
                    ? (setSelectingStart(false), setCalendarVisible(true))
                    : Alert.alert("Uyarı", "Önce başlangıç tarihini seçin.")
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={endDate ? "#34C759" : "#8E8E93"}
                />
                <View>
                  <Text style={styles.dateCardLabel}>Bitiş</Text>
                  <Text
                    style={[
                      styles.dateCardValue,
                      endDate && { color: "#34C759" },
                    ]}
                  >
                    {endDate ? formatDateTR(endDate) : "Tarih seç"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {startDate && endDate && (
              <View style={styles.summaryBar}>
                <Ionicons name="time-outline" size={16} color="#34C759" />
                <Text style={styles.summaryText}>
                  <Text style={{ color: "#34C759", fontWeight: "700" }}>
                    {programDays.length}
                  </Text>{" "}
                  günlük program
                </Text>
              </View>
            )}

            {/* PDF YÜKLEME */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              PDF Dosyası
            </Text>
            <TouchableOpacity style={styles.pdfPickerBtn} onPress={pickPDF}>
              {pdfFile ? (
                <View style={styles.pdfSelected}>
                  <Ionicons name="document-text" size={28} color="#34C759" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pdfFileName} numberOfLines={1}>
                      {pdfFile.name}
                    </Text>
                    <Text style={styles.pdfFileSize}>
                      {pdfFile.size
                        ? `${(pdfFile.size / 1024).toFixed(0)} KB`
                        : ""}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={22} color="#34C759" />
                </View>
              ) : (
                <View style={styles.pdfPlaceholder}>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={36}
                    color="#C7C7CC"
                  />
                  <Text style={styles.pdfPlaceholderTitle}>PDF Seç</Text>
                  <Text style={styles.pdfPlaceholderSub}>
                    Diyet programı PDF dosyanızı seçin
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {pdfFile && (
              <TouchableOpacity onPress={pickPDF} style={styles.changePdfBtn}>
                <Text style={styles.changePdfText}>Farklı PDF Seç</Text>
              </TouchableOpacity>
            )}

            {/* ANALİZ BUTOnu */}
            <TouchableOpacity
              style={[
                styles.analyzeBtn,
                (!pdfFile || !startDate || !endDate || parsing) && {
                  opacity: 0.5,
                },
              ]}
              onPress={parsePDF}
              disabled={!pdfFile || !startDate || !endDate || parsing}
            >
              {parsing ? (
                <View style={{ alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.analyzeBtnText}>{parseProgress}</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={20} color="#FFF" />
                  <Text style={styles.analyzeBtnText}>AI ile Analiz Et</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.infoCard}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#007AFF"
              />
              <Text style={styles.infoText}>
                PDF'deki diyet programı Claude AI tarafından analiz edilir.
                Öğünler, saatler ve içerikler otomatik çıkarılır. Ardından
                düzenleyebilirsiniz.
              </Text>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.sectionTitle}>Program Başlığı</Text>
            <TextInput
              style={styles.titleInput}
              placeholder={`${clientName} - Diyet Programı`}
              value={programTitle}
              onChangeText={setProgramTitle}
            />

            <View style={styles.summaryBar}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.summaryText}>
                <Text style={{ color: "#34C759", fontWeight: "700" }}>
                  {totalMeals}
                </Text>{" "}
                öğün bulundu ·{" "}
                <Text style={{ color: "#34C759", fontWeight: "700" }}>
                  {programDays.length}
                </Text>{" "}
                gün
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
              Günlük Öğünler
            </Text>
            {programDays.map(renderDay)}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* TAKVİM MODAL */}
      <Modal
        visible={calendarVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectingStart ? "Başlangıç Tarihi" : "Bitiş Tarihi"}
              </Text>
              <TouchableOpacity onPress={() => setCalendarVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            {!selectingStart && (
              <View style={styles.calendarHint}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color="#007AFF"
                />
                <Text style={styles.calendarHintText}>
                  Başlangıç: {formatDateTR(startDate)}
                </Text>
              </View>
            )}
            <Calendar
              onDayPress={(day) => {
                if (selectingStart) {
                  setStartDate(day.dateString);
                  setEndDate(null);
                } else {
                  if (day.dateString < startDate) {
                    Alert.alert(
                      "Hata",
                      "Bitiş tarihi başlangıçtan önce olamaz.",
                    );
                    return;
                  }
                  setEndDate(day.dateString);
                  setCalendarVisible(false);
                }
              }}
              markedDates={markedDates}
              markingType="period"
              minDate={selectingStart ? today : startDate}
              firstDay={1}
              theme={{
                todayTextColor: "#34C759",
                selectedDayBackgroundColor: "#34C759",
                arrowColor: "#34C759",
                textDayFontWeight: "500",
                textMonthFontWeight: "700",
              }}
            />
            {selectingStart && startDate && (
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={() => setSelectingStart(false)}
              >
                <Text style={styles.nextBtnText}>Bitiş Tarihini Seç →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* TIME PICKER */}
      {activeTimePicker && (
        <DateTimePicker
          value={pickerTime}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onTimeChange}
          is24Hour
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1C1C1E" },
  headerSubtitle: { fontSize: 13, color: "#8E8E93", marginTop: 1 },
  saveBtn: {
    backgroundColor: "#34C759",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 72,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },

  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  stepDotActive: { backgroundColor: "#34C759" },
  stepDotText: { fontSize: 13, fontWeight: "700", color: "#8E8E93" },
  stepDotTextActive: { color: "#FFF" },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: "#F2F2F7",
    marginHorizontal: 4,
  },
  stepLineActive: { backgroundColor: "#34C759" },
  stepLabel: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  titleInput: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1C1C1E",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },

  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
  },
  dateCardSelected: { borderColor: "#34C759", backgroundColor: "#F0FDF4" },
  dateCardLabel: { fontSize: 11, color: "#8E8E93", fontWeight: "600" },
  dateCardValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 2,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E5F9ED",
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  summaryText: { fontSize: 14, color: "#1C1C1E" },

  pdfPickerBtn: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    overflow: "hidden",
  },
  pdfPlaceholder: { alignItems: "center", paddingVertical: 32, gap: 8 },
  pdfPlaceholderTitle: { fontSize: 16, fontWeight: "700", color: "#1C1C1E" },
  pdfPlaceholderSub: { fontSize: 13, color: "#8E8E93" },
  pdfSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  pdfFileName: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  pdfFileSize: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  changePdfBtn: { alignSelf: "center", marginTop: 8 },
  changePdfText: { fontSize: 13, color: "#007AFF", fontWeight: "600" },

  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#34C759",
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
  },
  analyzeBtnText: { fontSize: 16, color: "#FFF", fontWeight: "700" },

  infoCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#EEF4FF",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  infoText: { flex: 1, fontSize: 13, color: "#007AFF", lineHeight: 18 },

  dayAccordion: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginBottom: 8,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  dayHeaderOpen: { borderBottomWidth: 1, borderBottomColor: "#F2F2F7" },
  dayHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  dayBadgeActive: { backgroundColor: "#E5F9ED" },
  dayBadgeText: { fontSize: 12, fontWeight: "700", color: "#8E8E93" },
  dayBadgeTextActive: { color: "#34C759" },
  dayLabel: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  dayLabelActive: { color: "#34C759" },
  dayDate: { fontSize: 12, color: "#8E8E93", marginTop: 1 },
  dayHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  mealCountBadge: {
    backgroundColor: "#E5F9ED",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mealCountText: { fontSize: 12, color: "#34C759", fontWeight: "700" },
  dayContent: { padding: 12 },
  emptyDay: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyDayText: { fontSize: 13, color: "#C7C7CC" },

  mealCard: {
    backgroundColor: "#F8F8FA",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  mealCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  mealCardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  mealDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34C759" },
  mealCardTitle: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  inputWrapper: { flex: 1 },
  inputLabel: {
    fontSize: 11,
    color: "#8E8E93",
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  timePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  timePickerBtnSelected: { borderColor: "#34C759", backgroundColor: "#F0FDF4" },
  timePickerText: { fontSize: 14, fontWeight: "700", color: "#8E8E93" },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    marginRight: 6,
  },
  chipActive: { backgroundColor: "#E5F9ED", borderColor: "#34C759" },
  chipText: { fontSize: 12, color: "#8E8E93", fontWeight: "600" },
  chipTextActive: { color: "#34C759" },
  optionalToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
  },
  optionalToggleText: { fontSize: 12, color: "#34C759", fontWeight: "600" },
  addMealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "#34C759",
    borderRadius: 12,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addMealText: { fontSize: 14, color: "#34C759", fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 30,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  calendarHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF4FF",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  calendarHintText: { fontSize: 13, color: "#007AFF", flex: 1 },
  nextBtn: {
    backgroundColor: "#34C759",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  nextBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
});

export default PDFProgram;
