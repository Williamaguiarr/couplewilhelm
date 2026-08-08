import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_imoveis",
  title: "Listar imóveis",
  description:
    "Lista os imóveis visíveis para o usuário autenticado, com nome do anúncio, endereço, capacidade e taxa de comissão.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).default(50).describe("Quantidade máxima de imóveis."),
    busca: z.string().trim().min(1).optional().describe("Filtro por nome do imóvel ou título do anúncio."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, busca }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("imoveis")
      .select(
        "id, nome_imovel, airbnb_title, airbnb_link, endereco, max_hospedes, taxa_comissao, hora_checkin, hora_checkout, ical_last_sync",
      )
      .order("nome_imovel", { ascending: true })
      .limit(limit ?? 50);

    if (busca) query = query.or(`nome_imovel.ilike.%${busca}%,airbnb_title.ilike.%${busca}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const imoveis = (data ?? []).map((i) => ({ ...i, nome_exibicao: i.airbnb_title || i.nome_imovel }));
    return {
      content: [{ type: "text", text: JSON.stringify(imoveis, null, 2) }],
      structuredContent: { total: imoveis.length, imoveis },
    };
  },
});
