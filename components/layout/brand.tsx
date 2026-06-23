import Image from "next/image";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

export function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex h-16 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "px-5")}>
      {collapsed ? (
        <Image
          src="/brand/dockly-mark-neg.png"
          alt="DocklyLogistics"
          width={359}
          height={300}
          className="h-7 w-auto"
          priority
        />
      ) : (
        <Logo variant="dark" />
      )}
    </div>
  );
}
