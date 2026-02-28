import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";


const ApprovalScreen = ({ route}) => {
  const { dietitianId, dietitianName, targetEmail } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
    const navigation = useNavigation();

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setCurrentUserEmail(user.email);

      if (
        targetEmail &&
        user.email.toLowerCase() !== targetEmail.toLowerCase()
      ) {
        Alert.alert(
          "Hesap Uyuşmazlığı",
          `Bu davet ${targetEmail} adresi içindir. Şu an ${user.email} ile giriş yapmışsınız. Devam etmek için doğru hesapla giriş yapmalısınız.`,
          [
            { text: "Çıkış Yap", onPress: handleSignOut },
            { text: "İptal", style: "cancel" },
          ],
        );
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigation.replace("Login", {
      redirectTo: "ApprovalScreen",
      redirectParams: { dietitianId, dietitianName, targetEmail },
    });
  };

  const handleApproval = async (isApproved) => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Hata", "Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        navigation.replace("Login", {
          redirectTo: "ApprovalScreen",
          redirectParams: { dietitianId, dietitianName, targetEmail },
        });
        return;
      }

      if (isApproved) {
        const { error } = await supabase
          .from("client_profiles")
          .update({
            dietitian_id: dietitianId,
            status: "active",
          })
          .eq("id", user.id);

        if (error) throw error;

        Alert.alert(
          "Eşleşme Tamamlandı! 🎉",
          `${dietitianName} ile eşleşmeniz başarıyla tamamlandı. Diyetisyeniniz artık programınızı oluşturabilir.`,
          [
            {
              text: "Harika!",
              onPress: () => navigation.replace("HomeClient"),
            },
          ],
        );
      } else {
        Alert.alert("Talep Reddedildi", "Diyetisyen daveti reddedildi.", [
          { text: "Tamam", onPress: () => navigation.replace("HomeClient") },
        ]);
      }
    } catch (error) {
      console.error("Approval error:", error);
      Alert.alert("Hata", "İşlem sırasında bir sorun oluştu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        <View style={styles.headerIcon}>
          <View style={styles.iconBackground}>
            <Ionicons name="mail-open-outline" size={50} color="#34C759" />
          </View>
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={24} color="#FFF" />
          </View>
        </View>

        <Text style={styles.title}>Diyetisyen Talebi</Text>
        <Text style={styles.description}>
          <Text style={styles.boldText}>{dietitianName}</Text> isimli
          diyetisyen, beslenme sürecinizi yönetmek için size bir davet gönderdi.
        </Text>

        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color="#8E8E93"
          />
          <Text style={styles.infoText}>
            Onayladığınızda diyetisyeniniz öğünlerinizi ve gelişiminizi takip
            edebilecektir.
          </Text>
        </View>

        {/* Hangi mail için olduğunu göster */}
        {targetEmail ? (
          <View style={styles.emailCard}>
            <Ionicons name="mail-outline" size={16} color="#34C759" />
            <Text style={styles.emailText}>{targetEmail}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.declineButton]}
            onPress={() => handleApproval(false)}
            disabled={loading}
          >
            <Text style={styles.declineButtonText}>Reddet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.approveButton]}
            onPress={() => handleApproval(true)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.approveButtonText}>Onayla ve Başla</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  headerIcon: {
    marginBottom: 30,
    position: "relative",
  },
  iconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E5F9ED",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#34C759",
    borderRadius: 15,
    padding: 2,
    borderWidth: 3,
    borderColor: "#FFF",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    color: "#3A3A3C",
    lineHeight: 24,
    marginBottom: 30,
  },
  boldText: {
    fontWeight: "700",
    color: "#34C759",
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#8E8E93",
    marginLeft: 10,
  },
  emailCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5F9ED",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 40,
    gap: 6,
  },
  emailText: {
    fontSize: 13,
    color: "#34C759",
    fontWeight: "600",
  },
  footer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    height: 55,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  approveButton: {
    backgroundColor: "#34C759",
    marginLeft: 10,
    elevation: 2,
    shadowColor: "#34C759",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  declineButton: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    marginRight: 10,
  },
  approveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  declineButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ApprovalScreen;
