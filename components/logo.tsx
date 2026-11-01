import Image from "next/image";
import icon from "@/app/icon.png";

/** Codebasics icon mark only, no lettering. Same file as the browser tab icon. */
export function Logo({ size = 40 }: { size?: number }) {
  return <Image src={icon} alt="Codebasics" width={size} height={size} unoptimized loading="eager" />;
}
