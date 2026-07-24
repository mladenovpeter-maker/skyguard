import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

// ─── constants ───────────────────────────────────────────────────────────────
const BLUE = "#1A6BFF";
const BLUE_DIM = "rgba(26,107,255,0.12)";
const BLUE_GLOW = "rgba(26,107,255,0.25)";

// ─── Radar ring background ───────────────────────────────────────────────────
function RadarWaves() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <style>{`
        @keyframes radarExpand {
          0%   { transform:scale(0.3); opacity:0.18; }
          100% { transform:scale(2.2); opacity:0; }
        }
        .radar-ring {
          position:absolute; border-radius:50%;
          border:1px solid rgba(26,107,255,0.3);
          top:50%; left:50%;
          transform:translate(-50%,-50%);
          animation: radarExpand 4s ease-out infinite;
        }
      `}</style>
      {[0, 1.3, 2.6].map(delay => (
        <div key={delay} className="radar-ring" style={{ width: 600, height: 600, animationDelay: `${delay}s`, marginLeft: -300, marginTop: -300 }} />
      ))}
    </div>
  );
}

// ─── Reveal on scroll ────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, y = 32 }: { children: React.ReactNode; delay?: number; y?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ id, children, style }: { id?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section id={id} style={{ padding: "120px 0", ...style }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
        {children}
      </div>
    </section>
  );
}

// ─── Eye-brow label ──────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
      <div style={{ width: 20, height: 1, background: BLUE }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: BLUE }}>
        {children}
      </span>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [, nav] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const imgY = useTransform(scrollY, [0, 600], [0, 60]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={{ background: "#080808", color: "#fff", fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        a { color: inherit; text-decoration: none; }

        @keyframes floatProduct {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%       { transform: translateY(-18px) rotate(1deg); }
        }
        @keyframes subtlePulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1; transform: scale(1.04); }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

        .nav-link {
          font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.5);
          cursor: pointer; transition: color 0.15s; background: none; border: none; font-family: inherit;
        }
        .nav-link:hover { color: #fff; }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: ${BLUE}; color: #fff;
          font-size: 14px; font-weight: 600; letter-spacing: 0.01em;
          padding: 14px 32px; border: none; cursor: pointer;
          border-radius: 12px; transition: all 0.2s; font-family: inherit;
        }
        .btn-primary:hover { background: #2d7fff; transform: translateY(-1px); box-shadow: 0 8px 32px rgba(26,107,255,0.4); }

        .btn-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7);
          font-size: 14px; font-weight: 500;
          padding: 14px 32px; border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer; border-radius: 12px; transition: all 0.2s; font-family: inherit;
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.25); }

        .feature-card {
          padding: 32px; border-radius: 20px;
          background: #111; border: 1px solid rgba(255,255,255,0.06);
          transition: all 0.3s;
        }
        .feature-card:hover {
          border-color: rgba(26,107,255,0.3);
          background: linear-gradient(135deg, #111 0%, rgba(26,107,255,0.06) 100%);
          transform: translateY(-3px);
        }

        .metric-card {
          padding: 40px 32px; border-radius: 20px;
          background: #111; border: 1px solid rgba(255,255,255,0.06);
          text-align: center;
        }

        .use-card {
          position: relative; overflow: hidden; border-radius: 20px;
          background: #111; border: 1px solid rgba(255,255,255,0.06);
          height: 280px; cursor: default;
          transition: transform 0.3s, border-color 0.3s;
        }
        .use-card:hover { transform: translateY(-4px); border-color: rgba(26,107,255,0.25); }

        .hotspot {
          position: absolute; width: 28px; height: 28px; border-radius: 50%;
          background: ${BLUE_DIM}; border: 1.5px solid ${BLUE};
          display: flex; align-items: center; justify-content: center;
          cursor: default; transition: all 0.2s;
          animation: subtlePulse 2.5s ease-in-out infinite;
        }
        .hotspot:hover { background: rgba(26,107,255,0.25); transform: scale(1.15); }
        .hotspot-dot { width: 8px; height: 8px; border-radius: 50%; background: ${BLUE}; }

        .timeline-step {
          display: flex; align-items: flex-start; gap: 24px;
        }
        .timeline-line {
          width: 1px; flex-shrink: 0; margin: 0 auto;
          background: linear-gradient(to bottom, ${BLUE}, transparent);
        }

        .price-card {
          border-radius: 24px; background: #111;
          border: 1px solid rgba(255,255,255,0.08);
          padding: 56px; max-width: 560px; margin: 0 auto;
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        height: 60, padding: "0 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(8,8,8,0.88)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "all 0.4s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke={BLUE} strokeWidth="1.5" fill="none"/>
            <circle cx="16" cy="16" r="8"  stroke={BLUE} strokeWidth="1"   fill="none" opacity="0.5"/>
            <circle cx="16" cy="16" r="3"  fill={BLUE}/>
            <line x1="16" y1="2"  x2="16" y2="10" stroke={BLUE} strokeWidth="1.5"/>
            <circle cx="21.5" cy="10.5" r="1.8" fill="#ff4040"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.04em" }}>DronExit</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {["features","hardware","pricing"].map(id => (
            <button key={id} className="nav-link" onClick={() => scrollTo(id)} style={{ textTransform: "capitalize" }}>{id}</button>
          ))}
          <button className="nav-link" onClick={() => scrollTo("contact")}>Contact</button>
          <button className="btn-primary" style={{ padding: "9px 22px", fontSize: 13, borderRadius: 10 }} onClick={() => nav("/login")}>
            Dashboard →
          </button>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <div ref={heroRef} style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden", paddingTop: 60 }}>
        {/* Background glow */}
        <div style={{ position: "absolute", top: "30%", right: "10%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,107,255,0.09) 0%, transparent 70%)", pointerEvents: "none" }} />
        <RadarWaves />

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          {/* Left */}
          <div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.25,0.1,0.25,1] }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: BLUE_DIM, border: `1px solid rgba(26,107,255,0.25)`, borderRadius: 100, padding: "6px 14px", marginBottom: 32 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: BLUE, display: "inline-block", animation: "blink 1.2s step-end infinite" }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: BLUE }}>PASSIVE DETECTION · LIVE</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.25,0.1,0.25,1] }}
              style={{ fontSize: "clamp(52px,5.5vw,80px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.0, marginBottom: 24 }}
            >
              Protect Your<br />
              <span style={{ color: BLUE }}>Airspace.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{ fontSize: 18, fontWeight: 300, lineHeight: 1.7, color: "rgba(255,255,255,0.45)", maxWidth: 420, marginBottom: 16 }}
            >
              Know the moment a drone appears near your property.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.28 }}
              style={{ marginBottom: 48 }}
            >
              {["No cloud.", "No subscription.", "100% local processing."].map(t => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke={BLUE} strokeWidth="1.2"/><path d="M4 7l2 2 4-4" stroke={BLUE} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>{t}</span>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              style={{ display: "flex", gap: 14 }}
            >
              <button className="btn-primary" onClick={() => scrollTo("pricing")}>Buy Now — €999</button>
              <button className="btn-ghost" onClick={() => scrollTo("how-it-works")}>How It Works</button>
            </motion.div>
          </div>

          {/* Right — product */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.15, ease: [0.25,0.1,0.25,1] }}
            style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}
          >
            {/* Glow behind */}
            <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: `radial-gradient(circle, ${BLUE_GLOW} 0%, transparent 70%)`, pointerEvents: "none" }} />
            <motion.div style={{ y: imgY }}>
              <div style={{ animation: "floatProduct 5s ease-in-out infinite", position: "relative" }}>
                <img
                  src={`${import.meta.env.BASE_URL}dronexit_deck_edit.jpg`}
                  alt="DronExit hardware"
                  style={{ width: 480, height: 480, objectFit: "cover", objectPosition: "center 20%", borderRadius: 24, display: "block", boxShadow: `0 40px 120px rgba(0,0,0,0.7), 0 0 60px ${BLUE_GLOW}` }}
                />
                {/* DronExit logo overlay */}
                <div style={{
                  position: "absolute",
                  top: "33%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                  pointerEvents: "none",
                }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <path d="M24 5L8 12v13c0 10.2 7.3 19.8 16 22 8.7-2.2 16-11.8 16-22V12L24 5z"
                      fill="rgba(26,107,255,0.15)" stroke="rgba(26,107,255,0.7)" strokeWidth="1.6"/>
                    <circle cx="24" cy="23" r="6" fill="none" stroke="rgba(26,107,255,0.6)" strokeWidth="1.2"/>
                    <circle cx="24" cy="23" r="2.5" fill="#1A6BFF"/>
                    <line x1="24" y1="17" x2="24" y2="23" stroke="#1A6BFF" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="24" y1="23" x2="29" y2="18" stroke="#1A6BFF" strokeWidth="1.3" strokeLinecap="round"/>
                    <circle cx="29.5" cy="17.5" r="2.5" fill="#ff4444"/>
                  </svg>
                  <span style={{
                    fontSize: 14, fontWeight: 700, letterSpacing: "0.1em",
                    color: "rgba(30,30,30,0.85)",
                    fontFamily: "Inter,-apple-system,sans-serif",
                  }}>DronExit</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ── TRUST METRICS ────────────────────────────────────────────────── */}
      <Section id="features" style={{ padding: "80px 0", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2 }}>
          {[
            { val: "24/7",  label: "Monitoring" },
            { val: "100%",  label: "Local Processing" },
            { val: "€0",    label: "Monthly Fee" },
            { val: "1",     label: "Cable Installation" },
          ].map(({ val, label }, i) => (
            <Reveal key={label} delay={i * 0.08}>
              <div className="metric-card" style={{ borderRadius: 0, background: "transparent", border: "none", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1, marginBottom: 8 }}>{val}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>{label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── WHY DRONEXIT ─────────────────────────────────────────────────── */}
      <Section style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <Reveal><Label>Why DronExit</Label></Reveal>
          <Reveal delay={0.1}>
            <h2 style={{ fontSize: "clamp(36px,4vw,56px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
              Built for serious protection.
            </h2>
          </Reveal>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            { icon: "◎", title: "Passive RF Detection", body: "Scans 400 MHz – 6 GHz continuously. Detects DJI, FPV, and RC controllers by radio fingerprint — even without Remote ID." },
            { icon: "⊘", title: "Privacy First",        body: "No camera. No microphone. No cloud uploads. The system detects RF signals only. Your data never leaves your network." },
            { icon: "⬡", title: "No Cloud Required",    body: "Fully self-hosted on your hardware. Works without internet. No subscription, no vendor lock-in, no monthly fees." },
            { icon: "⚡", title: "PoE Installation",    body: "Single ethernet cable delivers both power and data. Mount anywhere. No electrician required." },
            { icon: "◈", title: "Instant Mobile Alerts",body: "Push notifications via Telegram or SMS the moment a drone is detected. Under 12 seconds from detection to alert." },
            { icon: "◇", title: "Professional Grade",   body: "Designed for homes, villas, warehouses, and commercial properties. Industrial enclosure. Runs 24/7 unattended." },
          ].map(({ icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <div className="feature-card">
                <div style={{ fontSize: 22, marginBottom: 20, color: BLUE }}>{icon}</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, letterSpacing: "-0.01em" }}>{title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.75, color: "rgba(255,255,255,0.4)", fontWeight: 300 }}>{body}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── PRODUCT SECTION ──────────────────────────────────────────────── */}
      <Section id="hardware" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          {/* Image with hotspots */}
          <Reveal y={20}>
            <div style={{ position: "relative", borderRadius: 24, overflow: "hidden" }}>
              <img
                src={`${import.meta.env.BASE_URL}skyguard_plastic_cutaway.jpg`}
                alt="DronExit internals"
                style={{ width: "100%", display: "block", borderRadius: 24 }}
              />
              {/* Hotspots */}
              {[
                { top: "18%", left: "24%", label: "HackRF Pro" },
                { top: "42%", left: "60%", label: "BLE Module" },
                { top: "65%", left: "35%", label: "Wi-Fi Monitor" },
                { top: "28%", left: "75%", label: "PoE Module" },
              ].map(({ top, left, label }) => (
                <div key={label} className="hotspot" style={{ top, left }} title={label}>
                  <div className="hotspot-dot" />
                </div>
              ))}
            </div>
          </Reveal>

          {/* Text */}
          <div>
            <Reveal><Label>Hardware</Label></Reveal>
            <Reveal delay={0.1}>
              <h2 style={{ fontSize: "clamp(32px,3.5vw,52px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 24 }}>
                Everything inside<br />one enclosure.
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p style={{ fontSize: 16, lineHeight: 1.8, color: "rgba(255,255,255,0.4)", marginBottom: 40, fontWeight: 300 }}>
                Every component is selected for reliability. Runs 24/7 at room temperature. No fan. No noise. No maintenance.
              </p>
            </Reveal>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { name: "HackRF Pro",       desc: "RF spectrum 400 MHz – 6 GHz" },
                { name: "Nordic nRF52840",  desc: "Remote ID / BLE decoder" },
                { name: "Wi-Fi Monitor",    desc: "Passive 802.11 detection" },
                { name: "PoE Module",       desc: "IEEE 802.3af — single cable" },
                { name: "Industrial Shell", desc: "IP54 rated enclosure" },
              ].map(({ name, desc }, i) => (
                <Reveal key={name} delay={0.18 + i * 0.06}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{desc}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <Section id="how-it-works" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <Reveal><Label>How It Works</Label></Reveal>
          <Reveal delay={0.1}>
            <h2 style={{ fontSize: "clamp(36px,4vw,56px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
              Detection in seconds.
            </h2>
          </Reveal>
        </div>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {[
            { n: "01", title: "Drone emits signal",       sub: "Every drone broadcasts RF energy — control link, video feed, or Remote ID beacon." },
            { n: "02", title: "DronExit captures it",     sub: "Three independent sensors scan continuously across all relevant frequencies." },
            { n: "03", title: "AI analysis on-device",    sub: "RF fingerprinting identifies the drone model and classifies the threat level locally." },
            { n: "04", title: "Instant alert sent",       sub: "You receive a push notification via Telegram or SMS within 12 seconds." },
            { n: "05", title: "Dashboard & mobile",       sub: "Full detection log with direction, signal type, confidence score, and timeline." },
          ].map(({ n, title, sub }, i) => (
            <Reveal key={n} delay={i * 0.1}>
              <div style={{ display: "flex", gap: 24, paddingBottom: 40, position: "relative" }}>
                {/* Line */}
                {i < 4 && <div style={{ position: "absolute", left: 19, top: 44, width: 1, bottom: 0, background: "linear-gradient(to bottom, rgba(26,107,255,0.4), transparent)" }} />}
                {/* Number circle */}
                <div style={{ width: 40, height: 40, borderRadius: "50%", border: `1.5px solid ${BLUE}`, background: BLUE_DIM, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: BLUE }}>{n}</span>
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, marginTop: 8 }}>{title}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.4)", fontWeight: 300 }}>{sub}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── DASHBOARD PREVIEW ────────────────────────────────────────────── */}
      <Section style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Reveal><Label>Live Dashboard</Label></Reveal>
          <Reveal delay={0.1}>
            <h2 style={{ fontSize: "clamp(36px,4vw,52px)", fontWeight: 800, letterSpacing: "-0.03em" }}>Security at a glance.</h2>
          </Reveal>
        </div>
        <Reveal delay={0.15} y={20}>
          <div style={{ background: "#0e0e0e", borderRadius: 24, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
            {/* Fake window bar */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
              {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />)}
              <span style={{ marginLeft: 12, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>DronExit OS — Live</span>
            </div>
            <div style={{ padding: 32, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {[
                { label: "System Status",    val: "● Online",        valColor: "#34d399" },
                { label: "Active Threats",   val: "2 Detected",      valColor: "#f87171" },
                { label: "Last Detection",   val: "4 min ago",       valColor: "#fff" },
                { label: "Signal Type",      val: "Remote ID + RF",  valColor: "#60a5fa" },
                { label: "Confidence",       val: "94%",             valColor: BLUE },
                { label: "Est. Direction",   val: "North-East ↗",    valColor: "#fbbf24" },
              ].map(({ label, val, valColor }) => (
                <div key={label} style={{ background: "#080808", borderRadius: 16, padding: "24px 20px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: valColor, letterSpacing: "-0.01em" }}>{val}</div>
                </div>
              ))}
            </div>
            {/* Log strip */}
            <div style={{ margin: "0 32px 32px", borderRadius: 16, background: "#080808", border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
              {[
                { t:"21:34:07", type:"REMOTE ID", id:"DJI Mini 4 Pro",  d:"340m", c:"#f87171" },
                { t:"21:31:22", type:"RF 433MHz",  id:"ELRS Controller", d:"—",    c:"#fbbf24" },
                { t:"21:28:55", type:"REMOTE ID", id:"Mavic 3 Classic", d:"820m", c:"#f87171" },
              ].map((r,i) => (
                <div key={r.t} style={{ display:"flex", alignItems:"center", gap:16, padding:"12px 20px", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)", fontFamily:"monospace", minWidth:60 }}>{r.t}</span>
                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:4, background:`${r.c}15`, color:r.c, border:`1px solid ${r.c}25`, whiteSpace:"nowrap" }}>{r.type}</span>
                  <span style={{ fontSize:13, color:"rgba(255,255,255,0.65)", flex:1 }}>{r.id}</span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)", fontFamily:"monospace" }}>{r.d}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.25}>
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <button className="btn-ghost" onClick={() => nav("/login")}>Open Live Dashboard →</button>
          </div>
        </Reveal>
      </Section>

      {/* ── USE CASES ────────────────────────────────────────────────────── */}
      <Section style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <Reveal><Label>Use Cases</Label></Reveal>
          <Reveal delay={0.1}>
            <h2 style={{ fontSize: "clamp(36px,4vw,52px)", fontWeight: 800, letterSpacing: "-0.03em" }}>Built for any property.</h2>
          </Reveal>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            { icon: "⌂", title: "Luxury Homes",       sub: "Protect family privacy from surveillance drones." },
            { icon: "◫", title: "Villas & Estates",    sub: "Large perimeter, continuous outdoor monitoring." },
            { icon: "▦", title: "Warehouses",          sub: "Detect industrial espionage and unauthorized overflights." },
            { icon: "◈", title: "Factories",           sub: "Secure production facilities and IP." },
            { icon: "⬡", title: "Construction Sites",  sub: "Monitor for competitor or press drones." },
            { icon: "⊞", title: "Business Buildings",  sub: "Executive floors, boardrooms, perimeter security." },
          ].map(({ icon, title, sub }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <div className="use-card">
                <div style={{ padding: 32 }}>
                  <div style={{ fontSize: 28, marginBottom: 16, color: BLUE }}>{icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{title}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.35)", fontWeight: 300 }}>{sub}</div>
                </div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(to right, ${BLUE}, transparent)`, opacity: 0 }} className="use-accent"/>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <Section id="pricing" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <Reveal><Label>Pricing</Label></Reveal>
          <Reveal delay={0.1}>
            <h2 style={{ fontSize: "clamp(36px,4vw,52px)", fontWeight: 800, letterSpacing: "-0.03em" }}>One price. No surprises.</h2>
          </Reveal>
        </div>
        <Reveal delay={0.15} y={24}>
          <div className="price-card">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: BLUE, letterSpacing: "0.12em", marginBottom: 8 }}>DRONEXIT</div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", fontWeight: 300 }}>Passive drone detection appliance</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>€999</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>one-time · no subscription</div>
              </div>
            </div>
            <div style={{ marginBottom: 40 }}>
              {[
                "HackRF Pro SDR · 400 MHz – 6 GHz",
                "Remote ID decoder (BLE/Wi-Fi)",
                "Telegram + SMS alerts",
                "Web dashboard (self-hosted)",
                "Industrial PoE enclosure",
                "Lifetime software updates",
                "No monthly fees — ever",
              ].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6.5" fill={BLUE_DIM} stroke={BLUE} strokeWidth="1"/><path d="M4.5 7.5l2 2 4-4" stroke={BLUE} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{f}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <button className="btn-primary" style={{ flex: 1, justifyContent: "center", borderRadius: 14, padding: "16px" }} onClick={() => scrollTo("contact")}>
                Order Now →
              </button>
              <button className="btn-ghost" style={{ borderRadius: 14, padding: "16px 24px" }} onClick={() => scrollTo("how-it-works")}>
                Learn More
              </button>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ── CONTACT / FINAL CTA ───────────────────────────────────────────── */}
      <Section id="contact" style={{ textAlign: "center" }}>
        <Reveal>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: BLUE_DIM, border: `1.5px solid rgba(26,107,255,0.35)`, marginBottom: 32 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={BLUE} strokeWidth="1.5"/><circle cx="12" cy="12" r="5" stroke={BLUE} strokeWidth="1.2" opacity="0.5"/><circle cx="12" cy="12" r="2" fill={BLUE}/></svg>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 style={{ fontSize: "clamp(44px,5.5vw,76px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.0, marginBottom: 20 }}>
            Protect your property.<br /><span style={{ color: BLUE }}>Start today.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.18}>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", marginBottom: 56, fontWeight: 300 }}>
            Questions about installation or compatibility? We're here.
          </p>
        </Reveal>
        <Reveal delay={0.24}>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:contact@dronexit.com" className="btn-primary" style={{ borderRadius: 14, padding: "16px 40px", fontSize: 15 }}>
              contact@dronexit.com
            </a>
            <button className="btn-ghost" style={{ borderRadius: 14, padding: "16px 40px", fontSize: 15 }} onClick={() => nav("/login")}>
              Open Dashboard
            </button>
          </div>
        </Reveal>
      </Section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke={BLUE} strokeWidth="1.5" fill="none"/><circle cx="16" cy="16" r="3" fill={BLUE}/><circle cx="21.5" cy="10.5" r="1.8" fill="#ff4040"/></svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>DronExit © 2026</span>
          </div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {["Documentation","Privacy","Terms","Support"].map(t => (
              <span key={t} style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
              >{t}</span>
            ))}
            <a href="mailto:contact@dronexit.com" style={{ fontSize: 13, color: "rgba(255,255,255,0.2)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
            >contact@dronexit.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
