export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#23262F] bg-[#09090C]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">

        {/* Logo + Name */}
        <div className="flex items-center gap-3">
          <Logomark />
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight text-[#E4E6EB]">
              Project Black Rod
            </span>
            <span className="hidden text-[11px] font-medium uppercase tracking-widest text-[#555B6B] sm:block">
              AI Market Intelligence
            </span>
          </div>
        </div>

        {/* XAU/USD Identity Badge */}
        <div className="flex items-center gap-2">
          <LiveDot />
          <span className="gold-bar rounded-md px-3 py-1.5 font-mono text-[12px] font-bold tracking-widest text-[#09090C]">
            XAU / USD
          </span>
        </div>

      </div>
    </header>
  );
}

function Logomark() {
  return (
    <svg viewBox="0 0 36 36" className="h-8 w-8 shrink-0" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="34"
        height="34"
        rx="9"
        fill="#13151B"
        stroke="#23262F"
        strokeWidth="1.5"
      />

      {/* Outer triangle */}
      <path
        d="M10 25 L18 8 L26 25"
        stroke="#C9A84C"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Inner triangle */}
      <path
        d="M13.5 25 L18 14.5 L22.5 25"
        stroke="#E5C96A"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#30B87A] opacity-50 [animation-duration:2s]" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#30B87A]" />
    </span>
  );
}
