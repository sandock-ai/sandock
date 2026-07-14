/**
 * Docker-style random name generator for sandboxes
 * Generates names like "happy_whale", "hungry_tiger", etc.
 *
 * Based on Docker's namesgenerator package
 * https://github.com/moby/moby/blob/master/pkg/namesgenerator/names-generator.go
 */

// Adjectives list (inspired by Docker)
const ADJECTIVES = [
  "admiring",
  "adoring",
  "affectionate",
  "agitated",
  "amazing",
  "angry",
  "awesome",
  "beautiful",
  "blissful",
  "bold",
  "boring",
  "brave",
  "busy",
  "charming",
  "clever",
  "cool",
  "compassionate",
  "competent",
  "condescending",
  "confident",
  "cranky",
  "crazy",
  "dazzling",
  "determined",
  "distracted",
  "dreamy",
  "eager",
  "ecstatic",
  "elastic",
  "elated",
  "elegant",
  "eloquent",
  "epic",
  "exciting",
  "fervent",
  "festive",
  "flamboyant",
  "focused",
  "friendly",
  "frosty",
  "funny",
  "gallant",
  "gifted",
  "goofy",
  "gracious",
  "great",
  "happy",
  "hardcore",
  "heuristic",
  "hopeful",
  "hungry",
  "infallible",
  "inspiring",
  "intelligent",
  "interesting",
  "jolly",
  "jovial",
  "keen",
  "kind",
  "laughing",
  "loving",
  "lucid",
  "magical",
  "mystifying",
  "modest",
  "musing",
  "naughty",
  "nervous",
  "nice",
  "nifty",
  "nostalgic",
  "objective",
  "optimistic",
  "peaceful",
  "pedantic",
  "pensive",
  "practical",
  "priceless",
  "quirky",
  "quizzical",
  "recursing",
  "relaxed",
  "reverent",
  "romantic",
  "sad",
  "serene",
  "sharp",
  "silly",
  "sleepy",
  "stoic",
  "strange",
  "stupefied",
  "suspicious",
  "sweet",
  "tender",
  "thirsty",
  "trusting",
  "unruffled",
  "upbeat",
  "vibrant",
  "vigilant",
  "vigorous",
  "wizardly",
  "wonderful",
  "xenodochial",
  "youthful",
  "zealous",
  "zen",
];

// Nouns - famous scientists, programmers, and innovators (inspired by Docker)
const NOUNS = [
  "albattani", // Muhammad ibn Jābir al-Harrānī al-Battānī - astronomer
  "allen", // Frances E. Allen - computer scientist
  "archimedes", // Archimedes - mathematician and physicist
  "babbage", // Charles Babbage - computer pioneer
  "bell", // Alexander Graham Bell - inventor
  "bohr", // Niels Bohr - physicist
  "booth", // Kathleen Booth - computer scientist
  "borg", // Anita Borg - computer scientist
  "bose", // Satyendra Nath Bose - physicist
  "burnell", // Jocelyn Bell Burnell - astrophysicist
  "cannon", // Annie Jump Cannon - astronomer
  "carson", // Rachel Carson - marine biologist
  "chaplygin", // Sergei Chaplygin - mathematician
  "chatelet", // Émilie du Châtelet - physicist
  "cori", // Gerty Cori - biochemist
  "cray", // Seymour Cray - computer architect
  "curie", // Marie Curie - physicist
  "darwin", // Charles Darwin - naturalist
  "diffie", // Whitfield Diffie - cryptographer
  "dijkstra", // Edsger Dijkstra - computer scientist
  "einstein", // Albert Einstein - physicist
  "elion", // Gertrude Elion - biochemist
  "ellis", // Margaret Hamilton Ellis - NASA scientist
  "feynman", // Richard Feynman - physicist
  "franklin", // Rosalind Franklin - biophysicist
  "galileo", // Galileo Galilei - astronomer
  "gauss", // Carl Friedrich Gauss - mathematician
  "goldstine", // Adele Goldstine - mathematician
  "goldwasser", // Shafi Goldwasser - computer scientist
  "goodall", // Jane Goodall - primatologist
  "hamilton", // Margaret Hamilton - software engineer
  "hawking", // Stephen Hawking - physicist
  "heisenberg", // Werner Heisenberg - physicist
  "hodgkin", // Dorothy Hodgkin - chemist
  "hoover", // Erna Hoover - inventor
  "hopper", // Grace Hopper - computer scientist
  "jackson", // Mary Jackson - NASA engineer
  "johnson", // Katherine Johnson - mathematician
  "joliot", // Irène Joliot-Curie - chemist
  "keller", // Helen Keller - author
  "kepler", // Johannes Kepler - astronomer
  "khorana", // Har Gobind Khorana - biochemist
  "kilby", // Jack Kilby - electrical engineer
  "kowalevski", // Sofia Kovalevskaya - mathematician
  "lalande", // Jérôme Lalande - astronomer
  "lamarr", // Hedy Lamarr - inventor
  "lamport", // Leslie Lamport - computer scientist
  "leakey", // Mary Leakey - paleoanthropologist
  "leavitt", // Henrietta Leavitt - astronomer
  "lichterman", // Ruth Lichterman - programmer
  "liskov", // Barbara Liskov - computer scientist
  "lovelace", // Ada Lovelace - mathematician
  "lumiere", // Auguste Lumière - inventor
  "mahavira", // Mahāvīra - mathematician
  "margulis", // Lynn Margulis - biologist
  "mayer", // Maria Mayer - physicist
  "mccarthy", // John McCarthy - computer scientist
  "mclean", // Malcolm McLean - inventor
  "meitner", // Lise Meitner - physicist
  "mendel", // Gregor Mendel - geneticist
  "merkle", // Ralph Merkle - computer scientist
  "mirzakhani", // Maryam Mirzakhani - mathematician
  "moore", // Gordon Moore - engineer
  "morse", // Samuel Morse - inventor
  "nash", // John Nash - mathematician
  "newton", // Isaac Newton - physicist
  "nightingale", // Florence Nightingale - nurse
  "nobel", // Alfred Nobel - chemist
  "noether", // Emmy Noether - mathematician
  "northcutt", // Debbie Northcutt - programmer
  "noyce", // Robert Noyce - inventor
  "pascal", // Blaise Pascal - mathematician
  "pasteur", // Louis Pasteur - microbiologist
  "payne", // Cecilia Payne - astronomer
  "perlman", // Radia Perlman - network engineer
  "pike", // Rob Pike - programmer
  "ptolemy", // Claudius Ptolemy - astronomer
  "raman", // C. V. Raman - physicist
  "ride", // Sally Ride - astronaut
  "ritchie", // Dennis Ritchie - computer scientist
  "rubin", // Vera Rubin - astronomer
  "saha", // Meghnad Saha - astrophysicist
  "shannon", // Claude Shannon - mathematician
  "shockley", // William Shockley - physicist
  "snyder", // Betty Snyder - programmer
  "spence", // Frances Spence - programmer
  "stallman", // Richard Stallman - programmer
  "stonebraker", // Michael Stonebraker - computer scientist
  "swartz", // Aaron Swartz - programmer
  "tesla", // Nikola Tesla - inventor
  "thompson", // Ken Thompson - programmer
  "torvalds", // Linus Torvalds - programmer
  "turing", // Alan Turing - computer scientist
  "villani", // Cédric Villani - mathematician
  "vonneumann", // John von Neumann - mathematician
  "wescoff", // Marlyn Wescoff - programmer
  "wiles", // Andrew Wiles - mathematician
  "wilson", // Edward Wilson - biologist
  "wozniak", // Steve Wozniak - inventor
  "wright", // Orville Wright - inventor
  "wu", // Chien-Shiung Wu - physicist
  "yalow", // Rosalyn Yalow - physicist
  "yonath", // Ada Yonath - crystallographer
];

/**
 * Generate a random Docker-style sandbox name
 * Format: adjective_noun (e.g., "happy_whale", "clever_einstein")
 *
 * @returns A random name string
 */
export function generateRandomSandboxName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective}_${noun}`;
}

/**
 * Generate a unique random sandbox name with a retry mechanism
 * Appends a random suffix if the base name already exists
 *
 * @param existingNames - Array of existing sandbox names to check against
 * @param maxRetries - Maximum number of retries before adding a random suffix
 * @returns A unique random name string
 */
export function generateUniqueRandomSandboxName(
  existingNames: string[] = [],
  maxRetries = 10,
): string {
  const existingSet = new Set(existingNames);

  // Try to generate a unique name
  for (let i = 0; i < maxRetries; i++) {
    const name = generateRandomSandboxName();
    if (!existingSet.has(name)) {
      return name;
    }
  }

  // If all retries exhausted, add a random suffix
  const baseName = generateRandomSandboxName();
  const suffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${baseName}_${suffix}`;
}
