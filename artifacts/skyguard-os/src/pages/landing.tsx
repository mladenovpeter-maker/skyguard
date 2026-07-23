import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";

// ─── Animated radar canvas ──────────────────────────────────────────────────
function RadarScope() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const dotsRef = useRef([
    { angle: 0.8, dist: 0.45, size: 3 },
    { angle: 2.1, dist: 0.62, size: 2.5 },
    { angle: 4.5, dist: 0.3,  size: 2 },
    { angle: 5.2, dist: 0.7,  size: 3.5 },
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    function draw() {
      const W = canvas!.width, H = canvas!.height;
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) / 2 - 2;

      ctx.fillStyle = "rgba(2, 8, 20, 0.18)";
      ctx.fillRect(0, 0, W, H);

      // Grid circles
      ctx.strokeStyle = "rgba(0,255,136,0.08)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2); ctx.stroke();
      }

      // Cross hairs
      ctx.strokeStyle = "rgba(0,255,136,0.06)";
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();

      // Sweep trail
      const a = angleRef.current;
      for (let i = 0; i < 60; i++) {
        const trailA = a - (i * Math.PI) / 60;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, trailA - Math.PI / 60, trailA);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,255,136,${(1 - i / 60) * 0.35})`;
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
        const alpha = swept < 0.02 ? 1 : Math.max(0, 1 - swept * 3);
        if (alpha <= 0) return;
        const dx = cx + Math.cos(dot.angle) * dot.dist * R;
        const dy = cy + Math.sin(dot.angle) * dot.dist * R;
        ctx.beginPath(); ctx.arc(dx, dy, dot.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,80,80,${alpha})`; ctx.fill();
        if (alpha > 0.4) {
          ctx.beginPath(); ctx.arc(dx, dy, dot.size + 5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,80,80,${alpha * 0.35})`; ctx.lineWidth = 1; ctx.stroke();
        }
      });

      // Outer ring + ticks
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,255,136,0.25)"; ctx.lineWidth = 1.5; ctx.stroke();
      for (let i = 0; i < 36; i++) {
        const tickA = (i * Math.PI * 2) / 36;
        const inner = i % 3 === 0 ? R - 10 : R - 5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(tickA) * inner, cy + Math.sin(tickA) * inner);
        ctx.lineTo(cx + Math.cos(tickA) * R, cy + Math.sin(tickA) * R);
        ctx.strokeStyle = "rgba(0,255,136,0.3)"; ctx.lineWidth = 1; ctx.stroke();
      }

      angleRef.current = (a + 0.025) % (Math.PI * 2);
      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={400} height={400} className="w-full h-full" />;
}

// ─── DronExit logo SVG ───────────────────────────────────────────────────────
function DronExitLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer hex ring */}
      <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#00ff88" strokeWidth="1.2" fill="none" opacity="0.6"/>
      {/* Inner circle — radar */}
      <circle cx="16" cy="16" r="7" stroke="#00ff88" strokeWidth="1" fill="none" opacity="0.4"/>
      {/* Cross hairs */}
      <line x1="16" y1="9" x2="16" y2="23" stroke="#00ff88" strokeWidth="0.6" opacity="0.4"/>
      <line x1="9" y1="16" x2="23" y2="16" stroke="#00ff88" strokeWidth="0.6" opacity="0.4"/>
      {/* Drone silhouette — 4 arms + body */}
      <circle cx="16" cy="16" r="2.2" fill="#00ff88"/>
      <line x1="16" y1="16" x2="11" y2="11" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="16" y1="16" x2="21" y2="11" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="16" y1="16" x2="11" y2="21" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="16" y1="16" x2="21" y2="21" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round"/>
      {/* Rotor circles */}
      <circle cx="10.5" cy="10.5" r="2.2" stroke="#00ff88" strokeWidth="0.8" fill="none" opacity="0.7"/>
      <circle cx="21.5" cy="10.5" r="2.2" stroke="#00ff88" strokeWidth="0.8" fill="none" opacity="0.7"/>
      <circle cx="10.5" cy="21.5" r="2.2" stroke="#00ff88" strokeWidth="0.8" fill="none" opacity="0.7"/>
      <circle cx="21.5" cy="21.5" r="2.2" stroke="#00ff88" strokeWidth="0.8" fill="none" opacity="0.7"/>
      {/* Target pip */}
      <circle cx="21.5" cy="10.5" r="1" fill="#ff5050" opacity="0.9"/>
    </svg>
  );
}

// ─── Blinking dot ────────────────────────────────────────────────────────────
function StatusDot({ color = "#00ff88" }: { color?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setInterval(() => setOn(v => !v), 800); return () => clearInterval(t); }, []);
  return <span className="inline-block w-2 h-2 rounded-full transition-colors duration-100" style={{ backgroundColor: on ? color : "transparent", border: `1px solid ${color}` }} />;
}

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let v = 0; const step = to / 40;
    const t = setInterval(() => { v += step; if (v >= to) { setVal(to); clearInterval(t); } else setVal(Math.floor(v)); }, 30);
    return () => clearInterval(t);
  }, [to]);
  return <>{val}{suffix}</>;
}

// ─── WOW CTA button ──────────────────────────────────────────────────────────
function CtaButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative group overflow-hidden"
      style={{
        padding: "14px 40px",
        background: hovered ? "rgba(0,255,136,0.12)" : "transparent",
        border: "1px solid transparent",
        backgroundClip: "padding-box",
        transition: "all 0.3s ease",
      }}
    >
      {/* Animated gradient border */}
      <span
        className="absolute inset-0 rounded-none"
        style={{
          background: "linear-gradient(90deg, #00ff88, #0ea5e9, #a78bfa, #00ff88)",
          backgroundSize: "300% 100%",
          animation: "gradientShift 3s linear infinite",
          padding: "1px",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      {/* Glow */}
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: "radial-gradient(ellipse at center, rgba(0,255,136,0.15) 0%, transparent 70%)" }}
      />
      {/* Text */}
      <span
        className="relative flex items-center gap-3 text-sm font-bold tracking-[0.25em]"
        style={{ color: "#00ff88" }}
      >
        <span
          className="flex items-center gap-1"
          style={{
            transform: hovered ? "translateX(4px)" : "translateX(0)",
            transition: "transform 0.3s ease",
          }}
        >
          ВЛЕЗ В СИСТЕМАТА
          <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
        </span>
      </span>
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#020814", fontFamily: "'Space Mono','Courier New',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        .grid-bg {
          background-image: linear-gradient(rgba(0,255,136,0.03) 1px,transparent 1px),
                            linear-gradient(90deg,rgba(0,255,136,0.03) 1px,transparent 1px);
          background-size: 40px 40px;
        }
        @keyframes gradientShift { 0%{background-position:0% 50%} 100%{background-position:300% 50%} }
        @keyframes pulseRing {
          0%  { transform:scale(1);   opacity:0.6; }
          100%{ transform:scale(1.8); opacity:0;   }
        }
        .pulse-ring::before {
          content:''; position:absolute; inset:-6px; border:1px solid rgba(0,255,136,0.4);
          border-radius:9999px; animation:pulseRing 2s ease-out infinite;
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50" style={{ background:"rgba(2,8,20,0.92)", borderBottom:"1px solid rgba(0,255,136,0.1)", backdropFilter:"blur(10px)" }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <StatusDot />
            <DronExitLogo size={28} />
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold tracking-[0.2em]" style={{ color:"#00ff88" }}>DRONEXIT</span>
              <span className="text-xs" style={{ color:"rgba(255,255,255,0.2)", letterSpacing:"0.15em" }}>DRONE DETECTION</span>
            </div>
          </div>
          {/* Nav right */}
          <div className="flex items-center gap-6">
            <span className="text-xs hidden sm:block" style={{ color:"rgba(0,255,136,0.4)" }}>dronexit.com</span>
            <button
              onClick={() => navigate("/login")}
              className="relative text-xs font-bold tracking-widest px-5 py-2 overflow-hidden group"
              style={{ border:"1px solid rgba(0,255,136,0.35)", color:"#00ff88" }}
              onMouseEnter={e => { e.currentTarget.style.background="rgba(0,255,136,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.background="transparent"; }}
            >
              ВХОД →
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="grid-bg relative pt-14 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center w-full">

          {/* Left */}
          <div>
            <div className="flex items-center gap-2 mb-8">
              <StatusDot />
              <span className="text-xs tracking-[0.3em]" style={{ color:"rgba(0,255,136,0.7)" }}>СИСТЕМА АКТИВНА — 24/7</span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span style={{ color:"rgba(255,255,255,0.95)" }}>Знайте кога</span><br />
              <span style={{ color:"#00ff88", textShadow:"0 0 40px rgba(0,255,136,0.4)" }}>дрон навлиза</span><br />
              <span style={{ color:"rgba(255,255,255,0.95)" }}>в имота ви.</span>
            </h1>

            <p className="text-sm leading-relaxed mb-10 max-w-lg" style={{ color:"rgba(255,255,255,0.4)" }}>
              Три независими сензора — Remote ID, RF спектър, Wi-Fi — работят едновременно, 24/7.
              Всичко е на вашия хардуер. Без облак. Без абонамент.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-10">
              {[
                { n:6000, suf:" MHz", label:"RF диапазон" },
                { n:100,  suf:"%",   label:"Remote ID точност" },
                { n:24,   suf:"/7",  label:"Автономна" },
              ].map(({ n, suf, label }) => (
                <div key={label} className="p-4" style={{ border:"1px solid rgba(0,255,136,0.12)", background:"rgba(0,255,136,0.02)" }}>
                  <div className="text-2xl font-bold" style={{ color:"#00ff88" }}><Counter to={n} suffix={suf} /></div>
                  <div className="text-xs mt-1" style={{ color:"rgba(255,255,255,0.3)", letterSpacing:"0.15em" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* WOW CTA */}
            <div className="flex items-center gap-6 flex-wrap">
              <CtaButton onClick={() => navigate("/login")} />
              <a href="mailto:contact@dronexit.com" className="text-xs tracking-widest transition-colors" style={{ color:"rgba(255,255,255,0.3)" }}
                onMouseEnter={e => (e.currentTarget.style.color="#00ff88")}
                onMouseLeave={e => (e.currentTarget.style.color="rgba(255,255,255,0.3)")}
              >КОНТАКТ</a>
            </div>
          </div>

          {/* Right — Radar + log */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width:360, height:360 }}>
              <RadarScope />
              {["N","E","S","W"].map((d,i) => {
                const pos: Record<string,React.CSSProperties> = {
                  N:{ top:4, left:"50%", transform:"translateX(-50%)" },
                  E:{ top:"50%", right:4, transform:"translateY(-50%)" },
                  S:{ bottom:4, left:"50%", transform:"translateX(-50%)" },
                  W:{ top:"50%", left:4, transform:"translateY(-50%)" },
                };
                return <div key={d} className="absolute text-xs" style={{ ...pos[d], color:"rgba(0,255,136,0.4)", letterSpacing:"0.2em" }}>{d}</div>;
              })}
              {/* DronExit watermark inside radar */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xs font-bold" style={{ color:"rgba(0,255,136,0.08)", letterSpacing:"0.4em" }}>DRONEXIT</span>
              </div>
            </div>

            {/* Detection feed */}
            <div className="w-full" style={{ border:"1px solid rgba(0,255,136,0.12)", background:"rgba(2,8,20,0.8)" }}>
              <div className="px-3 py-2 text-xs tracking-widest flex items-center gap-2" style={{ color:"rgba(0,255,136,0.5)", borderBottom:"1px solid rgba(0,255,136,0.08)" }}>
                <StatusDot /> DETECTION LOG
              </div>
              {[
                { time:"21:34:07", type:"REMOTE ID", id:"DJI-Mini4Pro",    dist:"340m", color:"#ff5050" },
                { time:"21:31:22", type:"RF 433MHz",  id:"ELRS-RC",         dist:"—",    color:"#f59e0b" },
                { time:"21:28:55", type:"REMOTE ID", id:"Mavic3-Classic",  dist:"820m", color:"#ff5050" },
              ].map(({ time, type, id, dist, color }) => (
                <div key={time} className="px-3 py-2 flex items-center gap-3 text-xs" style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ color:"rgba(255,255,255,0.25)", minWidth:64 }}>{time}</span>
                  <span className="px-1.5 py-0.5 text-xs font-bold shrink-0" style={{ background:`${color}22`, color, border:`1px solid ${color}44` }}>{type}</span>
                  <span className="flex-1" style={{ color:"rgba(255,255,255,0.6)" }}>{id}</span>
                  <span style={{ color:"rgba(255,255,255,0.25)" }}>{dist}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── THREE SENSORS ────────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ borderTop:"1px solid rgba(0,255,136,0.08)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs tracking-[0.3em] mb-3" style={{ color:"rgba(0,255,136,0.5)" }}>АРХИТЕКТУРА</div>
            <h2 className="text-3xl font-bold">Три независими сензора</h2>
            <p className="text-sm mt-3 max-w-xl mx-auto" style={{ color:"rgba(255,255,255,0.35)" }}>Повредата на един не спира останалите. Всеки засича различен тип заплаха.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {[
              { num:"01", title:"Remote ID / BLE", color:"#00ff88", tech:"Nordic nRF52840", badge:"ТОЧЕН", badgeColor:"#00ff88",
                items:["Чете ASTM F3411 стандарт по Bluetooth","Дава: GPS позиция на дрона","Дава: GPS позиция на пилота","Дава: сериен номер, скорост, altitude","100% надеждно за съвместими дрони"] },
              { num:"02", title:"RF Спектър 400MHz–6GHz", color:"#0ea5e9", tech:"HackRF One SDR", badge:"ИНДИКАЦИЯ", badgeColor:"#f59e0b",
                items:["Пасивен мониторинг без излъчване","Засича: RC сигнали 433/868/915 MHz","Засича: DJI OcuSync 2.4G и 5.8G","ML RF fingerprinting модел","Присъствие — без GPS позиция"] },
              { num:"03", title:"Wi-Fi Разузнаване", color:"#a78bfa", tech:"USB Wi-Fi Adapter", badge:"ОПЕРАТОР", badgeColor:"#a78bfa",
                items:["802.11 monitor mode — пасивен","Засича DJI дрони в Wi-Fi Direct режим","Засича RC контролери по MAC адрес","Засича probe requests от оператора","Неизвестни устройства в района"] },
            ].map(({ num, title, color, tech, items, badge, badgeColor }) => (
              <div key={num} className="p-6 transition-all" style={{ border:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.01)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${color}30`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
              >
                <div className="flex items-start justify-between mb-5">
                  <span className="text-4xl font-bold" style={{ color:"rgba(255,255,255,0.05)" }}>{num}</span>
                  <span className="text-xs px-2 py-1 font-bold tracking-widest" style={{ background:`${badgeColor}18`, color:badgeColor, border:`1px solid ${badgeColor}40` }}>{badge}</span>
                </div>
                <div className="text-lg font-bold mb-1" style={{ color }}>{title}</div>
                <div className="text-xs mb-5" style={{ color:"rgba(255,255,255,0.25)", letterSpacing:"0.15em" }}>{tech}</div>
                <div className="space-y-2.5">
                  {items.map(item => (
                    <div key={item} className="flex items-start gap-2 text-xs" style={{ color:"rgba(255,255,255,0.5)" }}>
                      <span style={{ color, marginTop:2 }}>›</span>{item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HONEST BREAKDOWN ─────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ borderTop:"1px solid rgba(0,255,136,0.08)", background:"rgba(0,255,136,0.01)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs tracking-[0.3em] mb-3" style={{ color:"rgba(0,255,136,0.5)" }}>ЧЕСТЕН ПРЕГЛЕД</div>
            <h2 className="text-3xl font-bold">Какво засича. Какво не може.</h2>
            <p className="text-sm mt-3" style={{ color:"rgba(255,255,255,0.35)" }}>Проектирана да е честна с оператора си.</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            <div style={{ border:"1px solid rgba(0,255,136,0.15)", background:"rgba(0,255,136,0.02)" }}>
              <div className="px-6 py-3 text-xs font-bold tracking-widest flex items-center gap-2" style={{ borderBottom:"1px solid rgba(0,255,136,0.1)", color:"#00ff88" }}>
                <StatusDot /> ЗАСИЧА — ПОТВЪРДЕНО
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
                    <span style={{ color:"rgba(255,255,255,0.8)" }}>{model}</span>
                    <span className="text-xs text-right shrink-0" style={{ color:"rgba(0,255,136,0.6)" }}>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ border:"1px solid rgba(255,80,80,0.15)", background:"rgba(255,80,80,0.02)" }}>
              <div className="px-6 py-3 text-xs font-bold tracking-widest flex items-center gap-2" style={{ borderBottom:"1px solid rgba(255,80,80,0.1)", color:"#ff5050" }}>
                <StatusDot color="#ff5050" /> НЕ МОЖЕ ДА ЗАСЕЧЕ
              </div>
              <div className="p-6 space-y-3">
                {[
                  ["DJI Mini 2 / Mini SE", "249g — без Remote ID, OcuSync proprietary"],
                  ["DJI Phantom 4 (стар)", "Без Remote ID, стар OcuSync"],
                  ["DJI FPV Gen 1",        "Без Remote ID"],
                  ["Военни дрони",         "Криптирани, frequency hopping"],
                  ["Самоделни без RID",    "Зависи от хардуера"],
                  ["Silent gliders",       "Минимална RF емисия"],
                ].map(([model, reason]) => (
                  <div key={model} className="flex items-start justify-between gap-4 text-sm">
                    <span style={{ color:"rgba(255,255,255,0.8)" }}>{model}</span>
                    <span className="text-xs text-right shrink-0" style={{ color:"rgba(255,80,80,0.6)" }}>{reason}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-5">
                <div className="text-xs p-3" style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)", color:"rgba(245,158,11,0.8)" }}>
                  ⚠ DJI Mini 2 е точно 249g — под Remote ID прага. RF дава подозрение, не потвърждение.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ borderTop:"1px solid rgba(0,255,136,0.08)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs tracking-[0.3em] mb-3" style={{ color:"rgba(0,255,136,0.5)" }}>ПЛАТФОРМА</div>
            <h2 className="text-3xl font-bold">Проектирана за реална употреба</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title:"Self-hosted",       body:"Данните не напускат мрежата ви. Без облак. Без абонамент.",              icon:"🔒" },
              { title:"Telegram алерти",   body:"Незабавно известие при навлизане. Снимка на радара с позиция.",           icon:"📡" },
              { title:"Geofence зони",     body:"Конфигурируем периметър. Аларма при нарушаване в реално време.",          icon:"⬡"  },
              { title:"История",           body:"Всяка детекция записана с timestamp, координати и RF данни.",             icon:"📋" },
              { title:"Admin / Operator",  body:"Администраторът конфигурира. Операторът наблюдава.",                     icon:"👥" },
              { title:"Автономна 24/7",    body:"Работи на Raspberry Pi без надзор. Рестартира при проблем.",              icon:"⚡" },
              { title:"RF Fingerprinting", body:"ML модел различава дрон-сигнали от шума. Намалява false positives.",      icon:"🧠" },
              { title:"Multi-sensor",      body:"Три независими канала — повредата на един не спира системата.",           icon:"◈"  },
            ].map(({ title, body, icon }) => (
              <div key={title} className="p-5 transition-all" style={{ border:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.01)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor="rgba(0,255,136,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor="rgba(255,255,255,0.06)")}
              >
                <div className="text-2xl mb-3">{icon}</div>
                <div className="text-sm font-bold mb-2">{title}</div>
                <div className="text-xs leading-relaxed" style={{ color:"rgba(255,255,255,0.35)" }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HARDWARE ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ borderTop:"1px solid rgba(0,255,136,0.08)", background:"rgba(0,0,0,0.3)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs tracking-[0.3em] mb-3" style={{ color:"rgba(0,255,136,0.5)" }}>ХАРДУЕР</div>
            <h2 className="text-3xl font-bold">Работи на стандартен хардуер</h2>
            <p className="text-sm mt-3" style={{ color:"rgba(255,255,255,0.35)" }}>Без proprietary устройства. Всеки компонент е достъпен и заменяем.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {[
              { name:"Raspberry Pi 4", role:"Централен процесор", spec:"4-core ARM · 4GB RAM · 24/7", color:"#00ff88" },
              { name:"HackRF One",     role:"RF Спектър 1MHz–6GHz",     spec:"SDR · 20 MSPS · Пасивен",   color:"#0ea5e9" },
              { name:"Nordic nRF52840",role:"Remote ID / BLE декодер",  spec:"ASTM F3411 · hci_usb",      color:"#a78bfa" },
            ].map(({ name, role, spec, color }) => (
              <div key={name} className="p-6 text-center" style={{ border:`1px solid ${color}22`, background:`${color}05` }}>
                <div className="text-2xl font-bold mb-2" style={{ color }}>{name}</div>
                <div className="text-sm mb-1" style={{ color:"rgba(255,255,255,0.6)" }}>{role}</div>
                <div className="text-xs tracking-widest" style={{ color:"rgba(255,255,255,0.25)" }}>{spec}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 text-center grid-bg" style={{ borderTop:"1px solid rgba(0,255,136,0.08)" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-center mb-8">
            <div className="relative pulse-ring">
              <DronExitLogo size={56} />
            </div>
          </div>
          <h2 className="text-4xl font-bold mt-4 mb-4">Готови за защита?</h2>
          <p className="text-sm mb-10" style={{ color:"rgba(255,255,255,0.35)" }}>
            Свържете се за демонстрация или влезте директно ако имате достъп.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <CtaButton onClick={() => navigate("/login")} />
            <a href="mailto:contact@dronexit.com"
              className="text-sm tracking-widest px-8 py-3 transition-all"
              style={{ border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(0,255,136,0.35)"; e.currentTarget.style.color="#00ff88"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.1)"; e.currentTarget.style.color="rgba(255,255,255,0.4)"; }}
            >КОНТАКТ</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="py-8 px-6" style={{ borderTop:"1px solid rgba(0,255,136,0.06)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <DronExitLogo size={18} />
            <span className="text-xs tracking-widest" style={{ color:"rgba(255,255,255,0.2)" }}>DRONEXIT © 2026</span>
          </div>
          <span className="text-xs" style={{ color:"rgba(255,255,255,0.15)" }}>Self-hosted · No cloud · Your data stays yours</span>
        </div>
      </footer>
    </div>
  );
}
