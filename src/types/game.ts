import { Card, PropertyCard, PropertyColor } from "./card";

export interface PropertySet {
  id: string;
  color: PropertyColor;
  properties: PropertyCard[];
  hasHouse: boolean;
  hasHotel: boolean;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  bank: Card[];
  propertySets: PropertySet[];
  pendingPlacements: PropertyCard[];
}

export interface GameConfig {
  enableDealBreaker: boolean;
  enableWildCard: boolean;
  winCondition: number; // number of completed sets needed to win (default 3)
}

// ─── Pending Actions ───────────────────────────────────────────────────────────
// When an action card is played that requires a response from another player,
// we push a PendingAction onto the game. The UI blocks normal play and shows
// the affected player(s) the response options.

export type PendingActionKind =
  | "payRent"           // target must pay rent amount to source
  | "payBirthday"       // every opponent must pay $2
  | "payDebtCollector"  // target must pay $5 to source
  | "slyDeal"           // source picks one property from target
  | "forcedDeal"        // source picks one of target's properties, gives one of theirs
  | "dealBreaker";      // source takes an entire completed set from target

export interface PendingPayment {
  kind: "payRent" | "payBirthday" | "payDebtCollector";
  fromPlayerId: string;   // who owes
  toPlayerId: string;     // who receives
  amountOwed: number;
  /** Cards the payer has selected so far to fulfil the debt */
  selectedCardIds: string[];
  /** Whether the payer has played a Just Say No */
  blocked: boolean;
}

export interface PendingSlyDeal {
  kind: "slyDeal";
  fromPlayerId: string;  // thief
  toPlayerId: string;    // victim
  /** Set + property the thief wants to take (chosen at play time) */
  targetSetId: string;
  targetCardId: string;
  blocked: boolean;
}

export interface PendingForcedDeal {
  kind: "forcedDeal";
  fromPlayerId: string;
  toPlayerId: string;
  /** Property the thief is offering */
  offeredSetId: string;
  offeredCardId: string;
  /** Property the thief wants */
  targetSetId: string;
  targetCardId: string;
  blocked: boolean;
}

export interface PendingDealBreaker {
  kind: "dealBreaker";
  fromPlayerId: string;
  toPlayerId: string;
  targetSetId: string;
  blocked: boolean;
}

export type PendingAction =
  | PendingPayment
  | PendingSlyDeal
  | PendingForcedDeal
  | PendingDealBreaker;

// ─── Game ──────────────────────────────────────────────────────────────────────

export type GamePhase =
  | "waitingToStart"
  | "drawPhase"        // current player needs to draw 2 cards
  | "actionPhase"      // current player plays cards (up to 3 actions)
  | "discardPhase"     // current player has >7 cards, must discard
  | "pendingAction"    // waiting for a player to respond to an action
  | "gameOver";

export interface Game {
  id: string;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  currentPlayerId: string;
  winnerId: string | null;
  config: GameConfig;
  actionsRemaining: number;
  phase: GamePhase;
  /** Stack of pending interactions. Resolved front-to-back. */
  pendingActions: PendingAction[];
  /** Log of game events for display */
  log: string[];
}
