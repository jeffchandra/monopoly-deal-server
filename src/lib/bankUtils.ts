import { Player } from "../types/game";
import { isSetComplete } from "./propertyUtils";

export function getBankValue(player: Player): number {
  return player.bank.reduce((sum, card) => sum + card.value, 0);
}

export function getTotalAssets(player: Player): number {
  let total = getBankValue(player);
  for (const set of player.propertySets) {
    if (isSetComplete(set)) continue;
    total += set.properties.reduce((sum, card) => sum + card.value, 0);
  }
  return total;
}

export function canAfford(player: Player, amount: number): boolean {
  return getTotalAssets(player) >= amount;
}

