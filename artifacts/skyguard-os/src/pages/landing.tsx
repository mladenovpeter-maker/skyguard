import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";

// Animated radar canvas
function RadarScope() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const dotsRef = useRef<{ angle: number; dist: number; alpha: number; size: number }[]>([
    { angle: 0.8, dist: 0.45, alpha: 1, size: 3 },
    { angle: 2.1, dist: 0.62, alpha: 1, size: 2.5 },
    { angle: 4.5, dist: 0.3,  alpha: 1, size: 2 },
    { angle: 5.2, dist: 0.7,  alpha: 1, size: 3.5 },
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    function draw() {
      const W = canvas!.width;
      const H = canvas!.height;
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) / 2 - 2;

      // Clear
      ctx.fillStyle = "rgba(2, 8, 20, 0.18)";
      ctx.fillRect(0, 0, W, H);

      // Grid circles
      ctx.strokeStyle = "rgba(0,255,136,0.08)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Cross hairs
      ctx.strokeStyle = "rgba(0,255,136,0.06)";
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();

      // Sweep gradient trail
      const sweepGrad = ctx.createConicalGradient
        ? null
        : null;
      const a = angleRef.current;
      for (let i = 0; i < 60; i++) {
        const trailA = a - (i * Math.PI) / 60;
        const alpha = (1 - i / 60) * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, trailA - Math.PI / 60, trailA);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,255,136,${alpha})`;
        ctx.fill();
      }

      // Sweep line
      ctx.strokeStyle = "rgba(0,255,136,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();

      // Detection dots
      dotsRef.current.forEach(dot => {
        const swept = ((a - dot.angle + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2);
        const alpha = swept < 0.02 ? 1 : Math.max(0, 1 - swept * 3) * dot.alpha;
        if (alpha <= 0) return;
        const dx = cx + Math.cos(dot.angle) * dot.dist * R;
        const dy = cy + Math.sin(dot.angle) * dot.dist * R;
        ctx.beginPath();
        ctx.arc(dx, dy, dot.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,80,80,${alpha})`;
        ctx.fill();
        if (alpha > 0.5) {
          ctx.beginPath();
          ctx.arc(dx, dy, dot.size + 4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,80,80,${alpha * 0.4})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,255,136,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tick marks
      for (let i = 0; i < 36; i++) {
        const tickA = (i * Math.PI * 2) / 36;
        const inner = i % 3 === 0 ? R - 10 : R - 5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(tickA) * inner, cy + Math.sin(tickA) * inner);
        ctx.lineTo(cx + Math.cos(tickA) * R, cy + Math.sin(tickA) * R);
        ctx.strokeStyle = "rgba(0,255,136,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      angleRef.current = (a + 0.025) % (Math.PI * 2);
      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// Blinking status dot
function StatusDot({ color = "#00ff88" }: { color?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 800);
    return () => clearInterval(t);
  }, []);
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ backgroundColor: on ? color : "transparent", border: `1px solid ${color}`, transition: "background 0.1s" }}
    />
  );
}

// Animated counter
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = to / 40;
    const t = setInterval(() => {
      start += step;
      if (start >= to) { setVal(to); clearInterval(t); }
      else setVal(Math.floor(start));
    }, 30);
    return () => clearInterval(t);
  }, [to]);
  return <>{val}{suffix}</>;
}

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div
      className="min-h-screen text-white overflow-x-hidden"
      style={{ background: "#020814", fontFamily: "'Space Mono', 'Courier New', monospace" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        .grid-bg {
          background-image:
            linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .scanline::after {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.08) 2px,
            rgba(0,0,0,0.08) 4px
          );
          pointer-events: none;
        }
        .glow-green { text-shadow: 0 0 20px rgba(0,255,136,0.5); }
        .glow-red { text-shadow: 0 0 20px rgba(255,80,80,0.6); }
        .border-green { border-color: rgba(0,255,136,0.25); }
        .hover-green:hover { border-color: rgba(0,255,136,0.5); background: rgba(0,255,136,0.04); }
      `}</style>

      {/* NAV */}
      <nav className="fixed top-0 w-full z-50" style={{ background: "rgba(2,8,20,0.92)", borderBottom: "1px solid rgba(0,255,136,0.1)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusDot />
            <span className="text-xs font-bold tracking-[0.3em]" style={{ color: "#00ff88" }}>SKYGUARD OS</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>// DRONE DETECTION SYSTEM</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs" style={{ color: "rgba(0,255,136,0.5)" }}>dronexit.com</span>
            <button
              onClick={() => navigate("/login")}
              className="text-xs px-5 py-2 font-bold tracking-widest transition-all"
              style={{ border: "1px solid rgba(0,255,136,0.4)", color: "#00ff88", background: "rgba(0,255,136,0.05)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,255,136,0.12)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,255,136,0.05)")}
            >
              ВХОД →
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="grid-bg scanline relative pt-14 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center w-full">

          {/* Left */}
          <div>
            <div className="flex items-center gap-2 mb-8">
              <StatusDot />
              <span className="text-xs tracking-[0.3em]" style={{ color: "rgba(0,255,136,0.7)" }}>СИСТЕМА АКТИВНА — 24/7</span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span style={{ color: "rgba(255,255,255,0.95)" }}>Знайте кога</span><br />
              <span style={{ color: "#00ff88" }} className="glow-green">дрон навлиза</span><br />
              <span style={{ color: "rgba(255,255,255,0.95)" }}>в имота ви.</span>
            </h1>

            <p className="text-sm leading-relaxed mb-10 max-w-lg" style={{ color: "rgba(255,255,255,0.45)" }}>
              SkyGuard OS е автономна система за мониторинг на въздушното пространство.
              Три независими сензора работят едновременно. Всичко е при вас — без облак, без абонамент за данни.
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              {[
                { n: 6000, suf: " MHz", label: "RF диапазон" },
                { n: 100, suf: "%", label: "Remote ID точност" },
                { n: 24, suf: "/7", label: "Автономна" },
              ].map(({ n, suf, label }) => (
                <div key={label} className="p-4" style={{ border: "1px solid rgba(0,255,136,0.12)", background: "rgba(0,255,136,0.02)" }}>
                  <div className="text-2xl font-bold" style={{ color: "#00ff88" }}>
                    <Counter to={n} suffix={suf} />
                  </div>
                  <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em" }}>{label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/login")}
                className="px-8 py-3 text-sm font-bold tracking-widest transition-all"
                style={{ background: "#00ff88", color: "#020814" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#00e87a")}
                onMouseLeave={e => (e.currentTarget.style.background = "#00ff88")}
              >
                ВЛЕЗ В СИСТЕМАТА →
              </button>
              <a
                href="mailto:contact@dronexit.com"
                className="text-xs tracking-widest transition-colors"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                КОНТАКТ
              </a>
            </div>
          </div>

          {/* Right — Radar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width: 360, height: 360 }}>
              <RadarScope />
              {/* Overlay labels */}
              <div className="absolute top-2 left-2 text-xs" style={{ color: "rgba(0,255,136,0.4)", letterSpacing: "0.2em" }}>N</div>
              <div className="absolute bottom-2 left-2 text-xs" style={{ color: "rgba(0,255,136,0.4)", letterSpacing: "0.2em" }}>S</div>
              <div className="absolute top-2 right-2 text-xs" style={{ color: "rgba(0,255,136,0.4)", letterSpacing: "0.2em" }}>E</div>
              <div className="absolute bottom-2 right-2 text-xs" style={{ color: "rgba(0,255,136,0.4)", letterSpacing: "0.2em" }}>W</div>
            </div>

            {/* Detection feed */}
            <div className="w-full" style={{ border: "1px solid rgba(0,255,136,0.12)", background: "rgba(2,8,20,0.8)" }}>
              <div className="px-3 py-2 text-xs tracking-widest" style={{ color: "rgba(0,255,136,0.4)", borderBottom: "1px solid rgba(0,255,136,0.08)" }}>
                DETECTION LOG
              </div>
              {[
                { time: "21:34:07", type: "REMOTE ID", id: "DJI-Mini4Pro", dist: "340m", color: "#ff5050" },
                { time: "21:31:22", type: "RF 433MHz",  id: "ELRS-RC",      dist: "—",    color: "#f59e0b" },
                { time: "21:28:55", type: "REMOTE ID", id: "Mavic3-Classic",dist: "820m", color: "#ff5050" },
              ].map(({ time, type, id, dist, color }) => (
                <div key={time} className="px-3 py-2 flex items-center gap-3 text-xs" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ color: "rgba(255,255,255,0.25)", minWidth: 64 }}>{time}</span>
                  <span className="px-1.5 py-0.5 text-xs font-bold" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>{type}</span>
                  <span style={{ color: "rgba(255,255,255,0.6)", flex: 1 }}>{id}</span>
                  <span style={{ color: "rgba(255,255,255,0.25)" }}>{dist}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(0,255,136,0.08)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs tracking-[0.3em] mb-3" style={{ color: "rgba(0,255,136,0.5)" }}>АРХИТЕКТУРА</div>
            <h2 className="text-3xl font-bold">Три независими сензора</h2>
            <p className="text-sm mt-3 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
              Всеки засича различен тип заплаха. Работят паралелно — повредата на един не спира останалите.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {[
              {
                num: "01",
                title: "Remote ID / BLE",
                color: "#00ff88",
                tech: "Nordic nRF52840",
                items: [
                  "Чете ASTM F3411 стандарт по Bluetooth",
                  "Дава: GPS позиция на дрона",
                  "Дава: GPS позиция на пилота",
                  "Дава: серийни номер, скорост, altitude",
                  "100% надеждно за всички нови дрони с Remote ID",
                ],
                badge: "ТОЧЕН",
                badgeColor: "#00ff88",
              },
              {
                num: "02",
                title: "RF Спектър 400MHz–6GHz",
                color: "#0ea5e9",
                tech: "HackRF One SDR",
                items: [
                  "Пасивен мониторинг без излъчване",
                  "Засича: RC сигнали 433/868/915 MHz",
                  "Засича: DJI OcuSync 2.4G и 5.8G",
                  "ML RF fingerprinting модел",
                  "Индикация за присъствие — без GPS позиция",
                ],
                badge: "ИНДИКАЦИЯ",
                badgeColor: "#f59e0b",
              },
              {
                num: "03",
                title: "Wi-Fi Разузнаване",
                color: "#a78bfa",
                tech: "USB Wi-Fi Adapter",
                items: [
                  "802.11 monitor mode — пасивен",
                  "Засича: DJI дрони в Wi-Fi Direct режим",
                  "Засича: DJI RC контролери по MAC адрес",
                  "Засича: probe requests от оператора",
                  "Засича: неизвестни устройства в района",
                ],
                badge: "ОПЕРАТОР",
                badgeColor: "#a78bfa",
              },
            ].map(({ num, title, color, tech, items, badge, badgeColor }) => (
              <div
                key={num}
                className="p-6 transition-all hover-green"
                style={{ border: `1px solid rgba(255,255,255,0.06)`, background: "rgba(255,255,255,0.01)" }}
              >
                <div className="flex items-start justify-between mb-5">
                  <span className="text-4xl font-bold" style={{ color: "rgba(255,255,255,0.06)" }}>{num}</span>
                  <span className="text-xs px-2 py-1 font-bold tracking-widest" style={{ background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}40` }}>{badge}</span>
                </div>
                <div className="text-lg font-bold mb-1" style={{ color }}>{title}</div>
                <div className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em" }}>{tech}</div>
                <div className="space-y-2.5">
                  {items.map(item => (
                    <div key={item} className="flex items-start gap-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                      <span style={{ color, marginTop: 2 }}>›</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HONEST BREAKDOWN */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(0,255,136,0.08)", background: "rgba(0,255,136,0.01)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs tracking-[0.3em] mb-3" style={{ color: "rgba(0,255,136,0.5)" }}>ЧЕСТЕН ПРЕГЛЕД</div>
            <h2 className="text-3xl font-bold">Какво засича. Какво не може.</h2>
            <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.35)" }}>Системата е проектирана да е честна с оператора си.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Detected */}
            <div style={{ border: "1px solid rgba(0,255,136,0.15)", background: "rgba(0,255,136,0.02)" }}>
              <div className="px-6 py-3 text-xs font-bold tracking-widest flex items-center gap-2" style={{ borderBottom: "1px solid rgba(0,255,136,0.1)", color: "#00ff88" }}>
                <span>●</span> ЗАСИЧА — ПОТВЪРДЕНО
              </div>
              <div className="p-6 space-y-3">
                {[
                  ["DJI Mini 3 Pro",     "Remote ID BLE — пълна телеметрия"],
                  ["DJI Mini 4 Pro",     "Remote ID BLE — пълна телеметрия"],
                  ["DJI Air 3 / Air 3S", "Remote ID BLE — пълна телеметрия"],
                  ["DJI Mavic 3",        "Remote ID BLE — пълна телеметрия"],
                  ["DJI Avata 2",        "Remote ID BLE — пълна телеметрия"],
                  ["FPV дрони (ELRS)",   "RF 433/868/915 MHz — присъствие"],
                  ["DJI в Wi-Fi режим",  "Wi-Fi MAC — присъствие"],
                  ["RC контролери DJI",  "Wi-Fi MAC — оператор локация"],
                ].map(([model, detail]) => (
                  <div key={model} className="flex items-start justify-between gap-4 text-sm">
                    <span style={{ color: "rgba(255,255,255,0.8)" }}>{model}</span>
                    <span className="text-xs text-right shrink-0" style={{ color: "rgba(0,255,136,0.6)" }}>{detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Not detected */}
            <div style={{ border: "1px solid rgba(255,80,80,0.15)", background: "rgba(255,80,80,0.02)" }}>
              <div className="px-6 py-3 text-xs font-bold tracking-widest flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,80,80,0.1)", color: "#ff5050" }}>
                <span>●</span> НЕ МОЖЕ ДА ЗАСЕЧЕ
              </div>
              <div className="p-6 space-y-3">
                {[
                  ["DJI Mini 2 / Mini SE", "249g — без Remote ID, OcuSync proprietary"],
                  ["DJI Phantom 4 (стар)", "Без Remote ID, стар OcuSync"],
                  ["DJI FPV Gen 1",        "Без Remote ID"],
                  ["Военни дрони",         "Криптирани, frequency hopping"],
                  ["Правителствени дрони", "Spread spectrum, скрити протоколи"],
                  ["Самоделни без RID",    "Зависи от хардуера"],
                  ["Silent gliders",       "Минимална RF емисия"],
                ].map(([model, reason]) => (
                  <div key={model} className="flex items-start justify-between gap-4 text-sm">
                    <span style={{ color: "rgba(255,255,255,0.8)" }}>{model}</span>
                    <span className="text-xs text-right shrink-0" style={{ color: "rgba(255,80,80,0.6)" }}>{reason}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-5">
                <div className="text-xs p-3 mt-2" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", color: "rgba(245,158,11,0.8)" }}>
                  ⚠ DJI Mini 2 е проектиран на точно 249g — под Remote ID прага. RF спектърът дава подозрение, не потвърждение.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(0,255,136,0.08)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs tracking-[0.3em] mb-3" style={{ color: "rgba(0,255,136,0.5)" }}>ПЛАТФОРМА</div>
            <h2 className="text-3xl font-bold">Проектирана за реална употреба</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Self-hosted", body: "Данните не напускат мрежата ви. Без облак. Без абонамент за съхранение.", icon: "🔒" },
              { title: "Telegram алерти", body: "Незабавно известие при навлизане в зоната. Снимка на радара с позиция.", icon: "📡" },
              { title: "Geofence зони", body: "Конфигурируем периметър. Аларма при нарушаване в реално време.", icon: "⬡" },
              { title: "История на инциденти", body: "Всяка детекция се записва с timestamp, координати и RF данни.", icon: "📋" },
              { title: "Роли: Admin / Operator", body: "Администраторът конфигурира. Операторът наблюдава.", icon: "👥" },
              { title: "Автономна 24/7", body: "Работи на Raspberry Pi без надзор. Рестартира сама при проблем.", icon: "⚡" },
              { title: "RF Fingerprinting", body: "ML модел различава видове сигнали от шума. Намалява false positives.", icon: "🧠" },
              { title: "Multi-device", body: "Управление на множество хардуерни устройства от един dashboard.", icon: "🗗" },
            ].map(({ title, body, icon }) => (
              <div key={title} className="p-5 transition-all" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,255,136,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
              >
                <div className="text-2xl mb-3">{icon}</div>
                <div className="text-sm font-bold mb-2">{title}</div>
                <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HARDWARE */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(0,255,136,0.08)", background: "rgba(0,0,0,0.3)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs tracking-[0.3em] mb-3" style={{ color: "rgba(0,255,136,0.5)" }}>ХАРДУЕР</div>
            <h2 className="text-3xl font-bold">Работи на стандартен хардуер</h2>
            <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.35)" }}>Без proprietary устройства. Всеки компонент е достъпен и заменяем.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {[
              { name: "Raspberry Pi 4", role: "Централен процесор", spec: "4-core ARM · 4GB RAM · 24/7", color: "#00ff88" },
              { name: "HackRF One", role: "RF Спектър 1MHz–6GHz", spec: "SDR · 20 MSPS · Пасивен", color: "#0ea5e9" },
              { name: "Nordic nRF52840", role: "Remote ID / BLE декодер", spec: "ASTM F3411 · hci_usb", color: "#a78bfa" },
            ].map(({ name, role, spec, color }) => (
              <div key={name} className="p-6 text-center" style={{ border: `1px solid ${color}22`, background: `${color}05` }}>
                <div className="text-2xl font-bold mb-2" style={{ color }}>{name}</div>
                <div className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>{role}</div>
                <div className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>{spec}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center grid-bg" style={{ borderTop: "1px solid rgba(0,255,136,0.08)" }}>
        <div className="max-w-2xl mx-auto">
          <StatusDot />
          <h2 className="text-4xl font-bold mt-6 mb-4">Готови за защита?</h2>
          <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
            Свържете се с нас за демонстрация или влезте директно ако вече имате достъп.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate("/login")}
              className="px-10 py-3 text-sm font-bold tracking-widest transition-all"
              style={{ background: "#00ff88", color: "#020814" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#00e87a")}
              onMouseLeave={e => (e.currentTarget.style.background = "#00ff88")}
            >
              ВХОД В СИСТЕМАТА →
            </button>
            <a
              href="mailto:contact@dronexit.com"
              className="px-10 py-3 text-sm tracking-widest transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,255,136,0.4)"; e.currentTarget.style.color = "#00ff88"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
            >
              КОНТАКТ
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-6" style={{ borderTop: "1px solid rgba(0,255,136,0.06)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusDot />
            <span className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>SKYGUARD OS © 2026</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
            <span className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>DRONEXIT.COM</span>
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
            Self-hosted · No cloud · Your data stays yours
          </span>
        </div>
      </footer>
    </div>
  );
}
