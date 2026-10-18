import { publicAssetUrl } from "../routing/publicAssetUrl";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <span className="brand-mark">
        <img
          className="brand-logo"
          src={publicAssetUrl("logo.png")}
          alt=""
          aria-hidden="true"
        />
      </span>
      <span>
        <strong>Raaga’s</strong>
        {!compact && <em>Cook Book</em>}
      </span>
    </>
  );
}
