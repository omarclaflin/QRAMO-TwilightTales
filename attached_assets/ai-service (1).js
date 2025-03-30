// ai-service.js
const { Anthropic } = require('@anthropic-ai/sdk');
const rateLimit = require('express-rate-limit');

// Initialize Anthropic client with API key from environment variables
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Implement rate limiting to avoid exceeding API quotas
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Generate a moral for an AI player based on the story
 * @param {String} story - The assembled story from selected cards
 * @returns {Promise<String>} - The generated moral
 */
async function generateAIMoral(story) {
  try {
    // Call Claude API to generate a moral
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 150,
      temperature: 0.7,
      system: "You are playing a storytelling card game. Your task is to create a witty, mock-serious moral based on the absurd story elements provided. Keep your moral concise (under 100 characters), funny, and in the style of classic fables or children's stories. Do not explain or elaborate - just provide the moral statement.",
      messages: [
        {
          role: "user",
          content: `Here is an absurd story created from random cards in our game: "${story}"\n\nPlease create a witty, mock-serious moral for this story. Start with "The moral of the story is:" and keep it under 100 characters.`
        }
      ]
    });

    // Extract the moral from the response
    const moral = response.content[0].text.trim();
    
    // Ensure the moral starts with the expected phrase
    if (!moral.startsWith("The moral of the story is:")) {
      return `The moral of the story is: ${moral.substring(0, 80)}`;
    }
    
    return moral;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw new Error('Failed to generate AI moral');
  }
}

/**
 * Simulate an AI player's vote on morals
 * @param {Array} submissions - Array of moral submissions
 * @param {String} aiPlayerId - ID of the AI player
 * @returns {String} - ID of the player being voted for
 */
function simulateAIVote(submissions, aiPlayerId) {
  // Filter out the AI's own submission
  const votableSubmissions = submissions.filter(s => s.playerId !== aiPlayerId);
  
  if (votableSubmissions.length === 0) return null;
  
  // Simple random selection for voting
  const randomIndex = Math.floor(Math.random() * votableSubmissions.length);
  return votableSubmissions[randomIndex].playerId;
}

/**
 * Check if the Anthropic API is accessible
 * @returns {Promise<Boolean>} - True if API is accessible
 */
async function checkAPIConnection() {
  try {
    // Simple API call to check connection
    await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
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
    console.error('API connection check failed:', error);
    return false;
  }
}

module.exports = {
  generateAIMoral,
  simulateAIVote,
  checkAPIConnection,
  apiLimiter
};
