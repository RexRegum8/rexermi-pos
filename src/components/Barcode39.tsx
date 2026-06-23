'use client';
import React from 'react';

const CODE39_ENCODINGS: Record<string, string> = {
  '0': 'NNNWWNWNN', '1': 'WNNWNNNNW', '2': 'NNWWNNNNW', '3': 'WNWWNNNNN',
  '4': 'NNNWWNNNW', '5': 'WNNWWNNNN', '6': 'NNWWWWNNN', '7': 'NNNWNNWNW',
  '8': 'WNNWNNWNN', '9': 'NNWWNNWNN', 'A': 'WNNNNWNNW', 'B': 'NNWNNWNNW',
  'C': 'WNWNNWNNN', 'D': 'NNNNWWNNW', 'E': 'WNNNWWNNN', 'F': 'NNWNWWNNN',
  'G': 'NNNNNWWNW', 'H': 'WNNNNWWNN', 'I': 'NNWNNWWNN', 'J': 'NNNNWWWNN',
  'K': 'WNNNNNNWW', 'L': 'NNWNNNNWW', 'M': 'WNWNNNNWN', 'N': 'NNNNWNNWW',
  'O': 'WNNNWNNWN', 'P': 'NNWNWNNWN', 'Q': 'NNNNNNWWW', 'R': 'WNNNNNWWN',
  'S': 'NNWNNNWWN', 'T': 'NNNNWNWWN', 'U': 'WWNNNNNNW', 'V': 'NWWNNNNNW',
  'W': 'WWWNNNNNN', 'X': 'NWNNWNNNW', 'Y': 'WWNNWNNNN', 'Z': 'NWWNWNNNN',
  '-': 'NWNNNNWNW', '.': 'WWNNNNWNN', ' ': 'NWWNNNWWN', '*': 'NWNNWNWNN',
  '$': 'NWNWNWNNN', '/': 'NWNWNNNWN', '+': 'NWNNNWNWN', '%': 'NNNWNWNWN'
};

interface Barcode39Props {
  value: string;
  width?: number; // width multiplier for each bar
  height?: number; // height of the barcode
}

export default function Barcode39({ value, width = 1.2, height = 45 }: Barcode39Props) {
  // Normalize value to uppercase and keep only allowed Code 39 characters
  const rawText = String(value || '').toUpperCase();
  const filteredText = rawText.split('').filter(char => CODE39_ENCODINGS[char]).join('');
  
  if (!filteredText) {
    return (
      <div style={{ fontSize: '0.8rem', color: 'var(--error)', fontStyle: 'italic', padding: '0.4rem', border: '1px dashed var(--error)', borderRadius: '4px' }}>
        Código inválido para Code 39
      </div>
    );
  }

  // Code 39 start and stop character is '*'
  const textToEncode = `*${filteredText}*`;
  
  const rects: React.ReactNode[] = [];
  let currentX = 0;
  
  const narrow = width;
  const wide = width * 3;
  const gap = width; // gap between characters
  
  for (let i = 0; i < textToEncode.length; i++) {
    const char = textToEncode[i];
    const pattern = CODE39_ENCODINGS[char];
    if (!pattern) continue;
    
    for (let j = 0; j < 9; j++) {
      const type = pattern[j];
      const isBar = j % 2 === 0; // alternate: bar, space, bar, space...
      const w = type === 'W' ? wide : narrow;
      
      if (isBar) {
        rects.push(
          <rect
            key={`${i}-${j}`}
            x={currentX}
            y={0}
            width={w}
            height={height}
            fill="#000"
          />
        );
      }
      currentX += w;
    }
    // Add gap between characters
    currentX += gap;
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', padding: '0.5rem', borderRadius: '4px' }}>
      <svg width={currentX} height={height} viewBox={`0 0 ${currentX} ${height}`}>
        {rects}
      </svg>
      <span style={{ fontSize: '0.72rem', color: '#000', fontFamily: 'monospace', marginTop: '0.2rem', letterSpacing: '0.15em', fontWeight: 600 }}>
        {filteredText}
      </span>
    </div>
  );
}
