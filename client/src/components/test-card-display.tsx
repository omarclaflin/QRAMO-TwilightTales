import React, { useState } from 'react';
import { GameCard, CardBack } from './card';
import { Card as CardType } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Test component to verify card rendering
export function TestCardDisplay() {
  // State to track flipped cards
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  
  // Sample cards for testing
  const testCards: CardType[] = [
    {
      id: 1,
      text: "A dusty old bookstore with forgotten secrets hiding in plain sight",
      type: "location",
    },
    {
      id: 2,
      text: "A paranoid conspiracy theorist who can actually see the truth no one else believes",
      type: "character",
    },
    {
      id: 3,
      text: "Time suddenly starts flowing backwards, causing people to age in reverse",
      type: "initialTwist",
    },
    {
      id: 4,
      text: "Strange symbols appear in the sky, visible only to those who've experienced déjà vu",
      type: "escalation",
    },
    {
      id: 5,
      text: "Everyone was actually a robot all along, programmed not to know their true nature",
      type: "finalTwist",
    }
  ];

  // State for whether cards are initially flipped (true means showing the front)
  const [initialFlipState] = useState(false); // Start with cards face down
  
  // Function to toggle card flip state
  const toggleCardFlip = (cardId: number) => {
    setFlippedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // Function to flip all cards
  const flipAllCards = (isFlipped: boolean) => {
    const newState: Record<number, boolean> = {};
    testCards.forEach(card => {
      newState[card.id] = isFlipped;
    });
    setFlippedCards(newState);
  };

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-2xl font-bold mb-4">Card Rendering Test</h2>
      
      <div className="flex space-x-4 mb-8">
        <Button onClick={() => flipAllCards(true)}>Reveal All Cards</Button>
        <Button onClick={() => flipAllCards(false)}>Hide All Cards</Button>
      </div>
      
      <div className="space-y-6">
        <h3 className="text-lg font-medium">Interactive Flip Cards (Click to Flip)</h3>
        <div className="flex flex-wrap gap-8 justify-center">
          {testCards.map((card) => (
            <div 
              key={card.id}
              className="perspective-card card-container-lg relative"
              onClick={() => toggleCardFlip(card.id)}
            >
              {/* Card label */}
              <div className="text-sm font-medium text-center mb-2">
                <span className={`text-${card.type?.toLowerCase() || 'gray'}-500 font-semibold`}>
                  {card.type} Card (click to flip)
                </span>
              </div>
              
              {/* Card flip container with animation */}
              <div 
                className={cn(
                  "transform-style-3d w-full h-full",
                  flippedCards[card.id] ? "" : "rotate-y-180" // Reversed logic: cards start face down (back showing)
                )}
                style={{
                  transition: 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
                  transformStyle: 'preserve-3d'
                }}
              >
                {/* Front of card (the actual card content) */}
                <div 
                  className="absolute w-full h-full backface-hidden"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg)',
                    opacity: flippedCards[card.id] ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                    zIndex: flippedCards[card.id] ? 1 : 0,
                    pointerEvents: flippedCards[card.id] ? 'auto' : 'none'
                  }}
                >
                  <GameCard 
                    card={card}
                    size="lg"
                    type={card.type}
                    className="cursor-pointer"
                  />
                </div>
                
                {/* Back of card */}
                <div 
                  className="absolute w-full h-full backface-hidden"
                  style={{
                    backfaceVisibility: 'hidden', 
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)', 
                    opacity: flippedCards[card.id] ? 0 : 1,
                    transition: 'opacity 0.3s ease-in-out',
                    zIndex: flippedCards[card.id] ? 0 : 1,
                    pointerEvents: flippedCards[card.id] ? 'none' : 'auto'
                  }}
                >
                  <CardBack size="lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="space-y-6 mt-16">
        <h3 className="text-lg font-medium">Regular Cards (No Animation)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testCards.map((card) => (
            <div key={card.id} className="space-y-2">
              <p className="text-base font-medium">{card.type} Card:</p>
              <GameCard 
                card={card}
                selectable={true}
                size="md"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}