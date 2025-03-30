import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Basic types for the card game

export const cardTypes = {
  CHARACTER: 'character',
  LOCATION: 'location',
  INITIAL_TWIST: 'initialTwist',
  ESCALATION: 'escalation',
  FINAL_TWIST: 'finalTwist'
};

export const gameStatus = {
  LOBBY: 'lobby',
  ACTIVE: 'active',
  COMPLETED: 'completed'
};

export const roundStatus = {
  WAITING: 'waiting',
  DEALING: 'dealing',
  SELECTION: 'selection',
  STORYTELLING: 'storytelling',
  VOTING: 'voting',
  RESULTS: 'results',
  COMPLETED: 'completed'
};

// Game interfaces
export interface Card {
  id: number;
  text: string;
  type?: string;
  isCustom?: boolean;
  customPrompt?: string;
  deck?: string;
}

export interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  isAI?: boolean;
  isThinking?: boolean;
  score: number;
  currentCardType?: string;
  hand?: Card[];
  selectedCard?: number | null;
  submittedMoral?: string | null;
  hasVoted?: boolean; // Added to track if player has voted
}

export interface Submission {
  playerId: string;
  cardId: number;
  moral: string | null;
  votes: number;
  hasVoted: boolean; // Tracks whether the player has cast their vote
}

export interface Round {
  number: number;
  status: string;
  story: string;
  submissions: Submission[];
}

export interface Game {
  gameId: string;
  status: string;
  players: Player[];
  round: Round;
  settings: {
    maxPlayers: number;
    roundsToPlay: number;
  };
}

// User schema for database (if we need user accounts)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
