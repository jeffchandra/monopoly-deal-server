import { PROPERTY_RULES } from "../data/propertyRules";
import { Card, MoneyCard, PropertyCard, PropertyColor, RentCard, ActionCard } from "../types/card";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function createDeck(): Card[] {
  const cards: Card[] = [];

  // ── Money ──────────────────────────────────────────────────────────────────
  const moneyValues = [10, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1];
  for (const value of moneyValues) {
    cards.push({
      id: generateId(),
      name: `$${value}M`,
      type: "money",
      value,
    } as MoneyCard);
  }

  // ── Brown ──────────────────────────────────────────────────────────────────
  cards.push({ id: generateId(), name: "Mediterranean Ave", type: "property", value: 1, colors: ["brown"], activeColor: "brown" } as PropertyCard);
  cards.push({ id: generateId(), name: "Baltic Ave", type: "property", value: 1, colors: ["brown"], activeColor: "brown" } as PropertyCard);

  // ── Light Blue ─────────────────────────────────────────────────────────────
  cards.push({ id: generateId(), name: "Oriental Ave", type: "property", value: 1, colors: ["lightBlue"], activeColor: "lightBlue" } as PropertyCard);
  cards.push({ id: generateId(), name: "Vermont Ave", type: "property", value: 1, colors: ["lightBlue"], activeColor: "lightBlue" } as PropertyCard);
  cards.push({ id: generateId(), name: "Connecticut Ave", type: "property", value: 1, colors: ["lightBlue"], activeColor: "lightBlue" } as PropertyCard);

  // ── Pink ───────────────────────────────────────────────────────────────────
  cards.push({ id: generateId(), name: "St. Charles Place", type: "property", value: 2, colors: ["pink"], activeColor: "pink" } as PropertyCard);
  cards.push({ id: generateId(), name: "States Ave", type: "property", value: 2, colors: ["pink"], activeColor: "pink" } as PropertyCard);
  cards.push({ id: generateId(), name: "Virginia Ave", type: "property", value: 2, colors: ["pink"], activeColor: "pink" } as PropertyCard);

  // ── Orange ─────────────────────────────────────────────────────────────────
  cards.push({ id: generateId(), name: "St. James Place", type: "property", value: 2, colors: ["orange"], activeColor: "orange" } as PropertyCard);
  cards.push({ id: generateId(), name: "Tennessee Ave", type: "property", value: 2, colors: ["orange"], activeColor: "orange" } as PropertyCard);
  cards.push({ id: generateId(), name: "New York Ave", type: "property", value: 2, colors: ["orange"], activeColor: "orange" } as PropertyCard);

  // ── Red ────────────────────────────────────────────────────────────────────
  cards.push({ id: generateId(), name: "Kentucky Ave", type: "property", value: 3, colors: ["red"], activeColor: "red" } as PropertyCard);
  cards.push({ id: generateId(), name: "Indiana Ave", type: "property", value: 3, colors: ["red"], activeColor: "red" } as PropertyCard);
  cards.push({ id: generateId(), name: "Illinois Ave", type: "property", value: 3, colors: ["red"], activeColor: "red" } as PropertyCard);

  // ── Yellow ─────────────────────────────────────────────────────────────────
  cards.push({ id: generateId(), name: "Atlantic Ave", type: "property", value: 3, colors: ["yellow"], activeColor: "yellow" } as PropertyCard);
  cards.push({ id: generateId(), name: "Ventnor Ave", type: "property", value: 3, colors: ["yellow"], activeColor: "yellow" } as PropertyCard);
  cards.push({ id: generateId(), name: "Marvin Gardens", type: "property", value: 3, colors: ["yellow"], activeColor: "yellow" } as PropertyCard);

  // ── Green ──────────────────────────────────────────────────────────────────
  cards.push({ id: generateId(), name: "Pacific Ave", type: "property", value: 4, colors: ["green"], activeColor: "green" } as PropertyCard);
  cards.push({ id: generateId(), name: "North Carolina Ave", type: "property", value: 4, colors: ["green"], activeColor: "green" } as PropertyCard);
  cards.push({ id: generateId(), name: "Pennsylvania Ave", type: "property", value: 4, colors: ["green"], activeColor: "green" } as PropertyCard);

  // ── Dark Blue ──────────────────────────────────────────────────────────────
  cards.push({ id: generateId(), name: "Park Place", type: "property", value: 4, colors: ["darkBlue"], activeColor: "darkBlue" } as PropertyCard);
  cards.push({ id: generateId(), name: "Boardwalk", type: "property", value: 4, colors: ["darkBlue"], activeColor: "darkBlue" } as PropertyCard);

  // ── Railroads ──────────────────────────────────────────────────────────────
  cards.push({ id: generateId(), name: "Reading Railroad", type: "property", value: 2, colors: ["railroad"], activeColor: "railroad" } as PropertyCard);
  cards.push({ id: generateId(), name: "Pennsylvania Railroad", type: "property", value: 2, colors: ["railroad"], activeColor: "railroad" } as PropertyCard);
  cards.push({ id: generateId(), name: "B&O Railroad", type: "property", value: 2, colors: ["railroad"], activeColor: "railroad" } as PropertyCard);
  cards.push({ id: generateId(), name: "Short Line Railroad", type: "property", value: 2, colors: ["railroad"], activeColor: "railroad" } as PropertyCard);

  // ── Utilities ──────────────────────────────────────────────────────────────
  cards.push({ id: generateId(), name: "Electric Company", type: "property", value: 2, colors: ["utility"], activeColor: "utility" } as PropertyCard);
  cards.push({ id: generateId(), name: "Water Works", type: "property", value: 2, colors: ["utility"], activeColor: "utility" } as PropertyCard);

  // ── Rent Cards ─────────────────────────────────────────────────────────────
  // 2 of each color pair
  const rentPairs: [PropertyColor, PropertyColor][] = [
    ["brown", "lightBlue"],
    ["pink", "orange"],
    ["red", "yellow"],
    ["green", "darkBlue"],
    ["railroad", "utility"],
  ];
  for (const [c1, c2] of rentPairs) {
    for (let i = 0; i < 2; i++) {
      cards.push({
        id: generateId(),
        name: `Rent: ${PROPERTY_RULES[c1].displayName}/${PROPERTY_RULES[c2].displayName}`,
        type: "rent",
        value: 1,
        rentableColors: [c1, c2],
      } as RentCard);
    }
  }

  // ── Action Cards ───────────────────────────────────────────────────────────
  function act(name: string, value: number, action: ActionCard["action"]): ActionCard {
    return { id: generateId(), name, type: "action", value, action };
  }

  // Pass Go x10
  for (let i = 0; i < 10; i++) {
    cards.push(act("Pass Go", 1, "passGo"));
  }

  // It's My Birthday x3
  for (let i = 0; i < 3; i++) {
    cards.push(act("It's My Birthday!", 2, "itsMyBirthday"));
  }

  // Debt Collector x3
  for (let i = 0; i < 3; i++) {
    cards.push(act("Debt Collector", 3, "debtCollector"));
  }

  // Sly Deal x3
  for (let i = 0; i < 3; i++) {
    cards.push(act("Sly Deal", 3, "slyDeal"));
  }

  // Forced Deal x4
  for (let i = 0; i < 4; i++) {
    cards.push(act("Forced Deal", 3, "forcedDeal"));
  }

  // House x3
  for (let i = 0; i < 3; i++) {
    cards.push(act("House", 3, "house"));
  }

  // Hotel x3
  for (let i = 0; i < 3; i++) {
    cards.push(act("Hotel", 4, "hotel"));
  }

  // Double Rent x2
  for (let i = 0; i < 2; i++) {
    cards.push(act("Double Rent", 2, "doubleRent"));
  }

  // Wild Rent x3
  for (let i = 0; i < 3; i++) {
    cards.push(act("Wild Rent", 3, "rentWild"));
  }
  
  // 2-Color Wild Cards
  cards.push({ id: generateId(), name: "Wild: Pink/Orange", type: "property", value: 2, colors: ["pink", "orange"], activeColor: "pink" } as PropertyCard);
  cards.push({ id: generateId(), name: "Wild: Pink/Orange", type: "property", value: 2, colors: ["pink", "orange"], activeColor: "pink" } as PropertyCard);
  cards.push({ id: generateId(), name: "Wild: Red/Yellow", type: "property", value: 3, colors: ["red", "yellow"], activeColor: "red" } as PropertyCard);
  cards.push({ id: generateId(), name: "Wild: Red/Yellow", type: "property", value: 3, colors: ["red", "yellow"], activeColor: "red" } as PropertyCard);
  cards.push({ id: generateId(), name: "Wild: Green/Dark Blue", type: "property", value: 4, colors: ["green", "darkBlue"], activeColor: "green" } as PropertyCard);
  cards.push({ id: generateId(), name: "Wild: Light Blue/Brown", type: "property", value: 1, colors: ["lightBlue", "brown"], activeColor: "lightBlue" } as PropertyCard);
  cards.push({ id: generateId(), name: "Wild: Light Blue/Railroad", type: "property", value: 4, colors: ["lightBlue", "railroad"], activeColor: "lightBlue" } as PropertyCard);
  cards.push({ id: generateId(), name: "Wild: Railroad/Green", type: "property", value: 4, colors: ["railroad", "green"], activeColor: "railroad" } as PropertyCard);
  cards.push({ id: generateId(), name: "Wild: Utility/Railroad", type: "property", value: 2, colors: ["utility", "railroad"], activeColor: "utility" } as PropertyCard);

  // All-Color Wild Cards x2
  const allColors: PropertyColor[] = ["brown","lightBlue","pink","orange","red","yellow","green","darkBlue","railroad","utility"];
  for (let i = 0; i < 2; i++) {
    cards.push({ id: generateId(), name: "Wild: All Colors", type: "property", value: 3, colors: allColors, activeColor: "green" } as PropertyCard);
  }

  // Just Say No x3
  // for (let i = 0; i < 3; i++) {
  //   cards.push(act("Just Say No", 4, "justSayNo"));
  // }

  return cards;
}