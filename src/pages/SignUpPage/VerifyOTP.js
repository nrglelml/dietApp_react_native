import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { supabase } from "../../../supabase";
import styles from "./styles";
import { useNavigation } from "@react-navigation/native";

const VerifyOTPScreen = ({ route }) => {
  const { email, role, fullName } = route.params;
  const [token, setToken] = useState("");
  const navigation = useNavigation();

  const handleVerify = async () => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
      });

      if (error) {
        alert("Kod hatalı: " + error.message);
      } else if (data.user) {
        const { error: profileError } = await supabase.from("profiles").insert([
          {
            id: data.user.id,
            role: role,
            full_name: fullName,
            email: email,
          },
        ]);

        if (profileError) {
          alert("Profil oluşturulurken hata: " + profileError.message);
          return;
        }

        let subProfileError = null;

        if (role === "client") {
          const { error } = await supabase
            .from("client_profiles")
            .insert([{ id: data.user.id, full_name: fullName, email: email }]);
          subProfileError = error;
        } else if (role === "dietitian") {
          const { error } = await supabase
            .from("dietitian_profiles")
            .insert([{ id: data.user.id, full_name: fullName, email: email }]);
          subProfileError = error;
        }

        if (subProfileError) {
          alert("Rol profili oluşturulurken hata: " + subProfileError.message);
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: role === "dietitian" ? "HomeDyt" : "HomeClient" }],
          });
        }
      }
    } catch (err) {
      console.error("Yönlendirme hatası:", err.message);
      alert("Bir hata oluştu: " + err.message);
    }
  };

  return (
    <ScrollView>
      <View style={styles.container}>
        <Text style={styles.hadiText}>Kodu Onayla</Text>
        <Text style={styles.roleText}>
          {email} adresine gönderilen kodu girin.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="6 Haneli Kod"
          keyboardType="number-pad"
          value={token}
          onChangeText={setToken}
        />

        <TouchableOpacity style={styles.mainButton} onPress={handleVerify}>
          <Text style={styles.buttonText}>Doğrula ve Başla</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default VerifyOTPScreen;
