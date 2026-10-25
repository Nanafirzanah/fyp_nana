/** SafeFile brand mark: floppy-disk icon with a stacked "SAFE / FILE" wordmark. */

import { Save } from "lucide-react";

interface LogoProps {
  /** "md" for the sidebar, "lg" for auth pages */
  size?: "md" | "lg";
  /** Light text for use on dark or blue backgrounds */
  light?: boolean;
}

export default function Logo({ size = "md", light = false }: LogoProps) {
  const large = size === "lg";
  return (
    <div className="flex items-center gap-2">
      <Save
        size={large ? 44 : 30}
        strokeWidth={1.75}
        className={light ? "text-white" : "text-blue-500"}
        aria-hidden="true"
      />
      <div
        className={`font-black leading-[0.95] tracking-wide ${large ? "text-3xl" : "text-lg"} ${light ? "text-white" : "text-blue-500"}`}
        aria-label="SafeFile"
      >
        <div>SAFE</div>
        <div>FILE</div>
      </div>
    </div>
  );
}
