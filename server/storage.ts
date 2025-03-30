import { users, type User, type InsertUser, type Game, type Player } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getGame(gameId: string): Promise<Game | undefined>;
  getAllGames(): Promise<Game[]>;
  createGame(game: Game): Promise<Game>;
  updateGame(game: Game): Promise<Game>;
  removeGame(gameId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private games: Map<string, Game>;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.games = new Map();
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getGame(gameId: string): Promise<Game | undefined> {
    return this.games.get(gameId);
  }

  async getAllGames(): Promise<Game[]> {
    return Array.from(this.games.values());
  }

  async createGame(game: Game): Promise<Game> {
    this.games.set(game.gameId, game);
    return game;
  }

  async updateGame(game: Game): Promise<Game> {
    this.games.set(game.gameId, game);
    return game;
  }

  async removeGame(gameId: string): Promise<boolean> {
    return this.games.delete(gameId);
  }
}

export const storage = new MemStorage();
