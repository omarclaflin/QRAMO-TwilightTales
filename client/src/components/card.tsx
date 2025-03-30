import React, { useState, useEffect } from 'react';
import { Card as CardType, cardTypes } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PencilIcon, CheckIcon, EyeIcon, EyeOffIcon } from 'lucide-react';

/**
 * Helper function to normalize card types across the application
 * This ensures consistent styling and type handling regardless of the format
 * @param cardType - The type string or constant to normalize
 * @param debug - Optional flag to enable debug logging
 * @returns - A normalized type string for CSS classes and display
 */
export function normalizeCardType(cardType: string | undefined, debug: boolean = false): string {
  if (!cardType) return 'unknown';
  
  let normalizedType = cardType;
  
  // Start by logging the original value
  if (debug) console.log(`[normalizeCardType] Original type: "${cardType}"`);
  
  // Convert to lowercase for case-insensitive matching
  const lowerType = normalizedType.toLowerCase();
  
  // Handle hyphenated formats and convert to camelCase
  if (normalizedType.includes('-')) {
    const parts = normalizedType.split('-');
    normalizedType = parts[0].toLowerCase() + 
      parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    
    if (debug) console.log(`[normalizeCardType] After hyphen handling: "${normalizedType}"`);
  }
  
  // Comprehensive mapping of all possible card type variations
  const typeMap: Record<string, string> = {
    // Character variations
    'character': 'character',
    'charactercard': 'character',
    'character-card': 'character',
    'characterCard': 'character',
    'char': 'character',
    
    // Location variations
    'location': 'location',
    'locationcard': 'location',
    'location-card': 'location',
    'locationCard': 'location',
    'setting': 'location',
    'place': 'location',
    
    // Initial Twist variations
    'initialtwist': 'initialTwist',
    'initial-twist': 'initialTwist',
    'initialtwistcard': 'initialTwist',
    'initial-twist-card': 'initialTwist',
    'initialTwistCard': 'initialTwist',
    'initial': 'initialTwist',
    'firsttwist': 'initialTwist',
    
    // Escalation variations
    'escalation': 'escalation',
    'escalationcard': 'escalation',
    'escalation-card': 'escalation',
    'escalationCard': 'escalation',
    'middle': 'escalation',
    'tension': 'escalation',
    
    // Final Twist variations
    'finaltwist': 'finalTwist',
    'final-twist': 'finalTwist',
    'finaltwistcard': 'finalTwist',
    'final-twist-card': 'finalTwist',
    'finalTwistCard': 'finalTwist',
    'ending': 'finalTwist',
    'final': 'finalTwist'
  };
  
  // Try to match using our comprehensive map first (case insensitive)
  if (typeMap[lowerType]) {
    normalizedType = typeMap[lowerType];
    if (debug) console.log(`[normalizeCardType] Matched in type map: "${normalizedType}"`);
  }
  
  // Also handle cardTypes constants
  const constantsMap: Record<string, string> = {
    [cardTypes.CHARACTER]: 'character',
    [cardTypes.LOCATION]: 'location',
    [cardTypes.INITIAL_TWIST]: 'initialTwist',
    [cardTypes.ESCALATION]: 'escalation',
    [cardTypes.FINAL_TWIST]: 'finalTwist'
  };
  
  if (constantsMap[normalizedType]) {
    normalizedType = constantsMap[normalizedType];
    if (debug) console.log(`[normalizeCardType] Matched from constants: "${normalizedType}"`);
  }
  
  if (debug) console.log(`[normalizeCardType] Final normalized type: "${normalizedType}"`);
  
  return normalizedType;
}

interface GameCardProps {
  card: CardType;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (cardId: number) => void;
  onCustomTextChange?: (cardId: number, text: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  type?: string;
  editable?: boolean;
  flippable?: boolean;
  isFlipped?: boolean;
  onFlip?: (cardId: number, isFlipped: boolean) => void;
}

/**
 * Game card component for displaying story cards
 */
export function GameCard({
  card,
  selectable = false,
  selected = false,
  onSelect,
  onCustomTextChange,
  className,
  size = 'md',
  type,
  editable = false,
  flippable = false,
  isFlipped = true,
  onFlip
}: GameCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [customText, setCustomText] = useState(card.text || '');
  
  useEffect(() => {
    // Update local state when card text changes externally
    setCustomText(card.text || '');
  }, [card.text]);

  // Card type icons (you can replace these with imported icons as needed)
  const typeIcons: Record<string, string> = {
    'location': '🏙️',
    'character': '👤',
    'initialTwist': '🔄',
    'escalation': '📈',
    'finalTwist': '💥'
  };
  
  // Use the normalizeCardType helper function
  const actualType = normalizeCardType(type || card.type, true);
  
  // Use lowercase for CSS class compatibility
  const actualTypeLower = actualType.toLowerCase();
  console.log(`[GameCard] Card ${card.id} type normalized: "${card.type}" → "${actualType}" → CSS class: card-type-${actualTypeLower}`);
  const typeIcon = typeIcons[actualType] || '❓';

  // Size styles
  const sizeStyles = {
    'sm': 'w-28 h-36 text-xs',
    'md': 'w-40 h-52 text-sm',
    'lg': 'w-52 h-64 text-base'
  };

  // Detect custom and blank cards
  const isCustomCard = card.isCustom === true;
  const isBlankCard = !card.text || card.text.trim() === '';
  
  // Set editing state automatically for blank custom cards on first render
  useEffect(() => {
    if (isCustomCard && isBlankCard && !isEditing && editable) {
      setIsEditing(true);
    }
  }, [isCustomCard, isBlankCard, isEditing, editable, card.id]);

  // Handler to flip the card
  const handleFlip = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when flipping
    if (onFlip) {
      onFlip(card.id, !isFlipped);
    }
  };

  // Handler for card click
  const handleClick = () => {
    if (flippable) {
      // If card is flippable, clicking it flips it
      if (onFlip) {
        onFlip(card.id, !isFlipped);
      }
    } else if (selectable && onSelect && !isEditing) {
      // Otherwise, if selectable, it selects the card
      onSelect(card.id);
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when saving
    if (onCustomTextChange) {
      onCustomTextChange(card.id, customText);
    }
    setIsEditing(false);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when editing
    setIsEditing(true);
  };

  // If card is flippable, we return the FlippableCard component
  if (flippable) {
    return (
      <div 
        className={cn(
          "perspective-card relative",
          sizeStyles[size],
          className
        )}
        onClick={handleClick}
      >
        {/* Card flip container with animation */}
        <div 
          className={cn(
            "transform-style-3d w-full h-full",
            isFlipped ? "" : "rotate-y-180" // flipped state controls rotation
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
              opacity: isFlipped ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out',
              zIndex: isFlipped ? 1 : 0,
              pointerEvents: isFlipped ? 'auto' : 'none'
            }}
          >
            <RegularCard 
              card={card}
              selectable={selectable}
              selected={selected}
              onSelect={onSelect}
              onCustomTextChange={onCustomTextChange}
              size={size}
              type={actualType}
              editable={editable}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              customText={customText}
              setCustomText={setCustomText}
              handleSave={handleSave}
              handleEdit={handleEdit}
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
              opacity: isFlipped ? 0 : 1,
              transition: 'opacity 0.3s ease-in-out',
              zIndex: isFlipped ? 0 : 1,
              pointerEvents: isFlipped ? 'none' : 'auto'
            }}
          >
            <CardBack size={size} />
          </div>
        </div>
        
        {/* Optional Flip Button - only visible in certain contexts */}
        {(selectable && !selected) && (
          <Button 
            variant="secondary" 
            size="sm" 
            className="absolute -top-3 -right-3 rounded-full z-10 p-1 h-8 w-8 shadow-lg"
            onClick={handleFlip}
          >
            {isFlipped ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </Button>
        )}
      </div>
    );
  }

  // For non-flippable cards, render the regular card
  return (
    <RegularCard
      card={card}
      selectable={selectable}
      selected={selected}
      onSelect={onSelect}
      onCustomTextChange={onCustomTextChange}
      className={className}
      size={size}
      type={actualType}
      editable={editable}
      isEditing={isEditing}
      setIsEditing={setIsEditing}
      customText={customText}
      setCustomText={setCustomText}
      handleSave={handleSave}
      handleEdit={handleEdit}
      handleClick={handleClick}
    />
  );
}

// Helper component for the regular card without flip functionality
function RegularCard({
  card,
  selectable = false,
  selected = false,
  onSelect,
  onCustomTextChange,
  className,
  size = 'md',
  type,
  editable = false,
  isEditing,
  setIsEditing,
  customText,
  setCustomText,
  handleSave,
  handleEdit,
  handleClick
}: GameCardProps & {
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  customText: string;
  setCustomText: (text: string) => void;
  handleSave: (e: React.MouseEvent) => void;
  handleEdit: (e: React.MouseEvent) => void;
  handleClick?: () => void;
}) {
  // Detect custom and blank cards
  const isCustomCard = card.isCustom === true;
  const isBlankCard = !card.text || card.text.trim() === '';
  
  // Use the normalizeCardType helper function
  const actualType = normalizeCardType(type || card.type, true);
  
  // Use lowercase for CSS class compatibility
  const actualTypeLower = actualType.toLowerCase();
  
  console.log(`[RegularCard] Card ${card.id} type normalized: "${card.type}" → "${actualType}" → CSS class: card-type-${actualTypeLower}`);
  
  // Card type icons
  const typeIcons: Record<string, string> = {
    'location': '🏙️',
    'character': '👤',
    'initialTwist': '🔄',
    'escalation': '📈',
    'finalTwist': '💥'
  };
  const typeIcon = typeIcons[actualType] || '❓';
  
  // Size styles
  const sizeStyles = {
    'sm': 'w-28 h-36 text-xs',
    'md': 'w-40 h-52 text-sm',
    'lg': 'w-52 h-64 text-base'
  };
  
  return (
    <Card 
      className={cn(
        'flex flex-col overflow-hidden transition-all duration-200 shadow-lg',
        sizeStyles[size],
        `card-type-${actualTypeLower}`,
        selected ? 'ring-2 ring-primary ring-offset-2 bg-primary/5 card-select-animation' : '',
        selectable && !isEditing ? 'cursor-pointer hover:shadow-xl float-on-hover' : '',
        selected ? 'transform -translate-y-2' : '',
        className
      )}
      onClick={handleClick}
    >
      <CardHeader className={cn('p-2', `card-header-${actualTypeLower}`)}>
        <div className="flex flex-col gap-1 w-full">
          <div className="flex justify-between items-center">
            <Badge variant="outline" className="bg-black/20 text-white font-medium">
              {typeIcon} {actualType === 'unknown' ? '?' : actualType.charAt(0).toUpperCase() + actualType.slice(1)}
            </Badge>
            
            <div className="flex items-center gap-1">
              {isCustomCard && !isEditing && editable && (
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
          
          {/* Card deck label */}
          <div className="text-[10px] text-white/80 font-medium uppercase tracking-wider">
            QRAMO Classic
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
          <CardDescription className="h-full flex flex-col items-center justify-center text-foreground">
            {isBlankCard && isCustomCard ? (
              <>
                <span className="text-muted-foreground italic text-center mb-2">
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

      <CardFooter className="p-1 text-xs text-muted-foreground border-t bg-muted">
        <div className="flex justify-between w-full">
          {isCustomCard && <Badge variant="outline">Custom</Badge>}
          {selected && (
            <Badge variant="default" className="ml-auto bg-primary text-primary-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Selected
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
  // Size styles
  const sizeStyles = {
    'sm': 'w-28 h-36',
    'md': 'w-40 h-52',
    'lg': 'w-52 h-64'
  };

  return (
    <div 
      className={cn(
        'relative bg-gradient-to-br from-primary/90 to-primary/70 rounded-md shadow-lg flex items-center justify-center perspective-card float-on-hover',
        sizeStyles[size],
        className
      )}
    >
      <div className="absolute inset-1 border-2 border-white/10 rounded-md bg-black/5"></div>
      <div className="text-center">
        <div className="text-xl font-bold text-primary-foreground">
          Twilight
        </div>
        <div className="text-lg font-medium text-primary-foreground/80">
          Tales
        </div>
        <div className="mt-2 text-[10px] text-primary-foreground/60 uppercase tracking-widest font-bold">
          The Card Game
        </div>
      </div>
    </div>
  );
}

/**
 * Card grid component for displaying multiple cards
 */
export function CardGrid({ 
  cards, 
  onSelect, 
  selectedCardId,
  onCustomTextChange,
  cardSize = 'md',
  className,
  editable = false,
  flippable = false,
  flippedCardIds = {},
  onFlip
}: { 
  cards: CardType[], 
  onSelect?: (cardId: number) => void,
  selectedCardId?: number | null,
  onCustomTextChange?: (cardId: number, text: string) => void,
  cardSize?: 'sm' | 'md' | 'lg',
  className?: string,
  editable?: boolean,
  flippable?: boolean,
  flippedCardIds?: Record<number, boolean>,
  onFlip?: (cardId: number, isFlipped: boolean) => void
}) {
  return (
    <div className={cn('flex flex-wrap gap-4 justify-center', className)}>
      {cards.map(card => (
        <GameCard 
          key={card.id}
          card={card}
          selectable={!!onSelect}
          selected={selectedCardId === card.id}
          onSelect={onSelect}
          onCustomTextChange={onCustomTextChange}
          size={cardSize}
          type={card.type}
          editable={editable}
          flippable={flippable}
          isFlipped={flippedCardIds?.[card.id] ?? true} // Default to showing front if no state provided
          onFlip={onFlip}
        />
      ))}
    </div>
  );
}

/**
 * A grid of cards that all start face down and can be flipped
 */
export function FlippableCardGrid({
  cards,
  onSelect,
  selectedCardId,
  cardSize = 'md',
  className
}: {
  cards: CardType[],
  onSelect?: (cardId: number) => void,
  selectedCardId?: number | null,
  cardSize?: 'sm' | 'md' | 'lg',
  className?: string
}) {
  // Track which cards are flipped (showing their front)
  const [flippedCardIds, setFlippedCardIds] = useState<Record<number, boolean>>({});
  
  // Function to handle card flip
  const handleFlip = (cardId: number, isFlipped: boolean) => {
    setFlippedCardIds(prev => ({
      ...prev,
      [cardId]: isFlipped
    }));
  };
  
  // Function to flip all cards
  const flipAllCards = (flipped: boolean) => {
    const newState: Record<number, boolean> = {};
    cards.forEach(card => {
      newState[card.id] = flipped;
    });
    setFlippedCardIds(newState);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end space-x-2">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => flipAllCards(true)}
          className="flex items-center gap-1"
        >
          <EyeIcon className="h-4 w-4" /> Reveal All
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => flipAllCards(false)}
          className="flex items-center gap-1"
        >
          <EyeOffIcon className="h-4 w-4" /> Hide All
        </Button>
      </div>
      
      <CardGrid
        cards={cards}
        onSelect={onSelect}
        selectedCardId={selectedCardId}
        cardSize={cardSize}
        className={className}
        flippable={true}
        flippedCardIds={flippedCardIds}
        onFlip={handleFlip}
      />
    </div>
  );
}