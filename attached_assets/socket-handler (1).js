// socket-handler.js
const gameStateManager = require('./game-state-manager');
const aiService = require('./ai-service');

/**
 * Set up Socket.io event handlers
 * @param {Object} io - The Socket.io server instance
 */
function setupSocketHandlers(io) {
  // Keep track of players and their socket IDs
  const playerSockets = new Map();

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      handlePlayerDisconnect(socket, playerSockets, io);
    });
    
    // Create a new game
    socket.on('create-game', (data, callback) => {
      try {
        const { playerName } = data;
        
        // Create player object
        const player = {
          id: socket.id,
          name: playerName,
          isAI: false,
          isHost: true
        };
        
        // Create new game and get ID
        const gameId = gameStateManager.createGame(player);
        
        // Associate player with socket
        playerSockets.set(socket.id, { gameId, playerId: player.id });
        
        // Join socket room for this game
        socket.join(gameId);
        
        // Return game ID to client
        callback({ success: true, gameId });
      } catch (error) {
        console.error('Error creating game:', error);
        callback({ success: false, error: 'Failed to create game' });
      }
    });
    
    // Join an existing game
    socket.on('join-game', (data, callback) => {
      try {
        const { playerName, gameId } = data;
        
        // Create player object
        const player = {
          id: socket.id,
          name: playerName,
          isAI: false,
          isHost: false
        };
        
        // Join the game
        const success = gameStateManager.joinGame(gameId, player);
        
        if (success) {
          // Associate player with socket
          playerSockets.set(socket.id, { gameId, playerId: player.id });
          
          // Join socket room for this game
          socket.join(gameId);
          
          // Notify all players in the game that someone joined
          const gameState = gameStateManager.getGameState(gameId);
          io.to(gameId).emit('player-joined', {
            newPlayer: {
              id: player.id,
              name: player.name,
              isAI: player.isAI
            },
            players: gameState.players
          });
          
          callback({ success: true });
        } else {
          callback({ success: false, error: 'Failed to join game' });
        }
      } catch (error) {
        console.error('Error joining game:', error);
        callback({ success: false, error: 'Failed to join game' });
      }
    });
    
    // Start the game
    socket.on('start-game', async (data, callback) => {
      try {
        const { gameId } = data;
        const playerInfo = playerSockets.get(socket.id);
        
        // Verify player is in this game
        if (!playerInfo || playerInfo.gameId !== gameId) {
          callback({ success: false, error: 'Player not in this game' });
          return;
        }
        
        // Get game state
        const gameState = gameStateManager.getGameState(gameId);
        
        // Verify player is the host
        const player = gameState.players.find(p => p.id === playerInfo.playerId);
        if (!player || !player.isHost) {
          callback({ success: false, error: 'Only the host can start the game' });
          return;
        }
        
        // Start the game
        const success = gameStateManager.startGame(gameId);
        
        if (success) {
          // Get updated game state
          const updatedState = gameStateManager.getGameState(gameId);
          
          // Notify all players that the game has started
          io.to(gameId).emit('game-started', {
            players: updatedState.players,
            round: updatedState.round
          });
          
          callback({ success: true });
        } else {
          callback({ success: false, error: 'Failed to start game' });
        }
      } catch (error) {
        console.error('Error starting game:', error);
        callback({ success: false, error: 'Failed to start game' });
      }
    });
    
    // Select a card
    socket.on('select-card', (data, callback) => {
      try {
        const { gameId, cardId } = data;
        const playerInfo = playerSockets.get(socket.id);
        
        // Verify player is in this game
        if (!playerInfo || playerInfo.gameId !== gameId) {
          callback({ success: false, error: 'Player not in this game' });
          return;
        }
        
        // Select the card
        const success = gameStateManager.selectCard(gameId, playerInfo.playerId, cardId);
        
        if (success) {
          // Get game state
          const gameState = gameStateManager.getGameState(gameId);
          
          // Notify all players that a card was selected
          io.to(gameId).emit('card-selected', {
            playerId: playerInfo.playerId,
            roundStatus: gameState.round.status
          });
          
          // If all human players have selected, trigger AI selections
          const humanPlayers = gameState.players.filter(p => !p.isAI);
          const allHumansSelected = humanPlayers.every(p => p.selectedCard);
          
          if (allHumansSelected) {
            // Trigger AI players to select cards
            gameStateManager.makeAISelections(gameId);
            
            // If story is assembled, send it to all players
            const updatedState = gameStateManager.getGameState(gameId);
            if (updatedState.round.status === 'storytelling') {
              io.to(gameId).emit('story-assembled', {
                story: updatedState.round.story,
                cards: updatedState.round.submissions.map(s => ({
                  playerId: s.playerId,
                  cardId: s.cardId
                }))
              });
            }
          }
          
          callback({ success: true });
        } else {
          callback({ success: false, error: 'Failed to select card' });
        }
      } catch (error) {
        console.error('Error selecting card:', error);
        callback({ success: false, error: 'Failed to select card' });
      }
    });
    
    // Submit moral
    socket.on('submit-moral', (data, callback) => {
      try {
        const { gameId, moral } = data;
        const playerInfo = playerSockets.get(socket.id);
        
        // Verify player is in this game
        if (!playerInfo || playerInfo.gameId !== gameId) {
          callback({ success: false, error: 'Player not in this game' });
          return;
        }
        
        // Submit the moral
        const success = gameStateManager.submitMoral(gameId, playerInfo.playerId, moral);
        
        if (success) {
          // Get game state
          const gameState = gameStateManager.getGameState(gameId);
          
          // Notify all players that a moral was submitted
          io.to(gameId).emit('moral-submitted', {
            playerId: playerInfo.playerId
          });
          
          // If all human players have submitted, generate AI morals
          const humanPlayers = gameState.players.filter(p => !p.isAI);
          const allHumansSubmitted = humanPlayers.every(p => p.submittedMoral);
          
          if (allHumansSubmitted) {
            // Generate AI morals asynchronously
            (async () => {
              await gameStateManager.generateAIMorals(gameId);
              
              // If all morals are submitted, notify players for voting
              const updatedState = gameStateManager.getGameState(gameId);
              if (updatedState.round.status === 'voting') {
                io.to(gameId).emit('voting-started', {
                  submissions: updatedState.round.submissions.map(s => ({
                    playerId: s.playerId,
                    moral: s.moral
                  }))
                });
              }
            })();
          }
          
          callback({ success: true });
        } else {
          callback({ success: false, error: 'Failed to submit moral' });
        }
      } catch (error) {
        console.error('Error submitting moral:', error);
        callback({ success: false, error: 'Failed to submit moral' });
      }
    });
    
    // Cast vote
    socket.on('cast-vote', (data, callback) => {
      try {
        const { gameId, votedForId } = data;
        const playerInfo = playerSockets.get(socket.id);
        
        // Verify player is in this game
        if (!playerInfo || playerInfo.gameId !== gameId) {
          callback({ success: false, error: 'Player not in this game' });
          return;
        }
        
        // Cast the vote
        const success = gameStateManager.castVote(gameId, playerInfo.playerId, votedForId);
        
        if (success) {
          // Get game state
          const gameState = gameStateManager.getGameState(gameId);
          
          // Notify all players that a vote was cast
          io.to(gameId).emit('vote-cast', {
            voterId: playerInfo.playerId,
            votedForId
          });
          
          // If round has ended, send results
          if (gameState.round.status === 'results') {
            io.to(gameId).emit('round-ended', {
              submissions: gameState.round.submissions,
              scores: gameState.players.map(p => ({
                playerId: p.id,
                score: p.score
              })),
              gameStatus: gameState.status
            });
          }
          
          callback({ success: true });
        } else {
          callback({ success: false, error: 'Failed to cast vote' });
        }
      } catch (error) {
        console.error('Error casting vote:', error);
        callback({ success: false, error: 'Failed to cast vote' });
      }
    });
    
    // Start next round
    socket.on('next-round', (data, callback) => {
      try {
        const { gameId } = data;
        const playerInfo = playerSockets.get(socket.id);
        
        // Verify player is in this game
        if (!playerInfo || playerInfo.gameId !== gameId) {
          callback({ success: false, error: 'Player not in this game' });
          return;
        }
        
        // Get game state
        const gameState = gameStateManager.getGameState(gameId);
        
        // Verify game is not completed
        if (gameState.status === 'completed') {
          callback({ success: false, error: 'Game is already completed' });
          return;
        }
        
        // Verify player is the host
        const player = gameState.players.find(p => p.id === playerInfo.playerId);
        if (!player || !player.isHost) {
          callback({ success: false, error: 'Only the host can start the next round' });
          return;
        }
        
        // Start new round
        gameStateManager.startNewRound(gameId);
        
        // Get updated game state
        const updatedState = gameStateManager.getGameState(gameId);
        
        // Notify all players that the next round has started
        io.to(gameId).emit('round-started', {
          round: updatedState.round,
          players: updatedState.players.map(p => ({
            id: p.id,
            currentCardType: p.currentCardType,
            hand: p.isAI ? null : p.hand // Don't send AI hands to clients
          }))
        });
        
        callback({ success: true });
      } catch (error) {
        console.error('Error starting next round:', error);
        callback({ success: false, error: 'Failed to start next round' });
      }
    });
    
    // End game
    socket.on('end-game', (data, callback) => {
      try {
        const { gameId } = data;
        const playerInfo = playerSockets.get(socket.id);
        
        // Verify player is in this game
        if (!playerInfo || playerInfo.gameId !== gameId) {
          callback({ success: false, error: 'Player not in this game' });
          return;
        }
        
        // Get game state
        const gameState = gameStateManager.getGameState(gameId);
        
        // Verify player is the host
        const player = gameState.players.find(p => p.id === playerInfo.playerId);
        if (!player || !player.isHost) {
          callback({ success: false, error: 'Only the host can end the game' });
          return;
        }
        
        // Mark game as completed
        gameState.status = 'completed';
        
        // Notify all players that the game has ended
        io.to(gameId).emit('game-ended', {
          players: gameState.players.map(p => ({
            id: p.id,
            name: p.name,
            isAI: p.isAI,
            score: p.score
          }))
        });
        
        callback({ success: true });
      } catch (error) {
        console.error('Error ending game:', error);
        callback({ success: false, error: 'Failed to end game' });
      }
    });
  });
}

/**
 * Handle player disconnection
 * @param {Object} socket - The socket that disconnected
 * @param {Map} playerSockets - Map of player socket associations
 * @param {Object} io - The Socket.io server instance
 */
function handlePlayerDisconnect(socket, playerSockets, io) {
  const playerInfo = playerSockets.get(socket.id);
  
  if (playerInfo) {
    const { gameId, playerId } = playerInfo;
    
    // Get game state
    const gameState = gameStateManager.getGameState(gameId);
    
    if (gameState) {
      // Find the player
      const playerIndex = gameState.players.findIndex(p => p.id === playerId);
      
      if (playerIndex !== -1) {
        const isHost = gameState.players[playerIndex].isHost;
        
        // Remove player from game
        gameState.players.splice(playerIndex, 1);
        
        // If game is in lobby, just notify remaining players
        if (gameState.status === 'lobby') {
          // If player was host, assign host to next player
          if (isHost && gameState.players.length > 0) {
            gameState.players[0].isHost = true;
          }
          
          // Notify remaining players
          io.to(gameId).emit('player-left', {
            playerId,
            players: gameState.players
          });
        } else {
          // For active games, convert player to AI
          const aiPlayer = {
            id: `ai-replacement-${playerId}`,
            name: `AI (was ${gameState.players[playerIndex].name})`,
            isAI: true,
            score: gameState.players[playerIndex].score,
            currentCardType: gameState.players[playerIndex].currentCardType,
            hand: [], // Will be dealt new cards
            selectedCard: null,
            submittedMoral: null
          };
          
          // Add AI player to game
          gameState.players.push(aiPlayer);
          
          // If player was host, assign host to next human player
          if (isHost) {
            const nextHuman = gameState.players.find(p => !p.isAI);
            if (nextHuman) {
              nextHuman.isHost = true;
            }
          }
          
          // Notify remaining players
          io.to(gameId).emit('player-replaced-by-ai', {
            oldPlayerId: playerId,
            aiPlayer: {
              id: aiPlayer.id,
              name: aiPlayer.name,
              isAI: aiPlayer.isAI,
              currentCardType: aiPlayer.currentCardType
            }
          });
        }
      }
    }
    
    // Remove player from socket map
    playerSockets.delete(socket.id);
  }
}

module.exports = setupSocketHandlers;
