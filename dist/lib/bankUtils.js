"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBankValue = getBankValue;
exports.getTotalAssets = getTotalAssets;
exports.canAfford = canAfford;
const propertyUtils_1 = require("./propertyUtils");
function getBankValue(player) {
    return player.bank.reduce((sum, card) => sum + card.value, 0);
}
function getTotalAssets(player) {
    let total = getBankValue(player);
    for (const set of player.propertySets) {
        if ((0, propertyUtils_1.isSetComplete)(set))
            continue;
        total += set.properties.reduce((sum, card) => sum + card.value, 0);
    }
    return total;
}
function canAfford(player, amount) {
    return getTotalAssets(player) >= amount;
}
