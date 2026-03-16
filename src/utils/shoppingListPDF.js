import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { supabase } from "../../supabase";

const analyzeMenuWithClaude = async (meals) => {
  const { data, error } = await supabase.functions.invoke("analyze-meals", {
    body: { meals },
  });
  if (error) throw new Error(error.message);
  return data;
};


const CATEGORY_ICONS = {
  "Et & Balık": "🥩",
  "Sebze & Meyve": "🥦",
  "Süt & Yumurta": "🥛",
  "Tahıl & Ekmek": "🍞",
  "Kuru Gıda": "🫘",
  "Yağ & Sos": "🫙",
  "İçecek": "🥤",
  "Diğer": "📦",
};

const generateHTML = ({ title, subtitle, date, groupedItems }) => {
  const categorySections = Object.entries(groupedItems)
    .map(([category, items]) => {
      const icon = CATEGORY_ICONS[category] || "📦";
      const rows = items
        .map(
          (item) => `
        <tr>
          <td class="check-col"><div class="checkbox"></div></td>
          <td class="item-name">${item.name}</td>
          <td class="item-amount">${item.amount || ""}</td>
        </tr>`
        )
        .join("");
      return `
      <div class="category-block">
        <div class="category-header">${icon} ${category}</div>
        <table class="item-table">
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
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
  .category-block { margin-bottom: 24px; }
  .category-header { font-size: 15px; font-weight: 700; color: #1C1C1E; background: #F2F2F7; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; }
  .item-table { width: 100%; border-collapse: collapse; }
  .item-table tr { border-bottom: 1px solid #F2F2F7; }
  .item-table tr:last-child { border-bottom: none; }
  .check-col { width: 28px; padding: 9px 8px; }
  .checkbox { width: 16px; height: 16px; border: 2px solid #C7C7CC; border-radius: 4px; }
  .item-name { font-size: 14px; color: #1C1C1E; padding: 9px 8px; }
  .item-amount { font-size: 13px; color: #8E8E93; padding: 9px 8px; text-align: right; white-space: nowrap; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #F2F2F7; text-align: center; font-size: 11px; color: #C7C7CC; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-row">
      <div class="logo-dot"></div>
      <span class="logo-text">DietApp</span>
    </div>
    <div class="title">${title}</div>
    <div class="subtitle">${subtitle}</div>
    <div class="date">${date}</div>
  </div>
  ${categorySections}
  <div class="footer">DietApp tarafından oluşturuldu • ${date}</div>
</body>
</html>`;
};

// ─── TABLOyu GRUPLAMA ────────────────────────────────────────────────────────

const groupByCategory = (items) => {
  const order = ["Et & Balık", "Sebze & Meyve", "Süt & Yumurta", "Tahıl & Ekmek", "Kuru Gıda", "Yağ & Sos", "İçecek", "Diğer"];
  const grouped = {};
  items.forEach((item) => {
    const cat = item.category || "Diğer";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  // Sıralı döndür
  const sorted = {};
  order.forEach((cat) => { if (grouped[cat]) sorted[cat] = grouped[cat]; });
  Object.keys(grouped).forEach((cat) => { if (!sorted[cat]) sorted[cat] = grouped[cat]; });
  return sorted;
};

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Tariften alışveriş listesi PDF oluştur
 * @param {object} recipe - { title, ingredients: [{name, amount, unit}] }
 */
export const generateRecipePDF = async (recipe) => {
  const items = recipe.ingredients.map((ing) => ({
    name: ing.name,
    amount: ing.amount ? `${ing.amount}${ing.unit ? " " + ing.unit : ""}` : "",
    category: "Diğer",
  }));

  const groupedItems = { "Malzemeler": items };
  const date = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const html = generateHTML({
    title: `${recipe.title}`,
    subtitle: "Tarif Alışveriş Listesi",
    date,
    groupedItems,
  });

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `${recipe.title} - Alışveriş Listesi`,
    UTI: "com.adobe.pdf",
  });
};

/**
 * Programdan alışveriş listesi PDF oluştur (Claude API ile analiz)
 * @param {object} params - { clientName, programTitle, meals: [{meal_name, notes, portion}] }
 * @param {function} onStatus - Yükleme durumu callback'i: (msg) => void
 */
export const generateProgramPDF = async ({ clientName, programTitle, meals }, onStatus) => {
  onStatus?.("Claude analiz ediyor...");

  let items = [];
  try {
    const result = await analyzeMenuWithClaude(meals);
    items = result.items || [];
  } catch (e) {
    console.warn("Claude API hatası, fallback:", e.message);
    // Fallback: sadece öğün adlarını listele
    items = meals.map((m) => ({ name: m.meal_name, amount: m.portion || "", category: "Diğer" }));
  }

  onStatus?.("PDF oluşturuluyor...");

  const groupedItems = groupByCategory(items);
  const date = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const html = generateHTML({
    title: `${clientName} — Alışveriş Listesi`,
    subtitle: programTitle || "Haftalık Program",
    date,
    groupedItems,
  });

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `${clientName} - Alışveriş Listesi`,
    UTI: "com.adobe.pdf",
  });
};