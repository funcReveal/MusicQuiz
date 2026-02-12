import React from "react";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false, className }) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className ?? ""}`.trim()}>
      <svg
        width={compact ? 28 : 34}
        height={compact ? 28 : 34}
        viewBox="0 0 48 48"
        role="img"
        aria-label="Muizo logo"
      >
        <defs>
          <linearGradient id="mqGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fcd34d" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="14"
          fill="rgba(20,17,13,0.92)"
          stroke="rgba(245,158,11,0.45)"
          strokeWidth="2"
        />
        <path
          d="M17 31V17.5a1.5 1.5 0 0 1 2.05-1.4l12.5 4.8a1.5 1.5 0 0 1 0 2.8l-12.5 4.8A1.5 1.5 0 0 1 17 31Z"
          fill="url(#mqGrad)"
        />
        <circle cx="35" cy="16" r="3" fill="#fcd34d" />
      </svg>
      <div className="leading-none">
        <div className="text-[10px] tracking-[0.24em] uppercase text-[var(--mc-text-muted)]">
          Brand
        </div>
        <div
          className={`${compact ? "text-base" : "text-lg"} font-semibold tracking-[0.08em] text-[var(--mc-text)]`}
          style={{ fontFamily: '"Newsreader", "Noto Sans TC", serif' }}
        >
          Muizo
        </div>
      </div>
    </div>
  );
};

export default BrandLogo;

