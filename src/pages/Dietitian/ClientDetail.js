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
  Alert,
  Modal,
  Image,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../../../supabase";

const TABS = ["Profil", "Program", "Öğünler", "Geçmiş"];

const DAY_SHORTS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const getDayShort = (dateStr) =>
  DAY_SHORTS[new Date(dateStr + "T12:00:00").getDay()];
const getDayFullName = (dateStr) => {
  const days = [
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
    "Pazar",
  ];
  return days[new Date(dateStr + "T12:00:00").getDay()];
};
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
const getProgramDays = (startStr, endStr) => {
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

const ClientDetail = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { clientId, clientName, initialTab } = route.params || {};

  const [activeTab, setActiveTab] = useState(initialTab ?? 0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [currentProgram, setCurrentProgram] = useState(null);
  const [currentMeals, setCurrentMeals] = useState([]);
  const [openDay, setOpenDay] = useState(null);
  const [pastPrograms, setPastPrograms] = useState([]);
  const [mealStats, setMealStats] = useState({ logged: 0, total: 0 });

  // Menü
  const [menuVisible, setMenuVisible] = useState(false);

  // Öğünler sekmesi
  const [mealLogsList, setMealLogsList] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [reactionModal, setReactionModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [reactionText, setReactionText] = useState("");
  const [sendingReaction, setSendingReaction] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (activeTab === 2) fetchMealLogs();
  }, [activeTab]);

  const fetchMealLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data: logs } = await supabase
        .from("meal_logs")
        .select(
          "*, diet_meals(meal_name, meal_date, meal_time, notes), meal_reactions(*)",
        )
        .eq("client_id", clientId)
        .order("logged_at", { ascending: false })
        .limit(50);
      setMealLogsList(logs || []);
    } catch (e) {
      console.log("fetchMealLogs:", e.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const sendReaction = async (emoji = null) => {
    if (!selectedLog) return;
    const content = emoji || reactionText.trim();
    if (!content) return;
    setSendingReaction(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("meal_reactions").insert({
        meal_log_id: selectedLog.id,
        dietitian_id: user.id,
        reaction_type: emoji ? "emoji" : "message",
        content,
      });
      // Danışanın push token'ını çek
      const { data: clientProfile } = await supabase
        .from("client_profiles")
        .select("push_token")
        .eq("id", clientId)
        .single();

      // Firebase ile push bildirimi /supase navigation üzerinden
      try {
        const { data: fcmResult, error: fcmError } =
          await supabase.functions.invoke("send-push-notification", {
            body: {
              token: clientProfile.push_token,
              title: "💬 Diyetisyeninizden mesaj",
              body: emoji
                ? `${clientName} öğününüze ${content} tepkisi verdi`
                : `${clientName}: ${content}`,
              data: { type: "reaction", mealLogId: selectedLog.id },
            },
          });
        console.log("FCM sonuç:", JSON.stringify(fcmResult), fcmError?.message);
      } catch (e) {
        console.log("FCM hata:", e.message);
      }
      setReactionText("");
      if (!emoji) setReactionModal(false);
      await fetchMealLogs();
    } catch (e) {
      Alert.alert("Hata", e.message);
    } finally {
      setSendingReaction(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchProfile(), fetchPrograms()]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchPrograms()]);
    setRefreshing(false);
  }, []);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("client_profiles")
      .select("*")
      .eq("id", clientId)
      .single();
    if (data) setProfile(data);
  };

  const fetchPrograms = async () => {
    const todayStr = new Date().toISOString().split("T")[0];

    // Aktif program: end_date bugün veya ileride olan en son program
    const { data: active } = await supabase
      .from("diet_programs")
      .select("*")
      .eq("client_id", clientId)
      .gte("end_date", todayStr)
      .order("end_date", { ascending: false })
      .limit(1)
      .single();

    if (active) {
      setCurrentProgram(active);
      const { data: meals } = await supabase
        .from("diet_meals")
        .select("*")
        .eq("program_id", active.id)
        .order("meal_date")
        .order("meal_time");
      if (meals) {
        setCurrentMeals(meals);

        // Yedim olarak işaretlenen öğünleri say
        const mealIds = meals.map((m) => m.id);
        const { data: logs } = await supabase
          .from("meal_logs")
          .select("meal_id, status")
          .eq("client_id", clientId)
          .eq("status", "eaten")
          .in("meal_id", mealIds);

        setMealStats({
          logged: logs?.length || 0,
          total: meals.length,
        });
      }
    } else {
      setCurrentProgram(null);
      setCurrentMeals([]);
    }

    // Geçmiş: end_date bugünden önce olan programlar
    const { data: past } = await supabase
      .from("diet_programs")
      .select("*, diet_meals(count)")
      .eq("client_id", clientId)
      .lt("end_date", todayStr)
      .order("end_date", { ascending: false })
      .limit(20);
    if (past) setPastPrograms(past);
  };

  // ─── PROGRAM SİL ────────────────────────────────────────
  const handleDeleteProgram = (program) => {
    Alert.alert(
      "Programı Sil",
      `"${program.title}" programını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await supabase
              .from("diet_meals")
              .delete()
              .eq("program_id", program.id);
            await supabase.from("diet_programs").delete().eq("id", program.id);
            await fetchPrograms();
          },
        },
      ],
    );
  };

  // ─── DANİŞAN SİL ────────────────────────────────────────
  const handleRemoveClient = () => {
    setMenuVisible(false);
    Alert.alert(
      "Danışanı Kaldır",
      `${clientName} adlı danışanı listenizden kaldırmak istediğinizden emin misiniz?\n\nDanışanın tüm program ve öğün verileri silinecektir.`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Kaldır",
          style: "destructive",
          onPress: async () => {
            // Önce programlara bağlı öğünleri sil
            const { data: programs } = await supabase
              .from("diet_programs")
              .select("id")
              .eq("client_id", clientId);
            if (programs?.length) {
              const programIds = programs.map((p) => p.id);
              await supabase
                .from("diet_meals")
                .delete()
                .in("program_id", programIds);
              await supabase
                .from("diet_programs")
                .delete()
                .eq("client_id", clientId);
            }
            await supabase
              .from("appointments")
              .delete()
              .eq("client_id", clientId);
            await supabase
              .from("client_profiles")
              .update({ dietitian_id: null, status: "inactive" })
              .eq("id", clientId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  // ─── PROFIL ────────────────────────────────────────────
  const renderProfile = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#34C759"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statsGrid}>
        <StatCard
          icon="scale-outline"
          label="Mevcut Kilo"
          value={profile?.weight ? `${profile.weight} kg` : "—"}
          color="#007AFF"
        />
        <StatCard
          icon="flag-outline"
          label="Hedef Kilo"
          value={profile?.target_weight ? `${profile.target_weight} kg` : "—"}
          color="#34C759"
        />
        <StatCard
          icon="resize-outline"
          label="Boy"
          value={profile?.height ? `${profile.height} cm` : "—"}
          color="#FF9500"
        />
        <StatCard
          icon="trending-down-outline"
          label="Fark"
          value={
            profile?.weight && profile?.target_weight
              ? `${(profile.weight - profile.target_weight).toFixed(1)} kg`
              : "—"
          }
          color="#AF52DE"
        />
      </View>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="warning-outline" size={18} color="#FF9500" />
          <Text style={styles.cardTitle}>Alerji / Kısıtlamalar</Text>
        </View>
        {profile?.allergies?.length > 0 ? (
          <View style={styles.tagContainer}>
            {profile.allergies.map((item, i) => (
              <View key={i} style={styles.allergyTag}>
                <Text style={styles.allergyTagText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Herhangi bir alerji bilgisi girilmemiş.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="restaurant-outline" size={18} color="#FF9500" />
          <Text style={styles.cardTitle}>Sevmediği Besinler</Text>
        </View>
        {profile?.disliked_foods?.length > 0 ? (
          <View style={styles.tagContainer}>
            {profile.disliked_foods.map((item, i) => (
              <View
                key={i}
                style={[
                  styles.allergyTag,
                  { borderColor: "#FF9500", backgroundColor: "#FFF8EE" },
                ]}
              >
                <Text style={[styles.allergyTagText, { color: "#FF9500" }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Sevmediği besin bilgisi girilmemiş.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="restaurant-outline" size={18} color="#34C759" />
          <Text style={styles.cardTitle}>Öğün Takibi</Text>
        </View>
        {mealStats.total > 0 ? (
          <View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(mealStats.logged / mealStats.total) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {mealStats.logged} / {mealStats.total} öğün takip edildi
            </Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>Program atanmamış.</Text>
        )}
      </View>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="mail-outline" size={18} color="#007AFF" />
          <Text style={styles.cardTitle}>İletişim</Text>
        </View>
        <Text style={styles.emailText}>{profile?.email || "—"}</Text>
      </View>
      <Text style={styles.joinDate}>
        Katılım:{" "}
        {profile?.created_at
          ? formatDate(profile.created_at.replace(" ", "T").split("T")[0])
          : "—"}
      </Text>
    </ScrollView>
  );

  // ─── PROGRAM ──────────────────────────────────────────
  const renderProgram = () => {
    const programDays = currentProgram
      ? getProgramDays(
          currentProgram.start_date || currentProgram.week_start,
          currentProgram.end_date || currentProgram.week_start,
        )
      : [];

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#34C759"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {currentProgram ? (
          <>
            <View style={styles.programHeaderCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.programTitle}>{currentProgram.title}</Text>
                <Text style={styles.programWeek}>
                  {formatDate(
                    currentProgram.start_date || currentProgram.week_start,
                  )}
                  {currentProgram.end_date
                    ? ` — ${formatDate(currentProgram.end_date)}`
                    : ""}
                </Text>
              </View>
              <View style={styles.programHeaderRight}>
                <View style={styles.programBadge}>
                  <Text style={styles.programBadgeText}>Aktif Program</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteProgramBtn}
                  onPress={() => handleDeleteProgram(currentProgram)}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>

            {programDays.map((dateStr) => {
              const dayMeals = currentMeals.filter(
                (m) => m.meal_date === dateStr,
              );
              const isOpen = openDay === dateStr;
              return (
                <View key={dateStr} style={styles.dayAccordion}>
                  <TouchableOpacity
                    style={[styles.dayHeader, isOpen && styles.dayHeaderOpen]}
                    onPress={() => setOpenDay(isOpen ? null : dateStr)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayHeaderLeft}>
                      <View
                        style={[
                          styles.dayBadge,
                          isOpen && styles.dayBadgeActive,
                        ]}
                      >
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
                        <Text
                          style={[
                            styles.dayLabel,
                            isOpen && styles.dayLabelActive,
                          ]}
                        >
                          {getDayFullName(dateStr)}
                        </Text>
                        <Text style={styles.dayDate}>
                          {formatDate(dateStr)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dayHeaderRight}>
                      {dayMeals.length > 0 && (
                        <View style={styles.mealCountBadge}>
                          <Text style={styles.mealCountText}>
                            {dayMeals.length} öğün
                          </Text>
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
                        <Text style={styles.emptyDayText}>
                          Bu gün için öğün eklenmemiş.
                        </Text>
                      ) : (
                        dayMeals.map((meal) => (
                          <View key={meal.id} style={styles.mealRow}>
                            <View style={styles.mealTimeCol}>
                              <Text style={styles.mealTime}>
                                {meal.meal_time?.slice(0, 5)}
                              </Text>
                              {meal.meal_type && (
                                <View style={styles.mealTypeBadge}>
                                  <Text style={styles.mealTypeText}>
                                    {meal.meal_type}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.mealInfoCol}>
                              <Text style={styles.mealName}>
                                {meal.meal_name}
                              </Text>
                              <View style={styles.mealMeta}>
                                {meal.calories && (
                                  <Text style={styles.mealMetaText}>
                                    🔥 {meal.calories} kcal
                                  </Text>
                                )}
                                {meal.portion && (
                                  <Text style={styles.mealMetaText}>
                                    ⚖️ {meal.portion}
                                  </Text>
                                )}
                              </View>
                              {meal.notes && (
                                <Text style={styles.mealNotes}>
                                  {meal.notes}
                                </Text>
                              )}
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.noProgramContainer}>
            <Ionicons name="calendar-outline" size={64} color="#E5E5EA" />
            <Text style={styles.noProgramTitle}>Henüz Program Yok</Text>
            <Text style={styles.noProgramText}>
              {clientName} için henüz bir diyet programı oluşturulmamış.
            </Text>
            <TouchableOpacity
              style={styles.createProgramBtn}
              onPress={() =>
                navigation.navigate("CreateProgram", { clientId, clientName })
              }
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.createProgramBtnText}>Program Oluştur</Text>
            </TouchableOpacity>
          </View>
        )}
        {currentProgram && (
          <TouchableOpacity
            style={styles.newProgramBtn}
            onPress={() =>
              navigation.navigate("CreateProgram", { clientId, clientName })
            }
          >
            <Ionicons name="add-circle-outline" size={18} color="#34C759" />
            <Text style={styles.newProgramBtnText}>Yeni Program Oluştur</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  // ─── ÖĞÜNLER SEKMESİ ──────────────────────────────────────────
  const renderMealLogs = () => {
    if (loadingLogs)
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#34C759" />
        </View>
      );

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
      >
        {mealLogsList.length === 0 ? (
          <View style={styles.noProgramContainer}>
            <Ionicons name="camera-outline" size={64} color="#E5E5EA" />
            <Text style={styles.noProgramTitle}>Öğün Fotoğrafı Yok</Text>
            <Text style={styles.noProgramText}>
              Danışan henüz öğün fotoğrafı yüklememış.
            </Text>
          </View>
        ) : (
          mealLogsList.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logMealName}>
                    {log.diet_meals?.meal_name}
                  </Text>
                  <Text style={styles.logMealDate}>
                    {log.diet_meals?.meal_date} ·{" "}
                    {log.diet_meals?.meal_time?.slice(0, 5)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.logStatusBadge,
                    {
                      backgroundColor:
                        log.status === "eaten" ? "#E5F9ED" : "#FFF0EE",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: log.status === "eaten" ? "#34C759" : "#FF3B30",
                    }}
                  >
                    {log.status === "eaten" ? "Yedim" : "Yemedim"}
                  </Text>
                </View>
              </View>

              {log.photo_url && (
                <Image
                  source={{ uri: log.photo_url }}
                  style={styles.logPhoto}
                  resizeMode="cover"
                />
              )}

              {(log.portion_note || log.change_note) && (
                <View style={styles.logNotes}>
                  {log.portion_note && (
                    <Text style={styles.logNoteText}>
                      📝 {log.portion_note}
                    </Text>
                  )}
                  {log.change_note && (
                    <Text style={styles.logNoteText}>🔄 {log.change_note}</Text>
                  )}
                </View>
              )}

              {log.meal_reactions?.length > 0 && (
                <View style={styles.reactionsContainer}>
                  {log.meal_reactions.map((r) => (
                    <View
                      key={r.id}
                      style={[
                        styles.reactionBubble,
                        r.reaction_type === "emoji"
                          ? styles.emojiBubble
                          : styles.messageBubble,
                      ]}
                    >
                      <Text
                        style={
                          r.reaction_type === "emoji"
                            ? styles.emojiText
                            : styles.messageText
                        }
                      >
                        {r.content}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.quickEmojis}>
                {["👍", "❤️", "🎉", "💪", "🔥"].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.quickEmojiBtn}
                    onPress={() => {
                      setSelectedLog(log);
                      sendReaction(emoji);
                    }}
                  >
                    <Text style={styles.quickEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.messageBtn}
                  onPress={() => {
                    setSelectedLog(log);
                    setReactionModal(true);
                  }}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={16}
                    color="#007AFF"
                  />
                  <Text style={styles.messageBtnText}>Mesaj</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // ─── GEÇMİŞ ───────────────────────────────────────────
  const renderHistory = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#34C759"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {pastPrograms.length === 0 ? (
        <View style={styles.noProgramContainer}>
          <Ionicons name="time-outline" size={64} color="#E5E5EA" />
          <Text style={styles.noProgramTitle}>Geçmiş Program Yok</Text>
          <Text style={styles.noProgramText}>
            Önceki haftalara ait program bulunmuyor.
          </Text>
        </View>
      ) : (
        pastPrograms.map((program) => (
          <View key={program.id} style={styles.historyCard}>
            <View style={styles.historyCardLeft}>
              <View style={styles.historyIcon}>
                <Ionicons name="calendar" size={20} color="#007AFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>{program.title}</Text>
                <Text style={styles.historyDate}>
                  {formatDate(program.start_date || program.week_start)}
                  {program.end_date ? ` — ${formatDate(program.end_date)}` : ""}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleDeleteProgram(program)}
              style={styles.historyDeleteBtn}
            >
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );

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
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatarImg}
            />
          ) : (
            <View
              style={[
                styles.avatar,
                { backgroundColor: getAvatarColor(clientName) },
              ]}
            >
              <Text style={styles.avatarText}>
                {clientName?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.headerName}>{clientName}</Text>
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Aktif Danışan</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => setMenuVisible(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#1C1C1E" />
        </TouchableOpacity>
      </View>

      {/* SEKMELER */}
      <View style={styles.tabBar}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === index && styles.tabActive]}
            onPress={() => setActiveTab(index)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === index && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
            {activeTab === index && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 0 && renderProfile()}
      {activeTab === 1 && renderProgram()}
      {activeTab === 2 && renderMealLogs()}
      {activeTab === 3 && renderHistory()}

      {/* REAKSİYON MODAL */}
      <Modal
        visible={reactionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setReactionModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.reactionModalOverlay}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setReactionModal(false)}
            />
            <View style={styles.reactionModal}>
              <View style={styles.reactionModalHeader}>
                <Text style={styles.reactionModalTitle}>Mesaj Gönder</Text>
                <TouchableOpacity onPress={() => setReactionModal(false)}>
                  <Ionicons name="close" size={24} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              {selectedLog?.photo_url && (
                <Image
                  source={{ uri: selectedLog.photo_url }}
                  style={styles.reactionPreviewPhoto}
                  resizeMode="cover"
                />
              )}
              <Text style={styles.reactionMealName}>
                {selectedLog?.diet_meals?.meal_name}
              </Text>
              <View style={styles.emojiRow}>
                {["👍", "❤️", "🎉", "💪", "⭐", "😊", "🔥", "👏"].map(
                  (emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.emojiPickerBtn}
                      onPress={() => sendReaction(emoji)}
                    >
                      <Text style={{ fontSize: 24 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>
              <View style={styles.reactionInputRow}>
                <TextInput
                  style={styles.reactionInput}
                  placeholder="Mesaj yaz..."
                  value={reactionText}
                  onChangeText={setReactionText}
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.reactionSendBtn,
                    (!reactionText.trim() || sendingReaction) && {
                      opacity: 0.5,
                    },
                  ]}
                  onPress={() => sendReaction()}
                  disabled={!reactionText.trim() || sendingReaction}
                >
                  {sendingReaction ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="send" size={18} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ... MENÜ MODAL */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuBox}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate("CreateProgram", { clientId, clientName });
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#34C759" />
              <Text style={styles.menuItemText}>Yeni Program Oluştur</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate("PDFProgram", { clientId, clientName });
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#AF52DE"
              />
              <Text style={styles.menuItemText}>PDF'den Program</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleRemoveClient}
            >
              <Ionicons
                name="person-remove-outline"
                size={20}
                color="#FF3B30"
              />
              <Text style={[styles.menuItemText, { color: "#FF3B30" }]}>
                Danışanı Kaldır
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <Ionicons name={icon} size={20} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

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
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  headerName: { fontSize: 17, fontWeight: "700", color: "#1C1C1E" },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34C759",
  },
  activeText: { fontSize: 12, color: "#34C759", fontWeight: "600" },
  moreBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    position: "relative",
  },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: "600", color: "#8E8E93" },
  tabTextActive: { color: "#34C759" },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "20%",
    right: "20%",
    height: 2,
    backgroundColor: "#34C759",
    borderRadius: 1,
  },
  tabContent: { padding: 16, paddingBottom: 40 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    width: "47%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    borderTopWidth: 3,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 4,
  },
  statLabel: { fontSize: 12, color: "#8E8E93" },
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
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  allergyText: { fontSize: 14, color: "#3A3A3C", lineHeight: 20 },
  tagContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  allergyTag: {
    backgroundColor: "#FFF0EE",
    borderWidth: 1,
    borderColor: "#FF3B30",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  allergyTagText: { fontSize: 13, color: "#FF3B30", fontWeight: "600" },

  tagContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  allergyTag: {
    backgroundColor: "#FFF0EE",
    borderWidth: 1,
    borderColor: "#FF3B30",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  allergyTagText: { fontSize: 13, color: "#FF3B30", fontWeight: "600" },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  emailText: { fontSize: 14, color: "#007AFF" },
  joinDate: {
    textAlign: "center",
    fontSize: 12,
    color: "#C7C7CC",
    marginTop: 8,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#F2F2F7",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#34C759",
    borderRadius: 4,
  },
  progressText: { fontSize: 13, color: "#8E8E93", marginTop: 6 },
  emptyText: { fontSize: 13, color: "#C7C7CC" },
  programHeaderCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  programHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  programTitle: { fontSize: 16, fontWeight: "700", color: "#1C1C1E" },
  programWeek: { fontSize: 13, color: "#8E8E93", marginTop: 2 },
  programBadge: {
    backgroundColor: "#E5F9ED",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  programBadgeText: { fontSize: 12, color: "#34C759", fontWeight: "700" },
  deleteProgramBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFF0EE",
    justifyContent: "center",
    alignItems: "center",
  },
  shoppingListBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#E5F9ED",
    justifyContent: "center",
    alignItems: "center",
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
  dayLabel: { fontSize: 16, fontWeight: "600", color: "#1C1C1E" },
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
  dayContent: { padding: 12, gap: 8 },
  emptyDayText: {
    fontSize: 13,
    color: "#C7C7CC",
    textAlign: "center",
    paddingVertical: 12,
  },
  mealRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  mealTimeCol: { width: 60, alignItems: "center" },
  mealTime: { fontSize: 14, fontWeight: "700", color: "#1C1C1E" },
  mealTypeBadge: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  mealTypeText: { fontSize: 10, color: "#8E8E93", fontWeight: "600" },
  mealInfoCol: { flex: 1 },
  mealName: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  mealMeta: { flexDirection: "row", gap: 10, marginTop: 4 },
  mealMetaText: { fontSize: 12, color: "#8E8E93" },
  mealNotes: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
    fontStyle: "italic",
  },
  noProgramContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 30,
    gap: 12,
  },
  noProgramTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  noProgramText: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
  },
  createProgramBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#34C759",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
    elevation: 2,
    shadowColor: "#34C759",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  createProgramBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  newProgramBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#34C759",
    borderRadius: 14,
    borderStyle: "dashed",
    marginTop: 8,
  },
  newProgramBtnText: { fontSize: 14, color: "#34C759", fontWeight: "700" },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  historyCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  historyTitle: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  historyDate: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  historyDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FFF0EE",
    justifyContent: "center",
    alignItems: "center",
  },

  // ... menü
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 100,
    paddingRight: 16,
  },
  menuBox: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 220,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  menuDivider: { height: 1, backgroundColor: "#F2F2F7", marginHorizontal: 12 },

  // Öğün logları
  logCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  logHeader: { flexDirection: "row", alignItems: "center", padding: 12 },
  logMealName: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  logMealDate: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  logStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  logPhoto: { width: "100%", height: 220 },
  logNotes: {
    padding: 12,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  logNoteText: { fontSize: 13, color: "#3A3A3C", lineHeight: 18 },
  reactionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  reactionBubble: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emojiBubble: { backgroundColor: "#F2F2F7" },
  messageBubble: { backgroundColor: "#EEF4FF", maxWidth: 260 },
  emojiText: { fontSize: 16 },
  messageText: { fontSize: 13, color: "#007AFF" },
  quickEmojis: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  quickEmojiBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  quickEmojiText: { fontSize: 18 },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    backgroundColor: "#EEF4FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  messageBtnText: { fontSize: 13, color: "#007AFF", fontWeight: "600" },

  // Reaction modal
  reactionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  reactionModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  reactionModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  reactionModalTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  reactionPreviewPhoto: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 10,
  },
  reactionMealName: { fontSize: 14, color: "#8E8E93", marginBottom: 12 },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  emojiPickerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  reactionInputRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  reactionInput: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1C1C1E",
    maxHeight: 100,
  },
  reactionSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ClientDetail;
