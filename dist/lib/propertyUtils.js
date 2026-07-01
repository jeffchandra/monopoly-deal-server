"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSetComplete = isSetComplete;
exports.getCompletedSetCount = getCompletedSetCount;
exports.getRentForSet = getRentForSet;
exports.getRentableSetsByCard = getRentableSetsByCard;
exports.getIncompleteSetForColor = getIncompleteSetForColor;
const propertyRules_1 = require("../data/propertyRules");
function isSetComplete(set) {
    const rule = propertyRules_1.PROPERTY_RULES[set.color];
    return set.properties.length >= rule.setSize;
}
function getCompletedSetCount(player) {
    let count = 0;
    for (const set of player.propertySets) {
        if (isSetComplete(set)) {
            count++;
        }
    }
    return count;
}
function getRentForSet(set) {
    const rule = propertyRules_1.PROPERTY_RULES[set.color];
    const count = set.properties.length;
    const tierIndex = Math.min(count - 1, rule.rentTiers.length - 1);
    let rent = rule.rentTiers[tierIndex];
    if (isSetComplete(set)) {
        if (set.hasHouse)
            rent += 3;
        if (set.hasHotel)
            rent += 4;
    }
    return rent;
}
function getRentableSetsByCard(player, rentCard) {
    return player.propertySets.filter(set => rentCard.rentableColors.includes(set.color));
}
function getIncompleteSetForColor(player, color) {
    return player.propertySets.find(s => s.color === color && !isSetComplete(s));
}
