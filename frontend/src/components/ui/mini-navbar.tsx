"use client";

import React, { useState, useEffect, useRef } from 'react';

const AnimatedNavLink = ({ href, onClick, children }: { href?: string; onClick?: (e: React.MouseEvent) => void; children: React.ReactNode }) => {
  const defaultTextColor = 'text-gray-300';
  const hoverTextColor = 'text-white';

  const content = (
    <div className="flex flex-col transition-transform duration-350 ease-out transform group-hover:-translate-y-1/2">
      <span className={`h-6 flex items-center text-sm font-medium ${defaultTextColor}`}>{children}</span>
      <span className={`h-6 flex items-center text-sm font-medium ${hoverTextColor}`}>{children}</span>
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="group relative block h-6 overflow-hidden bg-transparent border-none p-0 cursor-pointer">
        {content}
      </button>
    );
  }

  return (
    <a href={href} className="group relative block h-6 overflow-hidden">
      {content}
    </a>
  );
};

interface NavbarProps {
  onDocsClick?: () => void;
}

export function Navbar({ onDocsClick }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
  const shapeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (shapeTimeoutRef.current) {
      clearTimeout(shapeTimeoutRef.current);
    }

    if (isOpen) {
      setHeaderShapeClass('rounded-xl');
    } else {
      shapeTimeoutRef.current = setTimeout(() => {
        setHeaderShapeClass('rounded-full');
      }, 300);
    }

    return () => {
      if (shapeTimeoutRef.current) {
        clearTimeout(shapeTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const logoElement = (
    <div className="flex items-center gap-2.5">
      <div className="relative w-5 h-5 flex items-center justify-center">
        <span className="absolute w-1.5 h-1.5 rounded-full bg-[#0fbf3e] top-0 left-1/2 transform -translate-x-1/2 opacity-90"></span>
        <span className="absolute w-1.5 h-1.5 rounded-full bg-[#0fbf3e] left-0 top-1/2 transform -translate-y-1/2 opacity-90"></span>
        <span className="absolute w-1.5 h-1.5 rounded-full bg-[#0fbf3e] right-0 top-1/2 transform -translate-y-1/2 opacity-90"></span>
        <span className="absolute w-1.5 h-1.5 rounded-full bg-[#0fbf3e] bottom-0 left-1/2 transform -translate-x-1/2 opacity-90"></span>
      </div>
      <span className="font-bold tracking-tight text-sm bg-gradient-to-r from-white to-[#0fbf3e] bg-clip-text text-transparent select-none">
        GitScope AI
      </span>
    </div>
  );

  return (
    <header className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-20
                       flex flex-col items-center
                       px-10 py-4 backdrop-blur-lg
                       ${headerShapeClass}
                       border border-white/10 bg-black/40
                       w-[calc(100%-4rem)] sm:w-[680px]
                       transition-[border-radius] duration-300 ease-in-out shadow-2xl`}>

      <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
        <div className="flex items-center">
           {logoElement}
        </div>

        <nav className="hidden sm:flex items-center space-x-4 sm:space-x-6 text-sm">
          <AnimatedNavLink href="#recent-workspaces">
            Platform
          </AnimatedNavLink>
          <AnimatedNavLink onClick={onDocsClick}>
            Docs
          </AnimatedNavLink>
        </nav>

        <button className="sm:hidden flex items-center justify-center w-8 h-8 text-gray-300 focus:outline-none" onClick={toggleMenu} aria-label={isOpen ? 'Close Menu' : 'Open Menu'}>
          {isOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          )}
        </button>
      </div>

      <div className={`sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden
                       ${isOpen ? 'max-h-[1000px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none'}`}>
        <nav className="flex flex-col items-center space-y-4 text-base w-full">
          <a href="#recent-workspaces" onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-white transition-colors w-full text-center">
            Platform
          </a>
          <button onClick={() => { setIsOpen(false); onDocsClick?.(); }} className="text-gray-300 hover:text-white transition-colors w-full text-center bg-transparent border-none p-0 cursor-pointer">
            Docs
          </button>
        </nav>
      </div>
    </header>
  );
}
