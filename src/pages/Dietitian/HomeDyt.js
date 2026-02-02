import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../supabase";
import { SafeAreaView } from "react-native-safe-area-context";

const HomeDyt = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dietitianName, setDietitianName] = useState("");
  const [stats, setStats] = useState({
    totalClients: 0,
    clientTrend: 0,
    compliance: 0,
    compTrend: 0,
  });

  useEffect(() => {
    fetchUserAndData();
  }, []);

  const fetchUserAndData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("dietitian_profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        if (profile) setDietitianName(profile.full_name);

        const { data, error: rpcError } = await supabase.rpc(
          "get_dietitian_stats_v2",
          { dietitian_uuid: user.id },
        );

        if (!rpcError && data?.length > 0) {
          setStats({
            totalClients: data[0].total_clients,
            clientTrend: data[0].client_trend,
            compliance: data[0].avg_compliance,
            compTrend: data[0].compliance_trend,
          });
        }
      }

      await fetchMealLogs();
    } catch (error) {
      console.error("Yükleme hatası:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMealLogs = async () => {
    const { data, error } = await supabase
      .from("meal_logs")
      .select(
        `
        id, photo_url, mood, created_at,
        meal_plans!inner(
          meal_type,
          client_profiles(full_name)
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (!error) setLogs(data);
  };

  const getTrendStyle = (value) => ({
    backgroundColor: value >= 0 ? "#E5F9ED" : "#FEEBEB",
    color: value >= 0 ? "#34C759" : "#FF3B30",
  });

  const renderClientItem = ({ item }) => {
    const fullName =
      item.meal_plans?.client_profiles?.full_name || "Bilinmeyen Danışan";
    return (
      <TouchableOpacity style={styles.clientCard} activeOpacity={0.7}>
        <View style={styles.clientInfo}>
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: item.mood === "Kötü" ? "#FF3B30" : "#34C759" },
            ]}
          >
            <Text style={styles.avatarText}>{fullName.charAt(0)}</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.clientName}>{fullName}</Text>
            <View style={styles.statusRow}>
              <Text
                style={[
                  styles.statusTag,
                  { color: item.mood === "Kötü" ? "#FF3B30" : "#34C759" },
                ]}
              >
                • {item.meal_plans?.meal_type}
              </Text>
              <Text style={styles.moodBadge}>{item.mood || "Stabil"}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
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
        
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Toplam Danışan</Text>
            <View style={styles.valueRow}>
              <Text style={styles.statValue}>{stats.totalClients}</Text>
              <View
                style={[
                  styles.trendBadge,
                  {
                    backgroundColor: getTrendStyle(stats.clientTrend)
                      .backgroundColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.trendText,
                    { color: getTrendStyle(stats.clientTrend).color },
                  ]}
                >
                  {stats.clientTrend >= 0
                    ? `+${stats.clientTrend}%`
                    : `%${stats.clientTrend}`}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Diyet Uyumu</Text>
            <View style={styles.valueRow}>
              <Text style={styles.statValue}>%{stats.compliance}</Text>
              <View
                style={[
                  styles.trendBadge,
                  {
                    backgroundColor: getTrendStyle(stats.compTrend)
                      .backgroundColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.trendText,
                    { color: getTrendStyle(stats.compTrend).color },
                  ]}
                >
                  {stats.compTrend >= 0
                    ? `+${stats.compTrend}%`
                    : `%${stats.compTrend}`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Aktif Danışanlar</Text>
          <Text style={styles.filterText}>Tümünü Gör</Text>
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderClientItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Henüz bir aktivite bulunmuyor.</Text>
        }
      />

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="people" size={24} color="#34C759" />
          <Text style={[styles.tabText, { color: "#34C759" }]}>Danışanlar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="book-outline" size={24} color="#8E8E93" />
          <Text style={styles.tabText}>Tarifler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <View style={styles.fabButton}>
            <Ionicons name="add" size={32} color="#FFF" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="calendar-outline" size={24} color="#8E8E93" />
          <Text style={styles.tabText}>Randevu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="settings-outline" size={24} color="#8E8E93" />
          <Text style={styles.tabText}>Ayarlar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 15,
    backgroundColor: "#FFF",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 20,
    elevation: 3,
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
  iconCircle: { backgroundColor: "#F2F2F7", padding: 10, borderRadius: 25 },
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
  trendBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  trendText: { fontSize: 11, fontWeight: "700" },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 25,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  filterText: { fontSize: 14, color: "#34C759", fontWeight: "600" },
  listContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
  clientCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#FFF",
    borderRadius: 20,
    marginBottom: 12,
    elevation: 1,
  },
  clientInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  textContainer: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: "600", color: "#1C1C1E" },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  statusTag: { fontSize: 13, fontWeight: "600" },
  moodBadge: {
    fontSize: 11,
    color: "#8E8E93",
    marginLeft: 8,
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
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
  tabText: { fontSize: 10, marginTop: 4 },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    elevation: 4,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#8E8E93" },
});

export default HomeDyt;
