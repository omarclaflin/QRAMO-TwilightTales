import React, { useState, useEffect } from 'react';
import { Card as CardType, cardTypes } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PencilIcon, CheckIcon } from 'lucide-react';

/**
 * Get card type with minimal processing
 * @param cardType - The card type string or constant
 * @param playerCardType - Optional player assigned card type
 * @returns The appropriate card type string
 */
export function getCardType(cardType: string | undefined, playerCardType?: string | null): string {
  // First use playerCardType if available (directly use it)
  if (playerCardType) {
    return playerCardType;
  }
  
  // If no card type at all, return unknown
  if (!cardType) return 'unknown';
  
  // Use the card's own type
  return cardType;
}

interface GameCardProps {
  card: CardType;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (cardId: number) => void;
  onCustomTextChange?: (cardId: number, text: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Simple card component for displaying and selecting game cards
 */
export function GameCard({
  card,
  selectable = false,
  selected = false,
  onSelect,
  onCustomTextChange,
  className,
  size = 'md',
}: GameCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [customText, setCustomText] = useState(card.text || '');
  
  // Update local state when card text changes externally
  useEffect(() => {
    setCustomText(card.text || '');
  }, [card.text]);

  // Get card type and icon
  // Use playerCardType if it's available in the card (from ExtendedCard interface)
  const playerCardType = (card as any).playerCardType;
  const cardType = getCardType(card.type, playerCardType);
  const typeIcon = {
    'location': '🏙️',
    'character': '👤',
    'initialTwist': '🔄',
    'escalation': '📈',
    'finalTwist': '💥'
  }[cardType] || '❓';

  // Detect custom and blank cards
  const isCustomCard = card.isCustom === true;
  const isBlankCard = !card.text || card.text.trim() === '';
  
  // Set editing state automatically for blank custom cards on first render
  useEffect(() => {
    if (isCustomCard && isBlankCard && !isEditing) {
      setIsEditing(true);
    }
  }, [isCustomCard, isBlankCard, isEditing]);

  // Size styles
  const sizeStyles = {
    'sm': 'w-28 h-36 text-xs',
    'md': 'w-40 h-52 text-sm',
    'lg': 'w-52 h-64 text-base'
  };
  
  // A card is selectable if it has valid text content (either regular card or filled custom card)
  const hasValidContent = !isBlankCard || (isCustomCard && customText.trim() !== '');
  
  // Handle card click
  const handleClick = () => {
    // If editing, don't do anything (let the save button handle it)
    if (isEditing) {
      return;
    }
    
    // For blank custom cards, enter edit mode
    if (isCustomCard && isBlankCard) {
      setIsEditing(true);
      return;
    }
    
    // For cards with content, select them if selectable
    if (selectable && onSelect && hasValidContent) {
      onSelect(card.id);
    }
  };

  // Save custom text
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Validate if text was entered
    if (customText.trim() === '') {
      // Don't save blank text
      return;
    }
    
    // Save the custom text to the card
    if (onCustomTextChange) {
      onCustomTextChange(card.id, customText);
    }
    
    // Exit editing mode
    setIsEditing(false);
    
    // Also select the card if it's selectable
    if (selectable && onSelect) {
      onSelect(card.id);
    }
  };

  // Edit custom card
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };
  
  // Determine if the card should be visually marked as selectable
  const isSelectableCard = selectable && !isEditing && hasValidContent;
  
  // Add a pulsing effect for custom cards that are ready to be selected
  const customCardReadyClass = !selected && isCustomCard && !isBlankCard && !isEditing && selectable
    ? 'custom-card-filled hover:ring-2 hover:ring-primary hover:ring-offset-1'
    : '';
    
  return (
    <Card 
      className={cn(
        'flex flex-col transition-all duration-200 shadow-lg',
        sizeStyles[size],
        `card-type-${cardType.toLowerCase()}`,
        selected ? 'ring-2 ring-primary ring-offset-2 bg-primary/5' : '',
        isSelectableCard ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1' : '',
        customCardReadyClass,
        className
      )}
      onClick={handleClick}
    >
      <CardHeader className={cn('p-2', `card-header-${cardType.toLowerCase()}`)}>
        <div className="flex justify-between items-center">
          <Badge variant="outline" className="bg-black/20 text-white font-medium">
            {typeIcon} {cardType}
          </Badge>
          
          <div className="flex items-center gap-1">
            {isCustomCard && !isEditing && (
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6 rounded-full bg-black/20 text-white" 
                onClick={handleEdit}
              >
                <PencilIcon className="h-3 w-3" />
              </Button>
            )}
            <Badge variant="outline" className="bg-black/20 text-white">#{card.id}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow p-3 overflow-y-auto">
        {isEditing ? (
          <div className="h-full flex flex-col">
            <Textarea 
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="flex-grow text-xs min-h-[60px] resize-none"
              placeholder="Write your custom card text here..."
              onClick={(e) => e.stopPropagation()}
              autoFocus={true}
            />
            <Button 
              size="sm" 
              className="mt-2 w-full"
              onClick={handleSave}
            >
              <CheckIcon className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        ) : (
          <CardDescription className="text-foreground">
            {isBlankCard && isCustomCard ? (
              <>
                <span className="text-muted-foreground italic text-center mb-2 block">
                  This is a custom card - write your own text
                </span>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleEdit}
                  className="w-full"
                >
                  <PencilIcon className="h-3 w-3 mr-1" /> Edit Card
                </Button>
              </>
            ) : (
              card.text
            )}
          </CardDescription>
        )}
      </CardContent>

      <CardFooter className="p-1 text-xs border-t bg-muted">
        <div className="flex justify-between w-full">
          {isCustomCard && <Badge variant="outline">Custom</Badge>}
          {selected && (
            <Badge variant="default" className="ml-auto">
              ✓ Selected
            </Badge>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

/**
 * Card back component for hidden cards
 */
export function CardBack({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const sizeStyles = {
    'sm': 'w-28 h-36',
    'md': 'w-40 h-52',
    'lg': 'w-52 h-64'
  };
  
  return (
    <Card 
      className={cn(
        'flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 shadow-lg',
        sizeStyles[size],
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-foreground flex items-center justify-center">
        <span className="text-2xl">❓</span>
      </div>
      <CardContent className="p-2 text-center">
        <p className="text-xs text-white font-medium mt-2">Twilight Tales</p>
      </CardContent>
    </Card>
  );
}

/**
 * Simple function to normalize card types
 * Simplified replacement for the complex normalizeCardType function
 */
export function normalizeCardType(cardType: string | undefined, debug = false): string {
  // If no card type, return unknown
  if (!cardType) return 'unknown';
  
  // Keep it simple - just lowercase the type
  return cardType.toLowerCase();
}

/**
 * Card grid component for displaying multiple cards
 */
export function CardGrid({ 
  cards, 
  selectable = false, 
  selectedCardId,
  onSelectCard,
  onCustomTextChange,
  size = 'md',
  className 
}: { 
  cards: CardType[];
  selectable?: boolean;
  selectedCardId?: number | null;
  onSelectCard?: (cardId: number) => void;
  onCustomTextChange?: (cardId: number, text: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4', className)}>
      {cards.map(card => (
        <GameCard
          key={card.id}
          card={card}
          selectable={selectable}
          selected={selectedCardId === card.id}
          onSelect={onSelectCard}
          onCustomTextChange={onCustomTextChange}
          size={size}
        />
      ))}
    </div>
  );
}