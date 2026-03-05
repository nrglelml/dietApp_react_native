import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../../supabase";

const TABS = [
  {
    name: "HomeDyt",
    icon: "people",
    iconOut: "people-outline",
    label: "Danışanlar",
  },
  { name: "Recipes", icon: "book", iconOut: "book-outline", label: "Tarifler" },
  { name: "__ADD__", icon: "add", iconOut: "add", label: "" },
  {
    name: "DietitianCalendar",
    icon: "calendar",
    iconOut: "calendar-outline",
    label: "Randevu",
  },
  {
    name: "Settings",
    icon: "settings",
    iconOut: "settings-outline",
    label: "Ayarlar",
  },
];

const DietitianTabBar = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const currentRoute = route.name;

  const [modalVisible, setModalVisible] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  const handlePress = (tab) => {
    if (tab.name === "__ADD__") {
      setModalVisible(true);
      return;
    }
    if (tab.name === currentRoute) return;
    navigation.navigate(tab.name);
  };

  const addClient = async () => {
    if (!clientEmail.trim()) {
      Alert.alert("Hata", "Lütfen bir e-posta adresi girin.");
      return;
    }
    setSendingInvite(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: dytProfile } = await supabase
        .from("dietitian_profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      const dietitianName = dytProfile?.full_name || "";

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
      if (userData.dietitian_id === user.id) {
        Alert.alert("Bilgi", "Bu danışan zaten listenizde bulunuyor.");
        return;
      }

      const approvalUrl = `https://idyllic-cassata-8758dd.netlify.app/?dietitianId=${user.id}&dietitianName=${encodeURIComponent(dietitianName)}&targetEmail=${encodeURIComponent(clientEmail.toLowerCase().trim())}`;

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

      // HomeDyt'i yenilemek için navigate
      if (currentRoute !== "HomeDyt") {
        navigation.navigate("HomeDyt");
      }
    } catch (error) {
      Alert.alert("Hata", "E-posta gönderimi sırasında bir sorun oluştu.");
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          if (tab.name === "__ADD__") {
            return (
              <TouchableOpacity
                key="add"
                style={styles.tabItem}
                onPress={() => handlePress(tab)}
              >
                <View style={styles.fabButton}>
                  <Ionicons name="add" size={32} color="#FFF" />
                </View>
              </TouchableOpacity>
            );
          }
          const isActive = currentRoute === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => handlePress(tab)}
            >
              <Ionicons
                name={isActive ? tab.icon : tab.iconOut}
                size={24}
                color={isActive ? "#34C759" : "#8E8E93"}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* DANİŞAN EKLE MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
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
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 85,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingBottom: Platform.OS === "ios" ? 10 : 0,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabItem: { alignItems: "center", flex: 1 },
  tabText: { fontSize: 10, marginTop: 4, color: "#8E8E93" },
  tabTextActive: { color: "#34C759", fontWeight: "600" },
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
});

export default DietitianTabBar;
