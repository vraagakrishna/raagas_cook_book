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
      <span className="brand-name">
        <strong>Raaga’s</strong>
        {!compact && (
          <>
            {"\u00a0"}
            <em>Cook Book</em>
          </>
        )}
      </span>
    </>
  );
}
