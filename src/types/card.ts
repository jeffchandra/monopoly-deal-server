export type CardType = "property" | "money" | "rent" | "action";

export type PropertyColor =
  | "brown"
  | "lightBlue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkBlue"
  | "railroad"
  | "utility";

export type ActionType =
  | "dealBreaker"
  | "debtCollector"
  | "doubleRent"
  | "forcedDeal"
  | "hotel"
  | "house"
  | "itsMyBirthday"
  | "justSayNo"
  | "passGo"
  | "rentWild"
  | "slyDeal";

export interface Card {
  id: string;
  name: string;
  type: CardType;
  value: number;
}

export interface PropertyCard extends Card {
  type: "property";
  colors: PropertyColor[];
  activeColor: PropertyColor;
}

export interface MoneyCard extends Card {
  type: "money";
}

export interface RentCard extends Card {
  type: "rent";
  rentableColors: PropertyColor[];
}

export interface ActionCard extends Card {
  type: "action";
  action: ActionType;
}