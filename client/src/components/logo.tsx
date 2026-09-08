export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="TrustPass logo"
      role="img"
    >
      <path
        d="M16 2 4 6v9c0 7.5 5.1 13.4 12 15 6.9-1.6 12-7.5 12-15V6L16 2Z"
        fill="currentColor"
        opacity="0.92"
      />
      <path
        d="M10.5 16.2 14.3 20 21.8 11"
        stroke="hsl(var(--gold))"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoWordmark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span className="flex items-center gap-2">
      <Logo className={className} />
      <span className="font-semibold tracking-tight text-lg" style={{ color: "hsl(var(--foreground))" }}>
        Trust<span style={{ color: "hsl(var(--gold))" }}>Pass</span>
      </span>
    </span>
  );
}
