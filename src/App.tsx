import { useRef, useState } from 'react';
import confetti from 'canvas-confetti';

const SEGMENT_COLORS = [
  '#2a2318',
  '#1a2226',
  '#26221a',
  '#1a2220',
  '#26201a',
  '#221a26',
  '#1a2226',
  '#261a1a',
];

const SEGMENT_STROKES = [
  '#e8c87a',
  '#7ab8e8',
  '#e87ab8',
  '#7ae8a8',
  '#e8a87a',
  '#b87ae8',
  '#7ab8e8',
  '#e87a7a',
];

const formOptions = {
  yasAraliklari: ["0-12", "13-17", "18-25", "26-40", "41-60", "60+"],
  cinsiyetler: ["Kadın", "Erkek", "Fark etmez"],
  ilgiAlanlari: ["Teknoloji", "Spor", "Kitap", "Müzik", "Yemek", "Moda", "Seyahat", "Sanat", "Oyun", "Doğa", "Ev & Yaşam", "Kişisel Bakım", "Hobi & Aktivite"],
  butceler: ["100-250₺", "250-500₺", "500-1K₺", "1K-2.5K₺", "2.5K₺+"],
  vesileler: ["Doğum Günü", "Yılbaşı", "Sevgililer Günü", "Mezuniyet", "Evlilik", "Teşekkür", "Sürpriz"]
};

type FormData = {
  yasAraligi: string;
  cinsiyet: string;
  ilgiAlani: string[];
  butce: string;
  vesile: string;
  ekstraNot: string;
};

function App() {
  const [formData, setFormData] = useState<FormData>({
    yasAraligi: "",
    cinsiyet: "Fark etmez",
    ilgiAlani: [],
    butce: "",
    vesile: "",
    ekstraNot: "",
  });
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [streamedResponse, setStreamedResponse] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const spinAudioRef = useRef<HTMLAudioElement | null>(null);

  const playSpinSound = () => {
    try {
      if (spinAudioRef.current) {
        spinAudioRef.current.pause();
        spinAudioRef.current.currentTime = 0;
      }
      const audio = new Audio('/spin.mp3');
      audio.volume = 0.6;
      audio.loop = true;
      spinAudioRef.current = audio;
      void audio.play().catch(() => {});
    } catch {
      // mp3 yüklenemese bile uygulama akışı bozulmasın
    }
  };

  const stopSpinSound = () => {
    const audio = spinAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  };

  const playSuccessSound = () => {
    try {
      const audio = new Audio('/success.mp3');
      audio.volume = 0.8;
      void audio.play().catch(() => {});
    } catch {}
  };

  const launchSuccessConfetti = () => {
    try {
      confetti({
        particleCount: 180,
        spread: 70,
        startVelocity: 35,
        origin: { y: 0.6 },
        colors: ['#e8c87a', '#7ae8a8', '#e87ab8', '#7ab8e8', '#e8a87a'],
      });
    } catch {}
  };

  const handleInputChange = (key: keyof FormData, value: string) => {
    setFormData((prev) => {
      if (key === 'ilgiAlani') {
        const currentInterests = prev.ilgiAlani;
        const updatedInterests = currentInterests.includes(value)
          ? currentInterests.filter((interest: string) => interest !== value)
          : [...currentInterests, value];
        return { ...prev, ilgiAlani: updatedInterests };
      }
      return { ...prev, [key]: value } as FormData;
    });
  };

  const carkiCevir = async () => {
    if (isSpinning || aiLoading) return;

    if (!formData.yasAraligi || !formData.butce || !formData.vesile) {
      alert("Lütfen temel alanları (Yaş, Bütçe, Vesile) doldurun.");
      return;
    }

    if (formData.ilgiAlani.length < 2) {
      alert("Lütfen çarka eklemek için en az iki ilgi alanı seçin.");
      return;
    }

    setIsSpinning(true);
    setSpinResult(null);
    setStreamedResponse("");
    playSpinSound();

    const selectedInterests = formData.ilgiAlani;
    const numSegments = selectedInterests.length;
    const segmentAngle = 360 / numSegments;
    const winnerIndex = Math.floor(Math.random() * numSegments);
    const winner = selectedInterests[winnerIndex];
    const offset = segmentAngle / 2;
    const targetAngle = 360 - (winnerIndex * segmentAngle + offset);
    const currentMod = wheelRotation % 360;
    const rotationToAdd = (360 - currentMod) + targetAngle + 1800;
    const newRotation = wheelRotation + rotationToAdd;

    setWheelRotation(newRotation);

    setTimeout(async () => {
      setIsSpinning(false);
      setSpinResult(winner);
      stopSpinSound();
      launchSuccessConfetti();
      playSuccessSound();
      await hediyeOnerisiAl(winner);
    }, 5000);
  };

  const hediyeOnerisiAl = async (kategori: string) => {
    setAiLoading(true);
    setStreamedResponse("");
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yas: formData.yasAraligi,
          cinsiyet: formData.cinsiyet,
          butce: formData.butce,
          vesile: formData.vesile,
          ekstraNot: formData.ekstraNot,
          spinKategorisi: kategori,
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} Hatası`);

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        let chunkToAppend = "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("data: ") && trimmedLine !== "data: [DONE]") {
            try {
              const data = JSON.parse(trimmedLine.slice(6)) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const content = data.choices?.[0]?.delta?.content;
              if (typeof content === "string") {
                chunkToAppend += content;
              }
            } catch {}
          }
        }

        if (chunkToAppend) {
          fullText += chunkToAppend;
          setStreamedResponse(fullText);
        }
      }

      const remainingLine = buffer.trim();
      if (remainingLine.startsWith("data: ") && remainingLine !== "data: [DONE]") {
        try {
          const data = JSON.parse(remainingLine.slice(6)) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const content = data.choices?.[0]?.delta?.content;
          if (typeof content === "string") {
            fullText += content;
            setStreamedResponse(fullText);
          }
        } catch {}
      }
    } catch (err) {
      console.error(err);
      setStreamedResponse("Öneriler alınırken bir hata oluştu.");
    } finally {
      setAiLoading(false);
    }
  };

  type TagGroupProps = {
    options: string[];
    selectedValues: string | string[];
    onSelect: (keyProp: keyof FormData, option: string) => void;
    keyProp: keyof FormData;
    multiple?: boolean;
  };

  const TagGroup = ({
    options,
    selectedValues,
    onSelect,
    keyProp,
    multiple = false,
  }: TagGroupProps) => (
    <div className="flex flex-wrap gap-[7px]">
      {options.map((option) => {
        const isSelected = multiple
          ? (selectedValues as string[]).includes(option)
          : selectedValues === option;
        return (
          <button
            key={option}
            onClick={() => onSelect(keyProp, option)}
            className={`px-[13px] py-[6px] rounded-[20px] text-xs transition-all border select-none cursor-pointer ${
              isSelected
                ? "bg-[rgba(232,200,122,0.15)] text-[#e8c87a] font-medium border-[rgba(232,200,122,0.5)]"
                : "bg-[#231f1b] text-[#8a8478] border-[rgba(255,255,255,0.08)] hover:border-[rgba(232,200,122,0.3)] hover:text-[#e8c87a]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className="min-h-screen p-6 md:p-12 flex flex-col items-center justify-start"
      style={{ background: '#0f0e0c', color: '#f0ece4', fontFamily: "'DM Sans', sans-serif" }}
    >

      {/* HEADER */}
      <header className="w-full max-w-[900px] mb-[52px]">
        <div className="flex items-center justify-between mb-6">
          <div className="w-10" />
          <div
            className="px-[14px] py-[5px] rounded-[20px] border text-[11px] font-medium tracking-[0.12em] uppercase"
            style={{ color: '#e8c87a', borderColor: 'rgba(232,200,122,0.3)' }}
          >
            ✦ Yapay Zeka Destekli
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/edakaraa/hediye-carki"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-full border transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#8a8478' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e8c87a'; e.currentTarget.style.borderColor = 'rgba(232,200,122,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#8a8478'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              aria-label="GitHub reposunu görüntüle"
              tabIndex={0}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <button
              onClick={() => setShowInfoModal(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full border transition-colors text-sm font-bold"
              style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#8a8478' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e8c87a'; e.currentTarget.style.borderColor = 'rgba(232,200,122,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#8a8478'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              aria-label="Proje hakkında bilgi"
              tabIndex={0}
            >
              ?
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center text-center space-y-[14px]">
          <h1
            className="text-[clamp(36px,6vw,62px)] font-black tracking-tight leading-[1.05]"
            style={{ fontFamily: "'Playfair Display', serif", color: '#f0ece4' }}
          >
            Hediye <span style={{ color: '#e8c87a' }}>Çarkı</span>
          </h1>
          <p className="text-[15px] font-light max-w-[420px] mx-auto leading-relaxed" style={{ color: '#8a8478' }}>
            Kişiye özel bilgileri gir, çarkı çevir — AI en iyi hediyeyi bulsun.
          </p>
        </div>
      </header>

      {/* BİLGİ MODAL */}
      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,14,12,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowInfoModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Proje hakkında bilgi modalı"
        >
          <div
            className="rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-5 relative"
            style={{ background: '#1a1916', border: '1px solid rgba(232,200,122,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-5 right-5 text-[28px] leading-none transition-colors bg-transparent border-none cursor-pointer"
              style={{ color: '#8a8478' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e8c87a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#8a8478'; }}
              aria-label="Modalı kapat"
            >
              ×
            </button>
            <h2
              className="text-2xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif", color: '#f0ece4' }}
            >
              Hediye Çarkı Hakkında
            </h2>
            <div className="space-y-3 text-sm leading-relaxed" style={{ color: '#8a8478' }}>
              <p>
                <span className="font-semibold" style={{ color: '#e8c87a' }}>Hediye Çarkı</span>, yapay zeka destekli bir hediye öneri uygulamasıdır. Kişiye özel bilgileri girdikten sonra çarkı çevirerek AI&apos;ın size en uygun hediye önerilerini sunmasını sağlayabilirsiniz.
              </p>
              <p>
                Uygulama <span className="font-semibold" style={{ color: '#e8c87a' }}>Groq LPU</span> altyapısını kullanarak <span className="font-semibold" style={{ color: '#e8c87a' }}>Llama 3.3 70B</span> modeli ile gerçek zamanlı hediye önerileri üretir.
              </p>
              <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs" style={{ color: '#5a5650' }}>
                  React + TypeScript + Tailwind CSS + Cloudflare Workers
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[900px] grid md:grid-cols-2 gap-6 items-start">

        {/* SOL PANEL: Form */}
        <div
          className="rounded-2xl p-7 space-y-[18px]"
          style={{ background: '#1a1916', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2
            className="text-lg font-bold mb-5"
            style={{ fontFamily: "'Playfair Display', serif", color: '#f0ece4' }}
          >
            Kişi Bilgileri
          </h2>

          <div className="space-y-[7px]">
            <label className="block text-[11px] font-medium tracking-[0.08em] uppercase" style={{ color: '#8a8478' }}>Yaş Aralığı</label>
            <TagGroup options={formOptions.yasAraliklari} selectedValues={formData.yasAraligi} onSelect={handleInputChange} keyProp="yasAraligi" />
          </div>

          <div className="space-y-[7px]">
            <label className="block text-[11px] font-medium tracking-[0.08em] uppercase" style={{ color: '#8a8478' }}>Cinsiyet</label>
            <TagGroup options={formOptions.cinsiyetler} selectedValues={formData.cinsiyet} onSelect={handleInputChange} keyProp="cinsiyet" />
          </div>

          <div className="space-y-[7px]">
            <label className="block text-[11px] font-medium tracking-[0.08em] uppercase" style={{ color: '#8a8478' }}>
              İlgi Alanları <span style={{ color: '#5a5650' }}>(Çoklu Seçim)</span>
            </label>
            <TagGroup options={formOptions.ilgiAlanlari} selectedValues={formData.ilgiAlani} onSelect={handleInputChange} keyProp="ilgiAlani" multiple={true} />
          </div>

          <div className="space-y-[7px]">
            <label className="block text-[11px] font-medium tracking-[0.08em] uppercase" style={{ color: '#8a8478' }}>Bütçe</label>
            <TagGroup options={formOptions.butceler} selectedValues={formData.butce} onSelect={handleInputChange} keyProp="butce" />
          </div>

          <div className="space-y-[7px]">
            <label className="block text-[11px] font-medium tracking-[0.08em] uppercase" style={{ color: '#8a8478' }}>Vesile</label>
            <TagGroup options={formOptions.vesileler} selectedValues={formData.vesile} onSelect={handleInputChange} keyProp="vesile" />
          </div>

          <div className="space-y-[7px]">
            <label className="block text-[11px] font-medium tracking-[0.08em] uppercase" style={{ color: '#8a8478' }}>Ekstra Not (opsiyonel)</label>
            <textarea
              value={formData.ekstraNot}
              onChange={(e) => handleInputChange('ekstraNot', e.target.value)}
              rows={3}
              className="w-full rounded-[10px] px-[14px] py-[10px] text-sm outline-none transition-colors resize-none"
              style={{
                background: '#231f1b',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#f0ece4',
                fontFamily: "'DM Sans', sans-serif",
                lineHeight: 1.5,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(232,200,122,0.5)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              placeholder="Örn: 'Kahveye bayılıyor, evde çalışıyor, minimalist zevki var...'"
            />
          </div>

          <button
            type="button"
            onClick={carkiCevir}
            disabled={isSpinning || aiLoading}
            className="w-full py-[14px] border-none rounded-xl text-[15px] font-medium cursor-pointer transition-all mt-[6px] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: '#e8c87a',
              color: '#0f0e0c',
              fontFamily: "'DM Sans', sans-serif",
            }}
            aria-label="Çarkı çevir"
          >
            ✦ Çarkı Çevir
          </button>
        </div>

        {/* SAĞ PANEL: Çark ve Sonuçlar */}
        <div className="flex flex-col items-center justify-center gap-5 min-h-[500px] relative">

          {!spinResult && !aiLoading && streamedResponse.length === 0 && (
            <>
              <div className="relative w-[400px] h-[400px]">
                <svg
                  width="400"
                  height="400"
                  viewBox="0 0 400 400"
                  className={`transform transition-transform ${isSpinning ? 'duration-[5s] ease-[cubic-bezier(0.2,1,0.3,1)]' : ''}`}
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    willChange: isSpinning ? 'transform' : 'auto',
                  }}
                >
                  {/* Boş çark çemberi (kategori yokken de görünür) */}
                  <circle cx="200" cy="200" r="190" fill="none" stroke="#e8c87a" strokeWidth="2" strokeOpacity="0.25" />
                  {formData.ilgiAlani.map((interest, index) => {
                    const numSegments = formData.ilgiAlani.length;
                    const segmentAngle = 360 / numSegments;
                    const angle = index * segmentAngle;
                    const largeArcFlag = segmentAngle > 180 ? 1 : 0;
                    const radius = 190;
                    const center = 200;

                    const startX = center + radius * Math.cos((angle - 90) * Math.PI / 180);
                    const startY = center + radius * Math.sin((angle - 90) * Math.PI / 180);
                    const endX = center + radius * Math.cos((angle + segmentAngle - 90) * Math.PI / 180);
                    const endY = center + radius * Math.sin((angle + segmentAngle - 90) * Math.PI / 180);

                    const textRadius = radius - 55;
                    const textAngle = angle + segmentAngle / 2;
                    const textX = center + textRadius * Math.cos((textAngle - 90) * Math.PI / 180);
                    const textY = center + textRadius * Math.sin((textAngle - 90) * Math.PI / 180);

                    const strokeColor = SEGMENT_STROKES[index % SEGMENT_STROKES.length];

                    return (
                      <g key={`${interest}-${index}`}>
                        <path
                          d={`M ${center},${center} L ${startX},${startY} A ${radius},${radius} 0 ${largeArcFlag} 1 ${endX},${endY} Z`}
                          fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
                          stroke={strokeColor + '66'}
                          strokeWidth="1.5"
                        />
                        <text
                          x={textX}
                          y={textY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={strokeColor}
                          className="text-[11px] font-medium"
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            transform: `rotate(${textAngle}deg)`,
                            transformOrigin: `${textX}px ${textY}px`,
                          }}
                        >
                          {interest}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Çark merkezi */}
                <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-20 pointer-events-none">
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="30" fill="#0f0e0c" stroke="#e8c87a" strokeWidth="2" />
                    <text x="32" y="32" textAnchor="middle" dominantBaseline="middle" className="text-[22px]">🎁</text>
                  </svg>
                </div>
              </div>

              {/* Pointer — çark çemberinin üst kenarına oturur */}
              <div
                className="absolute left-[50%] z-30 w-6 h-6 rounded-[4px]"
                style={{
                  top: 'calc(50% - 225px)',
                  marginLeft: '-12px',
                  background: 'linear-gradient(135deg, #e8c87a, #c9a84c)',
                  transform: 'rotate(45deg)',
                  boxShadow: '0 4px 15px rgba(232,200,122,0.4)',
                }}
              />
              <p className="text-sm font-light" style={{ color: '#8a8478' }}>Bilgileri doldurup çarkı çevir</p>
            </>
          )}

          {/* Kazanan Kategori */}
          {spinResult && (
            <div className="text-center mb-4 z-10">
              <span
                className="text-[10px] font-medium tracking-[0.14em] uppercase"
                style={{ color: '#e8c87a' }}
              >
                ✦ Çark Sonucu
              </span>
              <h2
                className="text-[28px] font-bold mt-2"
                style={{ fontFamily: "'Playfair Display', serif", color: '#f0ece4' }}
              >
                {spinResult}
              </h2>
            </div>
          )}

          {/* AI Yükleniyor */}
          {aiLoading && streamedResponse.length === 0 && (
            <div className="flex flex-col items-center gap-3 z-10">
              <div className="flex gap-[6px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[6px] h-[6px] rounded-full animate-pulse"
                    style={{
                      background: '#e8c87a',
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-[13px] font-light" style={{ color: '#8a8478' }}>
                Hediyeler aranıyor…
              </p>
            </div>
          )}

          {/* AI Sonuçları */}
          {streamedResponse.length > 0 && (
            <div className="w-full text-left space-y-4 z-10">
              <h3
                className="text-lg font-bold"
                style={{ fontFamily: "'Playfair Display', serif", color: '#f0ece4' }}
              >
                Önerilen Hediyeler
              </h3>
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: '#8a8478' }}
                aria-label="AI tarafından oluşturulan hediye önerileri"
                aria-live="polite"
              >
                {streamedResponse}
              </div>
              {!aiLoading && (
                <div className="flex gap-[10px] mt-6">
                  <button
                    onClick={() => {
                      document.cookie.split(";").forEach((c) => {
                        document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                      });
                      window.location.reload();
                    }}
                    className="flex-1 py-[11px] rounded-[10px] border text-[13px] font-normal cursor-pointer transition-all"
                    style={{
                      background: 'transparent',
                      borderColor: 'rgba(255,255,255,0.08)',
                      color: '#8a8478',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(232,200,122,0.3)'; e.currentTarget.style.color = '#e8c87a'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8a8478'; }}
                    aria-label="Tekrar çevir"
                  >
                    ↺ Tekrar Çevir
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
