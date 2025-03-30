// game-state-manager.js
const { v4: uuidv4 } = require('uuid');
const { generateAIMoral } = require('./ai-service');

// Card types and their corresponding story elements
const CARD_TYPES = {
  RED: 'character',
  BLUE: 'setting',
  GREEN: 'conflict',
  YELLOW: 'resolution',
  PURPLE: 'twist'
};

class GameStateManager {
  constructor() {
    // In-memory storage of active games
    this.games = new Map();
    
    // Load card decks from JSON files (implementation detail)
    this.cardDecks = {
      RED: require('../data/red-cards.json'),
      BLUE: require('../data/blue-cards.json'),
      GREEN: require('../data/green-cards.json'),
      YELLOW: require('../data/yellow-cards.json'),
      PURPLE: require('../data/purple-cards.json')
    };
  }

  /**
   * Create a new game with a unique ID
   * @param {Object} host - The player object for the host
   * @returns {String} - The unique game ID
   */
  createGame(host) {
    const gameId = this.generateGameId();
    
    const newGame = {
      gameId,
      status: 'lobby',
      players: [{ ...host, score: 0, isHost: true }],
      round: {
        number: 0,
        status: 'waiting',
        story: '',
        submissions: []
      },
      settings: {
        maxPlayers: 5,
        roundsToPlay: 5
      }
    };
    
    this.games.set(gameId, newGame);
    return gameId;
  }

  /**
   * Generate a 6-character alphanumeric game ID
   * @returns {String} - Unique game ID
   */
  generateGameId() {
    // Generate a short, memorable game code
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  /**
   * Add a player to an existing game
   * @param {String} gameId - The game ID
   * @param {Object} player - The player object
   * @returns {Boolean} - Success status
   */
  joinGame(gameId, player) {
    if (!this.games.has(gameId)) {
      return false;
    }

    const game = this.games.get(gameId);
    
    // Check if game is joinable
    if (game.status !== 'lobby' || game.players.length >= game.settings.maxPlayers) {
      return false;
    }
    
    // Add player to game
    game.players.push({ ...player, score: 0 });
    return true;
  }

  /**
   * Start a game and set up the first round
   * @param {String} gameId - The game ID
   * @returns {Boolean} - Success status
   */
  startGame(gameId) {
    if (!this.games.has(gameId)) {
      return false;
    }

    const game = this.games.get(gameId);
    
    // Add AI players if fewer than 5 human players
    this.addAIPlayers(game);
    
    // Initialize game state
    game.status = 'active';
    
    // Start first round
    this.startNewRound(gameId);
    
    return true;
  }

  /**
   * Add AI players to fill empty slots
   * @param {Object} game - The game object
   */
  addAIPlayers(game) {
    const aiCount = 5 - game.players.length;
    
    if (aiCount <= 0) return;
    
    for (let i = 0; i < aiCount; i++) {
      game.players.push({
        id: `ai-${uuidv4()}`,
        name: `AI Player ${i + 1}`,
        isAI: true,
        score: 0
      });
    }
  }

  /**
   * Start a new round for the given game
   * @param {String} gameId - The game ID
   */
  startNewRound(gameId) {
    const game = this.games.get(gameId);
    
    // Increment round number
    game.round.number += 1;
    game.round.status = 'dealing';
    game.round.story = '';
    game.round.submissions = [];
    
    // Assign card types to players (rotating each round)
    this.assignCardTypes(game);
    
    // Deal cards to players
    this.dealCards(game);
    
    // Update round status
    game.round.status = 'selection';
  }

  /**
   * Assign card types to players, rotating based on round number
   * @param {Object} game - The game object
   */
  assignCardTypes(game) {
    const cardTypeKeys = Object.keys(CARD_TYPES);
    
    game.players.forEach((player, index) => {
      // Calculate rotated index based on round number
      const typeIndex = (index + game.round.number - 1) % cardTypeKeys.length;
      player.currentCardType = cardTypeKeys[typeIndex];
      player.selectedCard = null;
      player.submittedMoral = null;
    });
  }

  /**
   * Deal 3 cards to each player from their assigned deck
   * @param {Object} game - The game object
   */
  dealCards(game) {
    game.players.forEach(player => {
      // Get the appropriate deck for this player's type
      const deck = this.cardDecks[player.currentCardType];
      
      // Deal 3 random cards
      player.hand = this.getRandomCards(deck, 3);
    });
  }

  /**
   * Get random cards from a deck
   * @param {Array} deck - The card deck
   * @param {Number} count - Number of cards to draw
   * @returns {Array} - Array of selected cards
   */
  getRandomCards(deck, count) {
    const shuffled = [...deck].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Process a player's card selection
   * @param {String} gameId - The game ID
   * @param {String} playerId - The player ID
   * @param {String} cardId - The selected card ID
   * @returns {Boolean} - Success status
   */
  selectCard(gameId, playerId, cardId) {
    if (!this.games.has(gameId)) {
      return false;
    }

    const game = this.games.get(gameId);
    
    // Find the player
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;
    
    // Verify the card is in the player's hand
    if (!player.hand.some(card => card.id === cardId)) {
      return false;
    }
    
    // Set the selected card
    player.selectedCard = cardId;
    
    // If all players have selected a card, assemble the story
    if (game.players.every(p => p.selectedCard)) {
      this.assembleStory(game);
      game.round.status = 'storytelling';
    }
    
    return true;
  }

  /**
   * Have AI players automatically select cards
   * @param {String} gameId - The game ID
   */
  makeAISelections(gameId) {
    const game = this.games.get(gameId);
    
    // For each AI player that hasn't selected a card
    game.players
      .filter(p => p.isAI && !p.selectedCard)
      .forEach(aiPlayer => {
        // Select a random card from hand
        const randomIndex = Math.floor(Math.random() * aiPlayer.hand.length);
        aiPlayer.selectedCard = aiPlayer.hand[randomIndex].id;
      });
    
    // If all players have now selected cards, assemble the story
    if (game.players.every(p => p.selectedCard)) {
      this.assembleStory(game);
      game.round.status = 'storytelling';
    }
  }

  /**
   * Assemble a story from all selected cards
   * @param {Object} game - The game object
   */
  assembleStory(game) {
    // Get all selected cards
    const selectedCards = game.players.map(player => {
      const card = player.hand.find(c => c.id === player.selectedCard);
      return {
        playerId: player.id,
        card
      };
    });
    
    // Sort cards by their type's role in the story
    const orderedTypes = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE'];
    selectedCards.sort((a, b) => {
      return orderedTypes.indexOf(a.card.type) - orderedTypes.indexOf(b.card.type);
    });
    
    // Create story by combining card texts
    game.round.story = selectedCards.map(item => item.card.text).join(' ');
    
    // Save submission info
    game.round.submissions = selectedCards.map(item => ({
      playerId: item.playerId,
      cardId: item.card.id,
      moral: null,
      votes: 0
    }));
  }

  /**
   * Submit a moral for a player
   * @param {String} gameId - The game ID
   * @param {String} playerId - The player ID
   * @param {String} moral - The submitted moral
   * @returns {Boolean} - Success status
   */
  submitMoral(gameId, playerId, moral) {
    if (!this.games.has(gameId)) {
      return false;
    }

    const game = this.games.get(gameId);
    
    // Find the player
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;
    
    // Set the submitted moral
    player.submittedMoral = moral;
    
    // Update submission
    const submission = game.round.submissions.find(s => s.playerId === playerId);
    if (submission) {
      submission.moral = moral;
    }
    
    // If all players have submitted morals, move to voting
    if (game.players.every(p => p.submittedMoral)) {
      game.round.status = 'voting';
    }
    
    return true;
  }

  /**
   * Generate morals for AI players using Claude API
   * @param {String} gameId - The game ID
   */
  async generateAIMorals(gameId) {
    const game = this.games.get(gameId);
    
    // Create array of promises for all AI players
    const aiPromises = game.players
      .filter(p => p.isAI && !p.submittedMoral)
      .map(async (aiPlayer) => {
        try {
          // Get AI to generate a moral based on the story
          const moral = await generateAIMoral(game.round.story);
          
          // Update AI player and submission
          aiPlayer.submittedMoral = moral;
          
          const submission = game.round.submissions.find(s => s.playerId === aiPlayer.id);
          if (submission) {
            submission.moral = moral;
          }
        } catch (error) {
          console.error(`Error generating AI moral: ${error.message}`);
          // Fallback moral if API fails
          const fallbackMoral = "The moral of the story is: Don't trust AI to generate morals.";
          aiPlayer.submittedMoral = fallbackMoral;
          
          const submission = game.round.submissions.find(s => s.playerId === aiPlayer.id);
          if (submission) {
            submission.moral = fallbackMoral;
          }
        }
      });
    
    // Wait for all AI morals to be generated
    await Promise.all(aiPromises);
    
    // If all players have submitted morals, move to voting
    if (game.players.every(p => p.submittedMoral)) {
      game.round.status = 'voting';
    }
  }

  /**
   * Process a player's vote
   * @param {String} gameId - The game ID
   * @param {String} voterId - The voting player's ID
   * @param {String} votedForId - The ID of the player voted for
   * @returns {Boolean} - Success status
   */
  castVote(gameId, voterId, votedForId) {
    if (!this.games.has(gameId)) {
      return false;
    }

    const game = this.games.get(gameId);
    
    // Find the submission for the voted player
    const submission = game.round.submissions.find(s => s.playerId === votedForId);
    if (!submission) return false;
    
    // Increment votes
    submission.votes += 1;
    
    // Check if all human players have voted
    const humanPlayers = game.players.filter(p => !p.isAI);
    const allVoted = game.round.submissions.reduce((sum, s) => sum + s.votes, 0) >= humanPlayers.length;
    
    if (allVoted) {
      this.endRound(gameId);
    }
    
    return true;
  }

  /**
   * End the current round and calculate scores
   * @param {String} gameId - The game ID
   */
  endRound(gameId) {
    const game = this.games.get(gameId);
    
    // Find the winning submission
    const winningSubmission = [...game.round.submissions].sort((a, b) => b.votes - a.votes)[0];
    
    // Award points to the winner
    if (winningSubmission) {
      const winner = game.players.find(p => p.id === winningSubmission.playerId);
      if (winner) {
        winner.score += winningSubmission.votes;
      }
    }
    
    // Update round status
    game.round.status = 'results';
    
    // Check if game is over
    if (game.round.number >= game.settings.roundsToPlay) {
      game.status = 'completed';
    }
  }

  /**
   * Get the current state of a game
   * @param {String} gameId - The game ID
   * @returns {Object|null} - The game state or null if not found
   */
  getGameState(gameId) {
    return this.games.get(gameId) || null;
  }
}

module.exports = new GameStateManager();
