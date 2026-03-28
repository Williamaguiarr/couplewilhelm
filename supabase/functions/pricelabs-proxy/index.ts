import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICELABS_BASE = "https://api.pricelabs.co/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
    authHeader.replace("Bearer ", "")
  );
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const PRICELABS_API_KEY = Deno.env.get("PRICELABS_API_KEY");
  if (!PRICELABS_API_KEY) {
    return new Response(
      JSON.stringify({ error: "PRICELABS_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { action, listing_id, pms, listing_ids } = await req.json();

    let url: string;
    let method = "GET";
    let body: string | undefined;

    switch (action) {
      case "listings":
        url = `${PRICELABS_BASE}/listings`;
        break;

      case "listing":
        if (!listing_id) {
          return new Response(JSON.stringify({ error: "listing_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        url = `${PRICELABS_BASE}/listings/${encodeURIComponent(listing_id)}`;
        break;

      case "neighborhood_data":
        if (!listing_id || !pms) {
          return new Response(
            JSON.stringify({ error: "listing_id and pms required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        url = `${PRICELABS_BASE}/neighborhood_data?pms=${encodeURIComponent(pms)}&listing_id=${encodeURIComponent(listing_id)}`;
        break;

      case "prices":
        if (!listing_ids || !Array.isArray(listing_ids) || listing_ids.length === 0) {
          return new Response(
            JSON.stringify({ error: "listing_ids array required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        url = `${PRICELABS_BASE}/listing_prices`;
        method = "POST";
        body = JSON.stringify({ listing_ids });
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const fetchOpts: RequestInit = {
      method,
      headers: {
        "X-API-Key": PRICELABS_API_KEY,
        "Content-Type": "application/json",
      },
    };
    if (body) fetchOpts.body = body;

    const response = await fetch(url, fetchOpts);
    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "PriceLabs API error", status: response.status, details: data }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("PriceLabs proxy error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
