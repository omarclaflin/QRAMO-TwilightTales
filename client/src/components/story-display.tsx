import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Card } from '@shared/schema';
import { cn } from '@/lib/utils';
import {
  Card as UICard,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// Import the simplified card implementation
import { GameCard, CardBack, normalizeCardType, getCardType } from '@/components/card-simple';
import { PlayIcon, PauseIcon, FlameIcon, EyeIcon } from 'lucide-react';

interface StoryDisplayProps {
  story: string;
  cards?: (Card | null)[];
  className?: string;
  initiallyRevealed?: boolean; // Add this prop
  onCardsRevealed?: () => void; // Add this prop
}

// Define the ref interface
export interface StoryDisplayRef {
  resetAnimation: () => void;
}

/**
 * Component for displaying the assembled story with animated card reveal
 */
// Helper function to get a stable string representation of card IDs
const getCardIdsString = (cardsArray: (Card | null)[]) => {
  return cardsArray
    .filter(c => c !== null)
    .map(c => c!.id)
    .sort()
    .join(',');
};

export const StoryDisplay = forwardRef<StoryDisplayRef, StoryDisplayProps>(({ 
  story, 
  cards, 
  className, 
  initiallyRevealed = false,
  onCardsRevealed
}, ref) => {
  // Debug what's being passed in
  console.log('[StoryDisplay] Rendering with story and cards:', { 
    storyLength: story?.length, 
    cardsCount: cards?.length,
    cards: cards ? cards.map(c => c ? `${c.id}(${c.type || 'unknown'})` : 'null').join(', ') : 'none'
  });
  
  // State to track which cards have been revealed
  const [revealedCards, setRevealedCards] = useState<boolean[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [allRevealed, setAllRevealed] = useState(false);
  const [storyRevealed, setStoryRevealed] = useState(false);
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs to track if we've already animated this set of cards
  const hasAnimatedRef = useRef(false);
  const cardIdsRef = useRef('');
  // Ref to track if component has been initialized
  const initializedRef = useRef(false);

  // Group cards by type to display them in a logical order
  const groupedCards = React.useMemo(() => {
    if (!cards) return {};
    
    console.log('[StoryDisplay] Grouping cards by type:', cards);
    
    // Map of standard card types we expect in the storyline
    const expectedTypes = [
      'location',
      'character',
      'initialTwist',
      'escalation',
      'finalTwist'
    ];
    
    // First, track all existing card types to make sure we don't have card type capitalization issues
    const foundTypes = new Set<string>();
    cards.forEach(card => {
      if (card && card.type) {
        foundTypes.add(card.type.toLowerCase());
      }
    });
    
    console.log('[StoryDisplay] Found card types:', Array.from(foundTypes));
    
    // Initialize the accumulator with all expected types
    const initialAcc: Record<string, Card[]> = {};
    expectedTypes.forEach(type => {
      initialAcc[type] = [];
    });
    
    return cards.reduce((acc: Record<string, Card[]>, card, index) => {
      if (!card) return acc;
      
      // Determine the card type with fallbacks:
      // 1. Use card.type if it exists
      // 2. If we're missing that, use position in the array as a fallback
      let typeToUse: string;
      
      if (card.type) {
        // Use our simplified getCardType function
        const playerCardType = (card as any).playerCardType;
        typeToUse = getCardType(card.type, playerCardType);
        
        // Check if it's a known type, otherwise use the original
        if (!expectedTypes.includes(typeToUse)) {
          // Try to match by substring (e.g., match 'character-card' to 'character')
          const matchedType = expectedTypes.find(t => typeToUse.includes(t));
          if (matchedType) {
            typeToUse = matchedType;
          }
        }
        
        console.log(`[StoryDisplay] Card ${card.id} type: "${card.type}" with playerCardType "${playerCardType || 'none'}" → "${typeToUse}"`);
      } else {
        // Fallback to using position in array
        typeToUse = expectedTypes[index] || 'unknown';
        console.log(`[StoryDisplay] No type for card ${card.id}, using position-based fallback: "${typeToUse}"`);
      }
      
      if (!acc[typeToUse]) {
        acc[typeToUse] = [];
      }
      
      // Always ensure the card has a type property
      const cardWithType = card.type ? card : { ...card, type: typeToUse };
      acc[typeToUse].push(cardWithType);
      
      return acc;
    }, initialAcc);
  }, [cards]);

  // Define the order for card types in the story
  const cardTypeOrder = ['location', 'character', 'initialTwist', 'escalation', 'finalTwist'];
  
  // Story connectors for each card type
  const storyConnectors: Record<string, string> = {
    'location': 'In a',
    'character': 'A',
    'initialTwist': 'Notices',
    'escalation': 'And then',
    'finalTwist': 'All because'
  };
  
  // Get ordered cards for sequential reveal
  const orderedCards = React.useMemo(() => {
    console.log('[StoryDisplay] Generating ordered cards from:', groupedCards);
    const ordered = cardTypeOrder.flatMap(type => groupedCards[type] || []);
    console.log('[StoryDisplay] Result ordered cards:', ordered);
    // If no cards were ordered by type, just use all cards
    if (ordered.length === 0 && cards && cards.length > 0) {
      console.log('[StoryDisplay] Falling back to all cards');
      return cards.filter(card => card !== null) as Card[];
    }
    return ordered;
  }, [groupedCards, cards, cardTypeOrder]);

  // Initialize the revealed state when cards change and auto-start animation
  useEffect(() => {
    // If parent says cards are already revealed, show them all immediately
    if (initiallyRevealed && cards && cards.length > 0) {
      console.log('[StoryDisplay] Skipping animation - cards already revealed');
      setRevealedCards(new Array(cards.length).fill(true));
      setAllRevealed(true);
      setStoryRevealed(true);
      return;
    }
    
    // Only run this effect once per component mount and if not already revealed
    if (!initiallyRevealed && !initializedRef.current && cards && cards.length > 0) {
      initializedRef.current = true;
      console.log('[StoryDisplay] Initializing animation - first time');
      
      // Start with all cards hidden
      setRevealedCards(new Array(cards.length).fill(false));
      setAllRevealed(false);
      setStoryRevealed(true);
      
      // Start animation after a short delay
      const timer = setTimeout(() => {
        console.log('[StoryDisplay] Starting card reveal animation');
        startRevealAnimation();
        // Mark that we've animated this set of cards
        hasAnimatedRef.current = true;
      }, 500);
      
      return () => {
        clearTimeout(timer);
        // Only reset on unmount
        initializedRef.current = false;
      };
    }
  }, [cards, initiallyRevealed]); // Include initiallyRevealed in dependencies
  
  // Add a new useEffect that only handles changes to the number of cards
  useEffect(() => {
    // Only run if we've already initialized but the number of cards changes
    if (initializedRef.current && cards && revealedCards.length !== cards.length) {
      console.log('[StoryDisplay] Card count changed, resetting animation state');
      setRevealedCards(new Array(cards.length).fill(false));
      setAllRevealed(false);
      
      // Start animation after a short delay
      const timer = setTimeout(() => {
        console.log('[StoryDisplay] Starting card reveal animation after count change');
        startRevealAnimation();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [cards?.length, revealedCards.length]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  // Function to start the card reveal animation
  const startRevealAnimation = () => {
    if (isRevealing || allRevealed || !cards || cards.length === 0 || orderedCards.length === 0) {
      console.log('[StoryDisplay] Cannot start animation - no cards or already animating:', { 
        isRevealing, 
        allRevealed, 
        cardsCount: cards?.length, 
        orderedCardsCount: orderedCards?.length 
      });
      // Auto-reveal all cards if we can't animate
      if (cards && cards.length > 0 && !allRevealed) {
        revealAllCards();
      }
      return;
    }
    
    console.log('[StoryDisplay] Starting card reveal animation sequence');
    console.log('[StoryDisplay] Available cards:', cards.map(c => c ? `${c.id} (${c.type})` : 'null'));
    console.log('[StoryDisplay] Ordered cards for reveal:', orderedCards.map(c => `${c.id} (${c.type})`));
    
    setIsRevealing(true);
    // Always show story once animation starts
    setStoryRevealed(true);
    
    // Reveal cards one by one with delay
    let currentIndex = 0;
    
    const revealNextCard = () => {
      if (!cards || !orderedCards || orderedCards.length === 0) {
        console.error('[StoryDisplay] Missing cards data during reveal');
        setIsRevealing(false);
        // Auto-reveal all cards as fallback
        revealAllCards();
        return;
      }
      
      if (currentIndex >= orderedCards.length) {
        console.log('[StoryDisplay] All cards revealed, animation complete');
        setIsRevealing(false);
        setAllRevealed(true);
        
        // Notify parent that cards are revealed
        if (onCardsRevealed) {
          onCardsRevealed();
        }
        return;
      }
      
      const cardToReveal = orderedCards[currentIndex];
      if (!cardToReveal) {
        console.error(`[StoryDisplay] Failed to find card at index ${currentIndex}`);
        currentIndex++;
        revealTimerRef.current = setTimeout(revealNextCard, 1000);
        return;
      }
      
      // Find this card in the full cards array
      const indexInAllCards = cards.findIndex(c => c && c.id === cardToReveal.id);
      
      if (indexInAllCards >= 0) {
        console.log(`[StoryDisplay] Revealing card ${cardToReveal.id} (${cardToReveal.type || 'unknown'}) at position ${currentIndex}`);
        setRevealedCards(prev => {
          const newRevealed = [...prev];
          newRevealed[indexInAllCards] = true;
          return newRevealed;
        });
      } else {
        console.error(`[StoryDisplay] Could not find card ${cardToReveal.id} in cards array`);
      }
      
      currentIndex++;
      // 1 second per card animation
      revealTimerRef.current = setTimeout(revealNextCard, 1000);
    };
    
    // Start the reveal sequence
    revealNextCard();
  };

  // Function to reveal all cards at once
  const revealAllCards = () => {
    if (cards && cards.length > 0) {
      console.log('[StoryDisplay] Revealing all cards at once');
      setRevealedCards(new Array(cards.length).fill(true));
      setAllRevealed(true);
      setIsRevealing(false);
      setStoryRevealed(true);
      
      // Clear any ongoing reveal timer
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      
      // Notify parent that cards are revealed
      if (onCardsRevealed) {
        onCardsRevealed();
      }
    }
  };
  
  // Reset function to be called when starting a new round
  const resetAnimation = () => {
    console.log('[StoryDisplay] Manually resetting animation state');
    initializedRef.current = false;
    hasAnimatedRef.current = false;
    cardIdsRef.current = '';
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };
  
  // Expose methods via ref using useImperativeHandle
  useImperativeHandle(ref, () => ({
    resetAnimation
  }));

  // This component now auto-reveals cards with no manual controls

  // If no story is provided, show placeholder
  if (!story) {
    return (
      <UICard className={cn('w-full max-w-2xl mx-auto', className)}>
        <CardHeader>
          <CardTitle>The Story</CardTitle>
          <CardDescription>
            A story will appear here once all players have selected their cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-8">
          <div className="text-xl italic text-muted-foreground">Waiting for cards...</div>
        </CardContent>
      </UICard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Only show story after cards have been revealed */}
      {storyRevealed && (
        <UICard className={cn('w-full max-w-2xl mx-auto', className)}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">The Story</span>
              <Badge variant="outline">Complete</Badge>
            </CardTitle>
            <CardDescription>
              A bizarre tale assembled from everyone's cards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg italic font-medium leading-relaxed p-6 bg-gradient-to-r from-primary/5 to-background rounded-lg border border-primary/20 shadow-sm">
              "{story}"
            </p>
          </CardContent>
        </UICard>
      )}
      
      {/* Card reveal section - clean grid display without headers */}
      {cards && cards.length > 0 && orderedCards.length > 0 && (
        <div className="mt-8 mb-16 max-w-5xl mx-auto">
          {/* Display cards in a clean grid without headers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 justify-items-center">
            {/* Order cards in story sequence */}
            {orderedCards.map((card, index) => {
              const cardIndex = cards.findIndex(c => c?.id === card.id);
              const isRevealed = cardIndex >= 0 ? revealedCards[cardIndex] : false;
              
              // Get card type using our simplified getCardType function
              // Check for playerCardType first (from ExtendedCard)
              const playerCardType = (card as any).playerCardType; 
              const cardType = getCardType(card.type, playerCardType);
              
              return (
                <div key={card.id} className="relative perspective-card w-full story-section">
                  {/* Card label */}
                  <div className="text-sm font-medium text-center mb-2">
                    <span className={`text-${cardType || 'muted'}-500 font-semibold`}>
                      {cardType && storyConnectors[cardType] 
                        ? storyConnectors[cardType] 
                        : `Part ${index + 1}`}
                    </span>
                  </div>
                  
                  {/* Card container with fixed height to prevent layout shift */}
                  <div className="card-container-md relative">
                    <div 
                      className={cn(
                        "transform-style-3d absolute w-full h-full",
                        isRevealed ? "" : "rotate-y-180" // flipped state controls rotation
                      )}
                      style={{
                        transition: 'transform 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
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
                          opacity: isRevealed ? 1 : 0,
                          transition: 'opacity 0.3s ease-in-out',
                          zIndex: isRevealed ? 1 : 0
                        }}
                      >
                        <GameCard 
                          card={card}
                          size="md"
                          className="perspective-card"
                        />
                      </div>
                      
                      {/* Back of card */}
                      <div 
                        className="absolute w-full h-full backface-hidden"
                        style={{
                          backfaceVisibility: 'hidden', 
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                          opacity: isRevealed ? 0 : 1,
                          transition: 'opacity 0.3s ease-in-out',
                          zIndex: isRevealed ? 0 : 1
                        }}
                      >
                        <CardBack size="md" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

interface MoralInputProps {
  onSubmit: (moral: string) => void;
  maxLength?: number;
  defaultValue?: string;
  disabled?: boolean;
}

/**
 * Component for entering a moral for the story
 */
export function MoralInput({ 
  onSubmit, 
  maxLength = 150, 
  defaultValue = '',
  disabled = false
}: MoralInputProps) {
  const [moral, setMoral] = React.useState(defaultValue);
  const [charCount, setCharCount] = React.useState(defaultValue.length);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    if (value.length <= maxLength) {
      setMoral(value);
      setCharCount(value.length);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (moral.trim() && !disabled) {
      onSubmit(moral.trim());
    }
  };

  return (
    <UICard>
      <CardHeader>
        <CardTitle>The Moral of the Story</CardTitle>
        <CardDescription>
          What lesson can be learned from this bizarre tale?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              className="w-full h-32 p-4 border rounded-md bg-gradient-to-r from-background to-primary/5 resize-none focus:ring-2 focus:ring-primary/30 focus:outline-none transition-all"
              placeholder="Enter a clever, insightful moral (e.g., 'In a world of talking appliances, it's still best to unplug the toaster before taking a bath.')"
              value={moral}
              onChange={handleChange}
              disabled={disabled}
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {charCount}/{maxLength}
            </div>
          </div>
          <button
            type="submit"
            className={cn(
              "w-full py-3 rounded-md transition-all duration-300 font-semibold",
              "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg",
              "flex items-center justify-center gap-2 transform hover:-translate-y-0.5",
              disabled && "opacity-50 cursor-not-allowed hover:transform-none"
            )}
            disabled={!moral.trim() || disabled}
          >
            <FlameIcon size={18} /> Submit Moral
          </button>
        </form>
      </CardContent>
    </UICard>
  );
}

interface MoralSubmissionProps {
  playerName: string;
  moral: string;
  votes: number;
  isCurrentPlayer?: boolean;
  onVote?: () => void;
  canVote?: boolean;
  className?: string;
}

/**
 * Component for displaying a player's moral submission
 */
export function MoralSubmission({
  playerName,
  moral,
  votes,
  isCurrentPlayer = false,
  onVote,
  canVote = false,
  className
}: MoralSubmissionProps) {
  return (
    <UICard className={cn(
      "w-full transition-shadow", 
      isCurrentPlayer ? "ring-1 ring-primary" : "",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">
              {playerName}
              {isCurrentPlayer && <Badge className="ml-2 text-xs">You</Badge>}
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {votes} {votes === 1 ? 'vote' : 'votes'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-0">
        <p className="text-sm italic">"{moral}"</p>
      </CardContent>
      <CardFooter className="pt-2">
        {canVote && (
          <button
            onClick={onVote}
            className="ml-auto py-1.5 px-4 bg-primary text-primary-foreground text-xs rounded shadow-sm
              hover:bg-primary/90 hover:shadow transition-all duration-300 flex items-center gap-1.5 font-medium"
          >
            <EyeIcon size={14} /> Vote for this moral
          </button>
        )}
        {!canVote && !isCurrentPlayer && (
          <div className="ml-auto text-xs text-muted-foreground">
            {votes > 0 ? "Thanks for voting!" : "Voting will be enabled soon"}
          </div>
        )}
        {isCurrentPlayer && (
          <div className="ml-auto text-xs text-muted-foreground">
            You cannot vote for your own moral
          </div>
        )}
      </CardFooter>
    </UICard>
  );
}