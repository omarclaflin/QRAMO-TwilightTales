/**
 * AI service for generating content using Anthropic's Claude API
 */
import Anthropic from '@anthropic-ai/sdk';
import { Submission } from '@shared/schema';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';

export type AIPersonality = 'qramo' | 'narrator' | 'philosopher';

export const AI_PERSONALITIES: AIPersonality[] = ['qramo', 'narrator', 'philosopher'];

const PERSONALITY_SYSTEM_PROMPTS: Record<AIPersonality, string> = {
  qramo: `You are QRAMO, a sarcastic AI that generates inappropriate, barely-related moral lessons for bizarre horror stories. Speak as if you're a washed-up actor in a cheap suit, desperately trying to sound profound. Use overly formal language, draw completely illogical conclusions, include an awkward metaphor, deliver the message with unearned gravitas, and end with a questionable life lesson. STRICT OUTPUT INSTRUCTIONS: ONLY return the final moral line. Do NOT include any additional text, explanation, or artifacts. Keep it under 20 words. Maximum impact, minimal words. Do NOT strive for coherence or clarity.`,
  narrator: `You're Rod Serling after three martinis delivering a Twilight Zone moral. Your moral must completely miss the point of the story, contain at least one mixed metaphor, seem profound but make no sense upon reflection, include a bizarre non-sequitur, and end with ominous ellipses... STRICT OUTPUT INSTRUCTIONS: ONLY return the final moral line. Do NOT include any additional text, explanation, or artifacts. Keep it under 30 words. Do NOT strive for coherence or clarity.`,
  philosopher: `You're a pompous, self-important philosopher who confuses more than clarifies. Start with "Perhaps the real lesson is..." then draw an absurdly specific conclusion from cosmic horror, include outdated slang used incorrectly, attempt profundity but achieve confusion, and end with a statement that contradicts the beginning. STRICT OUTPUT INSTRUCTIONS: ONLY return the final moral line. Do NOT include any additional text, explanation, or artifacts. Keep it under 30 words.`,
};

const PERSONALITY_NAMES: Record<AIPersonality, { prefixes: string[]; suffixes: string[] }> = {
  qramo: {
    prefixes: ["Dramatic", "Washed", "Hammy", "Thespian", "Stage"],
    suffixes: ["Actor", "Serling", "Voice", "Host", "Narrator"],
  },
  narrator: {
    prefixes: ["Twilight", "Shadow", "Midnight", "Phantom", "Eerie"],
    suffixes: ["Zone", "Rod", "Smoke", "Reel", "Dusk"],
  },
  philosopher: {
    prefixes: ["Pompous", "Grand", "Verbose", "Lofty", "Noble"],
    suffixes: ["Sage", "Oracle", "Thinker", "Muse", "Scribe"],
  },
};

export function getRandomPersonality(): AIPersonality {
  return AI_PERSONALITIES[Math.floor(Math.random() * AI_PERSONALITIES.length)];
}

export function generateAIPlayerNameForPersonality(personality: AIPersonality): string {
  const { prefixes, suffixes } = PERSONALITY_NAMES[personality];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${prefix}${suffix}`;
}

// Track API calls to avoid rate limits
const apiCallTracker = {
  calls: 0,
  resetTime: Date.now() + 60000, // Reset after 1 minute
  maxCalls: 20, // Max calls per minute
};

/**
 * Check if we've exceeded our API rate limit
 * @returns {boolean} True if we're within rate limits, false if exceeded
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  
  // Reset counter if we're past the reset time
  if (now > apiCallTracker.resetTime) {
    apiCallTracker.calls = 0;
    apiCallTracker.resetTime = now + 60000;
    return true;
  }
  
  // Check if we're at the limit
  if (apiCallTracker.calls >= apiCallTracker.maxCalls) {
    return false;
  }
  
  // Increment counter and allow the call
  apiCallTracker.calls++;
  return true;
}

/**
 * Generate a moral for a given story using Claude API
 * @param {string} story - The complete story
 * @returns {Promise<string>} - A moral for the story
 */
export async function generateAIMoral(story: string, personality: AIPersonality = 'qramo'): Promise<string> {
  try {
    if (!process.env.ANTHROPIC_API_KEY || !checkRateLimit()) {
      console.warn(
        !process.env.ANTHROPIC_API_KEY 
          ? 'ANTHROPIC_API_KEY not set. Using fallback response.' 
          : 'API rate limit exceeded. Using fallback response.'
      );
      return generateFallbackMoral(story);
    }
    
    console.log(`[ai-service] Generating moral with personality "${personality}" for story:`, story.substring(0, 50) + '...');

    const prompt = `Here is the story from a horror/Twilight Zone storytelling card game:\n\n${story}\n\nNow deliver your moral:`;

    const responsePromise = anthropic.messages.create({
      model: MODEL,
      max_tokens: 100,
      temperature: 0.8,
      system: PERSONALITY_SYSTEM_PROMPTS[personality],
      messages: [
        { role: 'user', content: prompt }
      ],
    });
    
    // Add a timeout to the API call (10 seconds to give Claude enough time)
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('API call timed out after 10 seconds')), 10000);
    });
    
    // Race the API call against the timeout
    const response = await Promise.race([responsePromise, timeoutPromise]) as Anthropic.Messages.Message;

    // Extract and clean the generated moral
    let moral = '';
    if (response.content[0].type === 'text') {
      moral = response.content[0].text.trim();
      
      // Remove prefixes like "The moral of this story is:" if present
      moral = moral.replace(/^(The moral of this story is:?\s*)/i, '');
    }
    
    // Ensure moral isn't too long
    if (moral.length > 150) {
      moral = moral.substring(0, 147) + '...';
    }
    
    return moral;
  } catch (error) {
    console.error('[ai-service] Error generating AI moral:', error);
    // Check if it's a standard error object with message property
    if (error instanceof Error) {
      console.error('[ai-service] Error details:', error.message);
    }
    console.log('[ai-service] Falling back to pre-generated moral');
    return generateFallbackMoral(story);
  }
}

/**
 * Generate a sensible fallback moral when the API cannot be used
 * @param {string} story - The story to generate a moral for
 * @returns {string} A simple moral
 */
function generateFallbackMoral(story: string): string {
  const fallbackMorals = [
    "In life's twisted game, the cards we're dealt matter less than how we choose to play them.",
    "Sometimes the most frightening monsters are the ones we create in our own minds.",
    "Be careful what you wish for—the universe has a peculiar sense of humor.",
    "Reality is merely a thin veil, easily torn by those who look too closely.",
    "In trying to control fate, we often become puppets of our own design.",
    "The greatest deception is the one we perpetrate upon ourselves.",
    "The boundaries between imagination and reality are but shadows on the wall.",
    "Destiny follows no script but the one written by our choices.",
    "The key to wisdom is knowing that some doors are better left unopened.",
    "In the twilight between logic and fear lies the truth we dare not face."
  ];
  
  // Use a simple algorithm to select a fallback moral based on the story content
  const storyLength = story.length;
  const selectedIndex = storyLength % fallbackMorals.length;
  
  return fallbackMorals[selectedIndex];
}

/**
 * Generate AI player names with themes from classic sci-fi
 * @returns {string} A randomly generated AI player name
 */
export function generateAIPlayerName(): string {
  const prefixes = ["Neural", "Quantum", "Binary", "Cyber", "Digital", "Logic", "Pixel", "Techno", "Vector", "Data"];
  const suffixes = ["Mind", "Bot", "Tron", "Byte", "Unit", "Core", "Brain", "Synth", "Nexus", "Pulse"];
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  return `${prefix}${suffix}`;
}

/**
 * Simulate an AI player's vote on morals
 * @param {Array<Submission>} submissions - Array of moral submissions
 * @param {string} aiPlayerId - ID of the AI player
 * @param {Array<Player>} players - Array of all players in the game
 * @returns {string | null} - ID of the player being voted for
 */
export function simulateAIVote(
  submissions: Submission[], 
  aiPlayerId: string,
  players: any[] // Using any[] to avoid circular dependency with Player interface
): string | null {
  // Filter out the AI's own submission
  const votableSubmissions = submissions.filter(s => s.playerId !== aiPlayerId);
  
  if (votableSubmissions.length === 0) return null;
  
  // Weighted random selection for voting with enhanced human preference:
  // - Human players' morals get double weight compared to AI players
  // - Longer morals slightly more likely to get votes (simulating effort)
  // - Players without votes more likely to receive votes (to balance scoring)
  
  // Calculate weights based on player type, moral length and existing votes
  const weights = votableSubmissions.map(sub => {
    // Find if this submission belongs to a human or AI player
    const player = players.find(p => p.id === sub.playerId);
    const isHuman = player && !player.isAI;
    
    // Human players get 2x weight bonus
    const humanFactor = isHuman ? 2.0 : 1.0;
    
    // Other weight factors
    const lengthFactor = sub.moral ? Math.min(1.5, sub.moral.length / 50) : 0.5;
    const voteFactor = sub.votes === 0 ? 1.5 : (1 / (sub.votes + 1));
    
    // Calculate final weight with human preference
    return humanFactor * lengthFactor * voteFactor;
  });
  
  // Calculate total weight
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  // Generate random value
  let random = Math.random() * totalWeight;
  
  // Find the selected submission
  for (let i = 0; i < votableSubmissions.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      // Get the player ID we're voting for
      const votedForId = votableSubmissions[i].playerId;
      
      // Log vote decision with weight information
      const player = players.find(p => p.id === votedForId);
      const isHuman = player && !player.isAI;
      console.log(`AI ${aiPlayerId} voting decision: selected ${votedForId} (${isHuman ? 'Human' : 'AI'}) with weight ${weights[i]}`);
      
      return votedForId;
    }
  }
  
  // Fallback to random selection if something went wrong
  const randomIndex = Math.floor(Math.random() * votableSubmissions.length);
  return votableSubmissions[randomIndex].playerId;
}

/**
 * Analyze a story to determine appropriate character or theme
 * Used to help AI players make more contextually relevant choices
 * @param {string} text - Text to analyze
 * @returns {Promise<string>} - Key themes or characters
 */
export async function analyzeStoryTheme(text: string): Promise<string> {
  try {
    if (!process.env.ANTHROPIC_API_KEY || !checkRateLimit()) {
      return "Unknown";
    }
    
    const prompt = `
Analyze this story fragment and extract the 1-2 key themes, moods, or settings that define it.
Be very concise and focus only on the dominant elements. Text to analyze:

${text}

Key themes:`;

    // Set a timeout for the API call
    const responsePromise = anthropic.messages.create({
      model: MODEL,
      max_tokens: 30,
      temperature: 0.5,
      messages: [
        { role: 'user', content: prompt }
      ],
    });
    
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('API call timed out after 10 seconds')), 10000);
    });
    
    const response = await Promise.race([responsePromise, timeoutPromise]) as Anthropic.Messages.Message;

    if (response.content[0].type === 'text') {
      return response.content[0].text.trim();
    }
    return "Unknown";
  } catch (error) {
    console.error('[ai-service] Error analyzing story theme:', error);
    if (error instanceof Error) {
      console.error('[ai-service] Error details:', error.message);
    }
    return "Unknown";
  }
}

/**
 * Check if the Anthropic API is accessible
 * @returns {Promise<boolean>} - True if API is accessible
 */
export async function checkAPIConnection(): Promise<boolean> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return false;
    }
    
    // Simple API call to check connection
    await anthropic.messages.create({
      model: MODEL,
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: "Just checking the API connection. Please respond with 'OK'."
        }
      ]
    });
    return true;
  } catch (error) {
    console.error('[ai-service] API connection check failed:', error);
    if (error instanceof Error) {
      console.error('[ai-service] Error details:', error.message);
    }
    return false;
  }
}