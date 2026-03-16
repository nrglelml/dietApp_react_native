import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { meals } = await req.json();

    const mealText = meals.map((m) => {
      let text = m.meal_name;
      if (m.notes) text += ` (${m.notes})`;
      if (m.portion) text += ` - ${m.portion}`;
      return text;
    }).join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Aşağıdaki diyet programı öğünlerini analiz et ve alışveriş listesi çıkar.
Sadece JSON formatında yanıt ver, başka hiçbir şey yazma.
Format: { "items": [ { "name": "malzeme adı", "amount": "miktar (opsiyonel)", "category": "kategori" } ] }
Kategoriler: "Et & Balık", "Sebze & Meyve", "Süt & Yumurta", "Tahıl & Ekmek", "Kuru Gıda", "Yağ & Sos", "İçecek", "Diğer"
Tekrar eden malzemeleri birleştir.

Öğünler:\n${mealText}`,
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});