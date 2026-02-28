import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Navigation, navigationRef } from "./src/navigation/RootStack";
import { supabase } from "./supabase";
import * as Linking from "expo-linking";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState(null);
  const hasDeepLink = React.useRef(false);
  const pendingApproval = React.useRef(null);

  const linking = {
    prefixes: ["dietapp://"],
    config: {
      screens: {
        UpdatePassword: "update-password",
      },
    },
  };

  useEffect(() => {
    const handleDeepLink = async (url) => {
      if (!url) return;

      if (url.includes("update-password") || url.includes("type=recovery")) {
        hasDeepLink.current = true;
        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: "UpdatePassword", params: { recoveryUrl: url } }],
          });
        }
        return;
      }

      if (url.includes("dietapp://approve")) {
        hasDeepLink.current = true;

        const urlObj = new URL(url.replace("dietapp://", "https://dietapp.com/"));
        const params = {
          dietitianId: urlObj.searchParams.get("dietitianId"),
          dietitianName: urlObj.searchParams.get("dietitianName"),
          targetEmail: urlObj.searchParams.get("targetEmail"),
        };

        const { data: { session } } = await supabase.auth.getSession();

        if (navigationRef.isReady()) {
          if (session) {
            navigationRef.navigate("ApprovalScreen", params);
          } else {
            navigationRef.reset({
              index: 0,
              routes: [{
                name: "Login",
                params: {
                  redirectTo: "ApprovalScreen",
                  redirectParams: params,
                },
              }],
            });
          }
        } else {
          pendingApproval.current = { session, params };
        }
        return;
      }
    };

    const prepareApp = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url) await handleDeepLink(url);

        const { data: { session } } = await supabase.auth.getSession();

        if (session && !hasDeepLink.current) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

          if (!error && profile) {
            setInitialRoute(
              profile.role === "dietitian" ? "HomeDyt" : "HomeClient"
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

    if (hasDeepLink.current && !pendingApproval.current) {
      hasDeepLink.current = false;
      setTimeout(() => {
        navigationRef.reset({
          index: 0,
          routes: [{ name: "UpdatePassword" }],
        });
      }, 100);
      return;
    }

    if (pendingApproval.current) {
      const { session, params } = pendingApproval.current;
      pendingApproval.current = null;
      hasDeepLink.current = false;

      setTimeout(() => {
        if (session) {
          navigationRef.navigate("ApprovalScreen", params);
        } else {
          navigationRef.reset({
            index: 0,
            routes: [{
              name: "Login",
              params: {
                redirectTo: "ApprovalScreen",
                redirectParams: params,
              },
            }],
          });
        }
      }, 100);
      return;
    }

    if (initialRoute) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: initialRoute }],
      });
    }
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