export const MAJOR_POLITICIANS = [
  "Nancy Pelosi",
  "Josh Gottheimer",
  "Suzan DelBene",
  "Lois Frankel",
  "Michael McCaul",
  "Dan Crenshaw",
  "Virginia Foxx",
  "Brian Mast",
  "Tommy Tuberville",
  "Mark Warner",
  "Shelley Moore Capito",
  "Susan Collins",
  "Marjorie Taylor Greene",
  "Ro Khanna",
  "Greg Gianforte",
  "Pat Fallon",
  "Thomas Massie",
  "Austin Scott",
  "Mike Kelly",
  "Bill Huizenga",
];

export function normalizePoliticianName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export const MAJOR_POLITICIANS_NORMALIZED = MAJOR_POLITICIANS.map(
  normalizePoliticianName
);
