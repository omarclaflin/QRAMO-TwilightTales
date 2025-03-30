import React from 'react';
import { Card } from '@shared/schema';
import { GameCard } from '@/components/card';
import { cn } from '@/lib/utils';
import { normalizeCardType } from '@/components/card';

interface CardSelectionProps {
  cards: Card[];
  selectedCardId?: number | null;
  onSelectCard?: (cardId: number) => void;
  className?: string;
  playerCardType?: string;
}

export function CardSelectionComponent({
  cards,
  selectedCardId,
  onSelectCard,
  className,
  playerCardType
}: CardSelectionProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4", className)}>
      {cards.map((card) => {
        // Always use playerCardType as the source of truth for card type
        const cardType = playerCardType || card.type || 'unknown';
        console.log(`[CardSelection] Card ${card.id} type assignment:`, {
          originalType: card.type,
          playerCardType,
          finalType: cardType
        });

        const normalizedType = normalizeCardType(cardType, true);

        return (
          <div
            key={card.id}
            onClick={() => onSelectCard?.(card.id)}
            className="cursor-pointer"
          >
            <GameCard
              card={{...card, type: cardType}} // Pass the modified card object
              selected={selectedCardId === card.id}
              type={normalizedType}
              className={cn(
                'transition-all duration-300',
                selectedCardId === card.id && 'ring-2 ring-primary ring-offset-2',
                !selectedCardId && 'hover:scale-105'
              )}
            />
          </div>
        );
      })}
    </div>
  );
}