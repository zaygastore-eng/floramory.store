import { useState } from "react";
import { logoUrl } from "@/lib/site";

export default function BrandLogo({
  className = "brand-logo-img",
}: {
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="brand-logo-wrap">
        <span className="brand-logo-text">
          A <span>Chapter</span>
        </span>
        <span className="brand-logo-kicker">ATELIER &amp; ARCHIVES</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={logoUrl()}
      alt="A Chapter"
      onError={() => setFailed(true)}
    />
  );
}
