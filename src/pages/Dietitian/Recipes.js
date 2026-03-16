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
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../../supabase";
import { DietitianTabBar } from "../../components";
import { generateRecipePDF } from "../../utils/shoppingListPDF";

const emptyRecipe = () => ({
  title: "",
  description: "",
  calories: "",
  prep_time: "",
  ingredients: [{ id: Date.now(), name: "", amount: "", unit: "" }],
  steps: [{ id: Date.now() + 1, order: 1, description: "" }],
  is_shared: false,
  image_url: null,
});

const UNITS = [
  "gr",
  "kg",
  "ml",
  "lt",
  "adet",
  "yemek kaşığı",
  "çay kaşığı",
  "su bardağı",
  "demet",
  "dilim",
  "tutam",
];

// ─── ANA COMPONENT ────────────────────────────────────────────────────────────

const Recipes = () => {
  const navigation = useNavigation();

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Form modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyRecipe());
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [localImageUri, setLocalImageUri] = useState(null); // önizleme için

  // Detay modal
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("dietitian_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setRecipes(data);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRecipes();
    setRefreshing(false);
  }, []);

  // ─── FORM HELPERS ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyRecipe());
    setLocalImageUri(null);
    setModalVisible(true);
  };

  const openEdit = (recipe) => {
    setEditingId(recipe.id);
    setForm({
      title: recipe.title || "",
      description: recipe.description || "",
      calories: recipe.calories ? String(recipe.calories) : "",
      prep_time: recipe.prep_time ? String(recipe.prep_time) : "",
      ingredients: recipe.ingredients?.length
        ? recipe.ingredients.map((i, idx) => ({ ...i, id: idx }))
        : [{ id: 0, name: "", amount: "", unit: "" }],
      steps: recipe.steps?.length
        ? recipe.steps.map((s, idx) => ({ ...s, id: idx }))
        : [{ id: 0, order: 1, description: "" }],
      is_shared: recipe.is_shared || false,
      image_url: recipe.image_url || null,
    });
    setLocalImageUri(null);
    setModalVisible(true);
  };

  const addIngredient = () => {
    setForm((f) => ({
      ...f,
      ingredients: [
        ...f.ingredients,
        { id: Date.now(), name: "", amount: "", unit: "" },
      ],
    }));
  };
  const updateIngredient = (id, field, value) => {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((i) =>
        i.id === id ? { ...i, [field]: value } : i,
      ),
    }));
  };
  const removeIngredient = (id) => {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.filter((i) => i.id !== id),
    }));
  };

  const addStep = () => {
    setForm((f) => ({
      ...f,
      steps: [
        ...f.steps,
        { id: Date.now(), order: f.steps.length + 1, description: "" },
      ],
    }));
  };
  const updateStep = (id, value) => {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s) =>
        s.id === id ? { ...s, description: value } : s,
      ),
    }));
  };
  const removeStep = (id) => {
    setForm((f) => ({
      ...f,
      steps: f.steps
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i + 1 })),
    }));
  };

  // ─── FOTOĞRAF ──────────────────────────────────────────────────────────────

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("İzin Gerekli", "Kamera izni gerekiyor.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0])
      setLocalImageUri(result.assets[0].uri);
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("İzin Gerekli", "Galeri izni gerekiyor.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0])
      setLocalImageUri(result.assets[0].uri);
  };

  const pickImage = () => {
    Alert.alert("Fotoğraf Ekle", "Kaynak seçin", [
      { text: "Kamera", onPress: openCamera },
      { text: "Galeri", onPress: openGallery },
      { text: "İptal", style: "cancel" },
    ]);
  };

  const uploadImage = async (uri, dietitianId) => {
    setUploadingImage(true);
    try {
      const ext = uri.split(".").pop() || "jpg";
      const fileName = `${dietitianId}/${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error } = await supabase.storage
        .from("recipe-images")
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}` });
      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("recipe-images")
        .getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (e) {
      Alert.alert("Hata", "Fotoğraf yüklenemedi: " + e.message);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // ─── KAYDET ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert("Uyarı", "Tarif adı zorunludur.");
      return;
    }
    const validIngredients = form.ingredients.filter((i) => i.name.trim());
    if (validIngredients.length === 0) {
      Alert.alert("Uyarı", "En az bir malzeme giriniz.");
      return;
    }
    const validSteps = form.steps.filter((s) => s.description.trim());
    if (validSteps.length === 0) {
      Alert.alert("Uyarı", "En az bir yapılış adımı giriniz.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let imageUrl = form.image_url;
      if (localImageUri) {
        imageUrl = await uploadImage(localImageUri, user.id);
      }

      const payload = {
        dietitian_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        calories: form.calories ? parseInt(form.calories) : null,
        prep_time: form.prep_time ? parseInt(form.prep_time) : null,
        ingredients: validIngredients.map(({ id, ...rest }) => rest),
        steps: validSteps.map(({ id, ...rest }) => rest),
        is_shared: form.is_shared,
        image_url: imageUrl,
      };

      if (editingId) {
        const { error } = await supabase
          .from("recipes")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recipes").insert(payload);
        if (error) throw error;
      }

      setModalVisible(false);
      await fetchRecipes();
    } catch (e) {
      Alert.alert("Hata", e.message);
    } finally {
      setSaving(false);
    }
  };

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

  const handleDelete = (recipe) => {
    Alert.alert(
      "Tarifi Sil",
      `"${recipe.title}" tarifini silmek istiyor musunuz?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await supabase.from("recipes").delete().eq("id", recipe.id);
            await fetchRecipes();
          },
        },
      ],
    );
  };

  // ─── FİLTRE ────────────────────────────────────────────────────────────────

  const filtered = recipes.filter((r) =>
    r.title.toLowerCase().includes(searchText.toLowerCase()),
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────

  const renderRecipeCard = ({ item }) => (
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
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.is_shared && (
            <View style={styles.sharedBadge}>
              <Ionicons name="people-outline" size={10} color="#007AFF" />
              <Text style={styles.sharedBadgeText}>Paylaşıldı</Text>
            </View>
          )}
        </View>
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
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.cardActionBtn}
          onPress={() => openEdit(item)}
        >
          <Ionicons name="pencil-outline" size={18} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cardActionBtn}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>
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

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tarifler</Text>
          <Text style={styles.headerSub}>{recipes.length} tarif</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* ARAMA */}
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
        renderItem={renderRecipeCard}
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
              {searchText ? "Tarif bulunamadı" : "Henüz tarif yok"}
            </Text>
            <Text style={styles.emptyText}>
              + butonuna basarak tarif ekleyebilirsiniz.
            </Text>
          </View>
        }
      />

      <DietitianTabBar />

      {/* ─── DETAY MODAL ─────────────────────────────────────────────────── */}
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
                  {selectedRecipe?.is_shared ? (
                    <View
                      style={[
                        styles.detailMetaChip,
                        { backgroundColor: "#E5F9ED" },
                      ]}
                    >
                      <Ionicons name="people" size={14} color="#34C759" />
                      <Text
                        style={[styles.detailMetaText, { color: "#34C759" }]}
                      >
                        Danışanlara Açık
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Malzemeler */}
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

                {/* Yapılış */}
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

            {/* Alt butonlar */}
            <View style={styles.detailFooter}>
              <TouchableOpacity
                style={styles.detailEditBtn}
                onPress={() => {
                  setDetailVisible(false);
                  openEdit(selectedRecipe);
                }}
              >
                <Ionicons name="pencil-outline" size={18} color="#007AFF" />
                <Text style={styles.detailEditBtnText}>Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.detailShoppingBtn,
                  generatingPDF && { opacity: 0.6 },
                ]}
                onPress={() => handleShoppingList(selectedRecipe)}
                disabled={generatingPDF}
              >
                {generatingPDF ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="cart-outline" size={18} color="#FFF" />
                    <Text style={styles.detailShoppingBtnText}>
                      Alışveriş Listesi
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── FORM MODAL ──────────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          />
          <View style={styles.formModal}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingId ? "Tarifi Düzenle" : "Yeni Tarif"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
            >
              {/* Fotoğraf */}
              <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                {localImageUri || form.image_url ? (
                  <Image
                    source={{ uri: localImageUri || form.image_url }}
                    style={styles.photoPreview}
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={28} color="#8E8E93" />
                    <Text style={styles.photoPlaceholderText}>
                      Fotoğraf Ekle (Opsiyonel)
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Başlık */}
              <Text style={styles.fieldLabel}>Tarif Adı *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Yulaf Ezmesi..."
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              />

              {/* Açıklama */}
              <Text style={styles.fieldLabel}>Açıklama</Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  { minHeight: 70, textAlignVertical: "top" },
                ]}
                placeholder="Tarif hakkında kısa açıklama..."
                value={form.description}
                multiline
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              />

              {/* Kalori + Süre */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Kalori (kcal)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="350"
                    keyboardType="numeric"
                    value={form.calories}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, calories: v }))
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Hazırlık (dk)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="15"
                    keyboardType="numeric"
                    value={form.prep_time}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, prep_time: v }))
                    }
                  />
                </View>
              </View>

              {/* Danışanlara paylaş */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() =>
                  setForm((f) => ({ ...f, is_shared: !f.is_shared }))
                }
              >
                <View>
                  <Text style={styles.toggleLabel}>Danışanlara Göster</Text>
                  <Text style={styles.toggleSub}>
                    Danışanlarınız bu tarifi görebilir
                  </Text>
                </View>
                <View
                  style={[styles.toggle, form.is_shared && styles.toggleOn]}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      form.is_shared && styles.toggleThumbOn,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              {/* Malzemeler */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                Malzemeler *
              </Text>
              {form.ingredients.map((ing) => (
                <View key={ing.id} style={styles.ingredientFormRow}>
                  <TextInput
                    style={[styles.fieldInput, { flex: 2.5 }]}
                    placeholder="Malzeme adı"
                    value={ing.name}
                    onChangeText={(v) => updateIngredient(ing.id, "name", v)}
                  />
                  <TextInput
                    style={[
                      styles.fieldInput,
                      { flex: 1, marginHorizontal: 6 },
                    ]}
                    placeholder="Miktar"
                    value={ing.amount}
                    onChangeText={(v) => updateIngredient(ing.id, "amount", v)}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[styles.fieldInput, { flex: 1.2 }]}
                    placeholder="Birim"
                    value={ing.unit}
                    onChangeText={(v) => updateIngredient(ing.id, "unit", v)}
                  />
                  {form.ingredients.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeIngredient(ing.id)}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={styles.addRowBtn}
                onPress={addIngredient}
              >
                <Ionicons name="add-circle-outline" size={18} color="#34C759" />
                <Text style={styles.addRowBtnText}>Malzeme Ekle</Text>
              </TouchableOpacity>

              {/* Yapılış */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                Yapılışı *
              </Text>
              {form.steps.map((step, i) => (
                <View key={step.id} style={styles.stepFormRow}>
                  <View style={styles.stepFormNumber}>
                    <Text style={styles.stepFormNumberText}>{i + 1}</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.fieldInput,
                      { flex: 1, textAlignVertical: "top", minHeight: 56 },
                    ]}
                    placeholder={`${i + 1}. adımı açıklayın...`}
                    value={step.description}
                    multiline
                    onChangeText={(v) => updateStep(step.id, v)}
                  />
                  {form.steps.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeStep(step.id)}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addRowBtn} onPress={addStep}>
                <Ionicons name="add-circle-outline" size={18} color="#34C759" />
                <Text style={styles.addRowBtnText}>Adım Ekle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (saving || uploadingImage) && { opacity: 0.7 },
                ]}
                onPress={handleSave}
                disabled={saving || uploadingImage}
              >
                {saving || uploadingImage ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingId ? "Güncelle" : "Tarifi Kaydet"}
                  </Text>
                )}
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
  },

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
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#EEF4FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sharedBadgeText: { fontSize: 10, color: "#007AFF", fontWeight: "700" },
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
  cardActions: { justifyContent: "center", paddingHorizontal: 8, gap: 8 },
  cardActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  emptyText: { fontSize: 14, color: "#8E8E93" },

  // Detay modal
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
  detailFooter: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    gap: 10,
  },
  detailEditBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "#007AFF",
    borderRadius: 14,
  },
  detailEditBtnText: { fontSize: 15, color: "#007AFF", fontWeight: "700" },
  detailShoppingBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: "#34C759",
    borderRadius: 14,
  },
  detailShoppingBtnText: { fontSize: 15, color: "#FFF", fontWeight: "700" },

  // Form modal
  formModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 0,
    maxHeight: "95%",
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  formTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  photoBtn: { marginBottom: 14, borderRadius: 14, overflow: "hidden" },
  photoPreview: { width: "100%", height: 160, borderRadius: 14 },
  photoPlaceholder: {
    width: "100%",
    height: 120,
    backgroundColor: "#F2F2F7",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  photoPlaceholderText: { fontSize: 13, color: "#8E8E93" },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 12,
  },
  fieldInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1C1C1E",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F8FA",
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  toggleLabel: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  toggleSub: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E5E5EA",
    padding: 2,
  },
  toggleOn: { backgroundColor: "#34C759" },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFF",
  },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
  ingredientFormRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    marginBottom: 8,
  },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#34C759",
    borderRadius: 12,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addRowBtnText: { fontSize: 14, color: "#34C759", fontWeight: "700" },
  stepFormRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  stepFormNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5F9ED",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
    flexShrink: 0,
  },
  stepFormNumberText: { fontSize: 13, fontWeight: "800", color: "#34C759" },
  saveBtn: {
    backgroundColor: "#34C759",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
});

export default Recipes;
