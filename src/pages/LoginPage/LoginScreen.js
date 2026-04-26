import React, { useState } from "react";
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
import { eye } from "../../assets/icons";

const LoginScreen = ({ route }) => {
  const [selectedRole, setSelectedRole] = useState("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const navigation = useNavigation();
  const [showPassword, setShowPassword] = useState(false);

  const { redirectTo, redirectParams } = route?.params || {};

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  const cleanEmail = (raw) => raw.trim().replace(/[^\x20-\x7E@.]/g, "");

  const handleLogin = async () => {
    const cleanedEmail = cleanEmail(email);
    const cleanedPassword = password.trim();

    if (!cleanedEmail || !cleanedPassword) {
      showMessage("Lütfen e-posta ve şifrenizi girin.", "error");
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: cleanedEmail,
          password: cleanedPassword,
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
          if (redirectTo) {
            navigation.reset({
              index: 0,
              routes: [{ name: redirectTo, params: redirectParams }],
            });
          } else {
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: profile.role === "dietitian" ? "HomeDyt" : "HomeClient",
                },
              ],
            });
          }
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
    const cleanedEmail = cleanEmail(email);

    if (!cleanedEmail) {
      showMessage("Lütfen şifre sıfırlama için e-postanızı girin.", "error");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanedEmail,
        {
          redirectTo: "dietapp://update-password",
        },
      );
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
            onChangeText={(v) => setEmail(v.trim())}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Şifre</Text>
          <View style={{ justifyContent: "center" }}>
            <TextInput
              style={styles.input}
              placeholder="🔒 ........"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={{ position: "absolute", right: 15 }}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Image
                source={eye}
                style={{
                  width: 24,
                  height: 24,
                  tintColor: showPassword ? "#22c55e" : "#94a3b8",
                }}
              />
            </TouchableOpacity>
          </View>
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

      

        <TouchableOpacity style={styles.mainButton} onPress={handleLogin}>
          <Text style={styles.buttonText}>Giriş Yap</Text>
        </TouchableOpacity>

        <View style={styles.endWrapper}>
          <Text style={styles.roleText}>Hesabınız yok mu? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.girisText}>Hesap Oluşturun</Text>
          </TouchableOpacity>
        </View>
        
          <TouchableOpacity onPress={handleForgotPassword}>
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>Şifremi Unuttum</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
