import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Navigation, navigationRef } from "./src/navigation/RootStack";
import { supabase } from "./supabase";
import * as Linking from "expo-linking";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState(null);
  const hasDeepLink = React.useRef(false);

  const linking = {
    prefixes: ["dietapp://"],
    config: {
      screens: {
        UpdatePassword: "update-password",
      },
    },
  };

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile.role === "dietitian") {
          setIsDietitian(true);
        }
      }
    };
    checkUser();

    const handleDeepLink = (url) => {
      if (
        url &&
        (url.includes("update-password") || url.includes("type=recovery"))
      ) {
        console.log("Link algılandı:", url);
        hasDeepLink.current = true;

        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: "UpdatePassword", params: { recoveryUrl: url } }],
          });
        }
      }
    };
    const prepareApp = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url) handleDeepLink(url);

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session && !hasDeepLink.current) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

          if (!error && profile) {
            setInitialRoute(
              profile.role === "dietitian" ? "HomeDyt" : "HomeClient",
            );
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    prepareApp();

    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });
    return () => subscription.remove();
  }, []);

  const handleNavigationReady = () => {
    if (!navigationRef.isReady()) return;

    if (hasDeepLink.current) {
      console.log("Deep link bulundu, yönlendirme başlıyor...");
      hasDeepLink.current = false;

      // 100ms gecikme navigasyonun tamamen oturmasını sağlar
      setTimeout(() => {
        navigationRef.reset({
          index: 0,
          routes: [{ name: "UpdatePassword" }],
        });
      }, 100);
      return;
    }

    // Normal initialRoute yönlendirmen buraya devam edebilir...
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <Navigation
      ref={navigationRef}
      onReady={handleNavigationReady}
      linking={linking}
    />
  );
}
