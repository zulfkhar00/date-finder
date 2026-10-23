import Link from "next/link";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="54" r="42" fill="#22104A" />
      <circle cx="50" cy="48" r="42" fill="#C9F24D" stroke="#22104A" strokeWidth="5" />
      <path d="M29 42h12M59 42h12" stroke="#22104A" strokeWidth="7" strokeLinecap="round" />
      <path d="M36 62q18 4 32-9" stroke="#22104A" strokeWidth="7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="NoSwipe home">
      <BrandMark />
      <span>NoSwipe</span>
    </Link>
  );
}
