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
  AI_PERSONALITIES,
  generateAIMoral,
  generateAIPlayerName,
  generateAIPlayerNameForPersonality,
  generateAIJudgment,
} from "./ai-service";
import type { AIPersonality } from "./ai-service";

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
        judgeId: "",
        judgeReason: null,
        submissions: [],
      },
      settings: {
        maxPlayers: 5,
        roundsToPlay: 5,
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

    const others = AI_PERSONALITIES.filter(p => p !== 'qramo');
    const shuffledOthers = others.sort(() => Math.random() - 0.5);
    const ordered: typeof AI_PERSONALITIES = ['qramo', ...shuffledOthers];
    for (let i = 0; i < aiCount; i++) {
      const personality = ordered[i % ordered.length];
      const aiPlayer: Player = {
        id: uuidv4(),
        name: generateAIPlayerNameForPersonality(personality),
        isAI: true,
        personality,
        score: 0,
      };

      game.players.push(aiPlayer);
      console.log(`Added AI player ${aiPlayer.name} (${personality}) to game ${game.gameId}`);
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
    game.round.judgeReason = null;
    game.round.submissions = [];

    // Pick judge: random for round 1, rotate for subsequent rounds
    const prevJudgeId = game.round.judgeId;
    if (!prevJudgeId || game.round.number === 1) {
      const randomIdx = Math.floor(Math.random() * game.players.length);
      game.round.judgeId = game.players[randomIdx].id;
    } else {
      const prevIdx = game.players.findIndex((p) => p.id === prevJudgeId);
      const nextIdx = (prevIdx + 1) % game.players.length;
      game.round.judgeId = game.players[nextIdx].id;
    }

    const judge = game.players.find((p) => p.id === game.round.judgeId);
    console.log(`[game-state-manager] Judge for round ${game.round.number}: ${judge?.name} (${game.round.judgeId})`);

    console.log(`[game-state-manager] Reset round state:`, {
      previousStatus,
      newStatus: game.round.status,
      prevSubmissionsCount: previousSubmissions.length,
      newSubmissionsCount: game.round.submissions.length,
      roundNumber: game.round.number,
      judgeId: game.round.judgeId,
    });

    // Reset player state for the new round
    game.players.forEach((player) => {
      player.selectedCard = null;
      player.submittedMoral = null;
      player.isThinking = false;
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

    const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

    const location = selectedCards[cardTypes.LOCATION]?.text || "a mysterious place";
    const character = selectedCards[cardTypes.CHARACTER]?.text || "strange character";
    const twist = selectedCards[cardTypes.INITIAL_TWIST]?.text || "something unusual";
    const escalation = selectedCards[cardTypes.ESCALATION]?.text || "the situation escalates";
    const finalTwist = selectedCards[cardTypes.FINAL_TWIST]?.text || "a final twist occurs";

    game.round.story = `In a ${lcFirst(location)}, a ${lcFirst(character)} notices ${lcFirst(twist)}. But then, ${lcFirst(escalation)} — all because ${lcFirst(finalTwist)}.`;

    // Initialize submissions for each non-judge player
    game.round.submissions = game.players
      .filter((player) => player.id !== game.round.judgeId)
      .map((player) => ({
        playerId: player.id,
        cardId: player.selectedCard || 0,
        moral: null,
        isWinner: false,
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

    // Reject if caller is the judge
    if (playerId === game.round.judgeId) {
      console.error(`Player ${playerId} is the judge and cannot submit a moral`);
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

    submission.moral = moral;
    player.submittedMoral = moral;

    console.log(
      `Player ${playerId} submitted moral in game ${gameId}: ${moral}`,
    );

    // Check if all non-judge submissions have morals
    const allSubmissionsHaveMorals = game.round.submissions.every(
      (s) => s.moral !== null,
    );

    if (allSubmissionsHaveMorals) {
      game.round.status = roundStatus.VOTING;
      console.log(
        `All non-judge players in game ${gameId} have submitted morals. Moving to judging phase.`,
      );
    } else {
      const submissionsWithoutMorals = game.round.submissions
        .filter((s) => s.moral === null)
        .map((s) => s.playerId);
      console.log(`Not all morals submitted yet in game ${gameId}: waiting on ${submissionsWithoutMorals.length}`);
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

      // Count AI players that need morals (excluding judge)
      const aiPlayersNeedingMorals = game.players.filter(
        (p) => p.isAI && !p.submittedMoral && p.id !== game.round.judgeId,
      ).length;
      console.log(
        `[game-state-manager] AI players needing morals: ${aiPlayersNeedingMorals}`,
      );

      // Generate morals for AI players (skip judge)
      for (const player of game.players) {
        if (player.isAI && player.id !== game.round.judgeId) {
          if (!player.submittedMoral) {
            console.log(
              `[game-state-manager] Generating moral for AI player ${player.name} (${player.id})`,
            );
            // Get the current story from the game
            const story = game.round.story;

            try {
              const personality = (player.personality as AIPersonality) || 'qramo';
              const generatedMoral = await generateAIMoral(story, personality);
              player.submittedMoral = generatedMoral;
              console.log(
                `[game-state-manager] Generated AI moral (${personality}): ${generatedMoral}`,
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

      // Check if all submissions have morals (submissions already exclude judge)
      const allSubmissionsHaveMorals = game.round.submissions.every(
        (s) => s.moral !== null,
      );

      console.log(
        `[game-state-manager] Submissions with morals: ${game.round.submissions.filter(s => s.moral !== null).length}/${game.round.submissions.length}`,
      );

      if (allSubmissionsHaveMorals) {
        game.round.status = roundStatus.VOTING;
        console.log(
          `[game-state-manager] All submissions have morals. Game ${gameId} advanced to judging phase.`,
        );
      }

      // Failsafe: make sure all non-judge AI players have morals
      let fixedCount = 0;
      game.players.forEach((player) => {
        if (player.isAI && player.id !== game.round.judgeId && !player.submittedMoral) {
          const defaultMoral = "The moral is: some stories write themselves.";
          player.submittedMoral = defaultMoral;
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

      console.log(
        `[game-state-manager] END generateAIMorals for game ${gameId}, final round status: ${game.round.status}`,
      );
    } catch (error) {
      console.error(
        `[game-state-manager] ERROR in generateAIMorals for game ${gameId}:`,
        error,
      );
    }
  }

  /**
   * Judge picks the winning moral
   */
  judgePickWinner(gameId: string, judgeId: string, winnerId: string, reason: string): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      console.error(`[game-state-manager] Game not found: ${gameId}`);
      return false;
    }

    if (game.round.status !== roundStatus.VOTING) {
      console.error(`[game-state-manager] Game ${gameId} is not in judging phase`);
      return false;
    }

    if (game.round.judgeId !== judgeId) {
      console.error(`[game-state-manager] Player ${judgeId} is not the judge`);
      return false;
    }

    const winnerSubmission = game.round.submissions.find((s) => s.playerId === winnerId);
    if (!winnerSubmission) {
      console.error(`[game-state-manager] Submission for winner ${winnerId} not found`);
      return false;
    }

    winnerSubmission.isWinner = true;
    game.round.judgeReason = reason;

    const winner = game.players.find((p) => p.id === winnerId);
    if (winner) {
      winner.score += 1;
      console.log(`[game-state-manager] Player ${winner.name} wins round ${game.round.number}, score now ${winner.score}`);
    }

    game.round.status = roundStatus.RESULTS;

    return true;
  }

  /**
   * Trigger AI judgment when the judge is an AI player
   */
  async triggerAIJudgment(gameId: string): Promise<boolean> {
    const game = this.games.get(gameId);
    if (!game) return false;

    const judge = game.players.find((p) => p.id === game.round.judgeId);
    if (!judge || !judge.isAI) return false;

    const morals = game.round.submissions
      .filter((s) => s.moral !== null)
      .map((s) => ({ playerId: s.playerId, moral: s.moral! }));

    if (morals.length === 0) return false;

    const personality = (judge.personality as AIPersonality) || 'qramo';
    console.log(`[game-state-manager] AI judge ${judge.name} (${personality}) deliberating...`);

    const result = await generateAIJudgment(morals, personality, game.round.story);
    return this.judgePickWinner(gameId, judge.id, result.winnerId, result.reason);
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
