import { CookingPot } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <span className="brand-mark">
        <CookingPot size={22} strokeWidth={1.8} />
      </span>
      <span>
        <strong>Raaga’s</strong>
        {!compact && <em>Cook Book</em>}
      </span>
    </>
  );
}
