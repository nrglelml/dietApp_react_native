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

const SignUpScreen = () => {
  const [selectedRole, setSelectedRole] = useState("client");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigation = useNavigation();
  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };
  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      showMessage("Şifreler eşleşmiyor!", "error");
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          showMessage("Bu e-posta zaten kayıtlı. Giriş yapın.", "error");
          setTimeout(() => navigation.navigate("Login"), 2000);
          return;
        }
        throw authError;
      }
      if (data?.user?.identities?.length === 0) {
        showMessage("Bu e-posta zaten kayıtlı. Giriş yapın.", "error");
        setTimeout(() => navigation.navigate("Login"), 1500);
        return;
      }

      if (data.user) {
        showMessage("Doğrulama kodu gönderildi!", "success");

        setTimeout(() => {
          navigation.navigate("VerifyOTP", {
            email: email,
            role: selectedRole,
            fullName: name,
          });
        }, 2000);
      }
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(false);
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
          <Text style={styles.hadiText}>Haydi Başlayalım!</Text>
          <Text style={styles.roleText}>
            Diyet Yolculuğunuzu Başlatmak İçin Rolünüzü Seçin
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
          <Text style={styles.label}>Tam Adınız</Text>
          <TextInput
            style={styles.input}
            placeholder="Ayşe Kaya"
            value={name}
            onChangeText={setName}
          />
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
          <View style={{ justifyContent: "center" }}>
            <TextInput
              style={styles.input}
              placeholder="🔒 ........"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
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
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Şifre Tekrar</Text>
          <View style={{ justifyContent: "center" }}>
            <TextInput
              style={styles.input}
              placeholder="🔒 Şifrenizi tekrar girin"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              style={{ position: "absolute", right: 15 }}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Image
                source={eye}
                style={{
                  width: 24,
                  height: 24,
                  tintColor: showConfirmPassword ? "#22c55e" : "#94a3b8",
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

        {/* Görseldeki "Smart Kitchen Tip" Kutusu */}
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            🔔 ** Tip: ** Bildirim Ayarlarını Kendinize Göre Ayarlayabilirsiniz!
          </Text>
        </View>

        <TouchableOpacity style={styles.mainButton} onPress={handleSignUp}>
          <Text style={styles.buttonText}>Hesabımı Oluştur</Text>
        </TouchableOpacity>
        <View style={styles.endWrapper}>
          <Text style={styles.roleText}>Hesabınız var mı? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.girisText}>Giriş Yapın</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignUpScreen;
