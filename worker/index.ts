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

        // 1. SİSTEM KOMUTU: Yapay zekanın karakterini ve kesin sınırlarını belirliyoruz
        const systemPrompt = `Sen profesyonel ve yaratıcı bir hediye danışmanısın. SADECE TÜRKÇE (Turkish) dilinde yanıt vermen KESİNLİKLE ZORUNLUDUR. Hiçbir koşulda İngilizce kelime veya cümle kullanma. Yanıtların her zaman numaralandırılmış bir liste formatında olmalıdır.`;

        // 2. KULLANICI KOMUTU: Sadece görev detaylarını veriyoruz
        const userPrompt = `Kullanıcı Profili:
Yaş Aralığı: ${yas}
Cinsiyet: ${cinsiyet}
Bütçe Aralığı: ${butce}
Vesile: ${vesile}
Ekstra Notlar: ${ekstraNot || "Yok"}
Çarktan Çıkan Kategori: ${spinKategorisi}

Lütfen yukarıdaki profile tam uygun, yaratıcı ve spesifik 5 adet hediye önerisi yap. Her önerinin yanına (bu bütçeye uygun olarak) tahmini fiyatını ve bu hediyeyi neden seçtiğini 1-2 cümle ile TÜRKÇE olarak açıkla. Giriş veya çıkış cümlesi yazma, doğrudan 1. maddeden başla.`;

        // 1. SİSTEM KOMUTU ve 2. KULLANICI KOMUTU kısımları aynı kalıyor...
        const messagesV1 = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ];

        // Yedekleme (aiCandidates) döngüsünü tamamen kaldırdık!
        // Doğrudan stream (akış) başlatıyoruz.
        const stream = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: messagesV1,
          stream: true, // YAPAY ZEKAYI HIZLANDIRAN SİHİRLİ KELİME
          max_tokens: 800, // Uzun yanıt verip timeout olmasını engeller
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream", // Stream header'ı
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