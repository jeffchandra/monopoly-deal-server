import { Game, Player, PendingPayment } from "../types/game";
import { Card, RentCard, PropertyCard, PropertyColor } from "../types/card";
import { createDeck, shuffleDeck } from "./deck";
import { isSetComplete, getCompletedSetCount, getRentForSet, getRentableSetsByCard, getIncompleteSetForColor } from "./propertyUtils";
import { getTotalAssets } from "./bankUtils";
import { PROPERTY_RULES } from "../data/propertyRules";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    hand: [],
    bank: [],
    propertySets: [],
    pendingPlacements: [],
  };
}

export function createGame(players: Player[]): Game {
  return {
    id: generateId(),
    players,
    deck: [],
    discardPile: [],
    currentPlayerId: players[0].id,
    winnerId: null,
    config: {
      enableDealBreaker: false,
      enableWildCard: false,
      winCondition: 3,
    },
    actionsRemaining: 3,
    phase: "waitingToStart",
    pendingActions: [],
    log: [],
  };
}


export function addLog(game: Game, message: string): void {
  game.log = [message, ...game.log].slice(0, 50);
}

export function getPlayerById(game: Game, playerId: string): Player {
  const player = game.players.find(p => p.id === playerId);
  if (!player) throw new Error(`Player ${playerId} not found`);
  return player;
}

export function getCurrentPlayer(game: Game): Player {
  return getPlayerById(game, game.currentPlayerId);
}

export function getOpponents(game: Game, playerId: string): Player[] {
  return game.players.filter(p => p.id !== playerId);
}

export function drawCard(game: Game, playerId: string): void {
  if (game.deck.length === 0) {
    if (game.discardPile.length === 0) return;
    game.deck = shuffleDeck([...game.discardPile]);
    game.discardPile = [];
    addLog(game, "Deck reshuffled from discard pile.");
  }

  const card = game.deck.pop();
  if (!card) return;

  const player = getPlayerById(game, playerId);
  player.hand.push(card);
}

export function dealOpeningHands(game: Game): void {
  for (let i = 0; i < 5; i++) {
    for (const player of game.players) {
      drawCard(game, player.id);
    }
  }
}

export function startGame(game: Game): void {
  game.deck = shuffleDeck(createDeck());
  dealOpeningHands(game);
  game.phase = "drawPhase";
  addLog(game, "Game started! Each player was dealt 5 cards.");
}

export function startTurn(game: Game): void {
  if (game.phase !== "drawPhase") throw new Error("Not in draw phase");
  
  const player = getCurrentPlayer(game);
  drawCard(game, player.id);
  drawCard(game, player.id);
  game.actionsRemaining = 3;
  game.phase = "actionPhase";
  addLog(game, `${player.name} drew 2 cards.`);
}

export function checkWinCondition(game: Game): boolean {
  const current = getCurrentPlayer(game);
  const completedSets = getCompletedSetCount(current);
  if (completedSets >= game.config.winCondition) {
    game.winnerId = current.id;
    game.phase = "gameOver";
    addLog(game, `🏆 ${current.name} wins!`);
    return true;
  }
  return false;
}

export function endTurn(game: Game): void {
  if (game.phase === "pendingAction") {
    throw new Error("Cannot end turn — waiting for action response");
  }
  if (game.phase !== "actionPhase" && game.phase !== "discardPhase") {
    throw new Error("Not in action phase");
  }

  const player = getCurrentPlayer(game);

  if (player.pendingPlacements.length > 0) {
    throw new Error("You must place all received properties first");
  }

  if (player.hand.length > 7) {
    throw new Error("You must discard down to 7 cards first");
  }

  advanceToNextPlayer(game);
}

function advanceToNextPlayer(game: Game): void {
  const idx = game.players.findIndex(p => p.id === game.currentPlayerId);
  const next = game.players[(idx + 1) % game.players.length];
  game.currentPlayerId = next.id;
  game.phase = "drawPhase";
  addLog(game, `It's ${next.name}'s turn.`);
}

export function discard(game: Game, playerId: string, cardId: string): void {
  if (game.currentPlayerId !== playerId) throw new Error("Not your turn");

  const player = getPlayerById(game, playerId);
  const idx = player.hand.findIndex(c => c.id === cardId);
  if (idx === -1) throw new Error("Card not found in hand");

  game.discardPile.push(player.hand.splice(idx, 1)[0]);
  addLog(game, `${player.name} discarded a card.`);
}

export function placePropertyAsNewSet(
  game: Game,
  playerId: string,
  cardId: string,
  colorOverride?: PropertyColor
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const card = player.hand.splice(cardIdx, 1)[0] as PropertyCard;

  // For wild cards — use color override if provided
  if (colorOverride) {
    if (!card.colors.includes(colorOverride)) {
      throw new Error("Invalid color for this wild card");
    }
    card.activeColor = colorOverride;
  }

  player.propertySets.push({
    id: generateId(),
    color: (card as PropertyCard).activeColor,
    properties: [card as PropertyCard],
    hasHouse: false,
    hasHotel: false,
  });

  game.actionsRemaining--;
  addLog(game, `${player.name} started a new set with ${card.name}.`);
  checkWinCondition(game);
}

export function placePropertyIntoSet(
  game: Game,
  playerId: string,
  cardId: string,
  setId: string
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const set = player.propertySets.find(s => s.id === setId);
  if (!set) throw new Error("Set not found");
  if (isSetComplete(set)) throw new Error("That set is already complete");

  const card = player.hand.splice(cardIdx, 1)[0] as PropertyCard;

  // For wild cards — auto-flip to match set color
  if (card.colors.length > 1) {
    if (!card.colors.includes(set.color)) {
      throw new Error("This wild card cannot be this color");
    }
    card.activeColor = set.color;
  } else {
    if (card.activeColor !== set.color) throw new Error("Card color does not match set");
  }

  set.properties.push(card);
  game.actionsRemaining--;
  addLog(game, `${player.name} added ${card.name} to their ${set.color} set.`);
  checkWinCondition(game);
}

export function playCardToBank(
  game: Game,
  playerId: string,
  cardId: string
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const card = player.hand.splice(cardIdx, 1)[0];

  if (card.type === "property") throw new Error("Properties cannot be banked — place them on the board");

  player.bank.push(card);
  game.actionsRemaining--;
  addLog(game, `${player.name} banked ${card.name} for $${card.value}M.`);
}

export function confirmPayment(
  game: Game,
  playerId: string,
  cardIds: string[]
): void {
  if (game.phase !== "pendingAction") throw new Error("No pending action");

  const pending = game.pendingActions[0];
  if (!pending) throw new Error("No pending action");
  if (
    pending.kind !== "payRent" &&
    pending.kind !== "payBirthday" &&
    pending.kind !== "payDebtCollector"
  ) throw new Error("Pending action is not a payment");
  if (pending.fromPlayerId !== playerId) throw new Error("Not your payment to make");

  const payer = getPlayerById(game, playerId);
  const receiver = getPlayerById(game, pending.toPlayerId);

  const totalAssets = getTotalAssets(payer);
  const amountOwed = pending.amountOwed;

  // Calculate value of selected cards
  let selectedValue = 0;
  for (const id of cardIds) {
    const bankCard = payer.bank.find(c => c.id === id);
    if (bankCard) {
      selectedValue += bankCard.value;
      continue;
    }
    for (const set of payer.propertySets) {
      if (isSetComplete(set)) continue;
      const prop = set.properties.find(c => c.id === id);
      if (prop) {
        selectedValue += prop.value;
        break;
      }
    }
  }

  // Must pay full amount, or everything they have if they can't afford it
  if (selectedValue < amountOwed && selectedValue < totalAssets) {
    throw new Error(`Must pay $${amountOwed}M or everything you have`);
  }

  for (const id of cardIds) {
    // Try bank first
    const bankIdx = payer.bank.findIndex(c => c.id === id);
    if (bankIdx !== -1) {
      receiver.bank.push(payer.bank.splice(bankIdx, 1)[0]);
      continue;
    }

    // Try incomplete property sets
    for (const set of payer.propertySets) {
      if (isSetComplete(set)) continue;
      const propIdx = set.properties.findIndex(c => c.id === id);
      if (propIdx !== -1) {
        const card = set.properties.splice(propIdx, 1)[0] as PropertyCard;
        // Clean up empty set
        if (set.properties.length === 0) {
          payer.propertySets = payer.propertySets.filter(s => s.id !== set.id);
        }
        receiver.propertySets.push({
          id: generateId(),
          color: card.activeColor,
          properties: [card],
          hasHouse: false,
          hasHotel: false,
        });
        break;
      }
    }
  }

  addLog(game, `${payer.name} paid $${selectedValue}M to ${receiver.name}.`);

  game.pendingActions.shift();
  if (game.pendingActions.length === 0) {
    game.phase = "actionPhase";
  }
}

export function getPayableSources(
  game: Game,
  playerId: string
): { bankCards: import("../types/card").Card[], incompleteSetCards: { setId: string, card: import("../types/card").PropertyCard }[] } {
  const player = getPlayerById(game, playerId);

  const bankCards = [...player.bank];

  const incompleteSetCards: { setId: string, card: import("../types/card").PropertyCard }[] = [];
  for (const set of player.propertySets) {
    if (isSetComplete(set)) continue;
    for (const card of set.properties) {
      incompleteSetCards.push({ setId: set.id, card });
    }
  }

  return { bankCards, incompleteSetCards };
}

export function playRentCard(
  game: Game,
  playerId: string,
  cardId: string,
  setId: string,
  doubleRentCardId?: string,
  targetPlayerId?: string  // if provided, only charge this player (Wild Rent)
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const card = player.hand[cardIdx];
  if (card.type !== "rent") throw new Error("Card is not a rent card");

  const rentCard = card as RentCard;
  const set = player.propertySets.find(s => s.id === setId);
  if (!set) throw new Error("Set not found");

  if (!rentCard.rentableColors.includes(set.color)) {
    throw new Error("This rent card does not cover that color");
  }

  const rentableSets = getRentableSetsByCard(player, rentCard);
  if (rentableSets.length === 0) {
    throw new Error("You have no matching properties to charge rent for");
  }

  // Handle double rent
  let multiplier = 1;
  if (doubleRentCardId) {
    const doubleIdx = player.hand.findIndex(c => c.id === doubleRentCardId);
    if (doubleIdx === -1) throw new Error("Double Rent card not found in hand");
    const doubleCard = player.hand.splice(doubleIdx, 1)[0];
    game.discardPile.push(doubleCard);
    multiplier = 2;
  }

  const amount = getRentForSet(set) * multiplier;
  const opponents = targetPlayerId
    ? [getPlayerById(game, targetPlayerId)]
    : getOpponents(game, playerId);

  player.hand.splice(cardIdx, 1);
  game.discardPile.push(rentCard);
  game.actionsRemaining--;

  for (const opponent of opponents) {
    game.pendingActions.push({
      kind: "payRent",
      fromPlayerId: opponent.id,
      toPlayerId: playerId,
      amountOwed: amount,
      selectedCardIds: [],
      blocked: false,
    });
  }

  game.phase = "pendingAction";
  addLog(
    game,
    `${player.name} charged ${targetPlayerId
      ? getPlayerById(game, targetPlayerId).name
      : "everyone"
    } $${amount}M rent on ${PROPERTY_RULES[set.color].displayName}${multiplier === 2 ? " (doubled!)" : ""}.`
  );
}

export function placePendingProperty(
  game: Game,
  playerId: string,
  cardId: string,
  targetSetId: string | null
): void {
  const player = getPlayerById(game, playerId);
  const cardIdx = player.pendingPlacements.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not in pending placements");

  const card = player.pendingPlacements.splice(cardIdx, 1)[0];

  if (targetSetId === null) {
    // New set
    player.propertySets.push({
      id: generateId(),
      color: card.activeColor,
      properties: [card],
      hasHouse: false,
      hasHotel: false,
    });
  } else {
    // Existing set
    const set = player.propertySets.find(s => s.id === targetSetId);
    if (!set) throw new Error("Set not found");
    if (isSetComplete(set)) throw new Error("Set is already complete");

    // Auto-flip wild cards
    if (card.colors.length > 1) {
      if (!card.colors.includes(set.color)) {
        throw new Error("This wild card cannot be this color");
      }
      card.activeColor = set.color;
    } else {
      if (set.color !== card.activeColor) throw new Error("Color mismatch");
    }

    set.properties.push(card);
  }

  addLog(game, `${player.name} placed ${card.name}.`);
  checkWinCondition(game);
}

export function playPassGo(
  game: Game,
  playerId: string,
  cardId: string
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const card = player.hand.splice(cardIdx, 1)[0];
  game.discardPile.push(card);
  game.actionsRemaining--;

  drawCard(game, playerId);
  drawCard(game, playerId);

  addLog(game, `${player.name} played Pass Go — drew 2 cards.`);
}

export function playItsMyBirthday(
  game: Game,
  playerId: string,
  cardId: string
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const card = player.hand.splice(cardIdx, 1)[0];
  game.discardPile.push(card);
  game.actionsRemaining--;

  const opponents = getOpponents(game, playerId);
  for (const opponent of opponents) {
    game.pendingActions.push({
      kind: "payBirthday",
      fromPlayerId: opponent.id,
      toPlayerId: playerId,
      amountOwed: 2,
      selectedCardIds: [],
      blocked: false,
    });
  }

  game.phase = "pendingAction";
  addLog(game, `🎂 ${player.name} played It's My Birthday! Everyone pays $2M.`);
}

export function playDebtCollector(
  game: Game,
  playerId: string,
  cardId: string,
  targetPlayerId: string
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const target = getPlayerById(game, targetPlayerId);

  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const card = player.hand.splice(cardIdx, 1)[0];
  game.discardPile.push(card);
  game.actionsRemaining--;

  game.pendingActions.push({
    kind: "payDebtCollector",
    fromPlayerId: target.id,
    toPlayerId: playerId,
    amountOwed: 5,
    selectedCardIds: [],
    blocked: false,
  });

  game.phase = "pendingAction";
  addLog(game, `${player.name} hit ${target.name} with Debt Collector — pay $5M.`);
}

export function playSlyDeal(
  game: Game,
  playerId: string,
  cardId: string,
  targetPlayerId: string,
  targetSetId: string,
  targetCardId: string
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const target = getPlayerById(game, targetPlayerId);

  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const targetSet = target.propertySets.find(s => s.id === targetSetId);
  if (!targetSet) throw new Error("Target set not found");
  if (isSetComplete(targetSet)) throw new Error("Cannot steal from a complete set");

  const stolenCardIdx = targetSet.properties.findIndex(c => c.id === targetCardId);
  if (stolenCardIdx === -1) throw new Error("Target card not found in set");

  // Remove card from hand and discard
  const card = player.hand.splice(cardIdx, 1)[0];
  game.discardPile.push(card);
  game.actionsRemaining--;

  // Remove stolen card from target's set
  const stolenCard = targetSet.properties.splice(stolenCardIdx, 1)[0];
  if (targetSet.properties.length === 0) {
    target.propertySets = target.propertySets.filter(s => s.id !== targetSetId);
  }

  player.propertySets.push({
    id: generateId(),
    color: stolenCard.activeColor,
    properties: [stolenCard],
    hasHouse: false,
    hasHotel: false,
  });

  addLog(game, `${player.name} sly dealt ${stolenCard.name} from ${target.name}.`);
  checkWinCondition(game);
}

export function playForcedDeal(
  game: Game,
  playerId: string,
  cardId: string,
  targetPlayerId: string,
  targetSetId: string,
  targetCardId: string,
  offeredSetId: string,
  offeredCardId: string
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const target = getPlayerById(game, targetPlayerId);

  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  // Validate target set
  const targetSet = target.propertySets.find(s => s.id === targetSetId);
  if (!targetSet) throw new Error("Target set not found");
  if (isSetComplete(targetSet)) throw new Error("Cannot steal from a complete set");

  const targetCardIdx = targetSet.properties.findIndex(c => c.id === targetCardId);
  if (targetCardIdx === -1) throw new Error("Target card not found in set");

  // Validate offered set
  const offeredSet = player.propertySets.find(s => s.id === offeredSetId);
  if (!offeredSet) throw new Error("Offered set not found");
  if (isSetComplete(offeredSet)) throw new Error("Cannot give away a card from a complete set");

  const offeredCardIdx = offeredSet.properties.findIndex(c => c.id === offeredCardId);
  if (offeredCardIdx === -1) throw new Error("Offered card not found in set");

  // Remove card from hand and discard
  const card = player.hand.splice(cardIdx, 1)[0];
  game.discardPile.push(card);
  game.actionsRemaining--;

  // Swap the cards
  const takenCard = targetSet.properties.splice(targetCardIdx, 1)[0];
  if (targetSet.properties.length === 0) {
    target.propertySets = target.propertySets.filter(s => s.id !== targetSetId);
  }

  const givenCard = offeredSet.properties.splice(offeredCardIdx, 1)[0];
  if (offeredSet.properties.length === 0) {
    player.propertySets = player.propertySets.filter(s => s.id !== offeredSetId);
  }

  player.propertySets.push({
    id: generateId(),
    color: takenCard.activeColor,
    properties: [takenCard],
    hasHouse: false,
    hasHotel: false,
  });
  target.propertySets.push({
    id: generateId(),
    color: givenCard.activeColor,
    properties: [givenCard],
    hasHouse: false,
    hasHotel: false,
  });

  addLog(game, `${player.name} forced a deal — swapped ${givenCard.name} for ${takenCard.name} from ${target.name}.`);
  checkWinCondition(game);
}

export function playHouse(
  game: Game,
  playerId: string,
  cardId: string,
  setId: string
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const set = player.propertySets.find(s => s.id === setId);
  if (!set) throw new Error("Set not found");
  if (!isSetComplete(set)) throw new Error("Can only add a house to a complete set");
  if (set.color === "railroad" || set.color === "utility") {
    throw new Error("Cannot add houses to railroads or utilities");
  }
  if (set.hasHouse) throw new Error("Set already has a house");

  const card = player.hand.splice(cardIdx, 1)[0];
  game.discardPile.push(card);
  set.hasHouse = true;
  game.actionsRemaining--;

  addLog(game, `${player.name} added a house to their ${PROPERTY_RULES[set.color].displayName} set. Rent is now $${getRentForSet(set)}M.`);
}

export function playHotel(
  game: Game,
  playerId: string,
  cardId: string,
  setId: string
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const set = player.propertySets.find(s => s.id === setId);
  if (!set) throw new Error("Set not found");
  if (!isSetComplete(set)) throw new Error("Can only add a hotel to a complete set");
  if (set.color === "railroad" || set.color === "utility") {
    throw new Error("Cannot add hotels to railroads or utilities");
  }
  if (!set.hasHouse) throw new Error("Must have a house before adding a hotel");
  if (set.hasHotel) throw new Error("Set already has a hotel");

  const card = player.hand.splice(cardIdx, 1)[0];
  game.discardPile.push(card);
  set.hasHotel = true;
  game.actionsRemaining--;

  addLog(game, `${player.name} added a hotel to their ${PROPERTY_RULES[set.color].displayName} set. Rent is now $${getRentForSet(set)}M.`);
}

export function movePropertyBetweenSets(
  game: Game,
  playerId: string,
  cardId: string,
  fromSetId: string,
  toSetId: string
): void {
  const player = getPlayerById(game, playerId);

  const fromSet = player.propertySets.find(s => s.id === fromSetId);
  if (!fromSet) throw new Error("Source set not found");
  if (isSetComplete(fromSet)) throw new Error("Cannot move a card from a complete set");

  const toSet = player.propertySets.find(s => s.id === toSetId);
  if (!toSet) throw new Error("Destination set not found");
  if (isSetComplete(toSet)) throw new Error("Cannot move a card into a complete set");
  // if (fromSet.color !== toSet.color) throw new Error("Sets must be the same color");

  const cardIdx = fromSet.properties.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in source set");

  const card = fromSet.properties.splice(cardIdx, 1)[0] as PropertyCard;

  if (card.colors.length > 1) {
    if (!card.colors.includes(toSet.color)) {
      throw new Error("This wild card cannot be this color");
    }
    card.activeColor = toSet.color;
  } else {
    if (fromSet.color !== toSet.color) throw new Error("Sets must be the same color");
  }

  if (fromSet.properties.length === 0) {
    player.propertySets = player.propertySets.filter(s => s.id !== fromSetId);
  }

  toSet.properties.push(card);
  addLog(game, `${player.name} moved ${card.name} between ${PROPERTY_RULES[toSet.color].displayName} sets.`);
  checkWinCondition(game);
}

export function playWildRent(
  game: Game,
  playerId: string,
  cardId: string,
  setId: string,
  targetPlayerId: string,
  doubleRentCardId?: string
): void {
  if (game.phase !== "actionPhase") throw new Error("Not in action phase");
  if (game.actionsRemaining <= 0) throw new Error("No actions remaining");

  const player = getPlayerById(game, playerId);
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found in hand");

  const card = player.hand[cardIdx];
  if (card.type !== "action") throw new Error("Card is not a Wild Rent card");

  const set = player.propertySets.find(s => s.id === setId);
  if (!set) throw new Error("Set not found");

  const target = getPlayerById(game, targetPlayerId);

  let multiplier = 1;
  if (doubleRentCardId) {
    const doubleIdx = player.hand.findIndex(c => c.id === doubleRentCardId);
    if (doubleIdx === -1) throw new Error("Double Rent card not found in hand");
    const doubleCard = player.hand.splice(doubleIdx, 1)[0];
    game.discardPile.push(doubleCard);
    multiplier = 2;
  }

  const amount = getRentForSet(set) * multiplier;

  player.hand.splice(cardIdx, 1);
  game.discardPile.push(card);
  game.actionsRemaining--;

  game.pendingActions.push({
    kind: "payRent",
    fromPlayerId: target.id,
    toPlayerId: playerId,
    amountOwed: amount,
    selectedCardIds: [],
    blocked: false,
  });

  game.phase = "pendingAction";
  addLog(
    game,
    `${player.name} charged ${target.name} $${amount}M Wild Rent on ${PROPERTY_RULES[set.color].displayName}${multiplier === 2 ? " (doubled!)" : ""}.`
  );
}

export function moveWildToNewColor(
  game: Game,
  playerId: string,
  cardId: string,
  fromSetId: string,
  newColor: PropertyColor
): void {
  const player = getPlayerById(game, playerId);
  const fromSet = player.propertySets.find(s => s.id === fromSetId);
  if (!fromSet) throw new Error("Source set not found");
  if (isSetComplete(fromSet)) throw new Error("Cannot move from a complete set");

  const cardIdx = fromSet.properties.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error("Card not found");

  const card = fromSet.properties.splice(cardIdx, 1)[0] as PropertyCard;
  if (!card.colors.includes(newColor)) throw new Error("Invalid color for this wild");

  if (fromSet.properties.length === 0) {
    player.propertySets = player.propertySets.filter(s => s.id !== fromSetId);
  }

  card.activeColor = newColor;
  player.propertySets.push({
    id: generateId(),
    color: newColor,
    properties: [card],
    hasHouse: false,
    hasHotel: false,
  });

  addLog(game, `${player.name} moved ${card.name} to a new ${PROPERTY_RULES[newColor].displayName} set.`);
  checkWinCondition(game);
}