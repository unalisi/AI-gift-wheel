import { useRef, useState } from 'react';
import confetti from 'canvas-confetti';

// Seçilen kategori sayısına göre renkleri döngüyle kullanıyoruz
const SEGMENT_COLORS = [
  '#00BFFF', // Cyan
  '#EE82EE', // Pink
  '#9400D3', // Purple
  '#FF8C00', // Orange
  '#FF4500', // Red
  '#FF1493', // Fuchsia
  '#00FF00', // Green
  '#FFD700', // Yellow
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
  const [wheelRotation, setWheelRotation] = useState(0); // Çarkın rotasyon açısı

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Son satır yarım kalmış olabilir, onu buffer'da tut
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("data: ") && trimmedLine !== "data: [DONE]") {
            try {
              const data = JSON.parse(trimmedLine.slice(6)) as { response?: unknown };
              if (typeof data.response === "string") {
                setStreamedResponse((prev) => prev + data.response);
              }
            } catch {
              // Eksik chunk'ları (parçaları) sessizce geç
            }
          }
        }
      }

      // Akış bittiğinde buffer'da kalmış son "data:" satırını da işle
      const remainingLine = buffer.trim();
      if (remainingLine.startsWith("data: ") && remainingLine !== "data: [DONE]") {
        try {
          const data = JSON.parse(remainingLine.slice(6)) as { response?: unknown };
          if (typeof data.response === "string") {
            setStreamedResponse((prev) => prev + data.response);
          }
        } catch {
          // buffer parçalıysa sessizce geç
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
                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12 flex flex-col items-center justify-start font-sans text-slate-100">
      
      {/* HEADER ALANI */}
      <header className="w-full max-w-7xl flex flex-col items-center justify-center text-center mb-16 space-y-4">
        <div className="px-4 py-1.5 bg-slate-900 rounded-full border border-slate-800 text-xs text-amber-400 font-medium tracking-wider uppercase">
            ✦ YAPAY ZEKA DESTEKLİ
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-100 tracking-tight leading-none" style={{ fontFamily: 'serif' }}>
          Hediye Çarkı
        </h1>
        <p className="text-sm md:text-base text-slate-400 max-w-[420px] mx-auto">
          Kişiye özel bilgileri gir, çarkı çevir — AI en iyi hediyeyi bulsun.
        </p>
      </header>

      <div className="w-full max-w-7xl grid md:grid-cols-2 gap-12 items-start">
        
        {/* SOL PANEL: Form ve Seçimler */}
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl space-y-6">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Kişi Bilgileri</h2>

          {/* Yaş Aralığı */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">YAŞ ARALIĞI</label>
            <TagGroup options={formOptions.yasAraliklari} selectedValues={formData.yasAraligi} onSelect={handleInputChange} keyProp="yasAraligi" />
          </div>

          {/* Cinsiyet */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">CİNSİYET</label>
            <TagGroup options={formOptions.cinsiyetler} selectedValues={formData.cinsiyet} onSelect={handleInputChange} keyProp="cinsiyet" />
          </div>

          {/* İlgi Alanları (Çoklu Seçim) */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">İLGI ALANLARI <span className='text-xs text-slate-500'>(Çoklu Seçim)</span></label>
            <TagGroup options={formOptions.ilgiAlanlari} selectedValues={formData.ilgiAlani} onSelect={handleInputChange} keyProp="ilgiAlani" multiple={true} />
          </div>

          {/* Bütçe Aralığı */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">BÜTÇE ARALIĞI</label>
            <TagGroup options={formOptions.butceler} selectedValues={formData.butce} onSelect={handleInputChange} keyProp="butce" />
          </div>

          {/* Vesile */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">VESİLE</label>
            <TagGroup options={formOptions.vesileler} selectedValues={formData.vesile} onSelect={handleInputChange} keyProp="vesile" />
          </div>

          {/* Ekstra Not (Opsiyonel) */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">EKSTRA NOT (OPSİYONEL)</label>
            <textarea
              value={formData.ekstraNot}
              onChange={(e) => handleInputChange('ekstraNot', e.target.value)}
              rows={3}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 custom-scrollbar"
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
        <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl min-h-[500px] relative">
          
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
                            stroke="#334155"
                            strokeWidth="1.5"
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
                    <circle cx="50" cy="50" r="45" fill="#111827" stroke="#334155" strokeWidth="1.5" />
                    <circle cx="50" cy="50" r="18" fill="#FFD700" stroke="#F59E0B" strokeWidth="1.2" />
                    <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="text-2xl z-30">🎁</text>
                    {/* "SPIN" metni - hediye kutusunun arkasında koyu mavi dairede */}
                    <circle cx="50" cy="50" r="40" fill="#000080" />
                    <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-extrabold text-white">SPIN</text>
                  </svg>
                </div>

                {/* Işıklı dış çerçeve (Dönmeyen kısım) */}
                <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-10 pointer-events-none">
                  <svg width="424" height="424" viewBox="0 0 424 424">
                    {/* Koyu mavi dış çerçeve */}
                    <circle cx="212" cy="212" r="200" fill="none" stroke="#00008B" strokeWidth="12" />
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
              <p className="absolute bottom-6 text-sm font-medium text-slate-500 z-30">Bilgileri doldurup çarkı çevir</p>
            </>
          )}

          {/* Kazanan Kategori Ekranı */}
          {spinResult && (
            <div className="text-center mb-6 z-10">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Çark Sonucu</span>
              <h2 className="text-3xl font-bold text-amber-400 mt-1">{spinResult}</h2>
            </div>
          )}

          {/* AI Yükleniyor Ekranı (Sadece metin akmaya başlayana kadar görünür) */}
          {aiLoading && streamedResponse.length === 0 && (
            <div className="flex flex-col items-center animate-pulse z-10">
              <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-400">Yapay zeka size özel hediyeler düşünüyor...</p>
            </div>
          )}

          {/* Streamlenmiş AI Metni */}
          {streamedResponse.length > 0 && (
            <div className="w-full text-left space-y-5 z-10">
               <h3 className="text-xl font-bold text-slate-100">Önerilen Hediyeler</h3>
              <div
                className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed custom-scrollbar"
                aria-label="AI tarafından oluşturulan hediye önerileri (Markdown formatında metin)"
                aria-live="polite"
              >
                {streamedResponse}
              </div>
              {!aiLoading && (
                <button
                  onClick={() => { setSpinResult(null); setStreamedResponse(""); }}
                  className="w-full mt-4 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors border border-slate-700 shadow-lg shadow-black/10"
                  aria-label="Önerileri yeniden oluştur"
                >
                  Yeniden Dene
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