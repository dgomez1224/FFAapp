export type MessageLanguage = "English" | "French" | "Spanish";
export type MessageTrigger =
  | "NEW_SIGNING"
  | "HIGH_PERFORMANCE"
  | "LOW_PERFORMANCE"
  | "SUPER_SUB"
  | "STARTING_REGULARLY"
  | "NOT_STARTING_ENOUGH"
  | "NO_GAME_TIME"
  | "BIG_WIN"
  | "BIG_LOSS"
  | "UPCOMING_FIXTURES"
  | "FAVORABLE_FIXTURE"
  | "TOUGH_FIXTURE"
  | "TEAM_STREAK"
  | "PLAYER_REPLY";

export type MessageContext = {
  playerName: string;
  position: string;
  points?: number;
  goals?: number;
  assists?: number;
  minutes?: number;
  managerName: string;
  opponent?: string;
  fixtureNote?: string;
};

const FRENCH_MANAGERS = new Set(["HENRI", "LENNART", "KARIM"]);
const SPANISH_MANAGERS = new Set(["DAVID", "BENJI", "SEBASTIAN", "MAX", "BRENDAN", "CHRIS"]);

export const POSITION_LABEL: Record<number, string> = {
  1: "GK",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

export function managerLanguage(managerName: string): MessageLanguage {
  const key = String(managerName || "").trim().toUpperCase();
  if (FRENCH_MANAGERS.has(key)) return "French";
  if (SPANISH_MANAGERS.has(key)) return "Spanish";
  return "English";
}

export function managerUnderstands(managerName: string, language: MessageLanguage): boolean {
  if (language === "English") return true;
  return managerLanguage(managerName) === language;
}

function normalizePlayerToken(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/** Distinctive PL surnames / web names. Default is English. */
const FRENCH_PLAYER_TOKENS = new Set([
  "saliba", "konate", "olise", "nkunku", "tel", "cherki", "ekitike", "odobert",
  "gusto", "disasi", "badiashile", "fofana", "yoro", "areola", "maignan", "meslier",
  "digne", "zouma", "kante", "varane", "pogba", "giroud", "lacazette", "mateta",
  "kolo muani", "kolomuani", "zaire emery", "zaireemery", "le fee", "lefee",
  "truffert", "merlin", "kone", "ugochukwu", "barcola", "dembele", "mbappe",
  "tchouameni", "upamecano", "kounde", "camavinga", "thuram", "coman", "pavard",
  "clauss", "akliouche", "amougou", "saint maximin", "benrahma", "diaby", "wahi",
  "kalimuendo", "nkounkou", "mandanda", "lloris", "sissoko", "nardi", "locko",
  "kroupi", "doue",
]);

const SPANISH_PLAYER_TOKENS = new Set([
  "raya", "cucurella", "porro", "rodri", "zubimendi", "ayoze", "arrizabalaga",
  "kepa", "merino", "oyarzabal", "sancet", "baena", "asensio", "morata",
  "azpilicueta", "laporte", "alcantara", "ceballos", "carvajal", "remiro",
  "lenormand", "romeu", "zaragoza", "cubarsi", "balde", "oyarzun", "robert sanchez",
]);

const FRENCH_FIRST = new Set([
  "kylian", "aurelien", "antoine", "olivier", "mathieu", "matthieu", "thierry",
  "ousmane", "randal", "adrien", "baptiste", "clement", "maxence", "malo", "leny",
  "warren", "alexandre", "etienne", "loic", "yves", "raphael", "ngolo", "dayot",
  "jules", "theo", "ibrahima", "mathys", "rayan", "wesley", "benoit", "illan",
  "alphonse",
]);

const SPANISH_FIRST = new Set([
  "unai", "inaki", "mikel", "iker", "alvaro", "ferran", "ayoze", "sergio",
  "gerard", "jordi", "lamine", "pedri", "gavi", "fermin", "pau", "oriol",
]);

export function playerNativeLanguage(playerName: string): MessageLanguage {
  const normalized = normalizePlayerToken(playerName);
  if (!normalized) return "English";
  const tokens = normalized.split(" ").filter(Boolean);
  const full = normalized;
  if (FRENCH_PLAYER_TOKENS.has(full) || tokens.some((t) => FRENCH_PLAYER_TOKENS.has(t))) return "French";
  if (SPANISH_PLAYER_TOKENS.has(full) || tokens.some((t) => SPANISH_PLAYER_TOKENS.has(t))) return "Spanish";
  if (tokens[0] && FRENCH_FIRST.has(tokens[0]) && !SPANISH_FIRST.has(tokens[0])) return "French";
  if (tokens[0] && SPANISH_FIRST.has(tokens[0])) return "Spanish";
  return "English";
}

export function languageIndicator(language: string): { flag: string; label: string } {
  if (language === "French") return { flag: "🇫🇷", label: "French" };
  if (language === "Spanish") return { flag: "🇪🇸", label: "Spanish" };
  return { flag: "🇬🇧", label: "English" };
}

export function presentInboxMessage(row: any, managerName: string) {
  const spoken = (row.native_language || "English") as MessageLanguage;
  const understands = managerUnderstands(managerName, spoken);
  const original = String(row.content || "");
  const english = row.content_translation || (spoken === "English" ? original : null);
  const display = understands ? original : (english || original);
  const indicator = languageIndicator(spoken);
  return {
    ...row,
    content: display,
    content_original: display === original ? null : original,
    content_translation: understands && spoken !== "English" ? english : null,
    is_translated: !understands && Boolean(english) && display !== original,
    native_language: spoken,
    language_flag: indicator.flag,
    language_label: indicator.label,
    trigger_label: triggerLabel(row.trigger_event),
    player_response: row.player_response || row.metadata?.player_response || null,
  };
}

const MESSAGE_TZ = "America/New_York";

export function todayKeyInZone(now = new Date(), timeZone = MESSAGE_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function nextDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function zonedLocalToUtc(dateKey: string, hour: number, minute: number, timeZone = MESSAGE_TZ): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d, hour, minute, 0);
  const offset = getTimeZoneOffsetMs(new Date(utc), timeZone);
  return new Date(utc - offset);
}

export function nyDayBounds(dateKey: string): { start: Date; end: Date } {
  return {
    start: zonedLocalToUtc(dateKey, 0, 0),
    end: zonedLocalToUtc(nextDateKey(dateKey), 0, 0),
  };
}

export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dailyMessageQuota(managerName: string, dateKey: string): number {
  return 2 + (hashSeed(`${managerName}:${dateKey}:quota`) % 3);
}

export function assignDailyMessageTimes(count: number, seed: number, dateKey: string): Date[] {
  const times: Date[] = [];
  const usedHours = new Set<number>();
  let cursor = seed;
  let guard = 0;
  while (times.length < count && guard < 80) {
    guard += 1;
    cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0;
    const hour = 8 + (cursor % 15);
    const minute = Math.floor(cursor / 15) % 60;
    if (usedHours.has(hour) && usedHours.size < 15) continue;
    usedHours.add(hour);
    times.push(zonedLocalToUtc(dateKey, hour, minute));
  }
  return times.sort((a, b) => a.getTime() - b.getTime());
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let cursor = seed;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0;
    const j = cursor % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function triggerLabel(trigger: string): string {
  const labels: Record<string, string> = {
    NEW_SIGNING: "New signing",
    HIGH_PERFORMANCE: "Big performance",
    LOW_PERFORMANCE: "Tough night",
    SUPER_SUB: "Super sub",
    STARTING_REGULARLY: "Starting XI",
    NOT_STARTING_ENOUGH: "Playing time",
    NO_GAME_TIME: "Waiting for minutes",
    BIG_WIN: "Big win",
    BIG_LOSS: "Tough result",
    UPCOMING_FIXTURES: "Upcoming fixtures",
    FAVORABLE_FIXTURE: "Good fixture",
    TOUGH_FIXTURE: "Tough fixture",
    TEAM_STREAK: "Team form",
    PLAYER_REPLY: "Reply",
  };
  return labels[trigger] || trigger;
}

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

const TEMPLATES: Record<MessageTrigger, Record<MessageLanguage, string[]>> = {
  NEW_SIGNING: {
    English: [
      "Gaffer, buzzing to be here. Can't wait to get stuck in with the lads.",
      "Cheers for the move, boss. I'll give you everything in that {position} shirt.",
      "Proper excited to join. Point me at the training pitch and let's go.",
    ],
    French: [
      "Coach, merci pour la confiance. Je suis prêt à tout donner dans ce maillot.",
      "Content d'arriver ici. On va bosser dur, promis.",
      "Merci boss. J'ai hâte de commencer avec le groupe.",
    ],
    Spanish: [
      "Míster, gracias por la oportunidad. Voy a dejarlo todo en el campo.",
      "Feliz de estar aquí. Dime qué necesitas y lo hacemos.",
      "Gracias, jefe. Listo para competir desde el primer día.",
    ],
  },
  HIGH_PERFORMANCE: {
    English: [
      "What a night, gaffer! {points} points and the lads were class. Let's keep this rolling.",
      "I'm flying right now. That performance was for you and the fans.",
      "Banger of a game. Felt unstoppable out there.",
    ],
    French: [
      "Quelle soirée, coach ! {points} points, le groupe était énorme.",
      "Je me sens intenable. On continue comme ça.",
      "Le match qu'il fallait. Merci de m'avoir aligné.",
    ],
    Spanish: [
      "¡Qué partido, míster! {points} puntos y el equipo estuvo brutal.",
      "Hoy salió todo. Seguimos así, jefe.",
      "Me sentí imparable. Gracias por la confianza.",
    ],
  },
  LOW_PERFORMANCE: {
    English: [
      "Not my day, boss. I'll be in early tomorrow to put it right.",
      "Sorry I didn't deliver. Won't happen again if I can help it.",
      "That one stung. Extra finishing after training, I promise.",
    ],
    French: [
      "Pas mon soir, coach. Demain je suis le premier à l'entraînement.",
      "Désolé. Je vais corriger ça tout de suite.",
      "Ça fait mal. Je reviens plus fort.",
    ],
    Spanish: [
      "Hoy no fue mi día, míster. Mañana estoy el primero en el entrenamiento.",
      "Perdón. Lo voy a enderezar.",
      "Duele. Prometo responder la próxima.",
    ],
  },
  SUPER_SUB: {
    English: [
      "Came off the bench and made it count. That's the job, gaffer.",
      "Always ready when you call. {points} points from the bench feels proper.",
      "Impact sub all day. Keep throwing me on when it's tight.",
    ],
    French: [
      "Entrée et impact. C'est pour ça que je suis là.",
      "Toujours prêt quand tu m'appelles, coach. {points} points du banc.",
      "Le match se gagne aussi sur le banc. Merci de m'avoir lancé.",
    ],
    Spanish: [
      "Salí del banquillo y cambié el partido. Para eso estoy.",
      "Siempre listo, míster. {points} puntos desde el banco.",
      "Cuando me necesites, entro y dejo huella.",
    ],
  },
  STARTING_REGULARLY: {
    English: [
      "Loving this run in the XI. Confidence is sky high, gaffer.",
      "Keep picking me and I'll keep delivering for the lads.",
      "This streak in the team means everything. Let's not stop now.",
    ],
    French: [
      "J'adore cette série de titularisations. La confiance est là.",
      "Laisse-moi dans le onze, je te le rends sur le terrain.",
      "Cette place dans l'équipe, je la mérite chaque semaine.",
    ],
    Spanish: [
      "Me encanta esta racha de titular. La confianza está altísima.",
      "Sígueme alineando y yo respondo, míster.",
      "Esta racha en el once lo es todo. No paremos ahora.",
    ],
  },
  NOT_STARTING_ENOUGH: {
    English: [
      "Gaffer, I need minutes. I'm not here to watch from the bench every week.",
      "Respect the calls, but I feel I deserve more starts.",
      "Be honest with me — what do I need to change to get in the XI?",
    ],
    French: [
      "Coach, j'ai besoin de jouer. Le banc chaque semaine, ça ne me va pas.",
      "Je respecte tes choix, mais je mérite plus de temps de jeu.",
      "Dis-moi ce qu'il faut changer pour être titulaire.",
    ],
    Spanish: [
      "Míster, necesito minutos. No vine a mirar desde el banquillo.",
      "Respeto tus decisiones, pero merezco más titularidades.",
      "Dime qué tengo que mejorar para entrar al once.",
    ],
  },
  NO_GAME_TIME: {
    English: [
      "Haven't kicked a ball in ages, boss. Where do I stand?",
      "I need to know if I'm in your plans. I'm here to play.",
      "Four weeks without minutes is tough. Give me a chance.",
    ],
    French: [
      "Ça fait trop longtemps sans jouer. Coach, je dois savoir où j'en suis.",
      "Je suis là pour jouer. Dis-moi si je compte.",
      "Sans minutes, ça devient dur. Donne-moi une chance.",
    ],
    Spanish: [
      "Llevo demasiado sin jugar. Míster, ¿cuento para ti?",
      "Estoy aquí para jugar. Necesito una oportunidad.",
      "Sin minutos se hace largo. Lánzame.",
    ],
  },
  BIG_WIN: {
    English: [
      "Get in! That win was for the fans. The dressing room is bouncing.",
      "We showed them, gaffer. Confidence in this squad is unreal.",
      "Massive result. Let's back it up next week.",
    ],
    French: [
      "On l'a fait ! Cette victoire, c'est pour le groupe et les supporters.",
      "On a montré le caractère. La confiance est énorme.",
      "Résultat énorme. On enchaîne la semaine prochaine.",
    ],
    Spanish: [
      "¡Vamos! Esta victoria es para la afición.",
      "Les demostramos quiénes somos, míster. El vestuario está arriba.",
      "Resultado enorme. A repetirlo la próxima.",
    ],
  },
  BIG_LOSS: {
    English: [
      "That one hurts. We'll bounce back, I promise.",
      "We let ourselves down today. Extra work this week, gaffer.",
      "Tough result to take. I'll be first in tomorrow.",
    ],
    French: [
      "Ça fait mal. On va se relever, promis.",
      "On s'est manqués. Semaine de travail, coach.",
      "Résultat dur. Demain je suis le premier au club.",
    ],
    Spanish: [
      "Duele. Vamos a responder, te lo prometo.",
      "Hoy nos faltó. Semana de trabajo, míster.",
      "Resultado duro. Mañana estoy el primero.",
    ],
  },
  UPCOMING_FIXTURES: {
    English: [
      "Looked at the next few games, {manager}. {fixtureNote}",
      "Fixtures coming up against {opponent}. {fixtureNote}",
      "I've been thinking about {opponent}. {fixtureNote}",
    ],
    French: [
      "J'ai regardé les prochains matchs, {manager}. {fixtureNote}",
      "On joue {opponent} bientôt. {fixtureNote}",
      "Les calendriers contre {opponent}… {fixtureNote}",
    ],
    Spanish: [
      "He mirado los próximos partidos, {manager}. {fixtureNote}",
      "Nos toca {opponent} pronto. {fixtureNote}",
      "Pensando en {opponent}. {fixtureNote}",
    ],
  },
  FAVORABLE_FIXTURE: {
    English: [
      "This looks tasty against {opponent}. {fixtureNote}",
      "I fancy my chances here, {manager}. {fixtureNote}",
      "Good fixture for us vs {opponent}. {fixtureNote}",
    ],
    French: [
      "Beau match contre {opponent}. {fixtureNote}",
      "Je sens le coup, {manager}. {fixtureNote}",
      "Calendrier favorable face à {opponent}. {fixtureNote}",
    ],
    Spanish: [
      "Buen partido contra {opponent}. {fixtureNote}",
      "Me gustan estas, {manager}. {fixtureNote}",
      "Calendario a favor frente a {opponent}. {fixtureNote}",
    ],
  },
  TOUGH_FIXTURE: {
    English: [
      "Tough one vs {opponent}, {manager}. {fixtureNote}",
      "We'll need to be at it against {opponent}. {fixtureNote}",
      "Big test coming. {fixtureNote}",
    ],
    French: [
      "Match dur contre {opponent}. {fixtureNote}",
      "Il va falloir être au niveau, {manager}. {fixtureNote}",
      "Gros test à venir. {fixtureNote}",
    ],
    Spanish: [
      "Partido duro contra {opponent}. {fixtureNote}",
      "Hay que estar a tope, {manager}. {fixtureNote}",
      "Examen grande. {fixtureNote}",
    ],
  },
  TEAM_STREAK: {
    English: [
      "{fixtureNote}",
      "The dressing room's talking about this run, {manager}. {fixtureNote}",
      "Squad's feeling it. {fixtureNote}",
    ],
    French: [
      "{fixtureNote}",
      "Le vestiaire en parle, {manager}. {fixtureNote}",
      "L'équipe le sent. {fixtureNote}",
    ],
    Spanish: [
      "{fixtureNote}",
      "El vestuario está en esto, {manager}. {fixtureNote}",
      "El grupo lo siente. {fixtureNote}",
    ],
  },
  PLAYER_REPLY: {
    English: [
      "Got your message, {manager}. I'll keep working.",
      "Heard, gaffer. I'll show you on the pitch.",
      "Message received. I'm with you.",
    ],
    French: [
      "J'ai vu ton message, {manager}. Je continue.",
      "Compris, coach. Je te le montre sur le terrain.",
      "Message reçu. Je suis avec toi.",
    ],
    Spanish: [
      "Vi tu mensaje, {manager}. Sigo trabajando.",
      "Enterado, míster. Te lo demuestro en el campo.",
      "Mensaje recibido. Estoy contigo.",
    ],
  },
};

const ENGLISH_GLOSS: Record<MessageTrigger, string[]> = {
  NEW_SIGNING: ["Thanks for bringing me in — I'm ready to work."],
  HIGH_PERFORMANCE: ["Great game. I want to keep this form going."],
  LOW_PERFORMANCE: ["Sorry about today. I'll put it right in training."],
  SUPER_SUB: ["I made an impact off the bench. Use me anytime."],
  STARTING_REGULARLY: ["I love starting. Let's keep the run going."],
  NOT_STARTING_ENOUGH: ["I want more minutes. Tell me what to improve."],
  NO_GAME_TIME: ["I haven't played in a while. I need to know where I stand."],
  BIG_WIN: ["Huge win. The squad is buzzing."],
  BIG_LOSS: ["That loss hurts. We'll bounce back."],
  UPCOMING_FIXTURES: ["I've been looking at the fixtures ahead."],
  FAVORABLE_FIXTURE: ["This fixture looks good for me."],
  TOUGH_FIXTURE: ["Tough fixture — I'll need to be at my best."],
  TEAM_STREAK: ["The team's current run is on my mind."],
  PLAYER_REPLY: ["Got your message. I'll keep working."],
};

function fill(template: string, ctx: MessageContext): string {
  return template
    .replace(/\{player_name\}/g, ctx.playerName)
    .replace(/\{position\}/g, ctx.position || "the team")
    .replace(/\{points\}/g, String(ctx.points ?? 0))
    .replace(/\{goals\}/g, String(ctx.goals ?? 0))
    .replace(/\{assists\}/g, String(ctx.assists ?? 0))
    .replace(/\{manager\}/g, ctx.managerName.split(/\s+/)[0] || "gaffer")
    .replace(/\{opponent\}/g, ctx.opponent || "the next lot")
    .replace(/\{fixtureNote\}/g, ctx.fixtureNote || "I'm ready for whatever comes.");
}

export type ReplySentiment = "positive" | "negative" | "neutral";

export function analyzeReplySentiment(reply: string): ReplySentiment {
  const text = String(reply || "").toLowerCase();
  const positive = /\b(thanks|thank you|great|class|brilliant|keep it|well done|love|yes|proud|unreal|buzzing|good job|legend)\b/;
  const negative = /\b(poor|bench|drop|disappointed|not good|useless|bad|awful|must do better|not enough|cut)\b/;
  if (positive.test(text) && !negative.test(text)) return "positive";
  if (negative.test(text) && !positive.test(text)) return "negative";
  return "neutral";
}

const REPLY_TEMPLATES: Record<ReplySentiment, Record<MessageLanguage, string[]>> = {
  positive: {
    English: [
      "That means a lot, {manager}. I'll keep delivering for this club.",
      "Appreciate that, gaffer. The lads are buzzing — watch this space.",
      "Your confidence means everything. I'll give you 100% every week.",
    ],
    French: [
      "Ça me touche, {manager}. Je vais continuer à tout donner.",
      "Merci coach. Le groupe est chaud, on enchaîne.",
      "Ta confiance, ça compte. Je sors le maximum chaque semaine.",
    ],
    Spanish: [
      "Eso vale mucho, {manager}. Voy a seguir dejando todo.",
      "Gracias, míster. El vestuario está arriba.",
      "Tu confianza es todo. Cien por cien cada semana.",
    ],
  },
  negative: {
    English: [
      "Heard, {manager}. I need to be better and I will be.",
      "Message received. I'll put it right on the training ground.",
      "You're right. Watch me respond next time out.",
    ],
    French: [
      "Compris, {manager}. Je dois être meilleur, et je le serai.",
      "Message reçu. Je corrige ça à l'entraînement.",
      "T'as raison. Je réponds dès le prochain match.",
    ],
    Spanish: [
      "Enterado, {manager}. Tengo que estar mejor, y lo estaré.",
      "Mensaje recibido. Lo enderezo en los entrenos.",
      "Tienes razón. Respondo el próximo partido.",
    ],
  },
  neutral: {
    English: [
      "Got it, {manager}. I'll stay ready.",
      "Understood, gaffer. See you on the grass.",
      "Noted. I'll keep working.",
    ],
    French: [
      "Bien reçu, {manager}. Je reste prêt.",
      "Compris, coach. On se voit sur le terrain.",
      "Noté. Je continue à bosser.",
    ],
    Spanish: [
      "Recibido, {manager}. Sigo listo.",
      "Entendido, míster. Nos vemos en el césped.",
      "Anotado. Sigo trabajando.",
    ],
  },
};

export function composePlayerReply(
  spoken: MessageLanguage,
  ctx: MessageContext,
  managerReply: string,
  seed: number,
): { content: string; translation: string | null; nativeLanguage: MessageLanguage } {
  const sentiment = analyzeReplySentiment(managerReply);
  const content = fill(pick(REPLY_TEMPLATES[sentiment][spoken], seed), ctx);
  const translation = spoken === "English"
    ? null
    : fill(pick(REPLY_TEMPLATES[sentiment].English, seed), ctx);
  return { content, translation, nativeLanguage: spoken };
}

export function composePlayerMessage(
  trigger: MessageTrigger,
  spoken: MessageLanguage,
  ctx: MessageContext,
  seed: number,
): { content: string; translation: string | null; nativeLanguage: MessageLanguage } {
  const content = fill(pick(TEMPLATES[trigger][spoken], seed), ctx);
  const translation = spoken === "English"
    ? null
    : fill(pick(TEMPLATES[trigger].English, seed), ctx);
  return { content, translation, nativeLanguage: spoken };
}

const SCOUT_FIRST = ["Rafa", "Inès", "Omar", "Lucía", "Nico", "Amina", "Pavel", "Sofia", "Kenji", "Marta"];
const SCOUT_LAST = ["Costa", "Berg", "Nwosu", "Kovács", "Silva", "Hart", "Okoye", "Moreau", "Rossi", "Nielsen"];

export function scoutDisplayName(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const first = SCOUT_FIRST[hash % SCOUT_FIRST.length] || "Rafa";
  const last = SCOUT_LAST[Math.floor(hash / SCOUT_FIRST.length) % SCOUT_LAST.length] || "Hart";
  return `${first} ${last}`;
}

export type ScoutablePlayer = {
  player_id: number;
  player_name: string;
  position: string;
  image_url?: string | null;
  total_points: number;
  points_per_game: number;
  goals: number;
  assists: number;
  expected_goals: number;
  expected_assists: number;
  expected_goal_involvements: number;
  expected_goals_conceded: number;
  clean_sheets: number;
  minutes: number;
  bonus: number;
  bps: number;
  creativity: number;
  influence: number;
  threat: number;
  ict_index: number;
  goals_conceded: number;
  penalties_saved: number;
  red_cards: number;
  saves: number;
  starts: number;
  form: number;
  chance_of_playing_next_round: number;
  ep_next: number;
  tackles: number;
  recoveries: number;
  clearances_blocks_interceptions: number;
  defensive_contribution: number;
  fixture_difficulty?: number | null;
  fixture_difficulties?: number[];
  owned_by?: string | null;
  status?: string | null;
  team_name?: string | null;
  now_cost?: number | null;
};

export const SCOUT_STAT_OPTIONS = [
  "PPG",
  "Points",
  "Form",
  "xG",
  "xA",
  "xGI",
  "Goals",
  "Assists",
  "Bonus",
  "BPS",
  "Creativity",
  "Influence",
  "Threat",
  "ICT",
  "Minutes",
  "Starts",
  "Clean Sheets",
  "Goals Conceded",
  "xGC",
  "Saves",
  "Penalties Saved",
  "Tackles",
  "Recoveries",
  "CBI",
  "Defensive Contribution",
  "EP Next",
  "Play Chance",
] as const;

const STAT_WEIGHTS: Record<string, keyof ScoutablePlayer> = {
  PPG: "points_per_game",
  Points: "total_points",
  Form: "form",
  xG: "expected_goals",
  xA: "expected_assists",
  xGI: "expected_goal_involvements",
  Goals: "goals",
  Assists: "assists",
  Bonus: "bonus",
  BPS: "bps",
  Creativity: "creativity",
  Influence: "influence",
  Threat: "threat",
  ICT: "ict_index",
  Minutes: "minutes",
  Starts: "starts",
  "Clean Sheets": "clean_sheets",
  "Goals Conceded": "goals_conceded",
  xGC: "expected_goals_conceded",
  Saves: "saves",
  "Penalties Saved": "penalties_saved",
  Tackles: "tackles",
  Recoveries: "recoveries",
  CBI: "clearances_blocks_interceptions",
  "Defensive Contribution": "defensive_contribution",
  "EP Next": "ep_next",
  "Play Chance": "chance_of_playing_next_round",
};

const INVERTED_STATS = new Set(["Goals Conceded", "xGC", "Red Cards"]);

export function normalizeStatFocus(raw: unknown): Record<string, boolean> {
  if (Array.isArray(raw)) {
    const out: Record<string, boolean> = {};
    raw.forEach((key) => {
      const name = String(key || "").trim();
      if (name) out[name] = true;
    });
    return out;
  }
  if (raw && typeof raw === "object") {
    const out: Record<string, boolean> = {};
    Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
      out[key] = Boolean(value);
    });
    return out;
  }
  return {};
}

const SCORE_WEIGHTS: Record<string, number> = {
  PPG: 0.3,
  Points: 0.2,
  Form: 0.2,
  xG: 0.15,
  xA: 0.15,
  xGI: 0.15,
  Goals: 0.1,
  Assists: 0.1,
  Bonus: 0.08,
  BPS: 0.08,
  Creativity: 0.08,
  Influence: 0.08,
  Threat: 0.08,
  ICT: 0.1,
  Minutes: 0.05,
  Starts: 0.05,
  "Clean Sheets": 0.1,
  "Goals Conceded": 0.08,
  xGC: 0.08,
  Saves: 0.1,
  "Penalties Saved": 0.12,
  Tackles: 0.08,
  Recoveries: 0.08,
  CBI: 0.08,
  "Defensive Contribution": 0.1,
  "EP Next": 0.12,
  "Play Chance": 0.08,
};

export type FixtureDifficultyPref = "Any" | "Easy" | "Medium" | "Hard";

export function fixtureDifficultyBand(avg: number | null | undefined): FixtureDifficultyPref {
  if (avg == null || !Number.isFinite(avg)) return "Any";
  if (avg <= 2.4) return "Easy";
  if (avg >= 3.6) return "Hard";
  return "Medium";
}

export function scoreScoutPlayer(
  player: ScoutablePlayer,
  statFocus: Record<string, boolean>,
  fixturePref: FixtureDifficultyPref = "Any",
): number {
  const enabled = Object.entries(normalizeStatFocus(statFocus)).filter(([, on]) => on).map(([key]) => key);
  const keys = enabled.length ? enabled : ["PPG", "Points"];
  let score = 0;
  let weightTotal = 0;
  keys.forEach((key) => {
    if (key.startsWith("_")) return;
    const field = STAT_WEIGHTS[key];
    const weight = SCORE_WEIGHTS[key] ?? 0.1;
    if (!field) return;
    const raw = Number(player[field] || 0);
    const value = INVERTED_STATS.has(key) ? Math.max(0, 10 - raw) : raw;
    score += value * weight;
    weightTotal += weight;
  });
  const unownedBonus = player.owned_by ? 0 : 0.4;
  const band = fixtureDifficultyBand(player.fixture_difficulty);
  const fixtureBonus =
    fixturePref === "Any" || band === "Any"
      ? (player.fixture_difficulty != null && player.fixture_difficulty <= 2.4 ? 0.15 : 0)
      : band === fixturePref
        ? 0.45
        : -0.25;
  const base = weightTotal > 0 ? score / weightTotal : 0;
  return Math.round((base + unownedBonus + fixtureBonus) * 100) / 100;
}

export function buildRecommendationText(player: ScoutablePlayer, managerName: string): string {
  const bits: string[] = [];
  bits.push(`I've been tracking ${player.player_name}.`);
  if (player.points_per_game >= 5) bits.push(`The PPG (${player.points_per_game.toFixed(1)}) is elite.`);
  else if (player.points_per_game >= 3.5) bits.push(`Solid ${player.points_per_game.toFixed(1)} PPG so far.`);
  if (player.goals + player.assists >= 3) bits.push(`They're involved: ${player.goals} goals, ${player.assists} assists.`);
  if (player.expected_goals >= 1.5) bits.push(`xG of ${player.expected_goals.toFixed(2)} says the chances are coming.`);
  if (player.clean_sheets >= 2) bits.push(`${player.clean_sheets} clean sheets is a nice foundation.`);
  if (player.form >= 6) bits.push(`Form of ${player.form.toFixed(1)} is catching the eye.`);
  if (player.bonus >= 8) bits.push(`${player.bonus} bonus points says the refs (and BPS) like them.`);
  if (player.defensive_contribution >= 20) bits.push("Defensive contribution numbers are stacking up.");
  if ((player.fixture_difficulty ?? 3) <= 2.4) bits.push("Upcoming fixtures look kind.");
  else if ((player.fixture_difficulty ?? 3) >= 3.6) bits.push("Fixtures tighten up, so timing matters.");
  if (player.owned_by) bits.push(`Currently at ${player.owned_by} — worth watching if they become available.`);
  else bits.push("Unowned right now. Could be a smart add.");
  bits.push(`I'd put them on your shortlist, ${managerName.split(/\s+/)[0]}.`);
  return bits.join(" ");
}
