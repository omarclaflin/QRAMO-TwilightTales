import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGameState } from '@/hooks/use-game-state';
import { useToast } from '@/hooks/use-toast';
import { GameCard, CardGrid } from '@/components/card-simple';
import { MoralInput } from '@/components/moral-input';
import { PlayerList } from '@/components/player-list';
import { StoryDisplay } from '@/components/story-display';
import { RulesModal } from '@/components/rules-modal';
import { roundStatus, cardTypes, Card as CardType } from '@shared/schema';
import { cn } from '@/lib/utils';

// Extended card type with player card type for story ordering
interface ExtendedCard extends CardType {
  playerCardType?: string | null;
}

// Card type colors and labels
const cardTypeColors: Record<string, string> = {
  [cardTypes.CHARACTER]: 'text-red-500',
  [cardTypes.LOCATION]: 'text-blue-500',
  [cardTypes.INITIAL_TWIST]: 'text-emerald-500',
  [cardTypes.ESCALATION]: 'text-amber-500',
  [cardTypes.FINAL_TWIST]: 'text-purple-500'
};

const cardTypeLabels: Record<string, string> = {
  [cardTypes.CHARACTER]: 'Red (Character)',
  [cardTypes.LOCATION]: 'Blue (Setting)',
  [cardTypes.INITIAL_TWIST]: 'Green (Initial Twist)',
  [cardTypes.ESCALATION]: 'Yellow (Escalation)',
  [cardTypes.FINAL_TWIST]: 'Purple (Final Twist)'
};

const GamePage: React.FC = () => {
  const { gameId } = useParams();
  const { toast } = useToast();
  const [selectedMoral, setSelectedMoral] = useState<string | null>(null);
  const [localSelectedCardId, setLocalSelectedCardId] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  
  // Reference to the StoryDisplay component for animation control
  const storyDisplayRef = useRef<any>(null);
  
  // State for randomized player order during voting
  const [randomizedSubmissions, setRandomizedSubmissions] = useState<any[]>([]);
  
  // State to store unique player codes for the voting round
  const [playerCodes, setPlayerCodes] = useState<{[key: string]: string}>({});
  
  // State to track if cards have been revealed to prevent re-animation
  const [cardsRevealed, setCardsRevealed] = useState<boolean>(false);
  
  const { 
    gameState, 
    playerId, 
    currentPlayer,
    selectCard,
    confirmCardSelection,
    updateCustomCard, // Add the update custom card method
    submitMoral,
    castVote,
    nextRound,
    leaveGame
  } = useGameState();
  
  // Check if the game exists
  useEffect(() => {
    if (!gameState && gameId) {
      toast({
        title: 'Game Not Found',
        description: 'The game you are trying to join does not exist.',
        variant: 'destructive',
      });
    }
  }, [gameState, gameId, toast]);
  
  // Handle synchronizing local selection state with server state
  useEffect(() => {
    if (gameState && currentPlayer) {
      // Only update local selection from server if:
      // 1. We don't have a local selection yet, OR
      // 2. Server has acknowledged our selection (they match)
      if (localSelectedCardId === null || currentPlayer.selectedCard === localSelectedCardId) {
        setLocalSelectedCardId(currentPlayer.selectedCard ?? null);
      }
    }
  }, [gameState, currentPlayer, localSelectedCardId]);
  
  // Generate new player codes when entering voting stage
  useEffect(() => {
    console.log('[GamePage] Round status or number changed:', {
      roundStatus: gameState?.round.status,
      roundNumber: gameState?.round.number,
      previousStatus: '_previous_round_status_', // Will be seen in subsequent calls
      playerId,
      cardsRevealed,
      localSelectedCardId,
      submissionsCount: gameState?.round.submissions?.length || 0,
      playerCodesCount: Object.keys(playerCodes).length,
      randomizedSubmissionsCount: randomizedSubmissions.length
    });
    
    if (gameState && gameState.round.status === roundStatus.VOTING) {
      console.log('[GamePage] Entering VOTING stage:', {
        roundNumber: gameState.round.number,
        submissions: gameState.round.submissions.map(s => ({
          playerId: s.playerId,
          cardId: s.cardId,
          hasMoral: !!s.moral,
          votes: s.votes
        })),
        playerCodes: Object.keys(playerCodes).length > 0 ? 'Already generated' : 'Generating new',
        allPlayers: gameState.players.map(p => ({
          id: p.id,
          name: p.name,
          isAI: p.isAI,
          score: p.score,
          hasSelectedCard: p.selectedCard !== null
        }))
      });
      
      // Generate new player codes for this voting round
      const newCodes = generatePlayerCodes();
      setPlayerCodes(newCodes);
      
      // After setting player codes, randomize the submissions
      setTimeout(() => {
        const shuffled = randomizeSubmissions();
        setRandomizedSubmissions(shuffled);
        console.log('[GamePage] Randomized submissions for voting:', {
          shuffledCount: shuffled.length,
          shuffled: shuffled.map(s => ({
            playerId: s.playerId,
            displayName: s.displayName,
            hasMoral: !!s.moral,
            votes: s.votes
          }))
        });
      }, 0);
    }
  }, [gameState?.round.status, gameState?.round.number]);
  
  // Reset client state when round status changes
  useEffect(() => {
    if (gameState && gameState.round.status === roundStatus.SELECTION) {
      console.log('[GamePage] New round started, resetting local state');
      setCardsRevealed(false);
      setSelectedMoral(null); // CRITICAL FIX: Reset selected moral when starting a new round
      console.log('[GamePage] Reset selectedMoral state to null for new round');
    }
  }, [gameState?.round.status, gameState?.round.number]);
  
  // Handle temporary card selection (client-side only)
  const handleCardSelect = (cardId: number) => {
    console.log(`[GamePage] Selecting card ${cardId} (temporary UI state)`);
    // Update local state first
    setLocalSelectedCardId(cardId);
    // Then update through socket manager
    selectCard(cardId);
    // Using toast to provide visual feedback for card selection
    toast({
      title: 'Card Selected',
      description: `You have selected card #${cardId}. Click "Confirm Selection" to submit.`,
      duration: 3000,
    });
  };
  
  // Handle moral submission
  const handleMoralSubmit = (moral: string) => {
    submitMoral(moral);
  };
  
  // Handle moral voting
  const handleVote = (playerId: string) => {
    castVote(playerId);
    setSelectedMoral(playerId);
  };
  
  // Callback for when StoryDisplay has finished revealing cards
  const handleCardsRevealed = () => {
    console.log('[GamePage] All cards have been revealed, marking as revealed');
    setCardsRevealed(true);
  };
  
  // Handle next round
  const handleNextRound = () => {
    console.log('[GamePage] handleNextRound called - Before state resets:', {
      roundStatus: gameState?.round.status,
      roundNumber: gameState?.round.number,
      selectedMoral,
      localSelectedCardId,
      playerCodesCount: Object.keys(playerCodes).length,
      randomizedSubmissionsCount: randomizedSubmissions.length,
      cardsRevealed,
      hasStoryDisplayRef: !!storyDisplayRef.current,
      allPlayers: gameState?.players.map(p => ({
        id: p.id,
        name: p.name,
        selectedCard: p.selectedCard,
        score: p.score
      }))
    });
    
    setSelectedMoral(null);
    // Reset local card selection when moving to next round
    setLocalSelectedCardId(null);
    // Reset randomized submissions and player codes for the next round
    setRandomizedSubmissions([]);
    setPlayerCodes({});
    // Reset cards revealed state
    setCardsRevealed(false);
    
    // Reset story display animation state
    if (storyDisplayRef.current && storyDisplayRef.current.resetAnimation) {
      console.log('[GamePage] Resetting StoryDisplay animation state for new round');
      storyDisplayRef.current.resetAnimation();
    }
    
    console.log('[GamePage] Calling nextRound() function');
    nextRound();
    
    // Log again after state resets for debugging
    setTimeout(() => {
      console.log('[GamePage] handleNextRound - After state resets (setTimeout):', {
        selectedMoral: null, // We know this is null now
        localSelectedCardId: null, // We know this is null now
        playerCodesCount: 0, // Should be empty now
        randomizedSubmissionsCount: 0, // Should be empty now
        cardsRevealed: false // Should be false now
      });
    }, 0);
  };
  
  // Handle exit game
  const handleExitGame = () => {
    leaveGame();
  };
  
  // Helper function to get story cards
  const getStoryCards = () => {
    if (!gameState) {
      console.log('[GamePage] No game state available for story cards');
      return [];
    }
    
    console.log('[GamePage] Retrieving story cards from game state:', {
      submissions: gameState.round.submissions.length,
      players: gameState.players.length,
      roundStatus: gameState.round.status
    });
    
    // Define the expected card type order
    const cardTypeOrder = [
      'location',
      'character',
      'initialTwist',
      'escalation',
      'finalTwist'
    ];
    
    // First, retrieve all cards from submissions
    const submittedCards: (ExtendedCard | null)[] = [];
    
    // Add detailed submission logging
    console.log('[GamePage] All submissions:', gameState.round.submissions);
    
    // Map submissions to their corresponding cards
    gameState.round.submissions.forEach(submission => {
      const player = gameState.players.find(p => p.id === submission.playerId);
      if (!player || !player.hand) {
        console.log(`[GamePage] Cannot find player or hand for submission by ${submission.playerId}`);
        submittedCards.push(null);
        return;
      }
      
      const card = player.hand.find(c => c.id === submission.cardId);
      if (!card) {
        console.log(`[GamePage] Cannot find card ${submission.cardId} in player ${player.name}'s hand`);
        console.log(`[GamePage] Available cards in hand:`, player.hand.map(c => c.id));
        submittedCards.push(null);
      } else {
        console.log(`[GamePage] Found card ${card.id} for player ${player.name}: "${card.text}"`);
        // Store the card with its player's card type
        const cardWithType: ExtendedCard = {
          ...card,
          playerCardType: player.currentCardType || null
        };
        submittedCards.push(cardWithType);
      }
    });
    
    // Now sort the cards based on the expected order
    const storyCards = cardTypeOrder.map(cardType => {
      // Find a card matching this type
      return submittedCards.find(card => {
        if (!card) return false;
        
        // Check if the player's assigned card type matches
        if (card.playerCardType === cardType) return true;
        
        // Also check the card's own type if available
        return card.type && card.type.toLowerCase() === cardType.toLowerCase();
      }) || null;
    }).filter(card => card !== null); // Remove any nulls
    
    console.log('[GamePage] Ordered story cards:', storyCards.map(c => c ? 
      `${c.id}(${c.type || 'unknown'}) from player with assigned type ${(c as any).playerCardType}` : 
      'null').join(', '));
    
    return storyCards;
  };
  
  // Helper function to find the submission by player ID
  const getSubmissionByPlayerId = (playerId: string) => {
    if (!gameState) return null;
    return gameState.round.submissions.find(s => s.playerId === playerId);
  };
  
  // Helper function to check if all players have submitted morals
  const allMoralsSubmitted = () => {
    if (!gameState) return false;
    return gameState.players.every(p => getSubmissionByPlayerId(p.id)?.moral);
  };
  
  // Helper function to check if player has voted based on server state
  const hasVoted = () => {
    // First check local UI state
    if (selectedMoral !== null) {
      console.log(`[GamePage] hasVoted(): Local UI state shows player has voted (selectedMoral: ${selectedMoral})`);
      return true;
    }
    
    // Then check server state from current player's submission
    if (!gameState || !playerId) {
      console.log(`[GamePage] hasVoted(): No gameState or playerId, assuming not voted`);
      return false;
    }
    
    const currentPlayerSubmission = gameState.round.submissions.find(
      s => s.playerId === playerId
    );
    
    // Check both player hasVoted flag and submission hasVoted flag
    const currentPlayer = gameState.players.find(p => p.id === playerId);
    const playerVotedFlag = currentPlayer?.hasVoted === true;
    const submissionVotedFlag = currentPlayerSubmission?.hasVoted === true;
    
    // Log detailed state for debugging
    console.log(`[GamePage] hasVoted() server state check:`, {
      playerId,
      playerHasVoted: playerVotedFlag,
      submissionHasVoted: submissionVotedFlag,
      roundNumber: gameState.round.number,
      roundStatus: gameState.round.status
    });
    
    // If either flag indicates voting, consider the player as having voted
    return playerVotedFlag || submissionVotedFlag;
  };
  
  // Helper function to check if player has selected a card
  const hasSelectedCard = () => {
    return currentPlayer?.selectedCard !== null;
  };
  
  // Helper function to check if player has submitted a moral
  const hasSubmittedMoral = () => {
    if (!playerId) return false;
    const submission = getSubmissionByPlayerId(playerId);
    return submission?.moral !== null;
  };
  
  // Helper function to generate random codes for players
  const generatePlayerCodes = () => {
    if (!gameState || !gameState.players) return {};
    
    console.log('[GamePage] Generating new player codes for voting anonymity');
    
    const adjectives = [
      'Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Orange', 'Pink', 'Teal',
      'Gray', 'Silver', 'Golden', 'Crystal', 'Shadowy', 'Bright', 'Cosmic'
    ];
    
    const nouns = [
      'Fox', 'Wolf', 'Eagle', 'Hawk', 'Bear', 'Tiger', 'Lion', 'Shark',
      'Dragon', 'Phoenix', 'Serpent', 'Raven', 'Owl', 'Falcon', 'Panther'
    ];
    
    // Generate a unique code for each player
    const codes: {[key: string]: string} = {};
    const usedCodes = new Set<string>();
    
    gameState.players.forEach(player => {
      let code = '';
      // Ensure we don't get duplicate codes
      do {
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        code = `${adjective} ${noun}`;
      } while (usedCodes.has(code));
      
      usedCodes.add(code);
      codes[player.id] = code;
      console.log(`[GamePage] Assigned code "${code}" to player ${player.name}`);
    });
    
    return codes;
  };
  
  // Helper function to randomize submissions for voting
  const randomizeSubmissions = () => {
    console.log('[GamePage] randomizeSubmissions called:', {
      roundStatus: gameState?.round.status,
      roundNumber: gameState?.round.number,
      hasGameState: !!gameState,
      submissionsCount: gameState?.round.submissions?.length || 0,
      playerCodesCount: Object.keys(playerCodes).length,
      playerCodes: Object.keys(playerCodes),
      allSubmissions: gameState?.round.submissions?.map(s => ({
        playerId: s.playerId,
        cardId: s.cardId,
        hasMoral: !!s.moral,
        votes: s.votes
      }))
    });
    
    if (!gameState || !gameState.round.submissions) {
      console.log('[GamePage] No game state or submissions in randomizeSubmissions, returning empty array');
      return [];
    }
    
    // First, generate player codes if they don't exist
    if (Object.keys(playerCodes).length === 0) {
      console.log('[GamePage] No player codes exist, generating new ones in randomizeSubmissions');
      const newCodes = generatePlayerCodes();
      setPlayerCodes(newCodes);
      
      console.log('[GamePage] Generated new player codes:', {
        codeCount: Object.keys(newCodes).length,
        playerIds: Object.keys(newCodes),
        firstFewCodes: Object.entries(newCodes).slice(0, 3).map(([id, code]) => `${id}: ${code}`)
      });
    } else {
      console.log('[GamePage] Using existing player codes:', {
        codeCount: Object.keys(playerCodes).length,
        playerIds: Object.keys(playerCodes),
        firstFewCodes: Object.entries(playerCodes).slice(0, 3).map(([id, code]) => `${id}: ${code}`)
      });
    }
    
    // Filter submissions with morals
    const morals = gameState.round.submissions
      .filter(s => s.moral !== null && s.moral !== undefined)
      .map(s => ({
        ...s,
        displayName: playerCodes[s.playerId] || 'Anonymous Player' // Use player code instead of real name
      }));
    
    console.log('[GamePage] Filtered submissions with morals:', {
      inputSubmissionsCount: gameState.round.submissions.length,
      filteredMoralsCount: morals.length,
      morals: morals.map(m => ({
        playerId: m.playerId,
        hasMoral: !!m.moral,
        displayName: m.displayName,
        hasPlayerCode: !!playerCodes[m.playerId]
      }))
    });
    
    // Randomize the order
    const shuffled = [...morals];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    console.log('[GamePage] Shuffled submissions:', {
      originalCount: morals.length,
      shuffledCount: shuffled.length,
      displayNames: shuffled.map(s => s.displayName)
    });
    
    return shuffled;
  };
  
  // Helper function to get final results
  const getFinalResults = () => {
    if (!gameState) return [];
    
    return [...gameState.players]
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        position: index + 1,
        ...player
      }));
  };
  
  // Helper function to get round status text
  const getRoundStatusText = () => {
    if (!gameState) return '';
    
    switch (gameState.round.status) {
      case roundStatus.SELECTION:
        return 'Card Selection';
      case roundStatus.STORYTELLING:
        return 'Write Your Moral';
      case roundStatus.VOTING:
        return 'Vote for Best Moral';
      case roundStatus.RESULTS:
        return 'Round Results';
      default:
        return gameState.round.status;
    }
  };
  
  if (!gameState) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>Loading game...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Game Header */}
      <Card className="mb-6">
        <CardHeader className="border-b p-4">
          <div className="flex flex-wrap justify-between items-center">
            <h2 className="text-xl font-heading font-bold text-gray-900">
              Round {gameState.round.number} of {gameState.settings.roundsToPlay}
            </h2>
            <div>
              <span className="text-gray-600 mr-2">Status:</span>
              <span className="font-medium text-primary">{getRoundStatusText()}</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Players & Scores</h3>
          <PlayerList 
            players={gameState.players}
            currentPlayerId={playerId}
            mode="game"
            className="flex flex-wrap gap-2"
          />
        </CardContent>
      </Card>
      
      {/* Game Content - Different views based on round status */}
      {gameState.status === 'completed' ? (
        // Game Over View
        <Card>
          <CardHeader className="border-b bg-primary text-white">
            <h3 className="text-lg font-medium">Game Over</h3>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            <div className="text-center py-4">
              <h2 className="text-2xl font-heading font-bold text-gray-900">Final Results</h2>
              <p className="text-gray-600 mt-1">Thanks for playing QRAMO (Questionable Retroactive Aribtrary Moral Offerings)!</p>
            </div>
            
            <div className="final-scores">
              <h4 className="text-base font-medium text-gray-900 mb-4">Final Scores:</h4>
              
              <div className="space-y-3">
                {getFinalResults().map((player, index) => (
                  <div 
                    key={player.id}
                    className={`flex items-center p-3 rounded-lg ${
                      index === 0 
                        ? 'bg-green-50 border-2 border-green-200' 
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className={`flex-none flex items-center justify-center w-10 h-10 rounded-full ${
                      index === 0 ? 'bg-green-500' : 'bg-gray-500'
                    } text-white font-bold`}>
                      {player.position}
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">
                          {player.name} {player.id === playerId && "(You)"}
                        </span>
                        <span className="font-bold text-xl text-gray-900">{player.score}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="justify-center gap-4 p-4">
            <Button onClick={handleExitGame}>
              Exit to Home
            </Button>
          </CardFooter>
        </Card>
      ) : (
        // Active Game Views
        <div className="space-y-6">
          {gameState.round.status === roundStatus.SELECTION && (
            // Card Selection View
            <Card>
              <CardHeader className="border-b p-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Select Your Card</h3>
                  <div className="flex items-center">
                    <span className="text-gray-600 mr-2">Your card type:</span>
                    <span className={`font-medium ${cardTypeColors[currentPlayer?.currentCardType || '']}`}>
                      {cardTypeLabels[currentPlayer?.currentCardType || '']}
                    </span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-4">
                <p className="text-gray-600 mb-4">Select one card from your hand to contribute to the story.</p>
                
                {/* Use our CardGrid component for consistent card display */}
                {currentPlayer?.hand && (
                  <CardGrid
                    cards={currentPlayer.hand.map(card => ({
                      ...card,
                      // Set the card type explicitly based on the player's assigned type
                      type: currentPlayer.currentCardType || 'unknown'
                    }))}
                    selectable={true}
                    onSelectCard={handleCardSelect}
                    selectedCardId={localSelectedCardId}
                    size="md"
                    className="my-6"
                    onCustomTextChange={(cardId, text) => {
                      console.log(`Updating custom card ${cardId} text: ${text}`);
                      // Update custom card text through socket manager
                      if (gameState.gameId) {
                        updateCustomCard(gameState.gameId, cardId, text)
                          .then(() => {
                            toast({
                              title: 'Custom Card Updated',
                              description: 'Your custom card has been updated successfully',
                              duration: 3000,
                            });
                          })
                          .catch((error: unknown) => {
                            console.error('[GamePage] Error updating custom card:', error);
                            toast({
                              title: 'Error',
                              description: 'Failed to update custom card text',
                              variant: 'destructive',
                            });
                          });
                      }
                    }}
                  />
                )}
                
                {/* Submit Button */}
                {currentPlayer && localSelectedCardId != null && (
                  <div className="mt-6 flex flex-col items-center">
                    <Button 
                      size="lg" 
                      variant="default"
                      className="bg-primary font-medium text-white py-5 px-6"
                      onClick={() => {
                        // Actually send the selection to the server
                        if (localSelectedCardId && gameState.gameId) {
                          // Find the selected card to check if it's custom
                          const selectedCard = currentPlayer.hand?.find(c => c.id === localSelectedCardId);
                          const customText = selectedCard?.isCustom ? selectedCard.text : undefined;
                          
                          console.log('[GamePage] Confirming card selection to server:', {
                            cardId: localSelectedCardId,
                            isCustom: !!selectedCard?.isCustom,
                            customText
                          });
                          
                          // Now actually submit the card to the server
                          confirmCardSelection(localSelectedCardId, customText)
                            .then(() => {
                              toast({
                                title: 'Card Confirmed',
                                description: `Your card has been submitted for the story`,
                                duration: 3000,
                              });
                            })
                            .catch((error: unknown) => {
                              console.error('[GamePage] Error confirming card:', error);
                              toast({
                                title: 'Error',
                                description: 'Failed to confirm card selection',
                                variant: 'destructive',
                              });
                            });
                        }
                      }}
                    >
                      Confirm Selection
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>Important:</strong> Your card won't be submitted until you click this button.
                      You can change your selection until you confirm it. 
                      AI players will make their selections after you confirm yours.
                    </p>
                  </div>
                )}
                
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Waiting for players to select cards:</h4>
                  <div className="flex flex-wrap gap-2">
                    {gameState.players.map((player) => {
                      const cardType = player.currentCardType || '';
                      const bgColor = player.currentCardType 
                        ? `bg-${cardType.split('-')[0]}-500` 
                        : 'bg-gray-500';
                      const hasSelected = player.selectedCard !== null;
                      
                      return (
                        <div 
                          key={player.id}
                          className={`${bgColor} text-white px-3 py-1 rounded-full text-sm flex items-center`}
                        >
                          <span>{player.name}{player.isAI ? ' (AI)' : ''}</span>
                          {hasSelected && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {player.isThinking && (
                            <span className="ml-1 inline-flex items-center">
                              <span className="animate-pulse">•</span>
                              <span className="animate-pulse delay-100">•</span>
                              <span className="animate-pulse delay-200">•</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {gameState.round.status === roundStatus.STORYTELLING && (
            // Storytelling View
            <Card>
              <CardHeader className="border-b p-4">
                <h3 className="text-lg font-medium text-gray-900">The Story So Far...</h3>
              </CardHeader>
              
              <CardContent className="p-6 space-y-4">
                <StoryDisplay 
                  ref={storyDisplayRef}
                  story={gameState.round.story}
                  cards={getStoryCards()}
                  initiallyRevealed={cardsRevealed}
                  onCardsRevealed={handleCardsRevealed}
                />
                
                {!hasSubmittedMoral() && (
                  <MoralInput 
                    onSubmit={handleMoralSubmit}
                    maxLength={120}
                  />
                )}
                
                {hasSubmittedMoral() && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800 font-medium">Your moral has been submitted!</p>
                    <p className="text-gray-600 mt-2">Waiting for other players to submit their morals...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {gameState.round.status === roundStatus.VOTING && (
            // Voting View
            <Card className="shadow-lg border-primary/20">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
                <CardTitle className="flex items-center">
                  <span className="mr-2">Vote for the Best Moral</span>
                  <Badge variant="outline" className="bg-primary/10">Round {gameState.round.number}</Badge>
                </CardTitle>
                <CardDescription>
                  Choose the moral that best captures the essence of the story
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-6 space-y-6">
                {/* Story Display */}
                <Card className="border border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">The Story</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base italic leading-relaxed">"{gameState.round.story}"</p>
                  </CardContent>
                </Card>
                
                <div className="space-y-2">
                  <h4 className="text-base font-medium">Choose your favorite moral:</h4>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {/* Show randomized submissions when available */}
                    {(randomizedSubmissions.length > 0 ? randomizedSubmissions : gameState.round.submissions)
                      .filter(submission => submission.moral !== null && submission.moral !== undefined)
                      .map((submission) => {
                        const player = gameState.players.find(p => p.id === submission.playerId);
                        const isOwnMoral = submission.playerId === playerId;
                        const isSelected = submission.playerId === selectedMoral;
                        const hasVotedAlready = hasVoted();
                        const displayName = (submission as any).displayName || 
                                           (isOwnMoral ? player?.name : `Mystery ${playerCodes[submission.playerId] || 'Storyteller'}`);
                        
                        if (!player || !submission.moral) return null;
                        
                        return (
                          <div 
                          key={submission.playerId}
                          className={`
                            p-4 rounded-lg border transition-all
                            ${isOwnMoral 
                              ? 'bg-muted/50 border-muted cursor-not-allowed opacity-80'
                              : isSelected
                                ? 'bg-primary/5 border-2 border-primary shadow-md'
                                : hasVotedAlready 
                                  ? 'bg-background border-muted/50 cursor-not-allowed opacity-80'
                                  : 'bg-background hover:bg-muted/20 border-muted/50 cursor-pointer hover:shadow-sm'
                            }
                          `}
                          onClick={() => !isOwnMoral && !hasVotedAlready && handleVote(submission.playerId)}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-sm">
                              {/* Show anonymous player labels during voting, except for the current player */}
                              {isOwnMoral 
                                ? (
                                  <>
                                    {player.name}
                                    <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                                  </>
                                ) 
                                : (
                                  <>
                                    {displayName}
                                    {player.isAI && <Badge variant="outline" className="ml-2 text-xs bg-muted/30">AI</Badge>}
                                  </>
                                )
                              }
                            </span>
                            
                            {isSelected && (
                              <Badge className="bg-primary text-primary-foreground">Your Vote</Badge>
                            )}
                          </div>
                          
                          <p className="text-sm italic">"{submission.moral}"</p>
                          
                          {isOwnMoral && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Your submission (you cannot vote for your own moral)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {hasVoted() && (
                    <div className="mt-4 p-3 bg-muted/20 rounded-lg text-center">
                      <p className="text-sm">Vote recorded! Waiting for other players to vote...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {gameState.round.status === roundStatus.RESULTS && (
            // Results View
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-white border-b">
                <CardTitle className="flex items-center">
                  <span className="mr-2">Round Results</span>
                  <Badge variant="outline" className="text-white border-white/40 bg-white/10">
                    Round {gameState.round.number} of {gameState.settings.roundsToPlay}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-white/80">
                  See who won this round and the points awarded
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-6 space-y-6">
                {/* Story Display with TV Narrator side by side */}
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  {/* Story Card (70% width on desktop) */}
                  <Card className="border border-muted relative flex-1 md:w-[70%] w-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">The Story</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base italic leading-relaxed">"{gameState.round.story}"</p>
                    </CardContent>
                  </Card>
                  
                  {/* TV Narrator Image (30% width on desktop) */}
                  <div className="md:w-[30%] w-full flex justify-center md:justify-end">
                    <div className="w-40 h-40 md:w-52 md:h-52 relative">
                      <img 
                        src="/assets/narrator.png" 
                        alt="TV Narrator" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-base font-medium flex items-center">
                    <span className="mr-2">Moral Results</span>
                    <Badge variant="outline" className="text-xs">
                      {gameState.round.submissions.length} submissions
                    </Badge>
                  </h4>
                  
                  <div className="space-y-3">
                    {/* Sort submissions by votes (highest first) */}
                    {[...gameState.round.submissions]
                      .sort((a, b) => b.votes - a.votes)
                      .map((submission) => {
                        const player = gameState.players.find(p => p.id === submission.playerId);
                        // Find highest vote count
                        const highestVotes = Math.max(...gameState.round.submissions.map(s => s.votes));
                        const isWinner = submission.votes > 0 && submission.votes === highestVotes;
                        const isOwnMoral = submission.playerId === playerId;
                        
                        if (!player || !submission.moral) return null;
                        
                        return (
                          <Card 
                            key={submission.playerId}
                            className={cn(
                              "border overflow-hidden transition-all",
                              isWinner && "shadow-md border-primary/50",
                              isOwnMoral && !isWinner && "border-muted/80"
                            )}
                          >
                            {isWinner && (
                              <div className="bg-gradient-to-r from-primary/90 to-primary/70 text-white px-4 py-1 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">Winner</span>
                              </div>
                            )}
                            <div className="p-4">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center">
                                  <span className="font-medium">
                                    {player.name}
                                    {isOwnMoral && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                                    {player.isAI && <Badge variant="outline" className="ml-2 text-xs bg-muted/30">AI</Badge>}
                                  </span>
                                </div>
                                
                                <div>
                                  {isWinner ? (
                                    <Badge className="bg-primary text-primary-foreground">
                                      +{submission.votes} points
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">
                                      {submission.votes} {submission.votes === 1 ? 'vote' : 'votes'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm italic">"{submission.moral}"</p>
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                  
                  {/* Player score summary */}
                  <div className="mt-6 pt-4 border-t border-muted">
                    <h4 className="text-base font-medium mb-3">Current Scores</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[...gameState.players]
                        .sort((a, b) => b.score - a.score)
                        .map(player => (
                          <div 
                            key={player.id} 
                            className={cn(
                              "p-2 border rounded-md bg-muted/10 flex justify-between",
                              player.id === playerId && "border-primary/30 bg-primary/5"
                            )}
                          >
                            <span className="font-medium text-sm truncate">
                              {player.name} {player.id === playerId && "(You)"}
                            </span>
                            <Badge variant={player.id === playerId ? "default" : "outline"} className="ml-2">
                              {player.score}
                            </Badge>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="justify-end border-t p-4 bg-muted/5">
                <Button 
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  onClick={handleNextRound}
                >
                  {gameState.round.number < gameState.settings.roundsToPlay ? 'Next Round' : 'See Final Results'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      )}
      
      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
      />
    </div>
  );
};

export default GamePage;
