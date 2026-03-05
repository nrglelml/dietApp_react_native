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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

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

  const navigation = useNavigation();

  useEffect(() => {
    fetchUserAndData();
  }, []);

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
      .select("id, full_name, weight, height, status, email, created_at")
      .eq("dietitian_id", dytId)
      .eq("status", "active")
      .order("full_name", { ascending: true });

    if (error || !data) return;

    setClients(data);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeekCount = data.filter(
      (c) => new Date(c.created_at) > weekAgo,
    ).length;

    setStats({ totalClients: data.length, thisWeek: thisWeekCount });

    if (data.length > 0) {
      const clientIds = data.map((c) => c.id);
      const { data: programs } = await supabase
        .from("diet_programs")
        .select("client_id")
        .eq("dietitian_id", dytId)
        .in("client_id", clientIds);

      if (programs) {
        setClientsWithProgram(new Set(programs.map((p) => p.client_id)));
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
          "Bu e-postaya sahip bir danışan bulunamadı. Danışanın önce uygulamaya kayıt olması gerekiyor.",
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
            dietitianName: dietitianName,
            approvalUrl: approvalUrl,
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
      console.error("Hata:", error);
      Alert.alert("Hata", "E-posta gönderimi sırasında bir sorun oluştu.");
    } finally {
      setSendingInvite(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
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
          })
        }
      >
        <View style={styles.clientInfo}>
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: getAvatarColor(item.full_name) },
            ]}
          >
            <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
          </View>

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.profileRow}>
            <View style={styles.adminAvatar}>
              <Ionicons name="person" size={20} color="#8E8E93" />
            </View>
            <View>
              <Text style={styles.welcomeText}>Merhaba,</Text>
              <Text style={styles.portalTitle}>
                {dietitianName || "Diyetisyen"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={styles.notificationBtn}>
              <Ionicons
                name="notifications-outline"
                size={24}
                color="#1C1C1E"
              />
              {/* <View style={styles.badge} />*/}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>

        {/* İSTATİSTİK KARTLAR */}
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
                    {
                      color: stats.thisWeek > 0 ? "#34C759" : "#8E8E93",
                    },
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

      {/* DANİŞAN LİSTESİ */}
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

      {/* TAB BAR */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="people" size={24} color="#34C759" />
          <Text style={[styles.tabText, { color: "#34C759" }]}>Danışanlar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="book-outline" size={24} color="#8E8E93" />
          <Text style={styles.tabText}>Tarifler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setModalVisible(true)}
        >
          <View style={styles.fabButton}>
            <Ionicons name="add" size={32} color="#FFF" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation.navigate("DietitianCalendar")}
        >
          <Ionicons name="calendar-outline" size={24} color="#8E8E93" />
          <Text style={styles.tabText}>Randevu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="settings-outline" size={24} color="#8E8E93" />
          <Text style={styles.tabText}>Ayarlar</Text>
        </TouchableOpacity>
      </View>

      {/* DANİŞAN EKLE MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Danışan Ekle</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 20,
    backgroundColor: "#FFF",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
    marginBottom: 20,
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  adminAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  welcomeText: { fontSize: 13, color: "#8E8E93" },
  portalTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E" },
  notificationBtn: {
    padding: 8,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  statsContainer: { flexDirection: "row", justifyContent: "space-between" },
  statCard: {
    width: "48%",
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#F8F8FA",
  },
  statLabel: {
    fontSize: 12,
    color: "#8E8E93",
    fontWeight: "600",
    marginBottom: 8,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statValue: { fontSize: 24, fontWeight: "700", color: "#1C1C1E" },
  trendBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  trendText: { fontSize: 11, fontWeight: "700" },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  filterText: { fontSize: 14, color: "#34C759", fontWeight: "600" },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  clientCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#FFF",
    borderRadius: 20,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  clientInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  textContainer: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: "600", color: "#1C1C1E" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
    justifyContent: "space-around",
  },
  clientWeightText: { fontSize: 13, color: "#8E8E93" },
  programBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
    justifyContent: "space-around",
  },
  programBadgeText: { fontSize: 11, fontWeight: "600" },
  createProgramBtn: {
    backgroundColor: "#E5F9ED",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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
  tabBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 85,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  tabItem: { alignItems: "center" },
  tabText: { fontSize: 10, marginTop: 4, color: "#8E8E93" },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    elevation: 4,
    shadowColor: "#34C759",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 30,
    padding: 28,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E" },
  modalSubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    width: "100%",
    height: 52,
    backgroundColor: "#F2F2F7",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 15,
  },
  modalButtons: { flexDirection: "row", justifyContent: "space-between" },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmButton: { backgroundColor: "#34C759", marginLeft: 10 },
  cancelButton: { backgroundColor: "#F2F2F7" },
  confirmButtonText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  cancelButtonText: { color: "#8E8E93", fontWeight: "600", fontSize: 15 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});

export default HomeDyt;
