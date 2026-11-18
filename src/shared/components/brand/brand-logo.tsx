import Image from "next/image";
import { APP_NAME } from "@/core/config/constants";
import { cn } from "@/shared/lib/utils";

/** Transparent square PNG master (512×512). */
export const BRAND_LOGO_SRC = "/agropulse-logo.png";

type Props = {
  /** Logo mark size in px (square). */
  size?: number;
  /** Show app name next to the mark. */
  withWordmark?: boolean;
  className?: string;
  priority?: boolean;
};

/** Official Agro Pulse AI mark (olive tree + handshake). */
export function BrandLogo({
  size = 40,
  withWordmark = true,
  className,
  priority = false,
}: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src={BRAND_LOGO_SRC}
        alt={APP_NAME}
        width={size}
        height={size}
        priority={priority}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
      {withWordmark ? (
        <span className="text-[16px] leading-5 font-extrabold tracking-tight text-ink">
          {APP_NAME}
        </span>
      ) : null}
    </span>
  );
}
