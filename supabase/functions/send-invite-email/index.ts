import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { clientEmail, dietitianName, approvalUrl, clientName } = await req.json();

    const response = await resend.emails.send({
      from: 'DiyetLife <bilgi@diyetlife.com.tr>', 
      to: [clientEmail],
      subject: 'Diyetisyeninizden Davet Var! 🥗',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Merhaba ${clientName},</h2>
          <p>Diyetisyeniniz <strong>${dietitianName}</strong> sizi DiyetLife platformuna davet etti.</p>
          <p>Daveti onaylamak için aşağıdaki butona tıklayın:</p>
          <div style="margin: 30px 0;">
            <a href="${approvalUrl}"
               style="background-color: #34C759; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">
               Daveti Onayla / Reddet
            </a>
          </div>
        </div>
      `,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return new Response(JSON.stringify(response.data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
