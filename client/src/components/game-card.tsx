
import React from 'react';
import { Card } from '@shared/schema';
import { cn } from '@/lib/utils';

interface GameCardProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  type?: string;
  className?: string;
  selected?: boolean;
  onCustomTextChange?: (text: string) => void;
}

/**
 * Helper function to normalize card types across the application
 */
export function normalizeCardType(cardType: string | undefined, debug: boolean = false): string {
  if (!cardType) return 'unknown';
  
  // Convert to lowercase for consistent handling
  const normalizedType = cardType.toLowerCase()
    .replace(/[-_\s]card$/, '') // Remove 'card' suffix with optional hyphen/underscore
    .replace(/[-_\s]/g, ''); // Remove any remaining hyphens/underscores
    
  if (debug) console.log(`[GameCard] Card type normalized: "${cardType}" → "${normalizedType}" → CSS class: card-type-${normalizedType}`);
  
  return normalizedType;
}

export function GameCard({ 
  card, 
  size = 'md', 
  type,
  className,
  selected,
  onCustomTextChange 
}: GameCardProps) {
  const normalizedType = normalizeCardType(type || card.type, true);
  
  return (
    <div 
      className={cn(
        'relative rounded-lg shadow-md transition-all duration-300',
        `card-type-${normalizedType}`,
        card.isCustom && `card-header-${normalizedType}`,
        selected && 'ring-2 ring-offset-2 ring-primary',
        !selected && 'hover:scale-105',
        'card-container',
        className
      )}
    >
      <div className="p-4">
        <div className="font-semibold mb-2">
          {card.isCustom ? 'Custom Card' : `QRAMO Classic #${card.id}`}
        </div>
        {card.isCustom && onCustomTextChange ? (
          <textarea
            className="w-full p-2 rounded border"
            value={card.text}
            onChange={(e) => onCustomTextChange(e.target.value)}
            placeholder="Enter your card text..."
          />
        ) : (
          <p className="text-sm">{card.text}</p>
        )}
      </div>
    </div>
  );
}
