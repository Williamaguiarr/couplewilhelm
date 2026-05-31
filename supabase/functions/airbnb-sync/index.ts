import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchAirbnbMetadata(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,webp,image/apng,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Airbnb page: ${response.status}`);
    }

    const html = await response.text();
    
    // Extract metadata using regex (simpler than parsing DOM in Deno without external libs)
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || 
                      html.match(/<title>([^<]+)<\/title>/i);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    
    let title = titleMatch ? titleMatch[1] : null;
    let image = imageMatch ? imageMatch[1] : null;

    // Clean up title if it contains Airbnb suffixes
    if (title) {
      title = title.replace(" - Airbnb", "").replace(" | Airbnb", "").trim();
    }

    return { title, image };
  } catch (error) {
    console.error(`Error fetching metadata for ${url}:`, error);
    return { title: null, image: null, error: error.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { imovel_id, bulk } = await req.json();

    let query = supabase.from("imoveis").select("id, airbnb_link, nome_imovel");

    if (imovel_id) {
      query = query.eq("id", imovel_id);
    } else if (bulk) {
      query = query.not("airbnb_link", "is", null);
    } else {
      return new Response(JSON.stringify({ error: "Missing imovel_id or bulk flag" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: imoveis, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    const results = [];

    for (const imovel of imoveis || []) {
      if (!imovel.airbnb_link) {
        results.push({ id: imovel.id, status: "skipped", reason: "No Airbnb link" });
        continue;
      }

      console.log(`Syncing Airbnb data for property: ${imovel.nome_imovel} (${imovel.id})`);
      const metadata = await fetchAirbnbMetadata(imovel.airbnb_link);

      if (metadata.title || metadata.image) {
        const updateData: any = {
          last_airbnb_sync: new Date().toISOString(),
        };
        if (metadata.title) updateData.airbnb_title = metadata.title;
        if (metadata.image) updateData.airbnb_image_url = metadata.image;

        const { error: updateError } = await supabase
          .from("imoveis")
          .update(updateData)
          .eq("id", imovel.id);

        if (updateError) {
          results.push({ id: imovel.id, status: "error", error: updateError.message });
        } else {
          results.push({ id: imovel.id, status: "success", title: metadata.title });
        }
      } else {
        results.push({ id: imovel.id, status: "failed", error: metadata.error || "Could not extract metadata" });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
