export const WORDS = [
  // --- existing ---
  "bird","house","money","planet","window","coffee","travel","purple","yellow","bridge",
  "tomorrow","picture","button","memory","shadow","forest","castle","winter","summer","school",
  "rocket","camera","guitar","circle","triangle","pencil","bottle","market","random","silver",
  "street","garden","animal","orange","future","simple","danger","secret","energy","friend",
  "light","night","storm","ocean","river","mountain","minute","second","quick","focus",

  // --- extra (300+ common words, safe + easy to scramble) ---
  "about","above","abroad","absent","accept","access","accident","account","across","action",
  "active","actual","adapt","address","advice","affair","afford","afraid","agency","agenda",
  "almost","always","amount","animal","answer","anyone","anyway","apart","appear","apple",
  "area","argue","around","arrive","artist","aspect","attack","attempt","author","available",
  "avoid","backpack","balance","banana","barrier","battery","beach","beauty","because",
  "become","before","behind","belief","benefit","beside","better","between","beyond","billion",
  "biology","bitter","blanket","border","borrow","bother","bounce","bravery","breakfast",
  "breathe","bright","broken","browser","budget","builder","butter","button","cabin","cabinet",
  "camera","cancel","candle","cannot","canvas","capital","captain","capture","career","careful",
  "carpet","carrier","cartoon","castle","casual","catcher","caution","ceiling","center","chance",
  "change","charge","charity","cheerful","chicken","choice","choose","chorus","circuit","citizen",
  "city","classic","climate","closer","cloth","cloud","coach","coffee","collect","college","color",
  "combine","comfort","common","company","compare","compete","complain","complete","compose",
  "concept","concert","confirm","connect","consider","consent","control","cooking","corner",
  "correct","council","counter","country","courage","course","crystal","culture","curious",
  "custom","damage","danger","decide","declare","defeat","defense","deliver","demand","density",
  "depart","deposit","describe","design","desktop","despite","detail","develop","diamond","digital",
  "dinner","direct","discover","display","distance","doctor","dollar","domain","double","driver",
  "during","dynamic","eager","early","easily","eastern","economy","edition","effect","either",
  "elderly","elegant","element","embrace","emotion","employ","enable","energy","engine","enhance",
  "enjoy","enough","enquiry","ensure","entire","episode","equal","equally","escape","essence",
  "ethical","evening","exact","example","excited","exclude","execute","exercise","expense","explain",
  "explore","express","extend","extreme","fabric","factor","factory","fairly","family","famous",
  "farmer","fashion","feature","federal","feeling","fiction","finance","finish","fitness","flight",
  "flower","follow","foreign","fortune","forward","freedom","frequent","friend","frozen","future",
  "gallery","garden","general","genius","gentle","genuine","gesture","global","golden","govern",
  "gravity","grocery","growth","guilty","habitat","halfway","handle","handful","happen","harmony",
  "harvest","heading","healthy","hearing","heart","helpful","heritage","highway","history","holiday",
  "honest","honesty","hopeful","hospital","hotel","housing","however","hungry","husband","idea",
  "imagine","impact","improve","include","income","indeed","indoor","industry","inform","initial",
  "injury","inside","insist","install","instant","instead","intense","interest","into","invest",
  "island","itself","jacket","journal","journey","judge","justice","keeper","kitchen","knowing",
  "label","largely","latest","latter","launch","leader","leading","learned","lecture","legend",
  "length","letter","library","license","likely","limited","listen","little","lively","living",
  "logical","lonely","loyalty","lucky","machine","manager","manner","market","master","matter",
  "maximum","maybe","measure","medical","meeting","member","memory","message","method","middle",
  "minute","mirror","mobile","moment","monitor","month","morning","motion","mountain","museum",
  "musical","mystery","native","natural","nearby","nearly","network","neutral","nothing","notice",
  "nowadays","number","object","observe","obvious","ocean","offer","office","often","opening",
  "operate","opinion","option","orange","order","origin","outside","owner","packet","palace",
  "parent","parking","partner","party","patient","pattern","people","perfect","period","person",
  "phone","phrase","picture","pilot","planet","plastic","player","please","pocket","poetry",
  "police","popular","portion","position","possible","postcard","power","practice","prepare",
  "present","prevent","price","primary","printer","private","problem","process","produce","product",
  "profile","program","project","promise","proper","protect","provide","public","purpose","quality",
  "quarter","quiet","random","rapid","rather","reader","ready","reason","receive","record","recover",
  "reduce","reflect","reform","refresh","refuse","region","regular","release","remain","remember",
  "remote","remove","repair","repeat","replace","report","request","require","rescue","reserve",
  "result","return","reveal","review","reward","rhythm","river","rocket","runner","safety","salary",
  "sample","school","science","screen","search","season","second","secret","secure","select","seller",
  "senior","sense","series","service","settle","shadow","should","signal","silver","simple","single",
  "sister","smooth","society","someone","sound","source","speaker","special","spirit","sports",
  "square","stable","station","status","steady","store","storm","story","street","strong","student",
  "style","summer","supply","surely","system","tablet","talent","target","teacher","telecom",
  "temple","tennis","thanks","theory","ticket","today","together","tomorrow","topic","total",
  "touch","tourist","toward","travel","treat","trouble","tunnel","turning","twelve","unable",
  "unique","unless","update","useful","usual","valley","value","vendor","version","victory",
  "video","village","violin","visible","visitor","visual","volume","wallet","wander","warning",
  "weather","weekend","welcome","western","window","winner","winter","within","woman","wonder",
  "worker","world","writer","yellow","yesterday","young","yourself"
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
