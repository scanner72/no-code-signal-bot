// Cyber-Quant Signal Bot — logo mark + lockup (React + TS)
// Usage:
//   <CyberQuantMark size={32} />
//   <CyberQuantLogo />              full horizontal lockup
//   <CyberQuantMark mono="#fff" />  single-colour reversal

type MarkProps = {
  size?: number;
  accent?: string;   // node frame + ports
  spark?: string;    // signal arrow
  mono?: string;     // if set, overrides accent+spark with one colour
  glow?: boolean;
  className?: string;
};

export function CyberQuantMark({
  size = 40,
  accent = "#2962ff",
  spark = "#6ea8ff",
  mono,
  glow = false,
  className,
}: MarkProps) {
  const a = mono ?? accent;
  const s = mono ?? spark;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 ${size * 0.18}px ${a}80)` } : undefined}
      aria-label="Cyber-Quant Signal Bot"
    >
      <rect x="3.5" y="3.5" width="33" height="33" rx="9" stroke={a} strokeWidth="2.4" />
      <circle cx="3.5" cy="20" r="2.5" fill={a} />
      <circle cx="36.5" cy="20" r="2.5" fill={a} />
      <path d="M11 28 L17 23 L21 26 L28 14" stroke={s} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 14 L28 14 L28 20" stroke={s} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CyberQuantLogo({ size = 40, accent = "#2962ff" }: { size?: number; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.36 }}>
      <CyberQuantMark size={size} accent={accent} glow />
      <div style={{ lineHeight: 1.04 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: size * 0.52, letterSpacing: "-0.02em", color: "#fff" }}>
          Cyber<span style={{ color: accent }}>·</span>Quant
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: size * 0.21, letterSpacing: "0.4em", color: "#7b8190", marginTop: size * 0.06 }}>
          SIGNAL BOT
        </div>
      </div>
    </div>
  );
}
