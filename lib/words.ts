export const WORDS = [
  "bird","house","money","planet","window","coffee","travel","purple","yellow","bridge",
  "tomorrow","picture","button","memory","shadow","forest","castle","winter","summer","school",
  "rocket","camera","guitar","circle","triangle","pencil","bottle","market","random","silver",
  "street","garden","animal","orange","future","simple","danger","secret","energy","friend",
  "light","night","storm","ocean","river","mountain","minute","second","quick","focus"
];

// --------- helpers ----------
function fnv1a(str: string) {
  // stable deterministic hash -> uint32
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleWithSeed(chars: string[], seed: number) {
  // Fisher-Yates with seeded pseudo-random
  let x = seed >>> 0;
  const rand = () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

export function scrambleWord(word: string, seed?: number) {
  if (word.length <= 3) return word.split("").reverse().join("");

  const s = seed ?? Math.floor(Math.random() * 2 ** 31);
  const chars = shuffleWithSeed(word.split(""), s);
  let scrambled = chars.join("");

  if (scrambled === word) {
    // fallback swap
    const c = word.split("");
    [c[0], c[1]] = [c[1], c[0]];
    scrambled = c.join("");
  }
  return scrambled;
}

/**
 * GLOBAL word for a round:
 * - everyone gets same word for same interval+roundStartMs
 */
export function getGlobalWord(roundStartMs: number, intervalMin: number) {
  const roundKey = `${intervalMin}:${roundStartMs}`;
  const h = fnv1a(roundKey);
  const idx = h % WORDS.length;
  const word = WORDS[idx];

  // scrambled version is also stable for that round
  const scrambled = scrambleWord(word, h);
  return { word, scrambled };
}
