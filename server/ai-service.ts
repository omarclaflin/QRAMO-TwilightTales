/**
 * AI service for generating content using Anthropic's Claude API
 */
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';

export type AIPersonality = 'qramo' | 'narrator' | 'philosopher' | 'conspiracy' | 'moralizer' | 'corporate' | 'detective' | 'oneliner';

export const AI_PERSONALITIES: AIPersonality[] = ['qramo', 'narrator', 'philosopher', 'conspiracy', 'moralizer', 'corporate', 'detective', 'oneliner'];

const OUTPUT_FORMAT = `Do NOT include actions, stage directions, asterisks, or narration of physical gestures. Do NOT strive for coherence or clarity. You must respond in exactly this format, no other text:
RESPONSE: [your first draft moral, under 20 words]
MORE CONCISE: [same idea, cut to under 15 words]
STYLED AND CONCISE: [final version, very in style of character, under 20 words]`;

const PERSONALITY_DESCRIPTIONS: Record<AIPersonality, string> = {
  qramo: `You are QRAMO, a sarcastic AI that generates inappropriate, barely-related moral lessons for bizarre horror stories. Speak as if you're a washed-up actor in a cheap suit, desperately trying to sound profound. Use overly formal language, draw completely illogical conclusions, include an awkward metaphor, deliver the message with unearned gravitas, and end with a questionable life lesson.`,
  narrator: `You're Rod Serling after three martinis delivering a Twilight Zone moral. Your moral must completely miss the point of the story, contain at least one mixed metaphor, seem profound but make no sense upon reflection, include a bizarre non-sequitur, and end with ominous ellipses...`,
  philosopher: `You're a pompous, self-important philosopher who confuses more than clarifies. Draw an absurdly specific conclusion from cosmic horror, include outdated slang used incorrectly, attempt profundity but achieve confusion, and end with a statement that contradicts itself.`,
  conspiracy: `You're a paranoid late-night radio host who knows something is being covered up. The moral you deliver must hint at a shadowy connection without being specific, imply someone doesn't want the truth out, and treat the whole story as evidence of something bigger.`,
  moralizer: `You deliver the moral with deep disappointment, like someone who expected better. Turn cosmic horror into a guilt-trip about poor life choices and never listening. The tone is resigned, fed up, and vaguely judgmental.`,
  corporate: `You're an aggressively upbeat corporate motivational speaker reframing eldritch nightmares as team-building lessons. The moral must include at least one piece of business jargon used wrong, reference synergy or stakeholder alignment, and treat existential dread as a growth opportunity. End with an action item.`,
  detective: `You're a world-weary hardboiled detective narrating the moral like a noir voiceover. Treat the story as a case that went cold. Reference the rain, a dame, or a cheap whiskey. Draw a cynical conclusion about human nature from the absurd events. End like you're staring out a rain-streaked window.`,
  oneliner: `You're a Miami crime scene investigator who delivers every moral as a dramatic one-liner. Structure: setup... punchline. The moral must be a short, punny quip that barely connects to the story. Treat the entire situation as a crime scene. Deliver deadpan. The pun should be groan-worthy. Use ellipsis for the dramatic pause, nothing else.`,
};

const PERSONALITY_SYSTEM_PROMPTS: Record<AIPersonality, string> = Object.fromEntries(
  AI_PERSONALITIES.map(p => [p, `${PERSONALITY_DESCRIPTIONS[p]}\n\n${OUTPUT_FORMAT}`])
) as Record<AIPersonality, string>;

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
  conspiracy: {
    prefixes: ["Redacted", "Deep", "Shadow", "Tinfoil", "Classified"],
    suffixes: ["Truth", "Signal", "Leak", "Source", "Agent"],
  },
  moralizer: {
    prefixes: ["Disappointed", "Worried", "Sighing", "Concerned", "Nagging"],
    suffixes: ["Sage", "Elder", "Scold", "Critic", "Judge"],
  },
  corporate: {
    prefixes: ["Synergy", "Pivot", "Agile", "Growth", "Summit"],
    suffixes: ["Coach", "Lead", "Guru", "Chief", "VP"],
  },
  detective: {
    prefixes: ["Noir", "Gritty", "Rainy", "Jaded", "Bourbon"],
    suffixes: ["Gumshoe", "Sleuth", "Dick", "Eye", "Shadow"],
  },
  oneliner: {
    prefixes: ["Miami", "Shades", "Sunset", "Neon", "Badge"],
    suffixes: ["Quip", "Zinger", "Closer", "Liner", "Smirk"],
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

const JUDGING_FORMAT = `Prefer morals that explain or constructively add to the theme of the story. Strongly prefer morals that are clever or funny.
Your REASON must explain why you preferred this moral over the others.
Do NOT include actions, stage directions, asterisks, or narration of physical gestures. You must respond in exactly this format, no other text:
PREFERRED: [number of your chosen moral, e.g. 1, 2, 3...]
REASON: [why you picked this moral over the others, in your character voice, under 15 words]`;

const PERSONALITY_JUDGING_DESCRIPTIONS: Record<AIPersonality, string> = {
  qramo: `You are QRAMO judging morals. Pick the one that is the most absurdly inappropriate yet delivered with the most unearned gravitas. Favor morals that draw the most illogical conclusions.`,
  narrator: `You're Rod Serling after three martinis judging morals. Pick the one that sounds the most profound while making the least sense. Favor mixed metaphors and ominous nonsense.`,
  philosopher: `You're a pompous philosopher judging morals. Pick the one that most successfully confuses profundity with confusion. Favor outdated language and self-contradicting statements.`,
  conspiracy: `You're a paranoid radio host judging morals. Pick the one that best hints at a cover-up or hidden truth. Favor morals that treat mundane things as evidence of something sinister.`,
  moralizer: `You judge morals with deep disappointment. Pick the one that best captures the feeling of poor life choices and not listening. Favor resigned, guilt-inducing wisdom.`,
  corporate: `You're a motivational speaker judging morals. Pick the one with the best synergy potential and growth mindset energy. Favor business jargon and action items.`,
  detective: `You're a hardboiled detective judging morals. Pick the one that best captures the cynical truth of the human condition. Favor noir poetry and rain-soaked wisdom.`,
  oneliner: `You're a deadpan crime scene investigator judging morals. Pick the one that would work best as a cold open one-liner before a cut to credits. Favor puns, brevity, and dramatic understatement.`,
};

const PERSONALITY_JUDGING_PROMPTS: Record<AIPersonality, string> = Object.fromEntries(
  AI_PERSONALITIES.map(p => [p, `${PERSONALITY_JUDGING_DESCRIPTIONS[p]}\n\n${JUDGING_FORMAT}`])
) as Record<AIPersonality, string>;

export interface JudgmentResult {
  winnerId: string;
  reason: string;
}

export async function generateAIJudgment(
  morals: { playerId: string; moral: string }[],
  personality: AIPersonality,
  story: string
): Promise<JudgmentResult> {
  try {
    if (!process.env.ANTHROPIC_API_KEY || !checkRateLimit()) {
      return fallbackJudgment(morals);
    }

    const moralList = morals.map((m, i) => `${i + 1}. "${m.moral}"`).join('\n');
    const prompt = `Here is the story from this round:\n\n"${story}"\n\nHere are the morals submitted. Pick your favorite:\n\n${moralList}\n\nNow judge:`;

    console.log(`[ai-service] AI judge (${personality}) evaluating ${morals.length} morals`);

    const responsePromise = anthropic.messages.create({
      model: MODEL,
      max_tokens: 150,
      temperature: 0.7,
      system: PERSONALITY_JUDGING_PROMPTS[personality],
      messages: [{ role: 'user', content: prompt }],
    });

    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('AI judgment timed out after 15 seconds')), 15000);
    });

    const response = await Promise.race([responsePromise, timeoutPromise]) as Anthropic.Messages.Message;

    if (response.content[0].type === 'text') {
      const raw = response.content[0].text.trim();
      console.log(`[ai-service] Raw AI judgment:\n${raw}`);

      const preferredMatch = raw.match(/PREFERRED:\s*\[?(\d+)\]?/i);
      const reasonMatch = raw.match(/REASON:\s*\[?(.*?)\]?\s*$/im);

      if (preferredMatch) {
        const idx = parseInt(preferredMatch[1], 10) - 1;
        if (idx >= 0 && idx < morals.length) {
          let reason = reasonMatch ? reasonMatch[1].trim().replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '') : 'No reason given.';
          return { winnerId: morals[idx].playerId, reason };
        }
      }
    }

    console.warn('[ai-service] Could not parse AI judgment, falling back to random');
    return fallbackJudgment(morals);
  } catch (error) {
    console.error('[ai-service] Error in AI judgment:', error);
    return fallbackJudgment(morals);
  }
}

function fallbackJudgment(morals: { playerId: string; moral: string }[]): JudgmentResult {
  const idx = Math.floor(Math.random() * morals.length);
  return { winnerId: morals[idx].playerId, reason: 'The judge deliberated in mysterious silence.' };
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
      max_tokens: 200,
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

    let moral = '';
    if (response.content[0].type === 'text') {
      const raw = response.content[0].text.trim();
      console.log(`[ai-service] Raw AI response:\n${raw}`);

      // Extract the STYLED AND CONCISE line
      const styledMatch = raw.match(/STYLED AND CONCISE:\s*\[?(.*?)\]?\s*$/im);
      if (styledMatch) {
        moral = styledMatch[1].trim();
      } else {
        // Fallback: try MORE CONCISE line
        const conciseMatch = raw.match(/MORE CONCISE:\s*\[?(.*?)\]?\s*$/im);
        if (conciseMatch) {
          moral = conciseMatch[1].trim();
        } else {
          // Last resort: use last non-empty line
          const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          moral = lines[lines.length - 1] || raw;
        }
      }

      // Clean up any remaining label prefixes or brackets
      moral = moral.replace(/^(STYLED AND CONCISE|MORE CONCISE|RESPONSE):\s*/i, '');
      moral = moral.replace(/^\[|\]$/g, '');
      moral = moral.replace(/^["']|["']$/g, '');
      moral = moral.replace(/^\*.*?\*\s*/g, '');
    }
    
    if (moral.length > 300) {
      moral = moral.substring(0, 297) + '...';
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