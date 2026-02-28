import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { supabase } from "../../../supabase";
import styles from "./styles";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";
import { eye } from "../../assets/icons";

const UpdatePassword = ({ route }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigation = useNavigation();

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  useEffect(() => {
    const handleUrl = async (url) => {
      if (!url) return;

      // URL içinde encode edilmiş URL varsa çöz
      let actualUrl = url;
      if (url.includes("url=")) {
        actualUrl = decodeURIComponent(url.split("url=")[1]).split("&")[0];
      }

      // access_token hash'i var mı kontrol et
      if (!actualUrl.includes("#access_token=")) {
        // PKCE flow: code parametresi olabilir
        if (actualUrl.includes("code=")) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(actualUrl);
          if (!error && data.session) {
            setIsSessionReady(true);
          }
        }
        return;
      }

      setLoading(true);
      try {
        const hash = actualUrl.split("#")[1];
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          setIsSessionReady(true);
        }
      } catch (err) {
        showMessage("Oturum hatası: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    };

    const recoveryUrl = route.params?.recoveryUrl;
    if (recoveryUrl) {
      handleUrl(recoveryUrl);
    } else {
      Linking.getInitialURL().then((url) => {
        if (url) handleUrl(url);
      });
    }

    const subscription = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [route.params?.recoveryUrl]);

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      showMessage("Şifre en az 6 karakter olmalıdır.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showMessage("Şifreler eşleşmiyor!", "error");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      showMessage("Şifreniz başarıyla güncellendi!", "success");
      setTimeout(() => navigation.navigate("Login"), 2000);
    } catch (error) {
      showMessage("Güncelleme hatası: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "white" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.entryWrapper, { marginTop: 80 }]}>
        <Text style={styles.hadiText}>Şifreyi Güncelle</Text>
        <Text style={styles.roleText}>Lütfen yeni bir şifre belirleyin.</Text>
      </View>

      <View style={[styles.inputContainer, { marginTop: 40 }]}>
        <Text style={styles.label}>Yeni Şifre</Text>
        <View style={{ justifyContent: "center" }}>
          <TextInput
            style={[styles.input, { paddingRight: 50 }]}
            placeholder="🔒 yeni şifre"
            secureTextEntry={!showPassword}
            value={newPassword}
            onChangeText={setNewPassword}
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
        <Text style={styles.label}>Yeni Şifre Tekrar</Text>
        <View style={{ justifyContent: "center" }}>
          <TextInput
            style={[styles.input, { paddingRight: 50 }]}
            placeholder="🔒 şifreyi tekrar girin"
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

      {!isSessionReady && !loading && (
        <Text
          style={{
            textAlign: "center",
            color: "#94a3b8",
            marginTop: 20,
            fontSize: 13,
          }}
        >
          Bağlantı doğrulanıyor...
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.mainButton,
          { marginTop: 30, opacity: loading || !isSessionReady ? 0.6 : 1 },
        ]}
        onPress={handleUpdatePassword}
        disabled={loading || !isSessionReady}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Şifremi Güncelle</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

export default UpdatePassword;
