import { useRef, useState } from 'react';
import confetti from 'canvas-confetti';

// Seçilen kategori sayısına göre renkleri döngüyle kullanıyoruz
const SEGMENT_COLORS = [
  '#6B4C3B',
  '#3D5B4A',
  '#6B3A4D',
  '#5A6B3A',
  '#3A4D5B',
  '#5B4A3A',
  '#4D3A5B',
  '#5B6B3A',
];

// Form seçenekleri (Tasarım görüntüsüne uygun)
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
    // Audio playback tarayıcıda kullanıcı etkileşimi gerektirebilir;
    // bu yüzden butonla tetiklediğimiz akışta "catch" ile sessizce hata yönetiyoruz.
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
    } catch {
      // yok say
    }
  };

  const launchSuccessConfetti = () => {
    try {
      confetti({
        particleCount: 180,
        spread: 70,
        startVelocity: 35,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FF8C00', '#EE82EE', '#00BFFF', '#00FF00', '#9400D3'],
      });
    } catch {
      // yok say
    }
  };

  // Form inputlarını ve tag seçimlerini işler
  const handleInputChange = (key: keyof FormData, value: string) => {
    setFormData((prev) => {
      // Çoklu seçim (İlgi Alanları)
      if (key === 'ilgiAlani') {
        const currentInterests = prev.ilgiAlani;
        const updatedInterests = currentInterests.includes(value)
          ? currentInterests.filter((interest: string) => interest !== value)
          : [...currentInterests, value];
        return { ...prev, ilgiAlani: updatedInterests };
      }
      // Tekli seçim
      return { ...prev, [key]: value } as FormData;
    });
  };

  // Çarkı çevirme fonksiyonu (Dinamik açı hesaplaması ile)
  const carkiCevir = async () => {
    if (isSpinning || aiLoading) return; // Zaten çevriliyor veya yükleniyor

    // Form kontrolü (minimal alanlar)
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

    // Çark dönmeye başladığında ses ve haptik hissi güçlendirelim.
    playSpinSound();

    // --- DİNAMİK AÇI HESAPLAMA ---
    const selectedInterests = formData.ilgiAlani;
    const numSegments = selectedInterests.length;
    const segmentAngle = 360 / numSegments;
    
    // Kazananı belirle
    const winnerIndex = Math.floor(Math.random() * numSegments);
    const winner = selectedInterests[winnerIndex];

    // Kazanan dilimin TAM ORTASINA gelmesi için hedef açıyı bul
    const offset = segmentAngle / 2;
    const targetAngle = 360 - (winnerIndex * segmentAngle + offset);

    // Mevcut rotasyonun üzerine 5 tam tur (1800 derece) + hedef açıyı ekle
    const currentMod = wheelRotation % 360;
    const rotationToAdd = (360 - currentMod) + targetAngle + 1800;
    const newRotation = wheelRotation + rotationToAdd;

    setWheelRotation(newRotation); // Çarkı hesaplanan yeni dereceye çevir
    // ----------------------------

    // Çark dönme efekti (transition 4.5s sürer, setTimeout 5s)
    setTimeout(async () => {
      setIsSpinning(false);
      setSpinResult(winner);
      stopSpinSound();
      launchSuccessConfetti();
      playSuccessSound();
      await hediyeOnerisiAl(winner);
    }, 5000); 
  };

  // AI modelinden hediye önerisi al (Streaming versiyon)
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
              const data = JSON.parse(trimmedLine.slice(6)) as { response?: unknown };
              if (typeof data.response === "string") {
                chunkToAppend += data.response;
              }
            } catch {
              // Eksik chunk'ları sessizce geç
            }
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
          const data = JSON.parse(remainingLine.slice(6)) as { response?: unknown };
          if (typeof data.response === "string") {
            fullText += data.response;
            setStreamedResponse(fullText);
          }
        } catch {
          // Eksik chunk sessizce geç
        }
      }
    } catch (err) {
      console.error(err);
      setStreamedResponse("Öneriler alınırken bir hata oluştu.");
    } finally {
      setAiLoading(false);
    }
  };

  // Tag grubu bileşeni (Tekli veya çoklu seçim)
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
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = multiple
          ? (selectedValues as string[]).includes(option)
          : selectedValues === option;
        return (
          <button
            key={option}
            onClick={() => onSelect(keyProp, option)}
            className={`px-3 py-1.5 rounded-full text-xs transition border ${
              isSelected
                ? "bg-amber-400 text-black font-medium border-amber-400"
                : "bg-stone-900 text-stone-300 border-stone-800 hover:bg-stone-800"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-950 p-6 md:p-12 flex flex-col items-center justify-start font-sans text-stone-100">
      
      {/* HEADER ALANI */}
      <header className="w-full max-w-7xl mb-16">
        <div className="flex items-center justify-between mb-6">
          <div className="w-10" />
          <div className="px-4 py-1.5 bg-stone-900 rounded-full border border-stone-800 text-xs text-amber-400 font-medium tracking-wider uppercase">
            ✦ YAPAY ZEKA DESTEKLİ
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/unalisi/kreatif-proje"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-900 border border-stone-800 text-stone-400 hover:text-amber-400 hover:border-amber-400/50 transition-colors"
              aria-label="GitHub reposunu görüntüle"
              tabIndex={0}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <button
              onClick={() => setShowInfoModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-900 border border-stone-800 text-stone-400 hover:text-amber-400 hover:border-amber-400/50 transition-colors text-lg font-bold"
              aria-label="Proje hakkında bilgi"
              tabIndex={0}
            >
              ?
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-extrabold text-stone-100 tracking-tight leading-none" style={{ fontFamily: 'serif' }}>
            Hediye Çarkı
          </h1>
          <p className="text-sm md:text-base text-stone-400 max-w-[420px] mx-auto">
            Kişiye özel bilgileri gir, çarkı çevir — AI en iyi hediyeyi bulsun.
          </p>
        </div>
      </header>

      {/* BİLGİ MODAL */}
      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowInfoModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Proje hakkında bilgi modalı"
        >
          <div
            className="bg-stone-900 border border-stone-800 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-100 transition-colors"
              aria-label="Modalı kapat"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-stone-100" style={{ fontFamily: 'serif' }}>
              Hediye Çarkı Hakkında
            </h2>
            <div className="space-y-3 text-sm text-stone-300 leading-relaxed">
              <p>
                <span className="text-amber-400 font-semibold">Hediye Çarkı</span>, yapay zeka destekli bir hediye öneri uygulamasıdır. Kişiye özel bilgileri girdikten sonra çarkı çevirerek AI&apos;ın size en uygun hediye önerilerini sunmasını sağlayabilirsiniz.
              </p>
              <p>
                Uygulama <span className="text-amber-400 font-semibold">Cloudflare Workers AI</span> altyapısını kullanarak <span className="text-amber-400 font-semibold">Llama 3.1</span> modeli ile gerçek zamanlı hediye önerileri üretir.
              </p>
              <div className="pt-2 border-t border-stone-800">
                <p className="text-stone-500 text-xs">
                  React + TypeScript + Tailwind CSS + Cloudflare Workers
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl grid md:grid-cols-2 gap-12 items-start">
        
        {/* SOL PANEL: Form ve Seçimler */}
        <div className="bg-stone-900 p-8 rounded-2xl border border-stone-800 shadow-2xl space-y-6">
          <h2 className="text-2xl font-bold text-stone-100 mb-6" style={{ fontFamily: 'serif' }}>Kişi Bilgileri</h2>

          {/* Yaş Aralığı */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-stone-300">YAŞ ARALIĞI</label>
            <TagGroup options={formOptions.yasAraliklari} selectedValues={formData.yasAraligi} onSelect={handleInputChange} keyProp="yasAraligi" />
          </div>

          {/* Cinsiyet */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-stone-300">CİNSİYET</label>
            <TagGroup options={formOptions.cinsiyetler} selectedValues={formData.cinsiyet} onSelect={handleInputChange} keyProp="cinsiyet" />
          </div>

          {/* İlgi Alanları (Çoklu Seçim) */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-stone-300">İLGI ALANLARI <span className='text-xs text-stone-500'>(Çoklu Seçim)</span></label>
            <TagGroup options={formOptions.ilgiAlanlari} selectedValues={formData.ilgiAlani} onSelect={handleInputChange} keyProp="ilgiAlani" multiple={true} />
          </div>

          {/* Bütçe Aralığı */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-stone-300">BÜTÇE ARALIĞI</label>
            <TagGroup options={formOptions.butceler} selectedValues={formData.butce} onSelect={handleInputChange} keyProp="butce" />
          </div>

          {/* Vesile */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-stone-300">VESİLE</label>
            <TagGroup options={formOptions.vesileler} selectedValues={formData.vesile} onSelect={handleInputChange} keyProp="vesile" />
          </div>

          {/* Ekstra Not (Opsiyonel) */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-stone-300">EKSTRA NOT (OPSİYONEL)</label>
            <textarea
              value={formData.ekstraNot}
              onChange={(e) => handleInputChange('ekstraNot', e.target.value)}
              rows={3}
              className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 custom-scrollbar"
              placeholder="Örn: 'Kahveye bayılıyor, evde çalışıyor, minimalist zevki var...'"
            />
          </div>

          <button
            type="button"
            onClick={carkiCevir}
            disabled={isSpinning || aiLoading}
            className="w-full py-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:bg-amber-400/70 text-black font-bold text-lg rounded-xl transition-all shadow-xl shadow-amber-950/20"
            aria-label="Çarkı çevir"
          >
            ✦ Çarkı Çevir
          </button>
        </div>

        {/* SAĞ PANEL: Çark ve Sonuçlar */}
        <div className="flex flex-col items-center justify-center p-8 bg-stone-900 rounded-2xl border border-stone-800 shadow-2xl min-h-[500px] relative">
          
          {/* Çark Ekranı (Eğer kazanan yoksa veya AI yüklenmiyorsa) */}
          {!spinResult && !aiLoading && streamedResponse.length === 0 && (
            <>
              {/* SVG Çarkı */}
              <div className="relative w-[400px] h-[400px]">
                <svg
                  width="400"
                  height="400"
                  viewBox="0 0 400 400"
                  // Yavaşlama efekti (ease-out) cubic-bezier eğrisi ile eklendi
                  className={`transform transition-transform ${isSpinning ? 'duration-[5s] ease-[cubic-bezier(0.2,1,0.3,1)]' : ''}`}
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    // Dönmüyorsa will-change-transform kaldırarak performansı iyileştir
                    willChange: isSpinning ? 'transform' : 'auto'
                  }}
                >
                  <g filter="url(#shadow)">
                    {formData.ilgiAlani.map((interest, index) => {
                      const numSegments = formData.ilgiAlani.length;
                      const segmentAngle = 360 / numSegments;
                      const angle = index * segmentAngle;
                      const largeArcFlag = segmentAngle > 180 ? 1 : 0;
                      const radius = 180;
                      const center = 200;

                      // Dilim koordinatlarını hesapla
                      const startX = center + radius * Math.cos((angle - 90) * Math.PI / 180);
                      const startY = center + radius * Math.sin((angle - 90) * Math.PI / 180);
                      const endX = center + radius * Math.cos((angle + segmentAngle - 90) * Math.PI / 180);
                      const endY = center + radius * Math.sin((angle + segmentAngle - 90) * Math.PI / 180);

                      // Dilim içindeki metin pozisyonunu hesapla (dikey)
                      const textRadius = radius - 50;
                      const textAngle = angle + segmentAngle / 2;
                      const textX = center + textRadius * Math.cos((textAngle - 90) * Math.PI / 180);
                      const textY = center + textRadius * Math.sin((textAngle - 90) * Math.PI / 180);

                      return (
                        <g key={`${interest}-${index}`}>
                          <path
                            d={`M ${center},${center} L ${startX},${startY} A ${radius},${radius} 0 ${largeArcFlag} 1 ${endX},${endY} Z`}
                            fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
                            stroke="#2a2520"
                            strokeWidth="1"
                          />
                          <text
                            x={textX}
                            y={textY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="white"
                            className="text-[10px] font-bold"
                            style={{ 
                              // Metni dilime paralel döndür
                              transform: `rotate(${textAngle}deg)`, 
                              transformOrigin: `${textX}px ${textY}px` 
                            }}
                          >
                            {interest}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                  {/* Gölge filtresi */}
                  <defs>
                    <filter id="shadow">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
                    </filter>
                  </defs>
                </svg>

                {/* Çarkın merkezi (Hediye kutusu ve "SPIN" metni) */}
                <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-20 pointer-events-none">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="#1c1917" stroke="#292524" strokeWidth="2" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#C8956C" strokeWidth="1.5" />
                    <circle cx="50" cy="50" r="18" fill="#C8956C" />
                    <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="text-xl">🎁</text>
                  </svg>
                </div>

                {/* Işıklı dış çerçeve (Dönmeyen kısım) */}
                <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-10 pointer-events-none">
                  <svg width="424" height="424" viewBox="0 0 424 424">
                    {/* Koyu mavi dış çerçeve */}
                    <circle cx="212" cy="212" r="200" fill="none" stroke="#3a3530" strokeWidth="10" />
                    {/* 12 Işık */}
                    {[...Array(12)].map((_, i) => {
                      const angle = i * (360 / 12);
                      const radius = 206; // Işıkları çerçevenin dışına yerleştir
                      const center = 212;
                      const x = center + radius * Math.cos((angle - 90) * Math.PI / 180);
                      const y = center + radius * Math.sin((angle - 90) * Math.PI / 180);
                      return <circle key={i} cx={x} cy={y} r="3" fill="#FFD700" />;
                    })}
                  </svg>
                </div>
              </div>

              {/* Çarkın üstündeki sarı işaretçi ok (Pointer) */}
              <div
                className="absolute top-[-10px] left-[50%] translate-x-[-50%] z-30 w-[32px] h-[32px] bg-[#FFD700] rotate-45 rounded-sm"
                style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
              ></div>
              <p className="absolute bottom-6 text-sm font-medium text-stone-500 z-30">Bilgileri doldurup çarkı çevir</p>
            </>
          )}

          {/* Kazanan Kategori Ekranı */}
          {spinResult && (
            <div className="text-center mb-6 z-10">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Çark Sonucu</span>
              <h2 className="text-3xl font-bold text-amber-400 mt-1">{spinResult}</h2>
            </div>
          )}

          {/* AI Yükleniyor Ekranı (Sadece metin akmaya başlayana kadar görünür) */}
          {aiLoading && streamedResponse.length === 0 && (
            <div className="flex flex-col items-center animate-pulse z-10">
              <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-stone-400">Yapay zeka size özel hediyeler düşünüyor... Bu biraz zaman alabilir...</p>
            </div>
          )}

          {/* Streamlenmiş AI Metni */}
          {streamedResponse.length > 0 && (
            <div className="w-full text-left space-y-5 z-10">
               <h3 className="text-xl font-bold text-stone-100">Önerilen Hediyeler</h3>
              <div
                className="whitespace-pre-wrap text-stone-300 text-sm leading-relaxed custom-scrollbar"
                aria-label="AI tarafından oluşturulan hediye önerileri (Markdown formatında metin)"
                aria-live="polite"
              >
                {streamedResponse}
              </div>
              {!aiLoading && (
                <button
                  onClick={() => {
                    document.cookie.split(";").forEach((c) => {
                      document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                    });
                    window.location.reload();
                  }}
                  className="w-full mt-4 px-4 py-3 bg-stone-800 hover:bg-stone-700 text-white font-medium rounded-xl transition-colors border border-stone-700 shadow-lg shadow-black/10"
                  aria-label="Önerileri yeniden oluştur"
                >
                  Yeniden Çevir
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;