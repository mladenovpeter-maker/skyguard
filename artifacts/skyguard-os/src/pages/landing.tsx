import { useLocation } from "wouter";
import { Shield, Radio, Wifi, Bell, Lock, Server, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0a0a0f]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            <span className="text-sm font-bold tracking-widest text-white">SKYGUARD OS</span>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-xs px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors tracking-widest"
          >
            ВХОД
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-red-500/30 text-red-400 text-xs tracking-widest mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            АКТИВНА ЗАЩИТА 24/7
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Засичане на дрони в<br />
            <span className="text-red-500">реално време</span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Автономна система за мониторинг на въздушното пространство над вашия имот.
            Работи 24/7 без облак — всички данни остават при вас.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold tracking-widest transition-colors"
          >
            ВЛЕЗ В СИСТЕМАТА →
          </button>
        </div>
      </section>

      {/* Detection methods */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs text-white/30 tracking-widest text-center mb-12">МЕТОДИ ЗА ЗАСИЧАНЕ</p>
          <div className="grid md:grid-cols-3 gap-6">

            <div className="border border-white/10 bg-white/2 p-6 hover:border-red-500/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 border border-blue-500/40 flex items-center justify-center">
                  <Radio className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs tracking-widest text-white/70">REMOTE ID / BLE</span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                Четене на ASTM F3411 Open Drone ID стандарт по Bluetooth. Дава пълна телеметрия: позиция на дрона, позиция на пилота, скорост, серийни номер.
              </p>
              <div className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> 100% надеждно за съвместими дрони
              </div>
            </div>

            <div className="border border-white/10 bg-white/2 p-6 hover:border-red-500/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 border border-red-500/40 flex items-center justify-center">
                  <Radio className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-xs tracking-widest text-white/70">RF СПЕКТЪР / HACKRF</span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                Пасивен мониторинг на честоти 400 MHz – 6 GHz. Засича RC сигнали (433/868/915 MHz), DJI OcuSync 2.4G/5.8G и FPV видео. ML модел за RF fingerprinting.
              </p>
              <div className="text-xs text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Индикация за присъствие, без GPS позиция
              </div>
            </div>

            <div className="border border-white/10 bg-white/2 p-6 hover:border-red-500/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 border border-green-500/40 flex items-center justify-center">
                  <Wifi className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-xs tracking-widest text-white/70">WI-FI РАЗУЗНАВАНЕ</span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                Пасивен 802.11 monitor mode. Засича DJI дрони в Wi-Fi режим, RC контролери по MAC адрес и probe requests от устройства на оператора.
              </p>
              <div className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Оператор detection без GPS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Detected / Not detected */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs text-white/30 tracking-widest text-center mb-12">КАКВО ЗАСИЧА — ЧЕСТНО</p>
          <div className="grid md:grid-cols-2 gap-8">

            <div>
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs tracking-widest text-green-400">ЗАСИЧА 100%</span>
              </div>
              <div className="space-y-3">
                {[
                  "DJI Mini 3 Pro — Remote ID вграден",
                  "DJI Mini 4 Pro — Remote ID вграден",
                  "DJI Air 3 / Air 3S — Remote ID вграден",
                  "DJI Mavic 3 / Classic / Pro — Remote ID",
                  "DJI Avata 2 — Remote ID вграден",
                  "Autel EVO II v3 — Remote ID",
                  "Всеки дрон с ASTM F3411 Remote ID",
                  "FPV дрони с ELRS 433/868/915 MHz (RF)",
                  "DJI в Wi-Fi режим (Spark, Air 1)",
                ].map(item => (
                  <div key={item} className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-white/60">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-6">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs tracking-widest text-red-400">НЕ МОЖЕ ДА ЗАСЕЧЕ</span>
              </div>
              <div className="space-y-3">
                {[
                  ["DJI Mini 2 — 249g, без Remote ID, OcuSync 2.0 proprietary", "red"],
                  ["DJI Mini SE — същото като Mini 2", "red"],
                  ["DJI Phantom 4 (стар) — без Remote ID", "red"],
                  ["DJI FPV 1-во поколение — без Remote ID", "red"],
                  ["Военни / правителствени дрони — криптирани", "red"],
                  ["Самоделни без Remote ID модул", "red"],
                  ["Silent gliders — минимална RF емисия", "red"],
                ].map(([item]) => (
                  <div key={item} className="flex items-start gap-3 text-sm">
                    <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-white/60">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 border border-yellow-500/20 bg-yellow-500/5">
            <p className="text-xs text-yellow-400/80 leading-relaxed">
              <AlertTriangle className="w-3 h-3 inline mr-2" />
              DJI Mini 2 е проектиран на точно 249g — едно грамче под EU/US Remote ID прага. Не е случайно. RF спектърът дава индикация за присъствие при -55 dBm, но не може да го разграничи от Wi-Fi сигнал. Системата е честна с вас за това.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs text-white/30 tracking-widest text-center mb-12">ФУНКЦИОНАЛНОСТ</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Bell, title: "Telegram алерти", desc: "Незабавно известие при навлизане в geofence зоната. Без забавяне." },
              { icon: Lock, title: "Self-hosted", desc: "Всички данни остават на вашата мрежа. Нищо не излиза в облака." },
              { icon: Server, title: "Автономна 24/7", desc: "Работи на Raspberry Pi без нужда от компютър. Рестартира сама при проблем." },
              { icon: Shield, title: "Роли и достъп", desc: "Admin и Operator роли. История на инцидентите с timestamps." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 border border-white/8 hover:border-white/20 transition-colors">
                <Icon className="w-5 h-5 text-red-400 mb-3" />
                <div className="text-sm font-bold mb-2 text-white/90">{title}</div>
                <div className="text-xs text-white/40 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hardware */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs text-white/30 tracking-widest text-center mb-12">ХАРДУЕР</p>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { name: "Raspberry Pi 4", role: "Централен процесор", detail: "Изпълнява всички сензори 24/7" },
              { name: "HackRF One", role: "RF спектър 400MHz–6GHz", detail: "SDR за пасивен мониторинг" },
              { name: "Nordic nRF52840", role: "Remote ID / BLE", detail: "ASTM F3411 декодер" },
            ].map(({ name, role, detail }) => (
              <div key={name} className="p-6 border border-white/8">
                <div className="text-lg font-bold text-white mb-1">{name}</div>
                <div className="text-xs text-red-400 tracking-widest mb-2">{role}</div>
                <div className="text-xs text-white/30">{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Готови за защита?</h2>
          <p className="text-white/40 text-sm mb-8">Влезте в системата или се свържете с нас за демонстрация.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate("/")}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold tracking-widest transition-colors"
            >
              ВХОД В СИСТЕМАТА →
            </button>
            <a
              href="mailto:contact@dronexit.com"
              className="px-8 py-3 border border-white/20 hover:border-white/40 text-white/60 hover:text-white text-sm tracking-widest transition-colors"
            >
              КОНТАКТ
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white/20">
            <Shield className="w-4 h-4" />
            <span className="text-xs tracking-widest">SKYGUARD OS © 2026 — DRONEXIT.COM</span>
          </div>
          <div className="text-xs text-white/20">
            Self-hosted · No cloud · Your data stays yours
          </div>
        </div>
      </footer>
    </div>
  );
}
