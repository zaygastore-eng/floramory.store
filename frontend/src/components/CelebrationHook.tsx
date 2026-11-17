import { useEffect, useState } from "react";
import { LottieLight } from "lottie-react";
import {
  Cake,
  Flower,
  Flower2,
  Gift,
  GraduationCap,
  Mail,
  PartyPopper,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { VaultHookId } from "@/lib/vaultDesign";

/**
 * Hook pembuka celebration mode.
 *
 * JSON Lottie diimpor secara dinamis sehingga hanya hook yang dipilih
 * yang diunduh. Saat animasi gagal dimuat, pengguna memilih gerak
 * minimal, atau perangkat meminta reduced motion, tampil emblem statis
 * — pengalaman tidak pernah bergantung pada animasi.
 */

const HOOK_LOADERS: Record<VaultHookId, () => Promise<{ default: unknown }>> = {
  cake: () => import("@/assets/hooks/cake.json"),
  rose: () => import("@/assets/hooks/rose.json"),
  graduation: () => import("@/assets/hooks/graduation.json"),
  "gift-box": () => import("@/assets/hooks/gift-box.json"),
  bouquet: () => import("@/assets/hooks/bouquet.json"),
  envelope: () => import("@/assets/hooks/envelope.json"),
  celebration: () => import("@/assets/hooks/celebration.json"),
  confetti: () => import("@/assets/hooks/confetti.json"),
};

const HOOK_EMBLEMS: Record<VaultHookId, LucideIcon> = {
  cake: Cake,
  rose: Flower2,
  graduation: GraduationCap,
  "gift-box": Gift,
  bouquet: Flower,
  envelope: Mail,
  celebration: Wine,
  confetti: PartyPopper,
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

export default function CelebrationHook({
  hookId,
  onComplete,
  loop = false,
  className = "",
}: {
  hookId: VaultHookId;
  onComplete?: () => void;
  loop?: boolean;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [animationData, setAnimationData] = useState<unknown>(null);
  const [failed, setFailed] = useState(false);
  const Emblem = HOOK_EMBLEMS[hookId] || Gift;

  useEffect(() => {
    let active = true;
    setAnimationData(null);
    setFailed(false);
    HOOK_LOADERS[hookId]()
      .then((mod) => {
        if (active) setAnimationData(mod.default);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [hookId]);

  // Reduced motion tidak menunggu animasi: emblem tampil, lalu stage
  // memberi jalan ke hub setelah jeda singkat.
  useEffect(() => {
    if (!reducedMotion) return;
    const timer = window.setTimeout(() => onComplete?.(), 900);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, onComplete]);

  const showStatic = reducedMotion || failed || !animationData;

  return (
    <div className={`celebration-hook-art ${className}`.trim()} data-hook={hookId}>
      {showStatic ? (
        <span className="celebration-hook-emblem" aria-hidden="true">
          <Emblem strokeWidth={1.15} />
        </span>
      ) : (
        <LottieLight
          src={animationData as object}
          loop={loop}
          autoplay
          subscriptions={{ complete: () => onComplete?.() }}
          className="celebration-hook-lottie"
          rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
        />
      )}
    </div>
  );
}
