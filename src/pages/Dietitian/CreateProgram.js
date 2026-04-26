import React, { useState, useMemo, useEffect } from "react";
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
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../../../supabase";

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
const DAY_SHORTS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

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

const CreateProgram = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { clientId, clientName } = route.params || {};

  const [programTitle, setProgramTitle] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectingStart, setSelectingStart] = useState(true);
  const [openDay, setOpenDay] = useState(null);
  const [meals, setMeals] = useState({});
  const [saving, setSaving] = useState(false);

  // Tarif seçici
  const [recipeModalVisible, setRecipeModalVisible] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [recipeTargetDay, setRecipeTargetDay] = useState(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // Önceki program kopyalama
  const [copyingProgram, setCopyingProgram] = useState(false);

  // Time picker: hangi öğünün picker'ı açık
  const [activeTimePicker, setActiveTimePicker] = useState(null); // { dateStr, mealId }
  const [pickerTime, setPickerTime] = useState(new Date());

  const programDays = useMemo(
    () => getDaysBetween(startDate, endDate),
    [startDate, endDate],
  );

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
    const between = getDaysBetween(startDate, endDate);
    between.forEach((d, i) => {
      if (i === 0)
        marks[d] = { startingDay: true, color: "#34C759", textColor: "#FFF" };
      else if (i === between.length - 1)
        marks[d] = { endingDay: true, color: "#34C759", textColor: "#FFF" };
      else marks[d] = { color: "#E5F9ED", textColor: "#34C759" };
    });
    return marks;
  }, [startDate, endDate]);

  const handleDayPress = (day) => {
    if (selectingStart) {
      setStartDate(day.dateString);
      setEndDate(null);
      setMeals({});
      setOpenDay(null);
    } else {
      if (day.dateString < startDate) {
        Alert.alert("Hata", "Bitiş tarihi başlangıç tarihinden önce olamaz.");
        return;
      }
      setEndDate(day.dateString);
      setCalendarVisible(false);
    }
  };

  const openCalendar = (isStart) => {
    setSelectingStart(isStart);
    setCalendarVisible(true);
  };

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
      const timeStr = dateToTimeStr(selected);
      updateMeal(
        activeTimePicker.dateStr,
        activeTimePicker.mealId,
        "meal_time",
        timeStr,
      );
    }
  };

  const totalMeals = Object.values(meals).reduce((sum, d) => sum + d.length, 0);

  const handleSave = async () => {
    if (!startDate || !endDate) {
      Alert.alert("Uyarı", "Lütfen başlangıç ve bitiş tarihini seçin.");
      return;
    }
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

  // ─── TARİFLERİ YÜKlE ─────────────────────────────────────────
  const openRecipeModal = async (dateStr) => {
    setRecipeTargetDay(dateStr);
    setRecipeModalVisible(true);
    if (recipes.length > 0) return;
    setLoadingRecipes(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("recipes")
        .select("id, title, calories, prep_time, ingredients")
        .eq("dietitian_id", user.id)
        .order("created_at", { ascending: false });
      setRecipes(data || []);
    } catch (e) {
      console.log(e);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const addMealFromRecipe = (recipe) => {
    const newMeal = {
      ...emptyMeal(),
      meal_name: recipe.title,
      calories: recipe.calories ? String(recipe.calories) : "",
      notes:
        recipe.ingredients
          ?.map(
            (i) =>
              `${i.name}${i.amount ? " " + i.amount : ""}${i.unit ? " " + i.unit : ""}`,
          )
          .join(", ") || "",
      showOptional: true,
    };
    setMeals((prev) => ({
      ...prev,
      [recipeTargetDay]: [...(prev[recipeTargetDay] || []), newMeal],
    }));
    setRecipeModalVisible(false);
  };

  // ─── ÖNCEKİ PROGRAMI KOPYALA ──────────────────────────────────
  const copyLastProgram = async () => {
    if (!startDate || !endDate) {
      Alert.alert("Uyarı", "Önce program tarihlerini seçin.");
      return;
    }
    setCopyingProgram(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: lastProgram } = await supabase
        .from("diet_programs")
        .select("id, start_date, end_date, title")
        .eq("client_id", clientId)
        .order("end_date", { ascending: false })
        .limit(1)
        .single();

      if (!lastProgram) {
        Alert.alert("Bilgi", "Kopyalanacak önceki program bulunamadı.");
        return;
      }

      const { data: lastMeals } = await supabase
        .from("diet_meals")
        .select("*")
        .eq("program_id", lastProgram.id)
        .order("meal_date")
        .order("meal_time");

      if (!lastMeals?.length) {
        Alert.alert("Bilgi", "Önceki programda öğün bulunamadı.");
        return;
      }

      // Tarihleri yeni programa kaydır
      const oldStart = new Date(lastProgram.start_date + "T12:00:00");
      const newStart = new Date(startDate + "T12:00:00");
      const diffDays = Math.round(
        (newStart - oldStart) / (1000 * 60 * 60 * 24),
      );

      const newMeals = {};
      lastMeals.forEach((m) => {
        const oldDate = new Date(m.meal_date + "T12:00:00");
        oldDate.setDate(oldDate.getDate() + diffDays);
        const y = oldDate.getFullYear();
        const mo = String(oldDate.getMonth() + 1).padStart(2, "0");
        const d = String(oldDate.getDate()).padStart(2, "0");
        const newDateStr = `${y}-${mo}-${d}`;

        if (newDateStr >= startDate && newDateStr <= endDate) {
          if (!newMeals[newDateStr]) newMeals[newDateStr] = [];
          newMeals[newDateStr].push({
            ...emptyMeal(),
            meal_type: m.meal_type || "",
            meal_time: m.meal_time?.slice(0, 5) || "",
            meal_name: m.meal_name,
            calories: m.calories ? String(m.calories) : "",
            portion: m.portion || "",
            notes: m.notes || "",
            showOptional: !!(m.calories || m.portion || m.notes),
          });
        }
      });

      setMeals(newMeals);
      if (!programTitle) setProgramTitle(lastProgram.title);
      Alert.alert("✓", "Önceki program kopyalandı. Düzenleyebilirsiniz.");
    } catch (e) {
      Alert.alert("Hata", e.message);
    } finally {
      setCopyingProgram(false);
    }
  };

  const renderMealCard = (dateStr, meal) => (
    <View key={meal.id} style={styles.mealCard}>
      <View style={styles.mealCardHeader}>
        <View style={styles.mealCardHeaderLeft}>
          <View style={styles.mealDot} />
          <Text style={styles.mealCardTitle}>
            {meal.meal_name || "Yeni Öğün"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => removeMeal(dateStr, meal.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
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
        {/* SAAT — TimePicker butonu */}
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
            placeholder="Yulaf ezmesi, muz, süt karıştırılacak..."
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
                onChangeText={(v) =>
                  updateMeal(dateStr, meal.id, "calories", v)
                }
                keyboardType="numeric"
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
              style={[styles.input, { height: 60, textAlignVertical: "top" }]}
              placeholder="Öğün hakkında not..."
              value={meal.notes}
              onChangeText={(v) => updateMeal(dateStr, meal.id, "notes", v)}
              multiline
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
                  Bu gün için henüz öğün eklenmedi
                </Text>
              </View>
            ) : (
              dayMeals.map((meal) => renderMealCard(dateStr, meal))
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[styles.addMealBtn, { flex: 1 }]}
                onPress={() => addMeal(dateStr)}
              >
                <Ionicons name="add-circle" size={20} color="#34C759" />
                <Text style={styles.addMealText}>Öğün Ekle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addMealBtn, { flex: 1, borderColor: "#007AFF" }]}
                onPress={() => openRecipeModal(dateStr)}
              >
                <Ionicons name="book-outline" size={18} color="#007AFF" />
                <Text style={[styles.addMealText, { color: "#007AFF" }]}>
                  Tariften Ekle
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Program Oluştur</Text>
            <Text style={styles.headerSubtitle}>{clientName}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={[styles.copyBtn, copyingProgram && { opacity: 0.6 }]}
              onPress={copyLastProgram}
              disabled={copyingProgram}
            >
              {copyingProgram ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Ionicons name="copy-outline" size={18} color="#007AFF" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Program Başlığı</Text>
          <TextInput
            style={styles.titleInput}
            placeholder={`${clientName} - Diyet Programı`}
            value={programTitle}
            onChangeText={setProgramTitle}
          />

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            Program Tarihleri
          </Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateCard, startDate && styles.dateCardSelected]}
              onPress={() => openCalendar(true)}
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
                  ? openCalendar(false)
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
                günlük program · Toplam{" "}
                <Text style={{ color: "#34C759", fontWeight: "700" }}>
                  {totalMeals}
                </Text>{" "}
                öğün
              </Text>
            </View>
          )}

          {programDays.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                Günlük Öğünler
              </Text>
              {programDays.map(renderDay)}
            </>
          )}

          {!startDate && (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#E5E5EA" />
              <Text style={styles.emptyStateText}>
                Başlangıç ve bitiş tarihini seçerek program oluşturmaya başlayın
              </Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* TARİF SEÇİCİ MODAL */}
      <Modal
        visible={recipeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRecipeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "75%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tarif Seç</Text>
              <TouchableOpacity onPress={() => setRecipeModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            {loadingRecipes ? (
              <ActivityIndicator
                size="large"
                color="#34C759"
                style={{ padding: 30 }}
              />
            ) : recipes.length === 0 ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <Ionicons name="restaurant-outline" size={40} color="#E5E5EA" />
                <Text style={{ color: "#8E8E93", marginTop: 8 }}>
                  Henüz tarif eklenmemiş
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {recipes.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.recipeItem}
                    onPress={() => addMealFromRecipe(recipe)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipeItemTitle}>{recipe.title}</Text>
                      <View
                        style={{ flexDirection: "row", gap: 8, marginTop: 4 }}
                      >
                        {recipe.calories && (
                          <Text style={styles.recipeItemMeta}>
                            🔥 {recipe.calories} kcal
                          </Text>
                        )}
                        {recipe.prep_time && (
                          <Text style={styles.recipeItemMeta}>
                            ⏱ {recipe.prep_time} dk
                          </Text>
                        )}
                      </View>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#34C759" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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
              onDayPress={handleDayPress}
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
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyStateText: {
    fontSize: 14,
    color: "#C7C7CC",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
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
  copyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  recipeItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  recipeItemTitle: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  recipeItemMeta: { fontSize: 12, color: "#8E8E93" },
});

export default CreateProgram;
