import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { supabase } from "../../../supabase";
import { useNavigation } from "@react-navigation/native";
const HomeClient = () => {
  const navigation = useNavigation();
  const handleLogout = async () => {
    console.log("Çıkış işlemi başlatıldı...");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Çıkış hatası:", error.message);
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: "Welcome" }],
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Ana Sayfa (Geliştirme Aşamasında)</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: {
    marginBottom: 20,
    fontSize: 18,
    color: "#666",
  },
  logoutButton: {
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default HomeClient;
