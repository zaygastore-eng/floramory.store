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
      <span className="brand-logo-text">
        Flora<span>mory</span>
      </span>
    );
  }

  return (
    <img
      className={className}
      src={logoUrl()}
      alt="Floramory"
      onError={() => setFailed(true)}
    />
  );
}
