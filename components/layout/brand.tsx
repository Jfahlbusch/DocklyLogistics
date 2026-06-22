import { Logo } from "./logo";

export function Brand() {
  return (
    <div className="flex items-center px-5 h-16 border-b border-white/10">
      <Logo variant="dark" />
    </div>
  );
}
