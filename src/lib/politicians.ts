export const MAJOR_POLITICIANS = [
  "Nancy Pelosi",
  "Paul Pelosi",
  "Dan Crenshaw",
  "Michael McCaul",
  "Tommy Tuberville",
  "Shelley Moore Capito",
  "Marjorie Taylor Greene",
  "Virginia Foxx",
  "Brian Mast",
  "Lois Frankel",
  "Suzan DelBene",
  "Josh Gottheimer",
  "Ro Khanna",
  "Alexandria Ocasio-Cortez",
  "Mark Warner",
  "Susan Collins",
  "Greg Gianforte",
  "John Curtis",
  "David Perdue",
  "Richard Burr",
];

export function normalizePoliticianName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export const MAJOR_POLITICIANS_NORMALIZED = MAJOR_POLITICIANS.map(
  normalizePoliticianName
);
