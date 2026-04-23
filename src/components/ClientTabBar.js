import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

const TABS = [
  {
    name: "HomeClient",
    label: "Ana Sayfa",
    icon: "home-outline",
    iconActive: "home",
  },
  {
    name: "ClientCalendar",
    label: "Takvim",
    icon: "calendar-outline",
    iconActive: "calendar",
  },
  {
    name: "ClientRecipes",
    label: "Tarifler",
    icon: "book-outline",
    iconActive: "book",
  },
  {
    name: "ClientSettings",
    label: "Ayarlar",
    icon: "settings-outline",
    iconActive: "settings",
  },
];

const ClientTabBar = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const currentName = route.name;

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = currentName === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => !isActive && navigation.navigate(tab.name)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={24}
              color={isActive ? "#34C759" : "#8E8E93"}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 85,
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingBottom: Platform.OS === "ios" ? 20 : 8,
    paddingTop: 8,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontSize: 10, color: "#8E8E93", fontWeight: "500" },
  labelActive: { color: "#34C759", fontWeight: "700" },
});

export default ClientTabBar;
