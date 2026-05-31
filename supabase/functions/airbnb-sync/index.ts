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
    
    // 1. Try to extract from JSON-LD (most reliable)
    let title = null;
    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1]);
        if (data.name && typeof data.name === 'string') {
          // Check if it's a descriptive SEO name or real name
          // If it doesn't contain the " · " pattern often used in SEO titles, it's likely the real name
          if (!data.name.includes(" · ")) {
            title = data.name;
            break;
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }

    // 2. Try to extract from h1
    if (!title) {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match) {
        title = h1Match[1].replace(/<[^>]*>?/gm, '').trim();
      }
    }

    // 3. Try og:description (sometimes contains the actual name when og:title is SEO-optimized)
    if (!title) {
      const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
      const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
      
      const ogTitle = ogTitleMatch ? ogTitleMatch[1] : null;
      const ogDesc = ogDescMatch ? ogDescMatch[1] : null;

      if (ogTitle && (ogTitle.includes(" · ") || ogTitle.includes("★"))) {
        // If og:title looks like SEO summary, try og:description or cleaned title
        if (ogDesc && ogDesc.length > 5 && ogDesc.length < 100) {
          title = ogDesc;
        }
      } else {
        title = ogTitle;
      }
    }

    // 4. Fallback to <title>
    if (!title) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1];
        // Clean up: "Name - Property Type - ... - Airbnb"
        title = title.split(" - ")[0].split(" | ")[0].trim();
      }
    }

    // Extract image
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    let image = imageMatch ? imageMatch[1] : null;

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

    const { imovel_id, airbnb_link, bulk } = await req.json();

    let imoveis: any[] = [];

    if (airbnb_link) {
      // Direct link provided (from form)
      imoveis = [{ id: "temp", airbnb_link, nome_imovel: "Preview" }];
    } else if (imovel_id) {
      const { data, error: fetchError } = await supabase
        .from("imoveis")
        .select("id, airbnb_link, nome_imovel")
        .eq("id", imovel_id);
      if (fetchError) throw fetchError;
      imoveis = data || [];
    } else if (bulk) {
      const { data, error: fetchError } = await supabase
        .from("imoveis")
        .select("id, airbnb_link, nome_imovel")
        .not("airbnb_link", "is", null);
      if (fetchError) throw fetchError;
      imoveis = data || [];
    } else {
      return new Response(JSON.stringify({ error: "Missing imovel_id, airbnb_link or bulk flag" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

        if (imovel.id !== "temp") {
          const { error: updateError } = await supabase
            .from("imoveis")
            .update(updateData)
            .eq("id", imovel.id);

          if (updateError) {
            results.push({ id: imovel.id, status: "error", error: updateError.message });
          } else {
            results.push({ id: imovel.id, status: "success", title: metadata.title, image: metadata.image });
          }
        } else {
          // Temp/Preview mode
          results.push({ id: imovel.id, status: "success", title: metadata.title, image: metadata.image });
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
