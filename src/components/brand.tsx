import Link from "next/link";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="#FF5A47" />
      <path d="M19 46V18l26 28V18" fill="none" stroke="#22104A" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="14" r="6" fill="#C9F24D" stroke="#22104A" strokeWidth="3" />
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
