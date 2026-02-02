import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { schedule, balancedDiet } from "../../assets/icons";
import styles from "./styles";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../../../supabase";

const LoginScreen = () => {
  const [selectedRole, setSelectedRole] = useState("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const navigation = useNavigation();
  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showMessage("Lütfen e-posta ve şifrenizi girin.", "error");
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: email,
          password: password,
        },
      );

      if (authError) throw authError;

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (profileError) throw profileError;

        if (profile.role !== selectedRole) {
          await supabase.auth.signOut();
          showMessage(
            `Bu hesap bir ${profile.role === "dietitian" ? "Diyetisyen" : "Danışan"} hesabıdır. Lütfen doğru rolü seçin.`,
            "error",
          );
          return;
        }

        showMessage("Giriş başarılı! Yönlendiriliyorsunuz...", "success");
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [
              { name: selectedRole === "dietitian" ? "HomeDyt" : "HomeClient" },
            ],
          });
        }, 1500);
      }
    } catch (error) {
      if (error.message.includes("Email not confirmed")) {
        showMessage("Lütfen önce e-posta adresinizi doğrulayın.", "error");
      } else {
        showMessage("Giriş başarısız: " + error.message, "error");
      }
    } finally {
      setLoading(false);
    }
  };
  const handleForgotPassword = async () => {
    if (!email) {
      showMessage(
        "Lütfen şifre sıfırlama kodu için e-postanızı girin.",
        "error",
      );
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "dietapp://update-password",
      });

      if (error) throw error;

      showMessage(
        "Şifre sıfırlama e-postası gönderildi. Lütfen gelen kutunuzu kontrol edin.",
        "success",
      );
    } catch (error) {
      showMessage("Hata: " + error.message, "error");
    }
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={{ backgroundColor: "white", flexGrow: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.entryWrapper}>
          <Text style={styles.hadiText}>Tekrar Hoşgeldiniz</Text>
          <Text style={styles.roleText}>
            Diyet Yolculuğunuzu Devam Etmek İçin Rolünüzü Seçin
          </Text>
        </View>

        <View style={styles.rolWrapper}>
          {/* Danışan Kartı */}
          <TouchableOpacity
            style={[
              styles.card,
              selectedRole === "client" && styles.selectedCard,
            ]}
            onPress={() => setSelectedRole("client")}
          >
            <View style={styles.imageContainer}>
              <Image style={styles.imageStyle} source={schedule} />
            </View>
            <Text style={styles.cardTitle}>Danışanım</Text>
            <Text style={styles.cardSubText}>
              Öğün takibi yap ve akıllı uyarılar al
            </Text>
            {selectedRole === "client" && <View style={styles.checkPoint} />}
          </TouchableOpacity>

          {/* Diyetisyen Kartı */}
          <TouchableOpacity
            style={[
              styles.card,
              selectedRole === "dietitian" && styles.selectedCard,
            ]}
            onPress={() => setSelectedRole("dietitian")}
          >
            <View
              style={[styles.imageContainer, { backgroundColor: "#F3F4F6" }]}
            >
              <Image style={styles.imageStyle} source={balancedDiet} />
            </View>
            <Text style={styles.cardTitle}>Diyetisyenim</Text>
            <Text style={styles.cardSubText}>
              Danışanlarını ve listelerini yönet
            </Text>
            {selectedRole === "dietitian" && <View style={styles.checkPoint} />}
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email Adresi</Text>
          <TextInput
            style={styles.input}
            placeholder="✉️ name@example.com"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Şifre</Text>
          <TextInput
            style={styles.input}
            placeholder="🔒 ........"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {message.text ? (
          <View
            style={[
              styles.messageBanner,
              message.type === "error"
                ? styles.errorBanner
                : styles.successBanner,
            ]}
          >
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={handleForgotPassword}>
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>Şifremi Unuttum</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mainButton} onPress={handleLogin}>
          <Text style={styles.buttonText}>Giriş Yap</Text>
        </TouchableOpacity>
        <View style={styles.endWrapper}>
          <Text style={styles.roleText}>Hesabınız yok mu? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.girisText}>Hesap Oluşturun</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
