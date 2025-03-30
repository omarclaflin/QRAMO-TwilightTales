/**
 * Test client for Twilight Tales game server
 * This script simulates player actions to test Socket.io events
 */
import { io, Socket } from 'socket.io-client';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';

// Message types - must match the server-side enum
enum MessageType {
  JOIN_GAME = 'joinGame',
  CREATE_GAME = 'createGame',
  START_GAME = 'startGame',
  SELECT_CARD = 'selectCard',
  SUBMIT_MORAL = 'submitMoral',
  CAST_VOTE = 'castVote',
  NEXT_ROUND = 'nextRound',
  LEAVE_GAME = 'leaveGame',
  GAME_STATE = 'gameState',
  ERROR = 'error'
}

// Create console interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Simulation state
let socket: Socket;
let playerId: string | null = null;
let gameId: string | null = null;
let cardId: number | null = null;

// Create a socket connection
function connect() {
  console.log('Connecting to server...');
  
  socket = io('http://localhost:5000', {
    path: '/socket.io',
    transports: ['websocket'],
    reconnection: true,
  });

  // Set up event listeners
  socket.on('connect', () => {
    console.log('Connected to server');
    console.log('Socket ID:', socket.id);
    showMainMenu();
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  socket.on(MessageType.ERROR, (data) => {
    console.error('Server error:', data.message);
  });

  socket.on(MessageType.GAME_STATE, (data) => {
    console.log('\n---------- GAME STATE UPDATE ----------');
    console.log('Game ID:', data.game.gameId);
    console.log('Status:', data.game.status);
    console.log('Round:', data.game.round.number);
    console.log('Round Status:', data.game.round.status);
    
    if (data.game.round.story) {
      console.log('\nStory:');
      console.log(data.game.round.story);
    }
    
    console.log('\nPlayers:');
    data.game.players.forEach((player: any) => {
      console.log(`- ${player.name} (${player.id})${player.isHost ? ' (Host)' : ''}${player.isAI ? ' (AI)' : ''} - Score: ${player.score}`);
      
      if (player.id === playerId && player.hand) {
        console.log('  Your cards:');
        player.hand.forEach((card: any, index: number) => {
          console.log(`  ${index + 1}. [ID: ${card.id}] ${card.text}`);
        });
      }
    });
    
    if (data.game.round.submissions && data.game.round.submissions.length > 0) {
      console.log('\nSubmissions:');
      data.game.round.submissions.forEach((submission: any) => {
        const player = data.game.players.find((p: any) => p.id === submission.playerId);
        console.log(`- ${player?.name}: ${submission.moral || 'No moral yet'} (Votes: ${submission.votes || 0})`);
      });
    }
    console.log('--------------------------------------\n');
  });
}

// Show main menu
function showMainMenu() {
  console.log('\n----- TWILIGHT TALES TEST CLIENT -----');
  console.log('1. Create New Game');
  console.log('2. Join Existing Game');
  console.log('3. Exit');
  
  rl.question('Select an option: ', (answer) => {
    switch (answer) {
      case '1':
        createGame();
        break;
      case '2':
        joinGame();
        break;
      case '3':
        console.log('Exiting...');
        socket.disconnect();
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('Invalid option');
        showMainMenu();
    }
  });
}

// Create a new game
function createGame() {
  rl.question('Enter player name: ', (playerName) => {
    console.log(`Creating game as ${playerName}...`);
    
    socket.emit(MessageType.CREATE_GAME, { playerName }, (response: any) => {
      if (response.success) {
        console.log('Game created successfully!');
        console.log('Game ID:', response.gameId);
        console.log('Player ID:', response.playerId);
        
        playerId = response.playerId;
        gameId = response.gameId;
        
        showGameMenu();
      } else {
        console.error('Failed to create game:', response.error);
        showMainMenu();
      }
    });
  });
}

// Join an existing game
function joinGame() {
  rl.question('Enter game ID: ', (inputGameId) => {
    rl.question('Enter player name: ', (playerName) => {
      console.log(`Joining game ${inputGameId} as ${playerName}...`);
      
      socket.emit(MessageType.JOIN_GAME, { gameId: inputGameId, playerName }, (response: any) => {
        if (response.success) {
          console.log('Joined game successfully!');
          console.log('Player ID:', response.playerId);
          
          playerId = response.playerId;
          gameId = inputGameId;
          
          showGameMenu();
        } else {
          console.error('Failed to join game:', response.error);
          showMainMenu();
        }
      });
    });
  });
}

// Show in-game menu
function showGameMenu() {
  console.log('\n---------- GAME MENU ----------');
  console.log('1. Start Game (host only)');
  console.log('2. Select Card');
  console.log('3. Submit Moral');
  console.log('4. Cast Vote');
  console.log('5. Next Round');
  console.log('6. Leave Game');
  console.log('7. Exit');
  
  rl.question('Select an option: ', (answer) => {
    switch (answer) {
      case '1':
        startGame();
        break;
      case '2':
        selectCard();
        break;
      case '3':
        submitMoral();
        break;
      case '4':
        castVote();
        break;
      case '5':
        nextRound();
        break;
      case '6':
        leaveGame();
        break;
      case '7':
        console.log('Exiting...');
        socket.disconnect();
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('Invalid option');
        showGameMenu();
    }
  });
}

// Start the game
function startGame() {
  if (!gameId) {
    console.error('Not in a game');
    showGameMenu();
    return;
  }
  
  console.log('Starting game...');
  
  socket.emit(MessageType.START_GAME, { gameId }, (response: any) => {
    if (response.success) {
      console.log('Game started successfully!');
    } else {
      console.error('Failed to start game:', response.error);
    }
    
    showGameMenu();
  });
}

// Select a card
function selectCard() {
  if (!gameId) {
    console.error('Not in a game');
    showGameMenu();
    return;
  }
  
  rl.question('Enter card ID: ', (inputCardId) => {
    const cardId = parseInt(inputCardId);
    
    if (isNaN(cardId)) {
      console.error('Invalid card ID');
      showGameMenu();
      return;
    }
    
    console.log(`Selecting card ${cardId}...`);
    
    socket.emit(MessageType.SELECT_CARD, { gameId, cardId }, (response: any) => {
      if (response.success) {
        console.log('Card selected successfully!');
      } else {
        console.error('Failed to select card:', response.error);
      }
      
      showGameMenu();
    });
  });
}

// Submit a moral
function submitMoral() {
  if (!gameId) {
    console.error('Not in a game');
    showGameMenu();
    return;
  }
  
  rl.question('Enter moral: ', (moral) => {
    console.log('Submitting moral...');
    
    socket.emit(MessageType.SUBMIT_MORAL, { gameId, moral }, (response: any) => {
      if (response.success) {
        console.log('Moral submitted successfully!');
      } else {
        console.error('Failed to submit moral:', response.error);
      }
      
      showGameMenu();
    });
  });
}

// Cast a vote
function castVote() {
  if (!gameId) {
    console.error('Not in a game');
    showGameMenu();
    return;
  }
  
  rl.question('Enter player ID to vote for: ', (votedForId) => {
    console.log(`Casting vote for player ${votedForId}...`);
    
    socket.emit(MessageType.CAST_VOTE, { gameId, votedForId }, (response: any) => {
      if (response.success) {
        console.log('Vote cast successfully!');
      } else {
        console.error('Failed to cast vote:', response.error);
      }
      
      showGameMenu();
    });
  });
}

// Start the next round
function nextRound() {
  if (!gameId) {
    console.error('Not in a game');
    showGameMenu();
    return;
  }
  
  console.log('Starting next round...');
  
  socket.emit(MessageType.NEXT_ROUND, { gameId }, (response: any) => {
    if (response.success) {
      console.log('Next round started successfully!');
    } else {
      console.error('Failed to start next round:', response.error);
    }
    
    showGameMenu();
  });
}

// Leave the game
function leaveGame() {
  if (!gameId) {
    console.error('Not in a game');
    showGameMenu();
    return;
  }
  
  console.log('Leaving game...');
  
  socket.emit(MessageType.LEAVE_GAME, { gameId }, (response: any) => {
    if (response.success) {
      console.log('Left game successfully!');
      playerId = null;
      gameId = null;
      
      showMainMenu();
    } else {
      console.error('Failed to leave game:', response.error);
      showGameMenu();
    }
  });
}

// Start the client
console.log('Twilight Tales Test Client');
console.log('=========================');
connect();

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nExiting...');
  if (socket) {
    socket.disconnect();
  }
  rl.close();
  process.exit(0);
});