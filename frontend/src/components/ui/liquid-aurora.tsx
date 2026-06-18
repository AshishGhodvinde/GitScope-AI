import React from "react";

interface LiquidAuroraProps {
  className?: string;
  children?: React.ReactNode;
}

export const LiquidAurora: React.FC<LiquidAuroraProps> = ({ className, children }) => {
  return (
    <div className={`hero-section w-full h-screen flex flex-col overflow-hidden text-[#c9d1d9] font-sans ${className || ""}`}>
      {}
      <div className="liquid-shape shape-1 pointer-events-none" />
      <div className="liquid-shape shape-2 pointer-events-none" />
      <div className="liquid-shape shape-3 pointer-events-none" />

      {}
      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
};
