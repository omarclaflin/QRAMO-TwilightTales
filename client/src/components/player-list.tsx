import React from 'react';
import { Player } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TbCrown, TbRobot } from 'react-icons/tb';

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string | null;
  maxPlayers?: number;
  mode?: 'lobby' | 'game';
  className?: string;
}

/**
 * Component for displaying a list of players in the game
 */
export function PlayerList({ 
  players, 
  currentPlayerId, 
  maxPlayers = 5,
  mode = 'lobby',
  className 
}: PlayerListProps) {
  const sortedPlayers = React.useMemo(() => {
    // Sort by host first, then by score (if in game), then by name
    return [...players].sort((a, b) => {
      // Host always comes first
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      
      // Current player comes next
      if (a.id === currentPlayerId && b.id !== currentPlayerId) return -1;
      if (a.id !== currentPlayerId && b.id === currentPlayerId) return 1;
      
      // In game mode, sort by score
      if (mode === 'game') {
        if (a.score !== b.score) return b.score - a.score;
      }
      
      // Finally, sort by name
      return a.name.localeCompare(b.name);
    });
  }, [players, currentPlayerId, mode]);
  
  // Count empty slots
  const emptySlots = Math.max(0, maxPlayers - players.length);

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center justify-between">
          <span>Players</span>
          <Badge variant="outline">
            {players.length}/{maxPlayers}
          </Badge>
        </CardTitle>
        <CardDescription>
          {mode === 'lobby' 
            ? 'Players in the lobby waiting to start' 
            : 'Current player scores'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {sortedPlayers.map(player => (
            <PlayerItem
              key={player.id}
              player={player}
              isCurrentPlayer={player.id === currentPlayerId}
              mode={mode}
            />
          ))}
          
          {emptySlots > 0 && mode === 'lobby' && (
            <>
              {Array.from({ length: emptySlots }).map((_, index) => (
                <EmptyPlayerSlot key={`empty-${index}`} />
              ))}
            </>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

interface PlayerItemProps {
  player: Player;
  isCurrentPlayer: boolean;
  mode: 'lobby' | 'game';
}

/**
 * Individual player item in the player list
 */
function PlayerItem({ player, isCurrentPlayer, mode }: PlayerItemProps) {
  // Check if player has submitted their selection/moral
  const hasSubmitted = mode === 'game' && (
    player.selectedCard !== null || 
    player.submittedMoral !== null
  );
  
  return (
    <li 
      className={cn(
        "flex items-center justify-between p-2 rounded-md",
        isCurrentPlayer ? "bg-primary/10" : "bg-muted/50",
        "border-l-4",
        isCurrentPlayer ? "border-l-primary" : "border-l-transparent"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Player icon/avatar */}
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          {player.isAI ? (
            <TbRobot size={20} className="text-muted-foreground" />
          ) : (
            <span className="font-bold">{player.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        
        {/* Player name */}
        <div className="flex items-center">
          <span className={cn(
            "font-medium",
            player.isAI ? "text-muted-foreground" : ""
          )}>
            {player.name}
          </span>
          
          {isCurrentPlayer && (
            <Badge variant="outline" className="ml-2 text-xs">You</Badge>
          )}
          
          {player.isHost && (
            <TbCrown className="ml-1 text-amber-500" />
          )}
          
          {player.isAI && (
            <Badge variant="outline" className="ml-1 text-xs">AI</Badge>
          )}
        </div>
      </div>
      
      {/* Status indicators */}
      <div className="flex items-center gap-2">
        {/* Score (in game mode) */}
        {mode === 'game' && (
          <Badge variant={player.score > 0 ? "default" : "outline"} className="text-xs">
            {player.score} pts
          </Badge>
        )}
        
        {/* Selection status */}
        {hasSubmitted && (
          <span className="w-2 h-2 rounded-full bg-green-500" title="Submitted" />
        )}
      </div>
    </li>
  );
}

/**
 * Empty player slot placeholder
 */
function EmptyPlayerSlot() {
  return (
    <li className="flex items-center p-2 rounded-md bg-muted/30 border border-dashed border-muted">
      <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
        <span className="text-muted-foreground">?</span>
      </div>
      <span className="ml-2 text-muted-foreground">Empty Slot</span>
    </li>
  );
}