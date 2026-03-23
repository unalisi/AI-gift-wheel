import {
  getAssetFromKV,
  NotFoundError,
  serveSinglePageApp,
} from "@cloudflare/kv-asset-handler";

type AIService = {
  run: {
    (
      model: string,
      options: {
        messages: Array<{ role: string; content: string }>;
        stream: true;
        max_tokens?: number;
      }
    ): Promise<ReadableStream<Uint8Array>>;
    (
      model: string,
      options: {
        messages: Array<{ role: string; content: string }>;
        stream?: false;
        max_tokens?: number;
      }
    ): Promise<{ response: string }>;
  };
};

type SuggestRequestBody = {
  yas: string;
  cinsiyet: string;
  butce: string;
  vesile: string;
  ekstraNot?: string;
  spinKategorisi: string;
};

export interface Env {
  AI: AIService;
  __STATIC_CONTENT: unknown;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS Başlıkları (Frontend ve Backend farklı istekler için)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Preflight (OPTIONS) isteklerini yanıtla
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // /api/suggest endpoint'ini dinle
    if (url.pathname === "/api/suggest" && request.method === "POST") {
      try {
        const body = (await request.json()) as SuggestRequestBody;
        const { yas, cinsiyet, butce, vesile, ekstraNot, spinKategorisi } = body;

        const budgetMap: Record<string, string> = {
          "100-250₺": "100 TL ile 250 TL arasında",
          "250-500₺": "250 TL ile 500 TL arasında",
          "500-1K₺": "500 TL ile 1000 TL arasında",
          "1K-2.5K₺": "1000 TL ile 2500 TL arasında",
          "2.5K₺+": "en az 2500 TL ve üzeri (premium/lüks segment)",
        };
        const budgetDescription = budgetMap[butce] || butce;

        const systemPrompt = `Sen hediye danışmanısın. Yalnızca TÜRKÇE yanıt ver. Sonuçları sadece 5 maddelik numaralı liste olarak ver. KRİTİK KURAL: Önerdiğin her hediyenin fiyatı kullanıcının belirttiği bütçe aralığının İÇİNDE olmalıdır. Bütçenin altında veya üstünde fiyat YAZMA.`;

        const userPrompt = `Bütçe (KESİN UYULMALI): ${budgetDescription}.
Yaş: ${yas}, Cinsiyet: ${cinsiyet}, Vesile: ${vesile}, Not: ${ekstraNot || "Yok"}, Kategori: ${spinKategorisi}.
Bu bütçeye uygun SADECE 5 kısa hediye önerisi yap. Her madde: hediye adı, tahmini fiyat (${budgetDescription} aralığında), tek cümle açıklama. Doğrudan listeye başla.`;
        const messagesV1 = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ];

        // Yedekleme (aiCandidates) döngüsünü tamamen kaldırdık!
        // Doğrudan stream (akış) başlatıyoruz.
        const stream = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: messagesV1,
          stream: true,
          max_tokens: 400,
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            ...corsHeaders,
          },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: "AI yanıt verirken bir hata oluştu.",
            details: err instanceof Error ? err.message : String(err),
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    // Diğer tüm istekleri frontend için statik asset olarak servis et
    try {
      if (!env.__STATIC_CONTENT) {
        return new Response("STATIC_CONTENT binding not found", { status: 500 });
      }

      return await getAssetFromKV(
        {
          request,
          waitUntil(promise) {
            return ctx.waitUntil(promise);
          },
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          mapRequestToAsset: serveSinglePageApp(),
        },
      );
    } catch (err) {
      if (err instanceof NotFoundError) {
        return new Response("Not found", { status: 404 });
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error("Static asset error:", message);
      return new Response(message, { status: 500 });
    }
  },
};