export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="112 130 288 258" className={className} aria-hidden="true" focusable="false">
      <path d="M256 168c-34-22-78-30-132-26v208c54-4 98 4 132 26z" fill="var(--accent)" />
      <path d="M256 168c34-22 78-30 132-26v208c-54-4-98 4-132 26z" fill="var(--accent)" />
      <rect x="244" y="186" width="24" height="158" rx="4" fill="var(--bg)" />
      <rect x="198" y="226" width="116" height="24" rx="4" fill="var(--bg)" />
    </svg>
  );
}
