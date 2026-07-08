import React, { useMemo } from 'react';

interface VinylRecordProps {
  size?: number | string;
  labelColor?: string;
  spinning?: boolean;
  withTonearm?: boolean;
  className?: string;
}

export function VinylRecord({ size = 120, labelColor = '#7C3AED', spinning = false, withTonearm = false, className = '' }: VinylRecordProps) {
  // Generate dense grooves
  const grooves = useMemo(() => {
    const arr = [];
    // From r=20 to r=47
    for (let i = 0; i < 45; i++) {
      const r = 20 + (i * 0.6); // 20 up to 47
      const stroke = i % 3 === 0 ? '#222' : (i % 5 === 0 ? '#111' : '#1a1a1a');
      const opacity = 0.4 + Math.random() * 0.6;
      arr.push(<circle key={i} cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeWidth="0.4" strokeOpacity={opacity} />);
    }
    return arr;
  }, []);

  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size }}>
      {/* Spinning disc */}
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 100 100" 
        xmlns="http://www.w3.org/2000/svg"
        className={spinning ? 'animate-[spin_3s_linear_infinite]' : ''}
        style={{ borderRadius: 0, transformOrigin: 'center' }}
      >
        {/* Outer disc */}
        <circle cx="50" cy="50" r="49" fill="#0a0a0a" stroke="#282828" strokeWidth="0.5" />
        
        {/* Grooves */}
        {grooves}
        
        {/* Center Label */}
        <circle cx="50" cy="50" r="14" fill={labelColor} />
        
        {/* Label details */}
        <circle cx="50" cy="50" r="13" fill="none" stroke="#000" strokeWidth="0.2" strokeOpacity="0.4" />
        <circle cx="50" cy="50" r="9" fill="none" stroke="#fff" strokeWidth="0.1" strokeOpacity="0.4" />
        <circle cx="50" cy="50" r="4" fill="none" stroke="#000" strokeWidth="0.2" strokeOpacity="0.2" />
        
        <path d="M41,50 A9,9 0 0,1 59,50" fill="none" stroke="#000" strokeWidth="0.4" strokeOpacity="0.3" />
        <path d="M43,50 A7,7 0 0,0 57,50" fill="none" stroke="#000" strokeWidth="0.2" strokeOpacity="0.2" />
        
        {/* Fake text arc around label */}
        <path id="label-text-top" d="M40,50 A10,10 0 0,1 60,50" fill="none" />
        <text fontSize="2" fill="#000" fillOpacity="0.5" fontWeight="bold" letterSpacing="0.2" style={{ textTransform: 'uppercase' }}>
          <textPath href="#label-text-top" startOffset="50%" textAnchor="middle">STEREO 33 ⅓ RPM</textPath>
        </text>
        <path id="label-text-bottom" d="M40,50 A10,10 0 0,0 60,50" fill="none" />
        <text fontSize="2" fill="#000" fillOpacity="0.5" fontWeight="bold" letterSpacing="0.2">
          <textPath href="#label-text-bottom" startOffset="50%" textAnchor="middle">SIDE A</textPath>
        </text>

        {/* Reflection highlights */}
        {/* Subtle arc sweeps across the disc surface */}
        <path d="M50,1 A49,49 0 0,1 99,50 L95,50 A45,45 0 0,0 50,5 Z" fill="#ffffff" fillOpacity="0.03" />
        <path d="M50,99 A49,49 0 0,1 1,50 L5,50 A45,45 0 0,0 50,95 Z" fill="#ffffff" fillOpacity="0.03" />
        <path d="M1,50 A49,49 0 0,1 50,1 L50,5 A45,45 0 0,0 5,50 Z" fill="#ffffff" fillOpacity="0.02" />
        <path d="M99,50 A49,49 0 0,1 50,99 L50,95 A45,45 0 0,0 95,50 Z" fill="#ffffff" fillOpacity="0.02" />

        {/* Spindle hole */}
        <circle cx="50" cy="50" r="2" fill="#000" />
        <circle cx="50" cy="50" r="2" fill="none" stroke="#555" strokeWidth="0.2" />
      </svg>

      {/* Static tonearm overlay */}
      {withTonearm && (
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 100 100" 
          className="absolute inset-0 pointer-events-none z-10"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Pivot is at x=85, y=15. Rotated slightly so arm points over the record. */}
          <g transform="translate(85, 15) rotate(35)">
            {/* Pivot base */}
            <circle cx="0" cy="0" r="7" fill="#111" stroke="#333" strokeWidth="0.5" />
            <circle cx="0" cy="0" r="4.5" fill="#222" />
            <circle cx="0" cy="0" r="1.5" fill="#444" />
            
            {/* Counterweight extending up */}
            <rect x="-2" y="-12" width="4" height="7" fill="#222" />
            <rect x="-3" y="-14" width="6" height="4" fill="#3a3a3a" />
            
            {/* Arm extending down */}
            {/* Length approx 48 down to the record */}
            <path d="M-1.5,0 L-2.5,38 A4,4 0 0,1 -5,42 L-10,47 L-8.5,48.5 L-3,43 A4,4 0 0,0 -0.5,38 L1.5,0 Z" fill="#333" />
            <path d="M0,0 L-1,38 A4,4 0 0,1 -3.5,42 L-8.5,47" fill="none" stroke="#555" strokeWidth="0.5" />
            
            {/* Headshell / Cartridge */}
            <g transform="translate(-9.5, 47.5) rotate(25)">
              <rect x="-2.5" y="-1" width="5" height="8" fill="#1a1a1a" stroke="#333" strokeWidth="0.3" />
              <rect x="-1.5" y="7" width="3" height="2" fill="#444" />
              {/* Stylus line */}
              <line x1="0" y1="9" x2="0" y2="10" stroke="#888" strokeWidth="0.3" />
            </g>
          </g>
        </svg>
      )}
    </div>
  );
}
