# Multiplayer Card Game Architecture

## 1. System Components

### Backend
- **Game Server**: Express.js application handling HTTP requests
- **WebSocket Server**: Socket.io for real-time communication
- **Game State Manager**: In-memory storage of active games
- **AI Integration**: Claude API client for bot players

### Frontend
- **Lobby Interface**: Game creation, joining, and setup
- **Game Board**: Card display, selection, and submission
- **Storytelling View**: Combined story display
- **Voting Interface**: Moral submission and voting system

## 2. Data Flow

1. **Game Creation**:
   - Host creates game → Server generates unique room code
   - Players join with room code → Server adds them to game room
   - Host starts game → Server initializes game state

2. **Gameplay Loop**:
   - Server assigns card types to players (rotating each round)
   - Server deals 3 cards to each player from appropriate deck
   - Players select 1 card each → Server collects selections
   - If fewer than 5 players, AI bots automatically select cards
   - Server assembles story from all selected cards
   - Players submit morals → Server collects all morals
   - For AI players, server requests morals from Claude API
   - Players vote on morals → Server tallies votes
   - Server updates scores and starts new round

## 3. Data Structures

### Game State
```javascript
{
  gameId: "unique-id",
  status: "lobby|active|completed",
  players: [
    {
      id: "player-id",
      name: "Player Name",
      isAI: false,
      score: 0,
      currentCardType: "red|blue|green|yellow|purple",
      hand: ["card-id-1", "card-id-2", "card-id-3"],
      selectedCard: "card-id" | null,
      submittedMoral: "text" | null
    }
  ],
  round: {
    number: 1,
    status: "dealing|selection|storytelling|morals|voting|results",
    story: "Combined story text",
    submissions: [
      {
        playerId: "player-id",
        cardId: "card-id",
        moral: "Player's moral",
        votes: 0
      }
    ]
  },
  cardDecks: {
    red: ["card-id-1", "card-id-2", ...],
    blue: ["card-id-1", "card-id-2", ...],
    green: ["card-id-1", "card-id-2", ...],
    yellow: ["card-id-1", "card-id-2", ...],
    purple: ["card-id-1", "card-id-2", ...]
  }
}
```

### Card Structure
```javascript
{
  id: "unique-id",
  type: "red|blue|green|yellow|purple",
  text: "Card content text",
  storyRole: "character|setting|conflict|resolution|twist"
}
```

## 4. API Endpoints

### HTTP Endpoints
- `POST /games`: Create new game
- `GET /games/:id`: Get game state
- `POST /games/:id/join`: Join existing game

### Socket.io Events
- `connection`: New client connected
- `disconnect`: Client disconnected
- `join-game`: Player joins game room
- `start-game`: Host starts the game
- `select-card`: Player selects a card
- `submit-moral`: Player submits moral
- `cast-vote`: Player votes for a moral
- `next-round`: Start next round
- `end-game`: End the game session

## 5. AI Integration

### Claude API Usage
- API key stored securely in environment variables
- Prompt template for generating morals based on story elements
- Fallback mechanism for API failures
- Rate limiting and error handling
