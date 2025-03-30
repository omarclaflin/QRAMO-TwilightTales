/**
 * Game state manager for Twilight Tales
 * Handles game creation, state transitions, and game logic
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { Game, Player, Card, Submission, Round } from "@shared/schema";
import { cardTypes, gameStatus, roundStatus } from "@shared/schema";
import {
  generateAIMoral,
  generateAIPlayerName,
  simulateAIVote,
} from "./ai-service";

// Get directory path for loading card data
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "../data");

// Define card data structure
interface CardData {
  locationCards: Card[];
  characterCards: Card[];
  initialTwistCards: Card[];
  escalationCards: Card[];
  finalTwistCards: Card[];
}

// Load card data from JSON files
function loadCardData(): CardData {
  try {
    const locationData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "location-cards.json"), "utf-8"),
    );

    const characterData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "character-cards.json"), "utf-8"),
    );

    const initialTwistData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "initial-twist-cards.json"), "utf-8"),
    );

    const escalationData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "escalation-cards.json"), "utf-8"),
    );

    const finalTwistData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "final-twist-cards.json"), "utf-8"),
    );

    return {
      locationCards: locationData.locationCards || [],
      characterCards: characterData.characterCards || [],
      initialTwistCards: initialTwistData.initialTwistCards || [],
      escalationCards: escalationData.escalationCards || [],
      finalTwistCards: finalTwistData.finalTwistCards || [],
    };
  } catch (error) {
    console.error("Error loading card data:", error);
    // Return empty arrays as fallback
    return {
      locationCards: [],
      characterCards: [],
      initialTwistCards: [],
      escalationCards: [],
      finalTwistCards: [],
    };
  }
}

// Card data cache
let cardData: CardData | null = null;

/**
 * GameStateManager class for handling all game state transitions and logic
 */
class GameStateManager {
  private games: Map<string, Game>;

  /**
   * Initialize the game state manager
   */
  constructor() {
    this.games = new Map<string, Game>();

    // Load card data if not already loaded
    if (!cardData) {
      cardData = loadCardData();
      console.log(
        `Loaded card data: ${Object.keys(cardData)
          .map(
            (key) => `${key}: ${cardData![key as keyof CardData].length} cards`,
          )
          .join(", ")}`,
      );
    }
  }

  /**
   * Create a new game with a unique ID
   * @param host - The player object for the host
   * @returns The unique game ID
   */
  createGame(host: Omit<Player, "score" | "isHost">): string {
    const gameId = this.generateGameId();

    const newHost: Player = {
      ...host,
      score: 0,
      isHost: true,
    };

    const newGame: Game = {
      gameId,
      status: gameStatus.LOBBY,
      players: [newHost],
      round: {
        number: 0,
        status: roundStatus.WAITING,
        story: "",
        submissions: [],
      },
      settings: {
        maxPlayers: 5,
        roundsToPlay: 3,
      },
    };

    this.games.set(gameId, newGame);
    console.log(`Created new game with ID: ${gameId}`);

    return gameId;
  }

  /**
   * Generate a 6-character alphanumeric game ID
   * @returns Unique game ID
   */
  generateGameId(): string {
    // Generate a random game ID (6 alphanumeric characters)
    let gameId: string;
    do {
      gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (this.games.has(gameId));

    return gameId;
  }

  /**
   * Add a player to an existing game
   * @param gameId - The game ID
   * @param player - The player object
   * @returns Success status
   */
  joinGame(gameId: string, player: Omit<Player, "score">): boolean {
    const game = this.games.get(gameId);

    if (!game) {
      console.error(`Game not found: ${gameId}`);
      return false;
    }

    // Check if the game is in the lobby and not full
    if (game.status !== gameStatus.LOBBY) {
      console.error(`Game ${gameId} is not in lobby status`);
      return false;
    }

    if (game.players.length >= game.settings.maxPlayers) {
      console.error(`Game ${gameId} is full`);
      return false;
    }

    // Add the player to the game
    const newPlayer: Player = {
      ...player,
      score: 0,
    };

    game.players.push(newPlayer);
    console.log(`Player ${player.id} joined game ${gameId}`);

    return true;
  }

  /**
   * Start a game and set up the first round
   * @param gameId - The game ID
   * @returns Success status
   */
  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);

    if (!game) {
      console.error(`Game not found: ${gameId}`);
      return false;
    }

    // Check if the game is in the lobby
    if (game.status !== gameStatus.LOBBY) {
      console.error(`Game ${gameId} is not in lobby status`);
      return false;
    }

    // Check if there are enough players (at least one player is required)
    if (game.players.length < 1) {
      console.error(`Game ${gameId} doesn't have any players`);
      return false;
    }

    // Add AI players if there are fewer than min players
    this.addAIPlayers(game);

    // Update game status and start the first round
    game.status = gameStatus.ACTIVE;
    game.round.number = 1;

    // Set up the first round
    this.startNewRound(gameId);

    console.log(
      `Game ${gameId} started with ${game.players.length} players (including AI)`,
    );
    return true;
  }

  /**
   * Add AI players to fill empty slots
   * @param game - The game object
   */
  private addAIPlayers(game: Game): void {
    // For a proper game, we need exactly 5 players total (human + AI)
    // One player for each card type (location, character, initial twist, escalation, final twist)
    const totalPlayersNeeded = 5; // One for each card type
    const maxPlayersAllowed = game.settings.maxPlayers;

    // Calculate how many AI players to add to reach exactly 5 players
    const currentHumanCount = game.players.length;
    const aiCountNeeded = totalPlayersNeeded - currentHumanCount;
    const availableSlots = maxPlayersAllowed - currentHumanCount;
    const aiCount = Math.min(availableSlots, Math.max(0, aiCountNeeded));

    console.log(
      `Adding ${aiCount} AI players to game ${game.gameId}. Current players: ${currentHumanCount}`,
    );

    for (let i = 0; i < aiCount; i++) {
      const aiPlayer: Player = {
        id: uuidv4(),
        name: generateAIPlayerName(),
        isAI: true,
        score: 0,
      };

      game.players.push(aiPlayer);
      console.log(`Added AI player ${aiPlayer.name} to game ${game.gameId}`);
    }
  }

  /**
   * Start a new round for the given game
   * @param gameId - The game ID
   */
  startNewRound(gameId: string): void {
    console.log(`[game-state-manager] BEGIN startNewRound for game ${gameId}`);

    const game = this.games.get(gameId);

    if (!game) {
      console.error(
        `[game-state-manager] Game not found in startNewRound: ${gameId}`,
      );
      return;
    }

    console.log(`[game-state-manager] Current game state before new round:`, {
      gameId,
      status: game.status,
      roundNumber: game.round.number,
      roundStatus: game.round.status,
      submissionsCount: game.round.submissions.length,
      playersCount: game.players.length,
      maxRounds: game.settings.roundsToPlay,
    });

    // Check if the game is already over
    if (game.status === gameStatus.COMPLETED) {
      console.log(
        `[game-state-manager] Game ${gameId} is already completed, not starting new round`,
      );
      return;
    }

    // Check if we've reached the maximum number of rounds
    if (game.round.number >= game.settings.roundsToPlay) {
      console.log(
        `[game-state-manager] Game ${gameId} has reached the maximum number of rounds (${game.settings.roundsToPlay})`,
      );
      game.status = gameStatus.COMPLETED;
      game.round.status = roundStatus.COMPLETED;
      return;
    }

    // Increment round number if this isn't the first round
    if (game.round.status !== roundStatus.WAITING) {
      console.log(
        `[game-state-manager] Incrementing round number from ${game.round.number} to ${game.round.number + 1}`,
      );
      game.round.number++;
    }

    const previousSubmissions = [...(game.round.submissions || [])];

    // Reset round state
    const previousStatus = game.round.status;
    game.round.status = roundStatus.SELECTION;
    game.round.story = "";
    game.round.submissions = [];  // Will be populated in assembleStory

    console.log(`[game-state-manager] Reset round state:`, {
      previousStatus,
      newStatus: game.round.status,
      prevSubmissionsCount: previousSubmissions.length,
      newSubmissionsCount: game.round.submissions.length,
      roundNumber: game.round.number,
    });

    // Reset player selections and voting status for the new round
    game.players.forEach((player) => {
      const previousSelection = player.selectedCard;
      const previousMoral = player.submittedMoral;
      const previousVoteStatus = player.hasVoted;

      // Reset all player state for the new round
      player.selectedCard = null;
      player.submittedMoral = null;
      player.hasVoted = false;
      player.isThinking = false;

      console.log(`[game-state-manager] Reset player ${player.name}:`, {
        playerId: player.id,
        roundNumber: game.round.number,
        previousSelection,
        previousMoral: previousMoral ? "had moral" : null,
        previousVoteStatus,
        newSelection: player.selectedCard,
        newMoral: player.submittedMoral,
        hasVoted: player.hasVoted,
      });
      
      // Critical fix: Ensure any lingering submission objects from previous round don't cause issues
      if (previousSubmissions.length > 0) {
        const previousPlayerSubmission = previousSubmissions.find(s => s.playerId === player.id);
        if (previousPlayerSubmission) {
          // Log the previous submission state for debugging
          console.log(`[game-state-manager] Previous submission state for player ${player.name}:`, {
            playerId: player.id,
            roundNumber: game.round.number,
            hadMoral: !!previousPlayerSubmission.moral,
            wasVoted: previousPlayerSubmission.hasVoted,
            votes: previousPlayerSubmission.votes,
          });
        }
      }
    });

    // Assign card types to players
    this.assignCardTypes(game);

    console.log(
      `[game-state-manager] Assigned card types to players:`,
      game.players.map((p) => ({
        playerId: p.id,
        name: p.name,
        cardType: p.currentCardType,
      })),
    );

    // Deal cards to players
    this.dealCards(game);

    console.log(
      `[game-state-manager] Dealt cards to players, hand sizes:`,
      game.players.map((p) => ({
        playerId: p.id,
        name: p.name,
        handSize: p.hand?.length || 0,
        cardTypes: p.hand?.map((c) => c.type).join(", "),
      })),
    );

    console.log(
      `[game-state-manager] END startNewRound - Started round ${game.round.number} for game ${gameId}`,
    );
  }

  /**
   * Assign card types to players, rotating based on round number
   * @param game - The game object
   */
  private assignCardTypes(game: Game): void {
    // We need exactly 5 card types, one for each player
    // Card type assignments - we need one player for each type
    const types = [
      cardTypes.LOCATION,
      cardTypes.CHARACTER,
      cardTypes.INITIAL_TWIST,
      cardTypes.ESCALATION,
      cardTypes.FINAL_TWIST,
    ];

    // Note: We're not resetting player state here anymore since that's fully handled in startNewRound
    // This avoids potential duplicated resets that could cause issues
    console.log(`[game-state-manager] assignCardTypes: Starting card type assignment for round ${game.round.number}`);

    // Shuffle the player array to randomize type assignments
    // This ensures we're not always giving the same types to the same players
    const shuffledIndexes = Array.from(
      { length: game.players.length },
      (_, i) => i,
    ).sort(() => Math.random() - 0.5);

    // Get a different starting offset for each round to rotate card types
    const roundOffset = (game.round.number - 1) % types.length;

    // Assign each card type to a player, ensuring all 5 types are used
    // and rotated each round
    shuffledIndexes.forEach((playerIdx, i) => {
      const typeIndex = (i + roundOffset) % types.length;
      const player = game.players[playerIdx];
      player.currentCardType = types[typeIndex];
      console.log(
        `Assigned ${player.name} (${player.id}) to card type: ${player.currentCardType}`,
      );
    });
  }

  /**
   * Create a blank card for custom player input
   * @param type - The card type
   * @param id - Card ID to assign
   * @returns A blank custom card
   */
  private createBlankCard(type: string, id: number): Card {
    const typeName = type.charAt(0).toUpperCase() + type.slice(1);

    return {
      id: id,
      text: "",
      type: type,
      isCustom: true,
      customPrompt: `Enter your custom ${typeName}`,
    };
  }

  /**
   * Deal 3 cards to each player from their assigned deck
   * With a chance of including a blank customizable card
   * @param game - The game object
   */
  private dealCards(game: Game): void {
    if (!cardData) {
      console.error("Card data not loaded");
      return;
    }

    // Card IDs for custom cards (need to be unique and not conflict with existing cards)
    // Using high numbers to avoid conflicts
    const CUSTOM_CARD_ID_START = 10000;
    let nextCustomCardId = CUSTOM_CARD_ID_START;

    // Custom card chance (20%)
    const CUSTOM_CARD_CHANCE = 0.2;

    game.players.forEach((player) => {
      let deck: Card[] = [];

      // Get the correct deck based on player's card type
      switch (player.currentCardType) {
        case cardTypes.LOCATION:
          deck = cardData!.locationCards;
          break;
        case cardTypes.CHARACTER:
          deck = cardData!.characterCards;
          break;
        case cardTypes.INITIAL_TWIST:
          deck = cardData!.initialTwistCards;
          break;
        case cardTypes.ESCALATION:
          deck = cardData!.escalationCards;
          break;
        case cardTypes.FINAL_TWIST:
          deck = cardData!.finalTwistCards;
          break;
      }

      // Deal cards to the player
      let hand = this.getRandomCards(deck, 3);

      // For each player, decide if we should replace one card with a blank custom card
      // Only for human players and with a random chance
      if (!player.isAI && Math.random() < CUSTOM_CARD_CHANCE) {
        // Replace a random card with a blank custom card
        const replaceIndex = Math.floor(Math.random() * hand.length);
        hand[replaceIndex] = this.createBlankCard(
          player.currentCardType || "unknown",
          nextCustomCardId++,
        );

        console.log(
          `Dealt a blank custom card to player ${player.name} of type ${player.currentCardType}`,
        );
      }

      player.hand = hand;
    });
  }

  /**
   * Get random cards from a deck
   * @param deck - The card deck
   * @param count - Number of cards to draw
   * @returns Array of selected cards
   */
  private getRandomCards<T>(deck: T[], count: number): T[] {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Update the text of a custom card
   * @param gameId - The game ID
   * @param playerId - The player ID
   * @param cardId - The card ID to update
   * @param customText - The custom text for the card
   * @returns Success status
   */
  updateCustomCard(
    gameId: string,
    playerId: string,
    cardId: number,
    customText: string,
  ): boolean {
    const game = this.games.get(gameId);

    if (!game) {
      console.error(`Game not found: ${gameId}`);
      return false;
    }

    // Check if the game is in the selection phase
    if (game.round.status !== roundStatus.SELECTION) {
      console.error(`Game ${gameId} is not in selection phase`);
      return false;
    }

    // Find the player
    const player = game.players.find((p) => p.id === playerId);
    if (!player) {
      console.error(`Player ${playerId} not found in game ${gameId}`);
      return false;
    }

    // Find the custom card in player's hand
    const cardIndex = player.hand?.findIndex(
      (card) => card.id === cardId && card.isCustom,
    );
    if (cardIndex === undefined || cardIndex === -1) {
      console.error(
        `Custom card ${cardId} not found in player ${playerId}'s hand`,
      );
      return false;
    }

    // Update the card text
    if (player.hand && player.hand[cardIndex]) {
      player.hand[cardIndex].text = customText;
      console.log(
        `Updated custom card ${cardId} text for player ${playerId}: "${customText}"`,
      );
      return true;
    }

    return false;
  }

  /**
   * Process a player's card selection
   * @param gameId - The game ID
   * @param playerId - The player ID
   * @param cardId - The selected card ID
   * @param customText - Optional custom text for a custom card
   * @returns Success status
   */
  selectCard(
    gameId: string,
    playerId: string,
    cardId: number,
    customText?: string,
  ): boolean {
    const game = this.games.get(gameId);

    if (!game) {
      console.error(`Game not found: ${gameId}`);
      return false;
    }

    // Check if the game is in the selection phase
    if (game.round.status !== roundStatus.SELECTION) {
      console.error(`Game ${gameId} is not in selection phase`);
      return false;
    }

    // Find the player
    const player = game.players.find((p) => p.id === playerId);
    if (!player) {
      console.error(`Player ${playerId} not found in game ${gameId}`);
      return false;
    }

    // Find the card in player's hand
    const cardIndex = player.hand?.findIndex((card) => card.id === cardId);
    if (cardIndex === undefined || cardIndex === -1) {
      console.error(`Card ${cardId} not found in player ${playerId}'s hand`);
      return false;
    }

    // If it's a custom card and custom text is provided, update the card text
    if (player.hand && player.hand[cardIndex].isCustom && customText) {
      player.hand[cardIndex].text = customText;
      console.log(
        `Updated custom card ${cardId} text for player ${playerId}: "${customText}"`,
      );
    }

    // Save the selection
    player.selectedCard = cardId;
    console.log(`Player ${playerId} selected card ${cardId} in game ${gameId}`);

    // Check if all players have selected a card
    const allSelected = game.players.every((p) => p.selectedCard !== null);

    if (allSelected) {
      // Assemble the story from all selected cards
      this.assembleStory(game);

      // Move to the storytelling phase
      game.round.status = roundStatus.STORYTELLING;
      console.log(
        `All players in game ${gameId} have selected cards. Moving to storytelling phase.`,
      );
    }

    return true;
  }

  /**
   * Have AI players automatically select cards with random delays
   * @param gameId - The game ID
   */
  async makeAISelections(gameId: string): Promise<void> {
    const game = this.games.get(gameId);

    if (!game) {
      console.error(`Game not found: ${gameId}`);
      return;
    }

    // Check if the game is in the selection phase
    if (game.round.status !== roundStatus.SELECTION) {
      return;
    }

    // Get AI players that haven't selected a card yet
    const pendingAIPlayers = game.players.filter(
      (player) =>
        player.isAI &&
        player.selectedCard === null &&
        player.hand &&
        player.hand.length > 0,
    );

    // If no AI players need to make selections, return early
    if (pendingAIPlayers.length === 0) {
      return;
    }

    // Log the AI players that will make selections
    console.log(
      `[game-state-manager] Processing ${pendingAIPlayers.length} AI player selections for game ${gameId}`,
    );

    // Create an array of promises for AI selections with random delays
    const aiSelectionPromises = pendingAIPlayers.map(async (player) => {
      // Random delay between 1-3 seconds
      const delay = Math.floor(Math.random() * 2000) + 1000;

      // Mark the AI as "thinking" by setting a flag (not persisted in storage)
      player.isThinking = true;
      console.log(
        `[game-state-manager] AI player ${player.name} is thinking for ${delay}ms...`,
      );

      // Wait for the random delay
      await new Promise((resolve) => setTimeout(resolve, delay));

      if (player.hand && player.hand.length > 0) {
        // Randomly select a card
        const randomIndex = Math.floor(Math.random() * player.hand.length);
        const selectedCard = player.hand[randomIndex];

        player.selectedCard = selectedCard.id;
        player.isThinking = false;

        console.log(
          `[game-state-manager] AI player ${player.name} selected card ${selectedCard.id} in game ${gameId} after ${delay}ms`,
        );
      } else {
        player.isThinking = false;
        console.log(
          `[game-state-manager] Warning: AI player ${player.name} has no cards to select from`,
        );
      }
    });

    // Wait for all AI players to make their selections
    await Promise.all(aiSelectionPromises);

    // Check if all players have now selected a card
    const allSelected = game.players.every((p) => p.selectedCard !== null);

    if (allSelected) {
      // Assemble the story from all selected cards
      this.assembleStory(game);

      // Move to the storytelling phase
      game.round.status = roundStatus.STORYTELLING;
      console.log(
        `All players in game ${gameId} have selected cards. Moving to storytelling phase.`,
      );
    }
  }

  /**
   * Assemble a story from all selected cards
   * @param game - The game object
   */
  private assembleStory(game: Game): void {
    // Get all selected cards
    const selectedCards: { [type: string]: Card | null } = {
      [cardTypes.LOCATION]: null,
      [cardTypes.CHARACTER]: null,
      [cardTypes.INITIAL_TWIST]: null,
      [cardTypes.ESCALATION]: null,
      [cardTypes.FINAL_TWIST]: null,
    };

    // Collect all selected cards by their type
    game.players.forEach((player) => {
      if (
        player.selectedCard !== null &&
        player.currentCardType &&
        player.hand
      ) {
        const selectedCard = player.hand.find(
          (card) => card.id === player.selectedCard,
        );
        if (selectedCard) {
          selectedCards[player.currentCardType] = selectedCard;
        }
      }
    });

    // Assemble the story
    const storyParts: string[] = [];

    // Start with location
    if (selectedCards[cardTypes.LOCATION]) {
      storyParts.push(
        `In a ${selectedCards[cardTypes.LOCATION]?.text || "a mysterious place"}`,
      );
    }

    // Add character
    if (selectedCards[cardTypes.CHARACTER]) {
      storyParts.push(
        `, a ${selectedCards[cardTypes.CHARACTER]?.text || "strange character"}`,
      );
    }

    // Add initial twist
    if (selectedCards[cardTypes.INITIAL_TWIST]) {
      storyParts.push(
        ` NOTICES ${selectedCards[cardTypes.INITIAL_TWIST]?.text || "something unusual"}`,
      );
    }

    // Add escalation
    if (selectedCards[cardTypes.ESCALATION]) {
      storyParts.push(
        `. But then, ${selectedCards[cardTypes.ESCALATION]?.text || "the situation escalates"}`,
      );
    }

    // Add final twist
    if (selectedCards[cardTypes.FINAL_TWIST]) {
      storyParts.push(
        ` ALL BECAUSE ${selectedCards[cardTypes.FINAL_TWIST]?.text || "a final twist occurs"}`,
      );
    }

    // Join the story parts with proper spacing
    game.round.story = storyParts.join(" ");

    // Initialize submissions for each player
    game.round.submissions = game.players.map((player) => ({
      playerId: player.id,
      cardId: player.selectedCard || 0,
      moral: null,
      votes: 0,
      hasVoted: false // Explicitly initialize hasVoted as false
    }));

    console.log(`Assembled story for game ${game.gameId}: ${game.round.story}`);
  }

  /**
   * Submit a moral for a player
   * @param gameId - The game ID
   * @param playerId - The player ID
   * @param moral - The submitted moral
   * @returns Success status
   */
  submitMoral(gameId: string, playerId: string, moral: string): boolean {
    const game = this.games.get(gameId);

    if (!game) {
      console.error(`Game not found: ${gameId}`);
      return false;
    }

    // Check if the game is in the storytelling phase
    if (game.round.status !== roundStatus.STORYTELLING) {
      console.error(`Game ${gameId} is not in storytelling phase`);
      return false;
    }

    // Find the player
    const player = game.players.find((p) => p.id === playerId);
    if (!player) {
      console.error(`Player ${playerId} not found in game ${gameId}`);
      return false;
    }

    // Find the player's submission
    const submission = game.round.submissions.find(
      (s) => s.playerId === playerId,
    );
    if (!submission) {
      console.error(
        `Submission for player ${playerId} not found in game ${gameId}`,
      );
      return false;
    }

    // Update the submission with the moral
    submission.moral = moral;
    player.submittedMoral = moral;

    console.log(
      `Player ${playerId} submitted moral in game ${gameId}: ${moral}`,
    );

    // Check if all players have submitted a moral
    const allSubmissionsHaveMorals = game.round.submissions.every(
      (s) => s.moral !== null,
    );
    const allPlayersHaveMorals = game.players.every(
      (p) => p.submittedMoral !== null && p.submittedMoral !== undefined,
    );

    if (allSubmissionsHaveMorals && allPlayersHaveMorals) {
      // Move to the voting phase
      game.round.status = roundStatus.VOTING;
      console.log(
        `All players in game ${gameId} have submitted morals. Moving to voting phase automatically.`,
      );
    } else {
      // Log detailed diagnostic information
      const playersWithoutMorals = game.players
        .filter((p) => !p.submittedMoral)
        .map((p) => `${p.name}(${p.id})`);
      const submissionsWithoutMorals = game.round.submissions
        .filter((s) => s.moral === null)
        .map((s) => s.playerId);
      console.log(`Not all morals submitted yet in game ${gameId}:`);
      console.log(
        `- Players without morals (${playersWithoutMorals.length}): ${playersWithoutMorals.join(", ")}`,
      );
      console.log(
        `- Submissions without morals (${submissionsWithoutMorals.length}): ${submissionsWithoutMorals.join(", ")}`,
      );
    }

    return true;
  }

  /**
   * Generate morals for AI players
   * @param gameId - The game ID
   */
  async generateAIMorals(gameId: string): Promise<void> {
    console.log(
      `[game-state-manager] BEGIN generateAIMorals for game ${gameId}`,
    );
    try {
      const game = this.games.get(gameId);

      if (!game) {
        console.error(
          `[game-state-manager] Game ${gameId} not found in generateAIMorals`,
        );
        return;
      }

      // Check current game state
      console.log(
        `[game-state-manager] Current round status: ${game.round.status}`,
      );
      console.log(
        `[game-state-manager] Players with morals: ${game.players.filter((p) => p.submittedMoral).length}/${game.players.length}`,
      );

      // Always proceed even if not in storytelling phase (as a recovery mechanism)
      if (game.round.status !== roundStatus.STORYTELLING) {
        console.log(
          `[game-state-manager] Warning: generateAIMorals called while not in storytelling phase (${game.round.status})`,
        );
      }

      // Funny pre-written morals to use
      const funnyMorals = [
        "The moral of the story is: Always check if your time-traveling device has a return policy.",
        "The moral of the story is: Never trust a talking plant with your WiFi password.",
        "The moral of the story is: Sometimes the best solution is to pretend nothing happened.",
        "The moral of the story is: If plan A fails, remember there are 25 more letters in the alphabet.",
        "The moral of the story is: Not all who wander are lost, but this one definitely was.",
        "The moral of the story is: Just because you can doesn't mean you should, especially with portals.",
        "The moral of the story is: When reality glitches, pretend you meant to do that.",
        "The moral of the story is: The universe has a sense of humor, just not a very good one.",
        "The moral of the story is: Trust no one, especially if they claim to be from the future.",
        "The moral of the story is: Sometimes the only winning move is to unplug and go for a walk.",
      ];

      // Count AI players that need morals
      const aiPlayersNeedingMorals = game.players.filter(
        (p) => p.isAI && !p.submittedMoral,
      ).length;
      console.log(
        `[game-state-manager] AI players needing morals: ${aiPlayersNeedingMorals}`,
      );

      // Generate morals for AI players
      for (const player of game.players) {
        if (player.isAI) {
          if (!player.submittedMoral) {
            console.log(
              `[game-state-manager] Generating moral for AI player ${player.name} (${player.id})`,
            );
            // Get the current story from the game
            const story = game.round.story;

            try {
              // Call the AI service to generate a moral
              const generatedMoral = await generateAIMoral(story);
              player.submittedMoral = generatedMoral;
              console.log(
                `[game-state-manager] Generated AI moral using Claude: ${generatedMoral}`,
              );
            } catch (error) {
              // Fallback to random selection if AI generation fails
              console.error(
                `[game-state-manager] Error generating AI moral:`,
                error,
              );
              const randomIndex = Math.floor(
                Math.random() * funnyMorals.length,
              );
              player.submittedMoral = funnyMorals[randomIndex];
              console.log(
                `[game-state-manager] Fallback to predefined moral: ${player.submittedMoral}`,
              );
            }

            // Update submission
            const submission = game.round.submissions.find(
              (s) => s.playerId === player.id,
            );
            if (submission) {
              submission.moral = player.submittedMoral;
              console.log(
                `[game-state-manager] Updated submission for player ${player.id}`,
              );
            } else {
              console.error(
                `[game-state-manager] No submission found for AI player ${player.id}`,
              );
            }

            console.log(
              `[game-state-manager] AI player ${player.name} submitted moral: ${player.submittedMoral}`,
            );
          } else {
            console.log(
              `[game-state-manager] AI player ${player.name} already has moral: ${player.submittedMoral}`,
            );
          }
        }
      }

      // Verify all AI players have morals now
      const aiPlayersWithMorals = game.players.filter(
        (p) => p.isAI && p.submittedMoral,
      ).length;
      const aiPlayersTotal = game.players.filter((p) => p.isAI).length;
      console.log(
        `[game-state-manager] AI players with morals after generation: ${aiPlayersWithMorals}/${aiPlayersTotal}`,
      );

      // Check if all human players have also submitted their morals
      const humanPlayersWithMorals = game.players.filter(
        (p) => !p.isAI && p.submittedMoral,
      ).length;
      const humanPlayersTotal = game.players.filter((p) => !p.isAI).length;
      console.log(
        `[game-state-manager] Human players with morals: ${humanPlayersWithMorals}/${humanPlayersTotal}`,
      );

      // Check if all submissions have morals too
      const allSubmissionsHaveMorals = game.round.submissions.every(
        (s) => s.moral !== null,
      );
      const submissionsWithoutMorals = game.round.submissions.filter(
        (s) => s.moral === null,
      ).length;

      console.log(
        `[game-state-manager] Submissions with morals: ${game.round.submissions.length - submissionsWithoutMorals}/${game.round.submissions.length}`,
      );

      // Only advance to voting if all humans have submitted morals AND all submissions have morals
      if (
        humanPlayersWithMorals === humanPlayersTotal &&
        allSubmissionsHaveMorals
      ) {
        game.round.status = roundStatus.VOTING;
        console.log(
          `[game-state-manager] All players and submissions have morals. Game ${gameId} advanced to voting phase.`,
        );
      } else {
        // Print which human players haven't submitted morals yet
        const humanPlayersWithoutMorals = game.players
          .filter((p) => !p.isAI && !p.submittedMoral)
          .map((p) => `${p.name}(${p.id})`)
          .join(", ");

        // Also print submissions without morals
        const submissionsWithoutMoralsDetails = game.round.submissions
          .filter((s) => s.moral === null)
          .map((s) => {
            const player = game.players.find((p) => p.id === s.playerId);
            return `${player?.name || "Unknown"}(${s.playerId})`;
          })
          .join(", ");

        console.log(
          `[game-state-manager] Waiting for human players to submit morals: ${humanPlayersWithoutMorals}`,
        );
        console.log(
          `[game-state-manager] Submissions missing morals: ${submissionsWithoutMoralsDetails}`,
        );
      }

      // Extra verification - make sure all AI players have morals
      // We don't apply this failsafe to human players, as they need to submit their own morals
      let fixedCount = 0;
      game.players.forEach((player) => {
        if (player.isAI && !player.submittedMoral) {
          // Assign a default moral as failsafe for AI players only
          const defaultMoral = "The moral is: some stories write themselves.";
          player.submittedMoral = defaultMoral;

          // Find and update the submission too
          const submission = game.round.submissions.find(
            (s) => s.playerId === player.id,
          );
          if (submission) {
            submission.moral = defaultMoral;
          }
          fixedCount++;
        }
      });

      if (fixedCount > 0) {
        console.log(
          `[game-state-manager] Had to fix ${fixedCount} missing AI morals as failsafe`,
        );
      }

      // Final verification - AI players should all have morals now
      const allAIPlayersWithMorals = game.players
        .filter((p) => p.isAI)
        .every((p) => p.submittedMoral);
      console.log(
        `[game-state-manager] Final verification - all AI players have morals: ${allAIPlayersWithMorals}`,
      );

      console.log(
        `[game-state-manager] END generateAIMorals for game ${gameId}, final round status: ${game.round.status}`,
      );
    } catch (error) {
      console.error(
        `[game-state-manager] ERROR in generateAIMorals for game ${gameId}:`,
        error,
      );

      // Last-resort recovery - try to get the game and force it to voting phase
      try {
        const gameToFix = this.games.get(gameId);
        if (gameToFix) {
          gameToFix.round.status = roundStatus.VOTING;
          console.log(
            `[game-state-manager] EMERGENCY forced game ${gameId} to voting phase after error`,
          );
        }
      } catch (recoveryError) {
        console.error(
          `[game-state-manager] Failed even emergency recovery:`,
          recoveryError,
        );
      }
    }
  }

  /**
   * Process a player's vote
   * @param gameId - The game ID
   * @param voterId - The voting player's ID
   * @param votedForId - The ID of the player voted for
   * @returns Success status
   */
  castVote(gameId: string, voterId: string, votedForId: string): boolean {
    console.log(
      `[game-state-manager] BEGIN castVote for game ${gameId}, voter ${voterId}, voted for ${votedForId}`,
    );
    const game = this.games.get(gameId);

    if (!game) {
      console.error(`[game-state-manager] Game not found: ${gameId}`);
      return false;
    }

    // Check if the game is in the voting phase
    if (game.round.status !== roundStatus.VOTING) {
      console.error(
        `[game-state-manager] Game ${gameId} is not in voting phase, current status: ${game.round.status}`,
      );
      return false;
    }

    // Find the players
    const voter = game.players.find((p) => p.id === voterId);
    const votedFor = game.players.find((p) => p.id === votedForId);

    if (!voter || !votedFor) {
      console.error(`[game-state-manager] Players not found in game ${gameId}`);
      return false;
    }

    // Check if the voter is trying to vote for themselves
    if (voterId === votedForId) {
      console.error(
        `[game-state-manager] Player ${voterId} cannot vote for themselves`,
      );
      return false;
    }

    // Find the submission being voted for
    const submission = game.round.submissions.find(
      (s) => s.playerId === votedForId,
    );
    if (!submission) {
      console.error(
        `[game-state-manager] Submission for player ${votedForId} not found in game ${gameId}`,
      );
      return false;
    }

    // Find the voter's submission to mark that they've voted
    const voterSubmission = game.round.submissions.find(
      (s) => s.playerId === voterId,
    );
    if (voterSubmission) {
      // Mark that this player has cast their vote
      voterSubmission.hasVoted = true;
      
      // Also mark the player as having voted for consistency
      voter.hasVoted = true;
      
      console.log(
        `[game-state-manager] Marked player ${voterId} as having voted`,
      );
    } else {
      console.warn(
        `[game-state-manager] Could not find submission for voter ${voterId}`,
      );
    }

    // Increment the vote count for the voted-for player
    submission.votes++;

    const isHuman = !votedFor.isAI;
    console.log(
      `[game-state-manager] Player ${voterId} voted for ${votedForId}'s moral (${isHuman ? "Human" : "AI"}) in game ${gameId}`,
    );

    // Count how many players have voted
    const playersWithMorals = game.round.submissions.filter(
      (s) => s.moral !== null,
    ).length;
    const playersWhoVoted = game.round.submissions.filter(
      (s) => s.hasVoted,
    ).length;

    console.log(
      `[game-state-manager] Voting progress: ${playersWhoVoted}/${playersWithMorals} players have voted`,
    );

    // Check if all human players have voted
    const humanPlayers = game.players.filter((p) => !p.isAI);
    const humanPlayersWhoVoted = game.round.submissions.filter((s) => {
      const player = game.players.find((p) => p.id === s.playerId);
      return player && !player.isAI && s.hasVoted;
    }).length;

    console.log(
      `[game-state-manager] Human voting progress: ${humanPlayersWhoVoted}/${humanPlayers.length}`,
    );

    if (humanPlayersWhoVoted >= humanPlayers.length) {
      console.log(
        `[game-state-manager] All human players have voted in game ${gameId}, handling AI votes and round end`,
      );
      // Have AI players cast their votes with simulated thinking time
      this.makeAIVotes(game);

      // Use a shorter delay to improve game flow
      setTimeout(() => {
        console.log(
          `[game-state-manager] Ending round after AI voting delay for game ${gameId}`,
        );
        // End the round and update game status
        this.endRound(gameId);

        // Note: Broadcast will need to be handled by the caller (socket-handler)
        console.log(
          `[game-state-manager] Round ended for game ${gameId}, final status: ${game.round.status}`,
        );
      }, 2000); // Shorter 2 second delay after last human vote
    }

    return true;
  }

  /**
   * Have AI players cast their votes with simulated thinking time
   * @param game - The game object
   */
  private makeAIVotes(game: Game): void {
    console.log(
      `[game-state-manager] BEGIN makeAIVotes for game ${game.gameId}`,
    );
    const aiPlayers = game.players.filter((p) => p.isAI);
    console.log(
      `[game-state-manager] Processing votes for ${aiPlayers.length} AI players`,
    );

    // Stagger AI votes with small delays for more natural feeling
    aiPlayers.forEach((aiPlayer, index) => {
      // Small staggered delays (100-400ms) for each AI vote to seem natural
      setTimeout(() => {
        // First mark the AI as thinking about its vote
        aiPlayer.isThinking = true;
        console.log(
          `[game-state-manager] AI player ${aiPlayer.name} (${aiPlayer.id}) is thinking about their vote`,
        );

        // Short simulated decision time
        setTimeout(
          () => {
            // Find AI player's submission to mark that they've voted
            const aiSubmission = game.round.submissions.find(
              (s) => s.playerId === aiPlayer.id,
            );
            if (aiSubmission) {
              // Mark that this AI player has cast their vote
              aiSubmission.hasVoted = true;
              
              // Also mark the player as having voted for consistency
              aiPlayer.hasVoted = true;
              
              console.log(
                `[game-state-manager] Marked AI player ${aiPlayer.id} as having voted`,
              );
            } else {
              console.warn(
                `[game-state-manager] Could not find submission for AI player ${aiPlayer.id}`,
              );
            }

            // Simulate AI vote using the weighted algorithm with preference for human players
            const votedForId = simulateAIVote(
              game.round.submissions,
              aiPlayer.id,
              game.players,
            );

            if (votedForId) {
              // Find the submission being voted for
              const submission = game.round.submissions.find(
                (s) => s.playerId === votedForId,
              );
              if (submission) {
                // Find player that's being voted for
                const votedForPlayer = game.players.find(
                  (p) => p.id === votedForId,
                );
                const isHuman = votedForPlayer && !votedForPlayer.isAI;

                // Increment the vote count
                const oldVotes = submission.votes;
                submission.votes++;

                // AI is no longer thinking
                aiPlayer.isThinking = false;

                console.log(
                  `[game-state-manager] AI player ${aiPlayer.name} (${aiPlayer.id}) voted for ${votedForId}'s moral (${isHuman ? "Human" : "AI"}), votes increased from ${oldVotes} to ${submission.votes}`,
                );
              } else {
                console.warn(
                  `[game-state-manager] Could not find submission for votedForId ${votedForId}`,
                );
              }
            } else {
              console.warn(
                `[game-state-manager] AI player ${aiPlayer.id} could not find a valid player to vote for`,
              );
            }
          },
          500 + Math.random() * 500,
        ); // Random "thinking" time between 500-1000ms
      }, index * 200); // Stagger each AI vote by 200ms
    });

    console.log(
      `[game-state-manager] END makeAIVotes - All AI votes scheduled for game ${game.gameId}`,
    );
  }

  /**
   * End the current round and calculate scores
   * @param gameId - The game ID
   */
  endRound(gameId: string): void {
    console.log(`[game-state-manager] BEGIN endRound for game ${gameId}`);

    try {
      const game = this.games.get(gameId);

      if (!game) {
        console.error(
          `[game-state-manager] Game not found in endRound: ${gameId}`,
        );
        return;
      }

      console.log(
        `[game-state-manager] Detailed game state at start of endRound:`,
        {
          gameId: game.gameId,
          status: game.status,
          roundNumber: game.round.number,
          roundStatus: game.round.status,
          playersCount: game.players.length,
          submissionsCount: game.round.submissions.length,
          submissionsWithVotes: game.round.submissions.filter(
            (s) => s.votes > 0,
          ).length,
          playerScores: game.players.map((p) => ({
            id: p.id,
            name: p.name,
            score: p.score,
          })),
          submissionDetails: game.round.submissions.map((s) => ({
            playerId: s.playerId,
            moralExists: s.moral !== null,
            votes: s.votes,
            hasVoted: s.hasVoted || false,
          })),
        },
      );

      // Verify we're in voting phase
      if (game.round.status !== roundStatus.VOTING) {
        console.warn(
          `[game-state-manager] Attempted to end round for game ${gameId} while not in VOTING phase. Current status: ${game.round.status}`,
        );

        // Force to voting first, then continue to results
        if (game.round.status !== roundStatus.RESULTS) {
          console.log(
            `[game-state-manager] Forcing game ${gameId} to voting phase before proceeding to results`,
          );
          game.round.status = roundStatus.VOTING;
        } else {
          console.log(
            `[game-state-manager] Game ${gameId} already in RESULTS phase, no action needed`,
          );
          return; // Already in results phase, exit to avoid double scoring
        }
      }

      // Calculate and log initial scores
      const scoresBefore = game.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
      }));

      console.log(
        `[game-state-manager] Player scores before calculation:`,
        scoresBefore,
      );

      // Calculate scores
      game.round.submissions.forEach((submission) => {
        const player = game.players.find((p) => p.id === submission.playerId);
        if (player) {
          // Add points for votes received
          const oldScore = player.score;
          player.score += submission.votes;
          console.log(
            `[game-state-manager] Player ${player.name} (${player.id}) received ${submission.votes} votes, score updated from ${oldScore} to ${player.score}`,
          );
        } else {
          console.warn(
            `[game-state-manager] Could not find player ${submission.playerId} for submission during score calculation`,
          );
        }
      });

      // Print all players' scores for verification
      const scoresAfter = game.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
      }));

      console.log(
        `[game-state-manager] Player scores after calculation:`,
        scoresAfter,
      );

      // Move to the Results phase
      const oldStatus = game.round.status;
      game.round.status = roundStatus.RESULTS;
      console.log(
        `[game-state-manager] Changed round status from ${oldStatus} to ${game.round.status}`,
      );

      // Check if the game is over
      if (game.round.number >= game.settings.roundsToPlay) {
        // Mark the game as completed (but we'll still show results UI first)
        const oldGameStatus = game.status;
        game.status = gameStatus.COMPLETED;
        console.log(
          `[game-state-manager] Game ${gameId} status changed from ${oldGameStatus} to ${game.status} after completing ${game.round.number}/${game.settings.roundsToPlay} rounds`,
        );
      } else {
        console.log(
          `[game-state-manager] Round ${game.round.number} ended for game ${gameId}, showing results before next round (${game.round.number + 1}/${game.settings.roundsToPlay})`,
        );
      }

      // Final verification of game state
      console.log(`[game-state-manager] Final game state after endRound:`, {
        gameId: game.gameId,
        status: game.status,
        roundNumber: game.round.number,
        roundStatus: game.round.status,
        playersCount: game.players.length,
        submissionsCount: game.round.submissions.length,
        playerFinalScores: game.players.map((p) => ({
          id: p.id,
          name: p.name,
          score: p.score,
        })),
      });

      console.log(`[game-state-manager] END endRound for game ${gameId}`);
    } catch (error) {
      console.error(
        `[game-state-manager] ERROR in endRound for game ${gameId}:`,
        error,
      );

      // Emergency recovery - try to force the game to results phase
      try {
        const gameToFix = this.games.get(gameId);
        if (gameToFix) {
          gameToFix.round.status = roundStatus.RESULTS;
          console.log(
            `[game-state-manager] EMERGENCY forced game ${gameId} to results phase after error`,
          );

          console.log(`[game-state-manager] Emergency recovery game state:`, {
            gameId: gameToFix.gameId,
            status: gameToFix.status,
            roundNumber: gameToFix.round.number,
            roundStatus: gameToFix.round.status,
          });
        } else {
          console.error(
            `[game-state-manager] Could not perform emergency recovery: game ${gameId} not found`,
          );
        }
      } catch (recoveryError) {
        console.error(
          `[game-state-manager] Failed emergency recovery in endRound:`,
          recoveryError,
        );
      }
    }
  }

  /**
   * Get the current state of a game
   * @param gameId - The game ID
   * @returns The game state or null if not found
   */
  getGameState(gameId: string): Game | null {
    return this.games.get(gameId) || null;
  }

  /**
   * Get all active games
   * @returns Array of active games
   */
  getAllGames(): Game[] {
    return Array.from(this.games.values());
  }

  /**
   * Remove a player from a game
   * @param gameId - The game ID
   * @param playerId - The player ID
   * @returns Success status
   */
  removePlayer(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);

    if (!game) {
      console.error(`Game not found: ${gameId}`);
      return false;
    }

    // Find the player's index
    const playerIndex = game.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) {
      console.error(`Player ${playerId} not found in game ${gameId}`);
      return false;
    }

    // Remove the player
    const player = game.players[playerIndex];
    game.players.splice(playerIndex, 1);

    console.log(`Player ${player.name} removed from game ${gameId}`);

    // If the player was the host, assign a new host
    if (player.isHost && game.players.length > 0) {
      const newHost = game.players.find((p) => !p.isAI) || game.players[0];
      newHost.isHost = true;
      console.log(
        `New host assigned to player ${newHost.name} in game ${gameId}`,
      );
    }

    // If all players left, remove the game
    if (game.players.length === 0) {
      this.games.delete(gameId);
      console.log(`Game ${gameId} removed as all players left`);
      return true;
    }

    // If game is active and in selection or storytelling phase, handle player removal
    if (game.status === gameStatus.ACTIVE) {
      // Remove player's submission if they had one
      if (game.round.submissions) {
        const submissionIndex = game.round.submissions.findIndex(
          (s) => s.playerId === playerId,
        );
        if (submissionIndex !== -1) {
          game.round.submissions.splice(submissionIndex, 1);
        }
      }

      // If there are not enough players to continue, end the game
      const humanPlayers = game.players.filter((p) => !p.isAI);
      if (humanPlayers.length < 1) {
        game.status = gameStatus.COMPLETED;
        console.log(`Game ${gameId} ended as not enough human players left`);
      }
      // If in selection phase, check if everyone has now selected
      else if (game.round.status === roundStatus.SELECTION) {
        const allSelected = game.players.every((p) => p.selectedCard !== null);
        if (allSelected) {
          this.assembleStory(game);
          game.round.status = roundStatus.STORYTELLING;
        }
      }
      // If in storytelling phase, check if everyone has now submitted a moral
      else if (game.round.status === roundStatus.STORYTELLING) {
        const allSubmitted = game.round.submissions.every(
          (s) => s.moral !== null,
        );
        if (allSubmitted) {
          game.round.status = roundStatus.VOTING;
        }
      }
    }

    return true;
  }
}

// Export a singleton instance
const gameStateManager = new GameStateManager();
export default gameStateManager;
