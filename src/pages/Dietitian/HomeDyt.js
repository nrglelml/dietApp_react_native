import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Platform,
  Modal,
  Alert,
  TextInput,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DietitianTabBar } from "../../components";
import {
  getUnreadCount,
  getNotifications,
  markAsRead,
  markAllAsRead,
  checkProgramExpirations,
  loadSettings,
} from "../../services/notificationService";

const toLocalDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const todayStr = toLocalDateStr();

const formatDateTR = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });
};

const notifIcon = (type) => {
  switch (type) {
    case "new_client":
      return "person-add-outline";
    case "client_left":
      return "person-remove-outline";
    case "program_ending":
      return "warning-outline";
    case "program_expired":
      return "alert-circle-outline";
    case "appointment":
      return "calendar-outline";
    default:
      return "notifications-outline";
  }
};

const notifIconColor = (type) => {
  switch (type) {
    case "new_client":
      return "#34C759";
    case "client_left":
      return "#FF3B30";
    case "program_ending":
      return "#FF9500";
    case "program_expired":
      return "#FF3B30";
    case "appointment":
      return "#007AFF";
    default:
      return "#8E8E93";
  }
};

const notifIconBg = (type) => notifIconColor(type) + "18";

const formatNotifTime = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} saat önce`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} gün önce`;
  return date.toLocaleDateString("tr-TR");
};

const HomeDyt = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dietitianId, setDietitianId] = useState(null);
  const [dietitianName, setDietitianName] = useState("");
  const [stats, setStats] = useState({ totalClients: 0, thisWeek: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [clientsWithProgram, setClientsWithProgram] = useState(new Set());
  const [warnings, setWarnings] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPanelVisible, setNotifPanelVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [dismissedWarnings, setDismissedWarnings] = useState(new Set());

  const navigation = useNavigation();
  const route = useRoute();

  useEffect(() => {
    if (route.params?.openModal) {
      setModalVisible(true);
      navigation.setParams({ openModal: false });
    }
  }, [route.params?.openModal]);

  useEffect(() => {
    loadDismissed();
    fetchUserAndData();
    loadUnreadCount();
    runExpirationCheck();
  }, []);

  const loadUnreadCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (e) {}
  };

  const runExpirationCheck = async () => {
    try {
      const settings = await loadSettings();
      await checkProgramExpirations(settings);
      await loadUnreadCount();
    } catch (e) {}
  };

  const openNotifPanel = async () => {
    setNotifPanelVisible(true);
    setLoadingNotifs(true);
    try {
      const data = await getNotifications();
      setNotifications(data || []);
    } catch (e) {
      setNotifications([]);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  const handleMarkRead = async (id) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {}
  };

  const loadDismissed = async () => {
    try {
      const raw = await AsyncStorage.getItem("dismissed_warnings");
      if (raw) {
        const parsed = JSON.parse(raw);
        setDismissedWarnings(new Set(parsed[`dismissed_${todayStr}`] || []));
      }
    } catch (e) {}
  };

  const dismissWarning = async (warningId) => {
    const updated = new Set([...dismissedWarnings, warningId]);
    setDismissedWarnings(updated);
    try {
      const raw = await AsyncStorage.getItem("dismissed_warnings");
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[`dismissed_${todayStr}`] = [...updated];
      await AsyncStorage.setItem("dismissed_warnings", JSON.stringify(parsed));
    } catch (e) {}
  };

  const fetchUserAndData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setDietitianId(user.id);
      const { data: profile } = await supabase
        .from("dietitian_profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile) setDietitianName(profile.full_name);
      // ── DİYETİSYEN PUSH TOKEN KAYDET ──────────────────────
      try {
        const Notifications = require("expo-notifications");
        const Device = require("expo-device");
        if (Device.isDevice) {
          const { status } = await Notifications.getPermissionsAsync();
          let finalStatus = status;
          if (status !== "granted") {
            const { status: newStatus } =
              await Notifications.requestPermissionsAsync();
            finalStatus = newStatus;
          }
          if (finalStatus === "granted") {
            const tokenData = await Notifications.getDevicePushTokenAsync();
            if (tokenData?.data) {
              await supabase
                .from("dietitian_settings")
                .upsert(
                  { dietitian_id: user.id, push_token: tokenData.data },
                  { onConflict: "dietitian_id" },
                );
            }
          }
        }
      } catch (tokenErr) {
        console.log("Diyetisyen token hatası:", tokenErr.message);
      }
      await fetchClients(user.id);
    } catch (error) {
      console.error("Yükleme hatası:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async (dytId) => {
    const { data, error } = await supabase
      .from("client_profiles")
      .select(
        "id, full_name, weight, height, status, email, created_at,avatar_url",
      )
      .eq("dietitian_id", dytId)
      .eq("status", "active")
      .order("full_name", { ascending: true });

    if (error || !data) return;
    setClients(data);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    setStats({
      totalClients: data.length,
      thisWeek: data.filter((c) => new Date(c.created_at) > weekAgo).length,
    });

    if (data.length > 0) {
      const clientIds = data.map((c) => c.id);
      const { data: programs } = await supabase
        .from("diet_programs")
        .select("client_id")
        .eq("dietitian_id", dytId)
        .in("client_id", clientIds);
      if (programs)
        setClientsWithProgram(new Set(programs.map((p) => p.client_id)));

      const { data: latestPrograms } = await supabase
        .from("diet_programs")
        .select("client_id, end_date, title")
        .eq("dietitian_id", dytId)
        .in("client_id", clientIds)
        .not("end_date", "is", null)
        .order("end_date", { ascending: false });

      if (latestPrograms) {
        const latestByClient = {};
        latestPrograms.forEach((p) => {
          if (!latestByClient[p.client_id]) latestByClient[p.client_id] = p;
        });
        const newWarnings = [];
        data.forEach((client) => {
          const prog = latestByClient[client.id];
          if (!prog) return;
          if (prog.end_date === todayStr) {
            newWarnings.push({
              id: `${client.id}_${prog.end_date}`,
              clientId: client.id,
              clientName: client.full_name,
              endDate: prog.end_date,
              type: "today",
            });
          } else if (prog.end_date < todayStr) {
            newWarnings.push({
              id: `${client.id}_${prog.end_date}`,
              clientId: client.id,
              clientName: client.full_name,
              endDate: prog.end_date,
              type: "expired",
            });
          }
        });
        setWarnings(newWarnings);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (dietitianId) await fetchClients(dietitianId);
    setRefreshing(false);
  }, [dietitianId]);

  const handleLogout = async () => {
    Alert.alert("Çıkış Yap", "Hesabınızdan çıkmak istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
        },
      },
    ]);
  };

  const addClient = async () => {
    if (!clientEmail.trim()) {
      Alert.alert("Hata", "Lütfen bir e-posta adresi girin.");
      return;
    }
    setSendingInvite(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from("client_profiles")
        .select("id, full_name, dietitian_id")
        .eq("email", clientEmail.toLowerCase().trim())
        .single();
      if (userError || !userData) {
        Alert.alert(
          "Danışan Bulunamadı",
          "Bu e-postaya sahip bir danışan bulunamadı.",
        );
        return;
      }
      if (userData.dietitian_id === dietitianId) {
        Alert.alert("Bilgi", "Bu danışan zaten listenizde bulunuyor.");
        return;
      }

      const approvalUrl = `https://idyllic-cassata-8758dd.netlify.app/?dietitianId=${dietitianId}&dietitianName=${encodeURIComponent(dietitianName)}&targetEmail=${encodeURIComponent(clientEmail.toLowerCase().trim())}`;
      const { error: funcError } = await supabase.functions.invoke(
        "send-invite-email",
        {
          body: {
            clientEmail: clientEmail.toLowerCase().trim(),
            clientName: userData.full_name,
            dietitianName,
            approvalUrl,
          },
        },
      );
      if (funcError) throw funcError;
      Alert.alert(
        "Davet Gönderildi ✅",
        `${userData.full_name} adlı danışana davet e-postası gönderildi.`,
      );
      setModalVisible(false);
      setClientEmail("");
    } catch (error) {
      Alert.alert("Hata", "E-posta gönderimi sırasında bir sorun oluştu.");
    } finally {
      setSendingInvite(false);
    }
  };

  const getInitials = (name) => name?.trim().charAt(0).toUpperCase() || "?";
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

  const visibleWarnings = warnings.filter((w) => !dismissedWarnings.has(w.id));

  const renderClientItem = ({ item }) => {
    const hasProgram = clientsWithProgram.has(item.id);
    return (
      <TouchableOpacity
        style={styles.clientCard}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate("ClientDetail", {
            clientId: item.id,
            clientName: item.full_name,
            clientAvatar: item.avatar_url,
          })
        }
      >
        <View style={styles.clientInfo}>
          {item.avatar_url ? (
            <Image
              source={{ uri: item.avatar_url }}
              style={styles.avatarPlaceholder}
            />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: getAvatarColor(item.full_name) },
              ]}
            >
              <Text style={styles.avatarText}>
                {item.full_name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={styles.clientName}>{item.full_name}</Text>
            <View style={styles.statusRow}>
              <Text style={styles.clientWeightText}>
                {item.weight ? `${item.weight} kg` : "Kilo girilmemiş"}
              </Text>
              {hasProgram ? (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate("ClientDetail", {
                      clientId: item.id,
                      clientName: item.full_name,
                      initialTab: 1,
                    })
                  }
                  style={[styles.programBadge, { backgroundColor: "#E5F9ED" }]}
                >
                  <Ionicons name="checkmark-circle" size={12} color="#34C759" />
                  <Text style={[styles.programBadgeText, { color: "#34C759" }]}>
                    Program var
                  </Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={[styles.programBadge, { backgroundColor: "#FFF3E0" }]}
                >
                  <Ionicons name="time-outline" size={12} color="#FF9500" />
                  <Text style={[styles.programBadgeText, { color: "#FF9500" }]}>
                    Program yok
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          {!hasProgram && (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("CreateProgram", {
                  clientId: item.id,
                  clientName: item.full_name,
                })
              }
              style={styles.createProgramBtn}
            >
              <Text style={styles.createProgramText}>Program Ekle</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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
        <View style={styles.headerTop}>
          <View style={styles.profileRow}>
            <View style={styles.adminAvatar}>
              <Ionicons name="person" size={18} color="#8E8E93" />
            </View>
            <View>
              <Text style={styles.welcomeText}>Merhaba,</Text>
              <Text style={styles.portalTitle}>
                {dietitianName || "Diyetisyen"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={openNotifPanel}
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color="#1C1C1E"
              />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Toplam Danışan</Text>
            <View style={styles.valueRow}>
              <Text style={styles.statValue}>{stats.totalClients}</Text>
              <View style={[styles.trendBadge, { backgroundColor: "#E5F9ED" }]}>
                <Text style={[styles.trendText, { color: "#34C759" }]}>
                  Aktif
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Bu Hafta Eklenen</Text>
            <View style={styles.valueRow}>
              <Text style={styles.statValue}>{stats.thisWeek}</Text>
              <View
                style={[
                  styles.trendBadge,
                  {
                    backgroundColor: stats.thisWeek > 0 ? "#E5F9ED" : "#F2F2F7",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.trendText,
                    { color: stats.thisWeek > 0 ? "#34C759" : "#8E8E93" },
                  ]}
                >
                  {stats.thisWeek > 0 ? `+${stats.thisWeek}` : "Yeni yok"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Aktif Danışanlar</Text>
          <Text style={styles.filterText}>{stats.totalClients} kişi</Text>
        </View>
      </View>

      {/* UYARILAR */}
      {visibleWarnings.length > 0 && (
        <View style={styles.warningContainer}>
          {visibleWarnings.map((w) => (
            <View
              key={w.id}
              style={[
                styles.warningBanner,
                w.type === "expired"
                  ? styles.warningExpired
                  : styles.warningToday,
              ]}
            >
              <Ionicons
                name={w.type === "expired" ? "alert-circle" : "time"}
                size={18}
                color={w.type === "expired" ? "#FF3B30" : "#FF9500"}
              />
              <View style={styles.warningBody}>
                <Text
                  style={[
                    styles.warningTitle,
                    { color: w.type === "expired" ? "#FF3B30" : "#FF9500" },
                  ]}
                >
                  {w.type === "expired"
                    ? "⚠️ Program Süresi Doldu"
                    : "📅 Program Bugün Bitiyor"}
                </Text>
                <Text style={styles.warningText}>
                  {w.clientName} —{" "}
                  {w.type === "expired"
                    ? `${formatDateTR(w.endDate)} tarihinde bitti`
                    : "Bugün son gün"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.warningNewBtn}
                onPress={() =>
                  navigation.navigate("CreateProgram", {
                    clientId: w.clientId,
                    clientName: w.clientName,
                  })
                }
              >
                <Text style={styles.warningNewBtnText}>Yenile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => dismissWarning(w.id)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={16} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* LİSTE */}
      <FlatList
        data={clients}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderClientItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#34C759"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color="#E5E5EA" />
            <Text style={styles.emptyTitle}>Henüz danışanınız yok</Text>
            <Text style={styles.emptyText}>
              Alt menüdeki + butonuna basarak danışan ekleyebilirsiniz.
            </Text>
          </View>
        }
      />

      <DietitianTabBar onAddPress={() => setModalVisible(true)} />

      {/* BİLDİRİM PANELİ */}
      <Modal
        visible={notifPanelVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNotifPanelVisible(false)}
      >
        <View style={styles.notifOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setNotifPanelVisible(false)}
          />
          <View style={styles.notifPanel}>
            <View style={styles.notifPanelHeader}>
              <Text style={styles.notifPanelTitle}>Bildirimler</Text>
              <View
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
              >
                {notifications.some((n) => !n.is_read) && (
                  <TouchableOpacity onPress={handleMarkAllRead}>
                    <Text style={styles.markAllText}>Tümünü Oku</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setNotifPanelVisible(false)}>
                  <Ionicons name="close" size={24} color="#8E8E93" />
                </TouchableOpacity>
              </View>
            </View>
            {loadingNotifs ? (
              <View style={styles.notifLoading}>
                <ActivityIndicator size="large" color="#34C759" />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.notifEmpty}>
                <Ionicons
                  name="notifications-off-outline"
                  size={48}
                  color="#E5E5EA"
                />
                <Text style={styles.notifEmptyText}>Henüz bildirim yok</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.notifItem,
                      !item.is_read && styles.notifItemUnread,
                    ]}
                    onPress={() => handleMarkRead(item.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.notifTypeIcon,
                        { backgroundColor: notifIconBg(item.type) },
                      ]}
                    >
                      <Ionicons
                        name={notifIcon(item.type)}
                        size={16}
                        color={notifIconColor(item.type)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifItemTitle}>{item.title}</Text>
                      <Text style={styles.notifItemBody}>{item.body}</Text>
                      <Text style={styles.notifItemTime}>
                        {formatNotifTime(item.created_at)}
                      </Text>
                    </View>
                    {!item.is_read && <View style={styles.notifDot} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* DANİŞAN EKLE MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => {
              setModalVisible(false);
              setClientEmail("");
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Danışan Ekle</Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setClientEmail("");
                }}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Danışanın e-posta adresini girin. Uygulamaya kayıtlı olmaları
              gerekiyor.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="ornek@email.com"
              value={clientEmail}
              onChangeText={setClientEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setClientEmail("");
                }}
              >
                <Text style={styles.cancelButtonText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  sendingInvite && { opacity: 0.7 },
                ]}
                onPress={addClient}
                disabled={sendingInvite}
              >
                {sendingInvite ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Davet Gönder</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#FFF",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  adminAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  welcomeText: { fontSize: 12, color: "#8E8E93" },
  portalTitle: { fontSize: 16, fontWeight: "700", color: "#1C1C1E" },
  notificationBtn: {
    padding: 7,
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
    borderWidth: 1.5,
    borderColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  badgeText: { fontSize: 8, color: "#FFF", fontWeight: "800" },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#F8F8FA",
  },
  statLabel: {
    fontSize: 11,
    color: "#8E8E93",
    fontWeight: "600",
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statValue: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  trendBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  trendText: { fontSize: 11, fontWeight: "700" },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  filterText: { fontSize: 13, color: "#34C759", fontWeight: "600" },

  warningContainer: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 9,
    gap: 8,
    marginBottom: 6,
  },
  warningToday: {
    backgroundColor: "#FFF9ED",
    borderWidth: 1,
    borderColor: "#FF9500",
  },
  warningExpired: {
    backgroundColor: "#FFF0EE",
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  warningBody: { flex: 1 },
  warningTitle: { fontSize: 11, fontWeight: "800", marginBottom: 1 },
  warningText: { fontSize: 11, color: "#3A3A3C" },
  warningNewBtn: {
    backgroundColor: "#34C759",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  warningNewBtnText: { fontSize: 11, color: "#FFF", fontWeight: "700" },

  notifOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  notifPanel: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    minHeight: 300,
  },
  notifPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  notifPanelTitle: { fontSize: 18, fontWeight: "800", color: "#1C1C1E" },
  markAllText: { fontSize: 13, color: "#007AFF", fontWeight: "600" },
  notifLoading: { padding: 40, alignItems: "center" },
  notifEmpty: { padding: 40, alignItems: "center", gap: 10 },
  notifEmptyText: { fontSize: 15, color: "#8E8E93" },
  notifItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  notifItemUnread: { backgroundColor: "#F8FFFE" },
  notifTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  notifItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  notifItemBody: { fontSize: 13, color: "#8E8E93", lineHeight: 18 },
  notifItemTime: { fontSize: 11, color: "#C7C7CC", marginTop: 4 },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34C759",
    marginTop: 4,
    flexShrink: 0,
  },

  listContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 100 },
  clientCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFF",
    borderRadius: 14,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  clientInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  textContainer: { flex: 1 },
  clientName: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 8,
  },
  clientWeightText: { fontSize: 12, color: "#8E8E93" },
  programBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    gap: 3,
  },
  programBadgeText: { fontSize: 11, fontWeight: "600" },
  createProgramBtn: {
    backgroundColor: "#E5F9ED",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  createProgramText: { fontSize: 11, color: "#34C759", fontWeight: "700" },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: "center",
    color: "#8E8E93",
    fontSize: 14,
    lineHeight: 20,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  modalSubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    width: "100%",
    height: 50,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmButton: { backgroundColor: "#34C759" },
  cancelButton: { backgroundColor: "#F2F2F7" },
  confirmButtonText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  cancelButtonText: { color: "#8E8E93", fontWeight: "600", fontSize: 15 },
});

export default HomeDyt;
