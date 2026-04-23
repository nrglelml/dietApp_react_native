import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  Modal,
  Image,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../../../supabase";
import ClientTabBar from "../../components/ClientTabBar";

// ─── PDF YARDIMCISI ───────────────────────────────────────────────────────────

const CATEGORY_ICONS = {
  "Et & Balık": "🥩",
  "Sebze & Meyve": "🥦",
  "Süt & Yumurta": "🥛",
  "Tahıl & Ekmek": "🍞",
  "Kuru Gıda": "🫘",
  "Yağ & Sos": "🫙",
  İçecek: "🥤",
  Diğer: "📦",
  Malzemeler: "🛒",
};

const generateRecipePDF = async (recipe) => {
  const items = recipe.ingredients.map((ing) => ({
    name: ing.name,
    amount: ing.amount ? `${ing.amount}${ing.unit ? " " + ing.unit : ""}` : "",
  }));

  const rows = items
    .map(
      (item) => `
    <tr>
      <td class="check-col"><div class="checkbox"></div></td>
      <td class="item-name">${item.name}</td>
      <td class="item-amount">${item.amount}</td>
    </tr>`,
    )
    .join("");

  const date = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1C1C1E; padding: 32px; }
  .header { border-bottom: 3px solid #34C759; padding-bottom: 20px; margin-bottom: 28px; }
  .logo-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .logo-dot { width: 14px; height: 14px; border-radius: 50%; background: #34C759; }
  .logo-text { font-size: 13px; font-weight: 700; color: #34C759; letter-spacing: 1px; text-transform: uppercase; }
  .title { font-size: 26px; font-weight: 800; color: #1C1C1E; margin-bottom: 4px; }
  .subtitle { font-size: 14px; color: #8E8E93; }
  .date { font-size: 12px; color: #C7C7CC; margin-top: 6px; }
  .category-header { font-size: 15px; font-weight: 700; background: #F2F2F7; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; }
  tr { border-bottom: 1px solid #F2F2F7; }
  .check-col { width: 28px; padding: 9px 8px; }
  .checkbox { width: 16px; height: 16px; border: 2px solid #C7C7CC; border-radius: 4px; }
  .item-name { font-size: 14px; color: #1C1C1E; padding: 9px 8px; }
  .item-amount { font-size: 13px; color: #8E8E93; padding: 9px 8px; text-align: right; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #F2F2F7; text-align: center; font-size: 11px; color: #C7C7CC; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-row"><div class="logo-dot"></div><span class="logo-text">DietApp</span></div>
    <div class="title">${recipe.title}</div>
    <div class="subtitle">Tarif Alışveriş Listesi</div>
    <div class="date">${date}</div>
  </div>
  <div class="category-header">🛒 Malzemeler</div>
  <table><tbody>${rows}</tbody></table>
  ${recipe.calories ? `<p style="margin-top:16px;font-size:13px;color:#FF9500;">🔥 Kalori: ${recipe.calories} kcal</p>` : ""}
  <div class="footer">DietApp tarafından oluşturuldu • ${date}</div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `${recipe.title} - Alışveriş Listesi`,
    UTI: "com.adobe.pdf",
  });
};

// ─── ANA COMPONENT ────────────────────────────────────────────────────────────

const ClientRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dietitianId, setDietitianId] = useState(null);

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Danışanın diyetisyenini bul
      const { data: clientProf } = await supabase
        .from("client_profiles")
        .select("dietitian_id")
        .eq("id", user.id)
        .single();

      if (!clientProf?.dietitian_id) {
        setLoading(false);
        return;
      }
      setDietitianId(clientProf.dietitian_id);

      // Diyetisyenin paylaştığı tarifler
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("dietitian_id", clientProf.dietitian_id)
        .eq("is_shared", true)
        .order("created_at", { ascending: false });

      if (!error && data) setRecipes(data);
    } catch (e) {
      console.log("ClientRecipes loadRecipes:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecipes();
    setRefreshing(false);
  }, []);

  const handleShoppingList = async (recipe) => {
    if (!recipe.ingredients?.length) {
      Alert.alert("Uyarı", "Bu tarifte malzeme bulunmuyor.");
      return;
    }
    setGeneratingPDF(true);
    try {
      await generateRecipePDF(recipe);
    } catch (e) {
      Alert.alert("Hata", "PDF oluşturulamadı: " + e.message);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const filtered = recipes.filter((r) =>
    r.title.toLowerCase().includes(searchText.toLowerCase()),
  );

  const renderCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => {
        setSelectedRecipe(item);
        setDetailVisible(true);
      }}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.cardImage} />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Ionicons name="restaurant-outline" size={32} color="#C7C7CC" />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.cardMeta}>
          {item.calories ? (
            <View style={styles.metaChip}>
              <Ionicons name="flame-outline" size={12} color="#FF9500" />
              <Text style={styles.metaChipText}>{item.calories} kcal</Text>
            </View>
          ) : null}
          {item.prep_time ? (
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={12} color="#007AFF" />
              <Text style={styles.metaChipText}>{item.prep_time} dk</Text>
            </View>
          ) : null}
          <View style={styles.metaChip}>
            <Ionicons name="list-outline" size={12} color="#8E8E93" />
            <Text style={styles.metaChipText}>
              {item.ingredients?.length || 0} malzeme
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={styles.pdfBtn}
        onPress={() => handleShoppingList(item)}
        disabled={generatingPDF}
      >
        {generatingPDF && selectedRecipe?.id === item.id ? (
          <ActivityIndicator size="small" color="#34C759" />
        ) : (
          <Ionicons name="cart-outline" size={20} color="#34C759" />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tarifler</Text>
          <Text style={styles.headerSub}>{recipes.length} tarif</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#8E8E93" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tarif ara..."
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Ionicons name="close-circle" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#34C759"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={60} color="#E5E5EA" />
            <Text style={styles.emptyTitle}>
              {!dietitianId
                ? "Henüz bir diyetisyeniniz yok"
                : searchText
                  ? "Tarif bulunamadı"
                  : "Henüz paylaşılan tarif yok"}
            </Text>
            <Text style={styles.emptyText}>
              {!dietitianId
                ? "Diyetisyeniniz sizi sisteme ekledikten sonra tarifler görünecek"
                : "Diyetisyeniniz tarif paylaştığında burada görünecek"}
            </Text>
          </View>
        }
      />

      <ClientTabBar />

      {/* ─── DETAY MODAL ───────────────────────────────────────────────── */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedRecipe?.image_url ? (
                <Image
                  source={{ uri: selectedRecipe.image_url }}
                  style={styles.detailImage}
                />
              ) : (
                <View style={styles.detailImagePlaceholder}>
                  <Ionicons
                    name="restaurant-outline"
                    size={48}
                    color="#C7C7CC"
                  />
                </View>
              )}

              <View style={styles.detailContent}>
                <View style={styles.detailTitleRow}>
                  <Text style={styles.detailTitle}>
                    {selectedRecipe?.title}
                  </Text>
                  <TouchableOpacity onPress={() => setDetailVisible(false)}>
                    <Ionicons name="close-circle" size={26} color="#C7C7CC" />
                  </TouchableOpacity>
                </View>

                {selectedRecipe?.description ? (
                  <Text style={styles.detailDesc}>
                    {selectedRecipe.description}
                  </Text>
                ) : null}

                <View style={styles.detailMetaRow}>
                  {selectedRecipe?.calories ? (
                    <View
                      style={[
                        styles.detailMetaChip,
                        { backgroundColor: "#FFF3E0" },
                      ]}
                    >
                      <Ionicons name="flame" size={14} color="#FF9500" />
                      <Text
                        style={[styles.detailMetaText, { color: "#FF9500" }]}
                      >
                        {selectedRecipe.calories} kcal
                      </Text>
                    </View>
                  ) : null}
                  {selectedRecipe?.prep_time ? (
                    <View
                      style={[
                        styles.detailMetaChip,
                        { backgroundColor: "#EEF4FF" },
                      ]}
                    >
                      <Ionicons name="time" size={14} color="#007AFF" />
                      <Text
                        style={[styles.detailMetaText, { color: "#007AFF" }]}
                      >
                        {selectedRecipe.prep_time} dk
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.detailSectionTitle}>🛒 Malzemeler</Text>
                <View style={styles.ingredientList}>
                  {selectedRecipe?.ingredients?.map((ing, i) => (
                    <View key={i} style={styles.ingredientRow}>
                      <View style={styles.ingredientDot} />
                      <Text style={styles.ingredientText}>
                        {ing.name}
                        {ing.amount
                          ? ` — ${ing.amount}${ing.unit ? " " + ing.unit : ""}`
                          : ""}
                      </Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.detailSectionTitle}>👨‍🍳 Yapılışı</Text>
                {selectedRecipe?.steps?.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>
                        {step.order || i + 1}
                      </Text>
                    </View>
                    <Text style={styles.stepText}>{step.description}</Text>
                  </View>
                ))}
                <View style={{ height: 20 }} />
              </View>
            </ScrollView>

            <View style={styles.detailFooter}>
              <TouchableOpacity
                style={[styles.shoppingBtn, generatingPDF && { opacity: 0.6 }]}
                onPress={() => handleShoppingList(selectedRecipe)}
                disabled={generatingPDF}
              >
                {generatingPDF ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="cart-outline" size={18} color="#FFF" />
                    <Text style={styles.shoppingBtnText}>
                      Alışveriş Listesi İndir
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1C1C1E" },
  headerSub: { fontSize: 13, color: "#8E8E93", marginTop: 1 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#1C1C1E" },

  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  card: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardImage: { width: 90, height: 90 },
  cardImagePlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: { flex: 1, padding: 12 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  cardDesc: { fontSize: 12, color: "#8E8E93", lineHeight: 16, marginBottom: 6 },
  cardMeta: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaChipText: { fontSize: 11, color: "#8E8E93", fontWeight: "600" },
  pdfBtn: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    backgroundColor: "#F2F2F7",
  },

  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1C1C1E",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 18,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  detailModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    overflow: "hidden",
  },
  detailImage: { width: "100%", height: 200 },
  detailImagePlaceholder: {
    width: "100%",
    height: 160,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  detailContent: { padding: 20 },
  detailTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  detailTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: "#1C1C1E",
    marginRight: 10,
  },
  detailDesc: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 20,
    marginBottom: 12,
  },
  detailMetaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  detailMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  detailMetaText: { fontSize: 13, fontWeight: "700" },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1C1E",
    marginBottom: 10,
    marginTop: 4,
  },
  ingredientList: {
    backgroundColor: "#F8F8FA",
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34C759",
  },
  ingredientText: { fontSize: 14, color: "#3A3A3C", flex: 1 },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5F9ED",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  stepNumberText: { fontSize: 13, fontWeight: "800", color: "#34C759" },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: "#3A3A3C",
    lineHeight: 20,
    paddingTop: 4,
  },
  detailFooter: { padding: 16, borderTopWidth: 1, borderTopColor: "#F2F2F7" },
  shoppingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#34C759",
    borderRadius: 14,
  },
  shoppingBtnText: { fontSize: 15, color: "#FFF", fontWeight: "700" },
});

export default ClientRecipes;
