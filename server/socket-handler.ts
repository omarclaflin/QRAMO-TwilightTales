import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import gameStateManager from './game-state-manager';
import { Player, Game, roundStatus, gameStatus } from '@shared/schema';

// Define message types
enum MessageType {
  JOIN_GAME = 'joinGame',
  CREATE_GAME = 'createGame',
  START_GAME = 'startGame',
  SELECT_CARD = 'selectCard',
  UPDATE_CUSTOM_CARD = 'updateCustomCard',
  SUBMIT_MORAL = 'submitMoral',
  CAST_VOTE = 'castVote',
  NEXT_ROUND = 'nextRound',
  LEAVE_GAME = 'leaveGame',
  GAME_STATE = 'gameState',
  ERROR = 'error',
  MESSAGE = 'message'
}

// Extended Socket interface with game-specific data
interface GameSocket extends Socket {
  playerData?: {
    playerId: string;
    gameId: string;
  };
}

/**
 * Sets up Socket.io server for real-time game communication
 * @param server - HTTP server to attach Socket.io to
 * @returns Socket.io server instance
 */
export function setupWebSocketServer(server: HttpServer) {
  // Initialize Socket.io server with minimal configuration - same as our working test page
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    // Use the absolute minimum configuration that we've proven works in Replit
    transports: ["polling", "websocket"],  // Important: polling first, then websocket
    pingTimeout: 20000,
    pingInterval: 15000
  });
  
  console.log('Socket.io configured with transports:', JSON.stringify(io.engine.opts.transports));
  
  console.log('WebSocket server initialized with Replit-optimized settings');
  console.log(`Socket.io configured with transports: ${JSON.stringify(['polling', 'websocket'])}`);
  
  // Monitor connection statistics more frequently during development
  setInterval(() => {
    const clientCount = io.engine.clientsCount;
    console.log(`[${new Date().toISOString()}] Active Socket.io connections: ${clientCount}`);
    
    // Add more detailed diagnostics - just log client count
    console.log(`Socket.io server info - active clients: ${io.engine.clientsCount}`);
    
  }, 30000); // Log every 30 seconds

  // Store player socket mapping
  const playerSockets = new Map<string, string>(); // playerId -> socketId

  // Connection handler
  io.on('connection', (socket: GameSocket) => {
    const connectionTime = new Date().toISOString();
    console.log(`[${connectionTime}] New Socket.io connection: ${socket.id}`);
    
    /**
     * Creates a new game and assigns the socket's player as host
     * @event create-game
     * @param {Object} data - Request data containing player information
     * @param {string} data.playerName - Name for the player creating the game
     * @param {Function} callback - Callback function to send response
     */
    socket.on(MessageType.CREATE_GAME, (data, callback) => {
      try {
        const playerName = data.playerName?.trim();
        
        if (!playerName) {
          return callback({ success: false, error: 'Player name is required' });
        }
        
        const playerId = uuidv4();
        const player: Omit<Player, 'score' | 'isHost'> = {
          id: playerId,
          name: playerName
        };
        
        const gameId = gameStateManager.createGame(player);
        
        // Associate this socket with the player
        socket.playerData = { playerId, gameId };
        playerSockets.set(playerId, socket.id);
        
        // Join socket room for this game
        socket.join(gameId);
        
        // Send success response
        callback({
          success: true,
          gameId,
          playerId
        });
        
        // Send initial game state
        sendGameStateToClient(socket);
        
        console.log(`Game created: ${gameId} by player ${playerId} (${playerName})`);
      } catch (error) {
        console.error('Error creating game:', error);
        callback({ success: false, error: 'Failed to create game' });
      }
    });
    
    /**
     * Handles a player joining an existing game
     * @event join-game
     * @param {Object} data - Request data
     * @param {string} data.gameId - ID of the game to join
     * @param {string} data.playerName - Name of the player joining
     * @param {Function} callback - Callback to send response
     */
    socket.on(MessageType.JOIN_GAME, (data, callback) => {
      try {
        const { gameId, playerName } = data;
        
        if (!gameId || !playerName?.trim()) {
          return callback({ success: false, error: 'Game ID and player name are required' });
        }
        
        const game = gameStateManager.getGameState(gameId);
        if (!game) {
          return callback({ success: false, error: 'Game not found' });
        }
        
        const playerId = uuidv4();
        const player: Omit<Player, 'score'> = {
          id: playerId,
          name: playerName.trim()
        };
        
        const success = gameStateManager.joinGame(gameId, player);
        if (!success) {
          return callback({ success: false, error: 'Failed to join game' });
        }
        
        // Associate socket with player and join game room
        socket.playerData = { playerId, gameId };
        playerSockets.set(playerId, socket.id);
        socket.join(gameId);
        
        // Send success response
        callback({
          success: true,
          gameId,
          playerId
        });
        
        // Broadcast updated game state to all players in this game
        broadcastGameState(gameId);
        
        console.log(`Player ${playerId} (${playerName}) joined game ${gameId}`);
      } catch (error) {
        console.error('Error joining game:', error);
        callback({ success: false, error: 'Failed to join game' });
      }
    });
    
    /**
     * Starts a game that is in lobby status
     * @event start-game
     * @param {Object} data - Request data
     * @param {string} data.gameId - ID of the game to start
     * @param {Function} callback - Callback to send response
     */
    socket.on(MessageType.START_GAME, (data, callback) => {
      try {
        const { gameId } = data;
        
        if (!socket.playerData || socket.playerData.gameId !== gameId) {
          return callback({ success: false, error: 'Not authorized to start this game' });
        }
        
        const game = gameStateManager.getGameState(gameId);
        if (!game) {
          return callback({ success: false, error: 'Game not found' });
        }
        
        // Check if the requester is the host
        const player = game.players.find(p => p.id === socket.playerData?.playerId);
        if (!player?.isHost) {
          return callback({ success: false, error: 'Only the host can start the game' });
        }
        
        const success = gameStateManager.startGame(gameId);
        if (!success) {
          return callback({ success: false, error: 'Failed to start game' });
        }
        
        // Broadcast updated game state to all players in this game
        broadcastGameState(gameId);
        
        callback({ success: true });
        console.log(`Game ${gameId} started by host ${socket.playerData.playerId}`);
      } catch (error) {
        console.error('Error starting game:', error);
        callback({ success: false, error: 'Failed to start game' });
      }
    });
    
    /**
     * Handles updating a custom card's text
     * @event update-custom-card
     * @param {Object} data - Request data
     * @param {string} data.gameId - ID of the game
     * @param {number} data.cardId - ID of the card to update
     * @param {string} data.customText - Custom text for the card
     * @param {Function} callback - Callback to send response
     */
    socket.on(MessageType.UPDATE_CUSTOM_CARD, (data, callback) => {
      try {
        const { gameId, cardId, customText } = data;
        
        if (!socket.playerData || socket.playerData.gameId !== gameId) {
          return callback({ success: false, error: 'Not authorized to update this card' });
        }
        
        if (!customText?.trim()) {
          return callback({ success: false, error: 'Custom text cannot be empty' });
        }
        
        const success = gameStateManager.updateCustomCard(gameId, socket.playerData.playerId, cardId, customText.trim());
        if (!success) {
          return callback({ success: false, error: 'Failed to update custom card' });
        }
        
        // Broadcast updated game state to all players in this game
        broadcastGameState(gameId);
        
        callback({ success: true });
        console.log(`Player ${socket.playerData.playerId} updated custom card ${cardId} in game ${gameId}`);
      } catch (error) {
        console.error('Error updating custom card:', error);
        callback({ success: false, error: 'Failed to update custom card' });
      }
    });

    /**
     * Handles a player's card selection
     * @event select-card
     * @param {Object} data - Request data
     * @param {string} data.gameId - ID of the game
     * @param {number} data.cardId - ID of the selected card
     * @param {string} data.customText - Optional custom text for custom cards
     * @param {Function} callback - Callback to send response
     */
    socket.on(MessageType.SELECT_CARD, async (data, callback) => {
      try {
        const { gameId, cardId, customText } = data;
        
        if (!socket.playerData || socket.playerData.gameId !== gameId) {
          return callback({ success: false, error: 'Not authorized to select a card' });
        }
        
        const success = gameStateManager.selectCard(gameId, socket.playerData.playerId, cardId, customText);
        if (!success) {
          return callback({ success: false, error: 'Failed to select card' });
        }
        
        // Get updated game state
        const game = gameStateManager.getGameState(gameId);
        if (!game) return;
        
        // Check if all players have selected cards
        const allSelected = game.players.every(p => p.selectedCard !== null);
        
        // Send success response
        callback({ success: true });
        
        // If not all players have selected, have AI make their selections
        if (!allSelected) {
          // Add async processing of AI selections with proper broadcasting
          (async () => {
            console.log(`[socket-handler] Initiating AI selections for game ${gameId}`);
            
            // Broadcast the initial state (human player selection)
            broadcastGameState(gameId);
            
            // Wait for AI players to make their selections
            await gameStateManager.makeAISelections(gameId);
            
            // Get the updated game state after AI selections
            const updatedGame = gameStateManager.getGameState(gameId);
            
            // Log the status for debugging
            console.log(`[socket-handler] AI selections completed for game ${gameId}, round status: ${updatedGame?.round.status}`);
            
            // Broadcast the updated state after AI players have selected
            broadcastGameState(gameId);
          })();
          
          // Return early, as we'll handle the rest in the async function
          return;
        }
        
        // If we've moved to storytelling phase, generate AI morals
        if (game.round.status === 'storytelling') {
          // First broadcast the current state
          broadcastGameState(gameId);
          
          // Then asynchronously generate AI morals
          await gameStateManager.generateAIMorals(gameId);
          
          // Broadcast again after AI morals are generated
          broadcastGameState(gameId);
          return;
        }
        
        // Broadcast updated game state to all players in this game
        broadcastGameState(gameId);
        
        console.log(`Player ${socket.playerData.playerId} selected card ${cardId} in game ${gameId}`);
      } catch (error) {
        console.error('Error selecting card:', error);
        callback({ success: false, error: 'Failed to select card' });
      }
    });
    
    /**
     * Submits a player's moral for the story
     * @event submit-moral
     * @param {Object} data - Request data
     * @param {string} data.gameId - ID of the game
     * @param {string} data.moral - Moral of the story
     * @param {Function} callback - Callback to send response
     */
    socket.on(MessageType.SUBMIT_MORAL, async (data, callback) => {
      console.log(`[socket-handler] SUBMIT_MORAL event received for game ${data.gameId}`);
      try {
        const { gameId, moral } = data;
        
        if (!socket.playerData || socket.playerData.gameId !== gameId) {
          console.log(`[socket-handler] Not authorized to submit moral for game ${gameId}`);
          return callback({ success: false, error: 'Not authorized to submit a moral' });
        }
        
        if (!moral?.trim()) {
          console.log(`[socket-handler] Empty moral submitted for game ${gameId}`);
          return callback({ success: false, error: 'Moral cannot be empty' });
        }
        
        // Get game state before submission to check if we need to trigger AI morals
        const gameBefore = gameStateManager.getGameState(gameId);
        if (!gameBefore) {
          console.log(`[socket-handler] Game ${gameId} not found before moral submission`);
          return callback({ success: false, error: 'Game not found' });
        }
        
        console.log(`[socket-handler] Submitting moral for player ${socket.playerData.playerId} in game ${gameId}`);
        const success = gameStateManager.submitMoral(gameId, socket.playerData.playerId, moral.trim());
        if (!success) {
          console.log(`[socket-handler] Failed to submit moral for game ${gameId}`);
          return callback({ success: false, error: 'Failed to submit moral' });
        }
        
        // Send immediate callback to client
        callback({ success: true });
        console.log(`Player ${socket.playerData.playerId} submitted moral in game ${gameId}`);
        
        // Broadcast state after human player submission
        broadcastGameState(gameId);
        
        // Get game state after submission to check if all human players have submitted
        const gameAfter = gameStateManager.getGameState(gameId);
        if (!gameAfter) {
          console.log(`[socket-handler] Game ${gameId} not found after moral submission`);
          return;
        }
        
        // Check if we're still in storytelling phase (need AI morals)
        if (gameAfter.round.status === roundStatus.STORYTELLING) {
          console.log(`[socket-handler] Actively triggering AI moral generation for game ${gameId}`);
          
          try {
            // Immediately generate AI morals (no delay)
            await gameStateManager.generateAIMorals(gameId);
            
            // Get final game state after AI moral generation
            const finalGame = gameStateManager.getGameState(gameId);
            if (finalGame) {
              console.log(`[socket-handler] Final game state after AI moral generation: ${finalGame.round.status}`);
            }
            
            // Broadcast final state after AI morals
            broadcastGameState(gameId);
          } catch (aiError) {
            console.error(`[socket-handler] Error generating AI morals: ${aiError}`);
            
            // Only force progress to voting if ALL human players have submitted their morals 
            const gameToFix = gameStateManager.getGameState(gameId);
            if (gameToFix && gameToFix.round.status === roundStatus.STORYTELLING) {
              // Check if all human players have submitted morals
              const humanPlayersWithMorals = gameToFix.players.filter(p => !p.isAI && p.submittedMoral).length;
              const humanPlayersTotal = gameToFix.players.filter(p => !p.isAI).length;
              
              if (humanPlayersWithMorals === humanPlayersTotal) {
                console.log(`[socket-handler] All human players submitted morals. Forcing game ${gameId} to voting phase after error.`);
                gameToFix.round.status = roundStatus.VOTING;
              } else {
                console.log(`[socket-handler] Not forcing voting phase - waiting for ${humanPlayersTotal - humanPlayersWithMorals} human players to submit morals.`);
              }
              
              // Fix any discrepancies between player.submittedMoral and submission.moral
              gameToFix.players.forEach(p => {
                // Check if player has submitted but submission doesn't have it
                if (p.submittedMoral) {
                  const sub = gameToFix.round.submissions.find(s => s.playerId === p.id);
                  if (sub && sub.moral === null) {
                    sub.moral = p.submittedMoral;
                    console.log(`[socket-handler] Fixed missing moral in submission for ${p.name} (${p.id})`);
                  }
                }
                
                // Check if submission has moral but player doesn't
                const sub = gameToFix.round.submissions.find(s => s.playerId === p.id);
                if (sub && sub.moral && !p.submittedMoral) {
                  p.submittedMoral = sub.moral;
                  console.log(`[socket-handler] Fixed missing moral in player data for ${p.name} (${p.id})`);
                }
                
                // Set any missing AI morals
                if (p.isAI && !p.submittedMoral) {
                  p.submittedMoral = "The moral is: sometimes things don't go as planned.";
                  
                  // Find and update submission
                  if (sub && sub.moral === null) {
                    sub.moral = p.submittedMoral;
                    console.log(`[socket-handler] Added fallback moral for AI ${p.name} (${p.id})`);
                  }
                }
              });
              
              // Broadcast fixed state
              broadcastGameState(gameId);
            }
          }
        }
      } catch (error) {
        console.error('[socket-handler] Error in submit-moral handler:', error);
        callback({ success: false, error: 'Failed to submit moral' });
      }
    });
    
    /**
     * Casts a vote for another player's moral
     * @event cast-vote
     * @param {Object} data - Request data
     * @param {string} data.gameId - ID of the game
     * @param {string} data.votedForId - ID of the player being voted for
     * @param {Function} callback - Callback to send response
     */
    socket.on(MessageType.CAST_VOTE, (data, callback) => {
      console.log(`[socket-handler] BEGIN cast-vote for game ${data.gameId}`);
      try {
        const { gameId, votedForId } = data;
        
        console.log(`[socket-handler] Cast vote details:`, {
          gameId,
          voterId: socket.playerData?.playerId,
          votedForId,
          socketId: socket.id
        });
        
        if (!socket.playerData || socket.playerData.gameId !== gameId) {
          console.log(`[socket-handler] Not authorized to cast vote for game ${gameId}, socket.playerData:`, socket.playerData);
          return callback({ success: false, error: 'Not authorized to cast a vote' });
        }
        
        // Make sure player isn't voting for themselves
        if (socket.playerData.playerId === votedForId) {
          console.log(`[socket-handler] Player ${socket.playerData.playerId} tried to vote for themselves`);
          return callback({ success: false, error: 'Cannot vote for yourself' });
        }
        
        // Get game state before vote to check round status
        const gameBefore = gameStateManager.getGameState(gameId);
        if (!gameBefore) {
          console.log(`[socket-handler] Game ${gameId} not found before casting vote`);
          return callback({ success: false, error: 'Game not found' });
        }
        
        console.log(`[socket-handler] Game state before casting vote:`, {
          gameId: gameBefore.gameId,
          status: gameBefore.status,
          roundNumber: gameBefore.round.number,
          roundStatus: gameBefore.round.status,
          playersCount: gameBefore.players.length,
          submissionsWithMorals: gameBefore.round.submissions.filter(s => s.moral !== null).length,
          totalSubmissions: gameBefore.round.submissions.length,
          submissionsWithVotes: gameBefore.round.submissions.filter(s => s.votes && s.votes > 0).length
        });
        
        if (gameBefore.round.status !== roundStatus.VOTING) {
          console.log(`[socket-handler] Game ${gameId} not in voting phase, current status: ${gameBefore.round.status}`);
          return callback({ success: false, error: 'Game is not in voting phase' });
        }
        
        // Make sure the voted-for player has a moral submission
        const votedForSubmission = gameBefore.round.submissions.find(s => s.playerId === votedForId);
        if (!votedForSubmission || !votedForSubmission.moral) {
          console.log(`[socket-handler] Voted player ${votedForId} has no moral submission`);
          return callback({ success: false, error: 'Selected player has no moral submission' });
        }
        
        console.log(`[socket-handler] Processing vote: player ${socket.playerData.playerId} voting for ${votedForId}`);
        const success = gameStateManager.castVote(gameId, socket.playerData.playerId, votedForId);
        if (!success) {
          console.log(`[socket-handler] Failed to cast vote for game ${gameId}`);
          return callback({ success: false, error: 'Failed to cast vote' });
        }
        
        // Get the new game state after voting
        const gameAfterVote = gameStateManager.getGameState(gameId);
        if (gameAfterVote) {
          console.log(`[socket-handler] Game state after casting vote:`, {
            playerId: socket.playerData.playerId,
            votedForId,
            roundStatus: gameAfterVote.round.status,
            votesCountByPlayer: gameAfterVote.round.submissions.map(s => ({
              playerId: s.playerId,
              votes: s.votes
            })),
            votedPlayers: gameAfterVote.round.submissions.filter(s => s.hasVoted).length,
            totalPlayers: gameAfterVote.players.length
          });
        }
        
        // Send immediate success response to client
        callback({ success: true });
        console.log(`[socket-handler] Player ${socket.playerData.playerId} voted for ${votedForId} in game ${gameId}`);
        
        // Broadcast state after human player vote
        console.log(`[socket-handler] Broadcasting game state after human player vote`);
        broadcastGameState(gameId);
        
        // Set up a periodic check for game state changes to ensure clients get updated
        // This handles the case where the game transitions to results phase after AI voting
        console.log(`[socket-handler] Setting up periodic check for game state transitions`);
        const checkInterval = setInterval(() => {
          // Get current game state
          const currentGame = gameStateManager.getGameState(gameId);
          if (!currentGame) {
            console.log(`[socket-handler] Game ${gameId} no longer exists, clearing interval`);
            clearInterval(checkInterval);
            return;
          }
          
          // If round status changed to results, broadcast final state and clear interval
          if (currentGame.round.status === roundStatus.RESULTS) {
            console.log(`[socket-handler] Detected game ${gameId} transitioned to results phase:`, {
              roundNumber: currentGame.round.number,
              roundStatus: currentGame.round.status,
              gameStatus: currentGame.status
            });
            broadcastGameState(gameId);
            clearInterval(checkInterval);
          } else {
            console.log(`[socket-handler] Periodic check for game ${gameId}, current round status: ${currentGame.round.status}`);
          }
        }, 1000); // Check every second
        
        // Set a timeout to clear the interval regardless after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          
          // Final broadcast to ensure latest state
          const finalGame = gameStateManager.getGameState(gameId);
          if (finalGame) {
            console.log(`[socket-handler] Final forced broadcast for game ${gameId}:`, {
              roundNumber: finalGame.round.number,
              roundStatus: finalGame.round.status,
              gameStatus: finalGame.status
            });
            broadcastGameState(gameId);
          }
        }, 10000);
        
      } catch (error) {
        console.error('[socket-handler] Error casting vote:', error);
        callback({ success: false, error: 'Failed to cast vote' });
      }
    });
    
    /**
     * Moves game to the next round
     * @event next-round
     * @param {Object} data - Request data
     * @param {string} data.gameId - ID of the game
     * @param {Function} callback - Callback to send response
     */
    socket.on(MessageType.NEXT_ROUND, (data, callback) => {
      console.log(`[socket-handler] BEGIN next-round for game ${data.gameId}`);
      try {
        const { gameId } = data;
        
        if (!socket.playerData || socket.playerData.gameId !== gameId) {
          console.log(`[socket-handler] Not authorized for next round in game ${gameId}, socket.playerData:`, socket.playerData);
          return callback({ success: false, error: 'Not authorized for this game' });
        }
        
        const game = gameStateManager.getGameState(gameId);
        if (!game) {
          console.log(`[socket-handler] Game ${gameId} not found for next round`);
          return callback({ success: false, error: 'Game not found' });
        }
        
        console.log(`[socket-handler] Current game state before next round:`, {
          gameId: game.gameId,
          status: game.status,
          roundNumber: game.round.number,
          roundStatus: game.round.status,
          playersCount: game.players.length,
          submissionsCount: game.round.submissions.length,
          playerDetails: game.players.map(p => ({
            id: p.id, 
            name: p.name,
            hasSelectedCard: p.selectedCard !== null,
            hasMoral: p.submittedMoral !== null,
            score: p.score
          })),
          submissions: game.round.submissions.map(s => ({
            playerId: s.playerId,
            cardId: s.cardId,
            hasMoral: s.moral !== null,
            votes: s.votes
          }))
        });
        
        // Verify the game is in results phase before moving to next round
        if (game.round.status !== roundStatus.RESULTS) {
          console.log(`[socket-handler] Game ${gameId} not in results phase, current status: ${game.round.status}`);
          return callback({ success: false, error: 'Game is not ready for next round' });
        }
        
        // If game is over, don't start a new round
        if (game.status === gameStatus.COMPLETED) {
          console.log(`[socket-handler] Game ${gameId} already completed, not starting new round`);
          broadcastGameState(gameId);
          return callback({ success: true });
        }
        
        console.log(`[socket-handler] Calling gameStateManager.startNewRound for game ${gameId}`);
        // Start a new round
        gameStateManager.startNewRound(gameId);
        
        // Log the state right after calling startNewRound
        const immediateGameState = gameStateManager.getGameState(gameId);
        console.log(`[socket-handler] Game state immediately after startNewRound:`, {
          gameId: immediateGameState?.gameId,
          status: immediateGameState?.status,
          roundNumber: immediateGameState?.round.number,
          roundStatus: immediateGameState?.round.status,
          submissionsCount: immediateGameState?.round.submissions.length || 0,
        });
        
        // Broadcast updated game state to all players in this game
        console.log(`[socket-handler] Broadcasting game state update after starting new round`);
        broadcastGameState(gameId);
        
        // Check the game state after starting new round and broadcasting
        const gameAfter = gameStateManager.getGameState(gameId);
        if (gameAfter) {
          console.log(`[socket-handler] Detailed game state after broadcastGameState:`, {
            gameId: gameAfter.gameId,
            status: gameAfter.status,
            roundNumber: gameAfter.round.number,
            roundStatus: gameAfter.round.status,
            story: gameAfter.round.story,
            submissionsCount: gameAfter.round.submissions.length,
            playerDetails: gameAfter.players.map(p => ({
              id: p.id, 
              name: p.name,
              hasSelectedCard: p.selectedCard !== null,
              hasMoral: p.submittedMoral !== null,
              score: p.score,
              cardType: p.currentCardType
            }))
          });
        } else {
          console.error(`[socket-handler] Failed to get game state after starting new round`);
        }
        
        callback({ success: true });
        console.log(`[socket-handler] END next-round: Successfully started new round in game ${gameId}`);
      } catch (error) {
        console.error('[socket-handler] Error starting next round:', error);
        callback({ success: false, error: 'Failed to start next round' });
      }
    });
    
    /**
     * Handles a player leaving a game
     * @event leave-game
     * @param {Object} data - Request data
     * @param {string} data.gameId - ID of the game
     * @param {Function} callback - Callback to send response
     */
    socket.on(MessageType.LEAVE_GAME, (data, callback) => {
      try {
        const { gameId } = data;
        
        if (!socket.playerData || socket.playerData.gameId !== gameId) {
          return callback({ success: false, error: 'Not in this game' });
        }
        
        handlePlayerLeave(socket);
        socket.leave(gameId);
        
        callback({ success: true });
      } catch (error) {
        console.error('Error leaving game:', error);
        callback({ success: false, error: 'Failed to leave game' });
      }
    });
    
    /**
     * Simple message handler for connection testing
     * @event message
     * @param {string|Object} data - The message data (string or object with text)
     */
    socket.on(MessageType.MESSAGE, (data) => {
      let messageText;
      
      console.log(`[DEBUG] Message event received from ${socket.id}. Data type:`, typeof data);
      console.log(`[DEBUG] Message data:`, data);
      
      // Handle both string messages and objects with text property
      if (typeof data === 'string') {
        messageText = data;
        console.log(`[Socket.io] String message from ${socket.id}:`, messageText);
      } else if (data && typeof data === 'object' && 'text' in data) {
        messageText = data.text;
        console.log(`[Socket.io] Object message from ${socket.id}:`, data);
      } else {
        messageText = 'Invalid message format';
        console.log(`[Socket.io] Invalid message format from ${socket.id}:`, data);
      }
      
      // Echo back the message with a timestamp
      console.log(`[DEBUG] Emitting echo message back to client: Echo: ${messageText} (from server)`);
      socket.emit(MessageType.MESSAGE, `Echo: ${messageText} (from server)`);
      
      // Send a ping message after 1 second
      setTimeout(() => {
        if (socket.connected) {
          console.log(`[DEBUG] Sending ping message to client: ${socket.id}`);
          socket.emit(MessageType.MESSAGE, `Server ping: ${new Date().toLocaleTimeString()}`);
        }
      }, 1000);
    });
    
    // VERY SIMPLE message handler using 'simple-message' event name
    // Use this isolated event name to avoid conflicts with other handlers
    socket.on('simple-message', (data) => {
      const timestamp = new Date().toISOString();
      
      // Type-specific logging for debugging
      console.log(`[${timestamp}] 'simple-message' received from ${socket.id}`);
      console.log(`  -> Client message type: ${typeof data}`);
      console.log(`  -> Client message content:`, data);
      
      // Always convert to string for simplicity
      const messageText = String(data);
      
      // Send back a response with the same event name
      const responseText = `Echo: ${messageText} (from server)`;
      console.log(`[${timestamp}] Server sending 'simple-message' response: "${responseText}"`);
      
      // Send the response back to the client
      socket.emit('simple-message', responseText);
      
      // Send a ping message after 1 second
      setTimeout(() => {
        if (socket.connected) {
          const pingMessage = `Server ping at ${new Date().toLocaleTimeString()}`;
          console.log(`[${new Date().toISOString()}] Server sending 'simple-message' ping: "${pingMessage}"`);
          socket.emit('simple-message', pingMessage);
        }
      }, 1000);
    });
    
    // Keep the original 'message' handler for backward compatibility
    socket.on('message', (data) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] 'message' event received from ${socket.id}`);
      console.log(`  -> Data type: ${typeof data}`);
      console.log(`  -> Data content:`, data);
      
      let messageText = typeof data === 'string' ? data : 
                       (data && typeof data === 'object' && 'text' in data) ? data.text : 
                       'Invalid message format';
      
      // Echo messages back to the client with the same event name
      const responseText = `Echo: ${messageText} (from server)`;
      console.log(`[${timestamp}] Server emitting 'message' response: "${responseText}"`);
      
      socket.emit('message', responseText);
    });
    
    /**
     * Handles disconnection of a client
     * @event disconnect
     */
    socket.on('disconnect', () => {
      const disconnectTime = new Date().toISOString();
      console.log(`[${disconnectTime}] Socket disconnected: ${socket.id}`);
      
      // Handle player leaving any games they're in
      handlePlayerLeave(socket);
    });
  });

  /**
   * Helper function to handle player leaving a game
   * @param socket - The socket of the disconnected player
   */
  function handlePlayerLeave(socket: GameSocket) {
    if (!socket.playerData) return;
    
    const { playerId, gameId } = socket.playerData;
    
    // Remove player from the game
    gameStateManager.removePlayer(gameId, playerId);
    
    // Remove from player socket mapping
    playerSockets.delete(playerId);
    
    // Clear player data from socket
    socket.playerData = undefined;
    
    // Broadcast updated game state to remaining players
    broadcastGameState(gameId);
    
    console.log(`Player ${playerId} left game ${gameId}`);
  }

  /**
   * Sends current game state to a specific client
   * @param socket - The socket to send the game state to
   */
  function sendGameStateToClient(socket: GameSocket) {
    if (!socket.playerData) return;
    
    const { gameId, playerId } = socket.playerData;
    const game = gameStateManager.getGameState(gameId);
    
    if (!game) return;
    
    // Send sanitized game state
    const sanitizedGame = sanitizeGameStateForPlayer(game, playerId);
    
    socket.emit(MessageType.GAME_STATE, { game: sanitizedGame });
  }

  /**
   * Broadcasts game state to all players in a game
   * @param gameId - ID of the game to broadcast state for
   */
  function broadcastGameState(gameId: string) {
    const game = gameStateManager.getGameState(gameId);
    if (!game) return;
    
    // Send game state to each player individually (with appropriate sanitization)
    game.players.forEach(player => {
      const socketId = playerSockets.get(player.id);
      
      if (socketId) {
        const socket = io.sockets.sockets.get(socketId) as GameSocket;
        
        if (socket) {
          const sanitizedGame = sanitizeGameStateForPlayer(game, player.id);
          socket.emit(MessageType.GAME_STATE, { game: sanitizedGame });
        }
      }
    });
  }

  /**
   * Sanitizes game state for a specific player (hides other players' cards)
   * @param game - The full game state
   * @param playerId - ID of the player to sanitize for
   * @returns Sanitized game state
   */
  function sanitizeGameStateForPlayer(game: Game, playerId: string): Game {
    // Create a deep copy of the game
    const sanitizedGame = JSON.parse(JSON.stringify(game)) as Game;
    
    // Log original voting state before sanitization when we're in voting phase
    if (game.round.status === 'voting') {
      const originalPlayerState = game.players.find(p => p.id === playerId);
      const originalSubmission = game.round.submissions.find(s => s.playerId === playerId);
      
      console.log(`[socket-handler] ORIGINAL voting state for player ${playerId}:`, {
        playerHasVoted: originalPlayerState?.hasVoted,
        submissionHasVoted: originalSubmission?.hasVoted,
        roundNumber: game.round.number,
        roundStatus: game.round.status
      });
    }
    
    // Mask other players' hands, with special handling for card selection phase
    sanitizedGame.players = sanitizedGame.players.map(player => {
      // Create a modified player with proper hasVoted handling
      const modifiedPlayer = { ...player };
      
      // Always show the current player's full hand
      if (player.id === playerId) {
        return modifiedPlayer;
      }
      
      // For other players, we need special handling depending on game phase
      if (player.selectedCard !== null && player.hand) {
        // If the player has selected a card and it's no longer selection phase, 
        // we show only the selected card
        if (game.round.status !== 'selection') {
          const selectedCard = player.hand.find(card => card.id === player.selectedCard);
          modifiedPlayer.hand = selectedCard ? [selectedCard] : [];
          return modifiedPlayer;
        }
      }
      
      // Default behavior - hide all cards
      const handLength = player.hand?.length || 0;
      modifiedPlayer.hand = player.hand ? Array(handLength).fill({ id: 0, text: "Hidden Card" }) : undefined;
      return modifiedPlayer;
    });
    
    // Critical fix: Ensure hasVoted property is correctly synchronized between player and submission objects
    if (sanitizedGame.round && sanitizedGame.round.submissions) {
      const currentPlayer = sanitizedGame.players.find(p => p.id === playerId);
      const currentPlayerSubmission = sanitizedGame.round.submissions.find(s => s.playerId === playerId);
      
      // Log if there's a mismatch between player and submission hasVoted flags
      if (game.round.status === 'voting' && currentPlayer && currentPlayerSubmission) {
        const originalPlayer = game.players.find(p => p.id === playerId);
        const originalSubmission = game.round.submissions.find(s => s.playerId === playerId);
        
        if (originalPlayer?.hasVoted !== originalSubmission?.hasVoted) {
          console.log(`[socket-handler] WARNING! Found mismatch in hasVoted flags for player ${playerId}:`, {
            playerHasVoted: originalPlayer?.hasVoted,
            submissionHasVoted: originalSubmission?.hasVoted,
            roundNumber: game.round.number
          });
          
          // Synchronize both flags - if either shows the player has voted, mark both
          if (originalPlayer?.hasVoted || originalSubmission?.hasVoted) {
            currentPlayer.hasVoted = true;
            currentPlayerSubmission.hasVoted = true;
            console.log(`[socket-handler] Fixed hasVoted mismatch for player ${playerId}`);
          }
        }
      }
      
      // Ensure all submissions have hasVoted explicitly set (not undefined)
      sanitizedGame.round.submissions = sanitizedGame.round.submissions.map(submission => {
        return {
          ...submission,
          hasVoted: submission.hasVoted === true
        };
      });
      
      // Add detailed voting state log for current player
      if (game.round.status === 'voting') {
        const playerAfterFix = sanitizedGame.players.find(p => p.id === playerId);
        const submissionAfterFix = sanitizedGame.round.submissions.find(s => s.playerId === playerId);
        
        console.log(`[socket-handler] FINAL voting state for player ${playerId}:`, {
          playerHasVoted: playerAfterFix?.hasVoted,
          submissionHasVoted: submissionAfterFix?.hasVoted,
          roundNumber: sanitizedGame.round.number,
          canVote: !playerAfterFix?.hasVoted && !submissionAfterFix?.hasVoted
        });
      }
    }
    
    return sanitizedGame;
  }

  return io;
}