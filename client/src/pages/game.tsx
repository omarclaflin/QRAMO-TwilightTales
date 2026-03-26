import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGameState } from '@/hooks/use-game-state';
import { GameCard, CardGrid } from '@/components/card-simple';
import { MoralInput } from '@/components/moral-input';
import { PlayerList } from '@/components/player-list';
import { StoryDisplay } from '@/components/story-display';
import { RulesModal } from '@/components/rules-modal';
import { roundStatus, cardTypes, Card as CardType } from '@shared/schema';
import { cn } from '@/lib/utils';
import { getQRAMOTitle } from '@/lib/qramo-words';

function getEasterEggImage(name: string): string | null {
  if (name === 'q' || name === 'qadri') return 'trickster';
  if (name === 'tuna' || name.includes('tuna')) return 'tuna';
  if (name === 'laser' || name === 'laserwolf' || name === 'coldire') return 'laserwolf';
  if (name === 'ramo') return 'mystic';
  if (name === 'ameer') return 'meerkat';
  if (name === 'tekkai' || name === 'wallace' || name === 'qaed') return 'bravefist';
  if (name === 'qiyam' || name === 'qwavko') return 'templar';
  if (name === 'kevin' || name === 'titan') return 'gunner';
  return null;
}

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
  const [localSelectedCardId, setLocalSelectedCardId] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  
  // Reference to the StoryDisplay component for animation control
  const storyDisplayRef = useRef<any>(null);
  
  // State for judge pick UI
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const [judgeReason, setJudgeReason] = useState<string>('');
  
  const [winnerImage, setWinnerImage] = useState<string>("/assets/player/player_1.png");
  
  // State to track if cards have been revealed to prevent re-animation
  const [cardsRevealed, setCardsRevealed] = useState<boolean>(false);
  
  const { 
    gameState, 
    playerId, 
    currentPlayer,
    selectCard,
    confirmCardSelection,
    updateCustomCard,
    submitMoral,
    judgePick,
    nextRound,
    leaveGame
  } = useGameState();
  
  // Check if the game exists
  useEffect(() => {
    if (!gameState && gameId) {
      console.warn('[GamePage] Game not found:', gameId);
    }
  }, [gameState, gameId]);
  
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
  
  // Reset judge pick state when entering judging phase
  useEffect(() => {
    if (gameState && gameState.round.status === roundStatus.VOTING) {
      console.log('[GamePage] Entering judging phase:', {
        roundNumber: gameState.round.number,
        judgeId: gameState.round.judgeId,
        isCurrentPlayerJudge: playerId === gameState.round.judgeId,
      });
      setSelectedWinnerId(null);
      setJudgeReason('');
    }
  }, [gameState?.round.status, gameState?.round.number]);
  
  const PLAYER_IMAGE_COUNT = 2;
  const PERSONALITY_IMAGE_COUNT = 5;

  // Pick winner image when entering results phase
  useEffect(() => {
    if (gameState && gameState.round.status === roundStatus.RESULTS) {
      const winnerSub = gameState.round.submissions.find(s => s.isWinner);
      if (winnerSub) {
        const player = gameState.players.find(p => p.id === winnerSub.playerId);
        if (player?.isAI && player.personality) {
          const imgIndex = Math.floor(Math.random() * PERSONALITY_IMAGE_COUNT) + 1;
          setWinnerImage(`/assets/personalities/${player.personality}_${imgIndex}.png`);
        } else if (player) {
          const nameLower = player.name.toLowerCase();
          const easterEgg = getEasterEggImage(nameLower);
          if (easterEgg) {
            const imgIndex = Math.floor(Math.random() * 5) + 1;
            setWinnerImage(`/assets/easter/${easterEgg}_${imgIndex}.png`);
          } else {
            const imgIndex = Math.floor(Math.random() * PLAYER_IMAGE_COUNT) + 1;
            setWinnerImage(`/assets/player/player_${imgIndex}.png`);
          }
        }
      } else {
        const imgIndex = Math.floor(Math.random() * PLAYER_IMAGE_COUNT) + 1;
        setWinnerImage(`/assets/player/player_${imgIndex}.png`);
      }
    }
  }, [gameState?.round.status, gameState?.round.number]);

  // Reset client state when round status changes
  useEffect(() => {
    if (gameState && gameState.round.status === roundStatus.SELECTION) {
      console.log('[GamePage] New round started, resetting local state');
      setCardsRevealed(false);
      console.log('[GamePage] Reset state for new round');
    }
  }, [gameState?.round.status, gameState?.round.number]);
  
  // Handle temporary card selection (client-side only)
  const handleCardSelect = (cardId: number) => {
    console.log(`[GamePage] Selecting card ${cardId} (temporary UI state)`);
    // Update local state first
    setLocalSelectedCardId(cardId);
    // Then update through socket manager
    selectCard(cardId);
  };
  
  // Handle moral submission
  const handleMoralSubmit = (moral: string) => {
    submitMoral(moral);
  };
  
  // Handle judge pick submission
  const handleJudgePick = () => {
    if (selectedWinnerId && judgeReason.trim()) {
      judgePick(selectedWinnerId, judgeReason.trim());
    }
  };
  
  // Callback for when StoryDisplay has finished revealing cards
  const handleCardsRevealed = () => {
    console.log('[GamePage] All cards have been revealed, marking as revealed');
    setCardsRevealed(true);
  };
  
  // Handle next round
  const handleNextRound = () => {
    setLocalSelectedCardId(null);
    setSelectedWinnerId(null);
    setJudgeReason('');
    setCardsRevealed(false);
    
    if (storyDisplayRef.current && storyDisplayRef.current.resetAnimation) {
      storyDisplayRef.current.resetAnimation();
    }
    
    nextRound();
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
    
    // Retrieve all selected cards from ALL players (including judge)
    const submittedCards: (ExtendedCard | null)[] = [];
    
    gameState.players.forEach(player => {
      if (!player.selectedCard || !player.hand) return;
      
      const card = player.hand.find(c => c.id === player.selectedCard);
      if (card) {
        submittedCards.push({
          ...card,
          playerCardType: player.currentCardType || null
        });
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
        return 'Judge Picks Winner';
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
            <div className="flex items-center gap-4">
              {gameState.round.judgeId && (
                <div className="flex items-center">
                  <span className="text-gray-600 mr-1">Judge:</span>
                  <Badge variant={playerId === gameState.round.judgeId ? "default" : "outline"}>
                    {gameState.players.find(p => p.id === gameState.round.judgeId)?.name || '?'}
                    {playerId === gameState.round.judgeId && ' (You)'}
                  </Badge>
                </div>
              )}
              <div>
                <span className="text-gray-600 mr-2">Status:</span>
                <span className="font-medium text-primary">{getRoundStatusText()}</span>
              </div>
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
              <p className="text-gray-600 mt-1">Thanks for playing {getQRAMOTitle()}!</p>
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
                          .then(() => {})
                          .catch((error: unknown) => {
                            console.error('[GamePage] Error updating custom card:', error);
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
                            .then(() => {})
                            .catch((error: unknown) => {
                              console.error('[GamePage] Error confirming card:', error);
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
                
                {playerId === gameState.round.judgeId ? (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-amber-800 font-medium">You are the judge this round!</p>
                    <p className="text-gray-600 mt-2">Sit back and wait for other players to submit their morals. You'll pick the winner.</p>
                  </div>
                ) : !hasSubmittedMoral() ? (
                  <MoralInput 
                    onSubmit={handleMoralSubmit}
                    maxLength={120}
                  />
                ) : (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800 font-medium">Your moral has been submitted!</p>
                    <p className="text-gray-600 mt-2">Waiting for other players to submit their morals...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {gameState.round.status === roundStatus.VOTING && (
            // Judge Pick View
            <Card className="shadow-lg border-primary/20">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
                <CardTitle className="flex items-center">
                  <span className="mr-2">Judge Picks Winner</span>
                  <Badge variant="outline" className="bg-primary/10">Round {gameState.round.number}</Badge>
                </CardTitle>
                <CardDescription>
                  {playerId === gameState.round.judgeId
                    ? 'Pick your favorite moral and explain why'
                    : `Waiting for ${gameState.players.find(p => p.id === gameState.round.judgeId)?.name || 'the judge'} to pick the winner...`
                  }
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-6 space-y-6">
                <Card className="border border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">The Story</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base italic leading-relaxed">"{gameState.round.story}"</p>
                  </CardContent>
                </Card>
                
                {playerId === gameState.round.judgeId ? (
                  <div className="space-y-4">
                    <h4 className="text-base font-medium">Pick the winning moral:</h4>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {gameState.round.submissions
                        .filter(s => s.moral !== null)
                        .map((submission) => {
                          const player = gameState.players.find(p => p.id === submission.playerId);
                          const isSelected = submission.playerId === selectedWinnerId;
                          if (!player || !submission.moral) return null;
                          
                          return (
                            <div 
                              key={submission.playerId}
                              className={cn(
                                "p-4 rounded-lg border transition-all cursor-pointer",
                                isSelected
                                  ? "bg-primary/5 border-2 border-primary shadow-md"
                                  : "bg-background hover:bg-muted/20 border-muted/50 hover:shadow-sm"
                              )}
                              onClick={() => setSelectedWinnerId(submission.playerId)}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-sm">
                                  {player.name}
                                  {player.isAI && <Badge variant="outline" className="ml-2 text-xs bg-muted/30">AI</Badge>}
                                </span>
                                {isSelected && (
                                  <Badge className="bg-primary text-primary-foreground">Selected</Badge>
                                )}
                              </div>
                              <p className="text-sm italic break-words whitespace-normal">"{submission.moral}"</p>
                            </div>
                          );
                        })}
                    </div>
                    
                    {selectedWinnerId && (
                      <div className="space-y-3 pt-2">
                        <label className="text-sm font-medium">Why did you pick this one?</label>
                        <textarea
                          className="w-full p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary/50 focus:outline-none"
                          rows={2}
                          maxLength={200}
                          placeholder="Write your reason..."
                          value={judgeReason}
                          onChange={(e) => setJudgeReason(e.target.value)}
                        />
                        <Button
                          className="bg-gradient-to-r from-primary to-primary/80"
                          disabled={!judgeReason.trim()}
                          onClick={handleJudgePick}
                        >
                          Confirm Winner
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-base font-medium">Submitted morals:</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {gameState.round.submissions
                        .filter(s => s.moral !== null)
                        .map((submission) => {
                          const player = gameState.players.find(p => p.id === submission.playerId);
                          const isOwnMoral = submission.playerId === playerId;
                          if (!player || !submission.moral) return null;
                          
                          return (
                            <div 
                              key={submission.playerId}
                              className={cn(
                                "p-4 rounded-lg border bg-background",
                                isOwnMoral && "border-primary/30 bg-primary/5"
                              )}
                            >
                              <span className="font-medium text-sm">
                                {player.name}
                                {isOwnMoral && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                                {player.isAI && <Badge variant="outline" className="ml-2 text-xs bg-muted/30">AI</Badge>}
                              </span>
                              <p className="text-sm italic break-words whitespace-normal mt-1">"{submission.moral}"</p>
                            </div>
                          );
                        })}
                    </div>
                    <div className="mt-4 p-3 bg-muted/20 rounded-lg text-center">
                      <p className="text-sm">Waiting for the judge to pick the winner...</p>
                    </div>
                  </div>
                )}
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
                  {gameState.players.find(p => p.id === gameState.round.judgeId)?.name || 'The judge'} has spoken
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <Card className="border border-muted relative flex-1 md:w-[70%] w-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">The Story</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base italic leading-relaxed">"{gameState.round.story}"</p>
                    </CardContent>
                  </Card>
                  
                  <div className="md:w-[30%] w-full flex justify-center md:justify-end">
                    <div className="w-40 h-40 md:w-52 md:h-52 relative">
                      <img 
                        src={winnerImage} 
                        alt="Round Winner" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Judge's reason */}
                {gameState.round.judgeReason && (
                  <Card className="border border-amber-200 bg-amber-50">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-amber-800 mb-1">
                        {gameState.players.find(p => p.id === gameState.round.judgeId)?.name || 'The judge'} says:
                      </p>
                      <p className="text-sm italic text-amber-900 break-words whitespace-normal">"{gameState.round.judgeReason}"</p>
                    </CardContent>
                  </Card>
                )}
                
                <div className="space-y-3">
                  <h4 className="text-base font-medium flex items-center">
                    <span className="mr-2">Moral Results</span>
                    <Badge variant="outline" className="text-xs">
                      {gameState.round.submissions.length} submissions
                    </Badge>
                  </h4>
                  
                  <div className="space-y-3">
                    {/* Show winner first, then the rest */}
                    {[...gameState.round.submissions]
                      .sort((a, b) => (b.isWinner ? 1 : 0) - (a.isWinner ? 1 : 0))
                      .map((submission) => {
                        const player = gameState.players.find(p => p.id === submission.playerId);
                        const isOwnMoral = submission.playerId === playerId;
                        
                        if (!player || !submission.moral) return null;
                        
                        return (
                          <Card 
                            key={submission.playerId}
                            className={cn(
                              "border overflow-hidden transition-all",
                              submission.isWinner && "shadow-md border-primary/50",
                              isOwnMoral && !submission.isWinner && "border-muted/80"
                            )}
                          >
                            {submission.isWinner && (
                              <div className="bg-gradient-to-r from-primary/90 to-primary/70 text-white px-4 py-1 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">Winner — +1 point</span>
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
                              </div>
                              <p className="text-sm italic break-words whitespace-normal">"{submission.moral}"</p>
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
