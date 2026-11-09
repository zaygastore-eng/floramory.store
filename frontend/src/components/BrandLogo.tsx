import { useState } from "react";
import { logoUrl } from "@/lib/site";

export default function BrandLogo({
  className = "brand-logo-img",
  variant = "burgundy",
}: {
  className?: string;
  variant?: "burgundy" | "light";
}) {
  const [failed, setFailed] = useState(false);

  const src = variant === "light" ? "/a-chapter-logo-light.png" : logoUrl();

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
      src={src}
      alt="A Chapter"
      onError={() => setFailed(true)}
    />
  );
}
