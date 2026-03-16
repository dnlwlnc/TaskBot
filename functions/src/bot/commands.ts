import * as chrono from "chrono-node";
import {sendMessage} from "../services/telegram";
import * as store from "../services/firestore";
import * as ticktick from "../services/ticktick";
import * as msg from "./messages";

interface CommandContext {
  botToken: string;
  chatId: number;
  clientId: string;
  clientSecret: string;
  oauthRedirectUri: string;
}

export async function handleStart(ctx: CommandContext): Promise<void> {
  await sendMessage(ctx.botToken, ctx.chatId, msg.MSG_START);
}

export async function handleLogin(ctx: CommandContext): Promise<void> {
  const params = new URLSearchParams({
    client_id: ctx.clientId,
    redirect_uri: ctx.oauthRedirectUri,
    response_type: "code",
    scope: "tasks:read tasks:write",
    state: String(ctx.chatId),
  });
  const url = `https://ticktick.com/oauth/authorize?${params}`;
  await sendMessage(
    ctx.botToken,
    ctx.chatId,
    `[Kliknij tutaj, aby zalogować się do TickTick](${url})`,
  );
}

export async function handleLogout(ctx: CommandContext): Promise<void> {
  await store.deleteToken();
  await sendMessage(ctx.botToken, ctx.chatId, msg.MSG_LOGGED_OUT);
}

export async function handleProjects(ctx: CommandContext): Promise<void> {
  const token = await requireToken(ctx);
  if (!token) return;

  const projects = await ticktick.getProjects(token);
  if (projects.length === 0) {
    await sendMessage(ctx.botToken, ctx.chatId, "Brak projektów.");
    return;
  }
  const lines = projects.map((p, i) => `${i + 1}. ${p.name}`);
  await sendMessage(ctx.botToken, ctx.chatId, lines.join("\n"));
}

export async function handleTasks(
  ctx: CommandContext,
  args: string,
): Promise<void> {
  const token = await requireToken(ctx);
  if (!token) return;

  const DEFAULT_PROJECT_ID = "69626abde3c911257fd7dee6";
  const projects = await ticktick.getProjects(token);
  let targetProject = projects.find((p) => p.id === DEFAULT_PROJECT_ID) ?? projects[0];

  if (args.trim()) {
    const found = projects.find(
      (p) => p.name.toLowerCase() === args.trim().toLowerCase(),
    );
    if (!found) {
      await sendMessage(
        ctx.botToken,
        ctx.chatId,
        `Nie znaleziono projektu "${args.trim()}". Użyj /projects aby zobaczyć listę.`,
      );
      return;
    }
    targetProject = found;
  }

  if (!targetProject) {
    await sendMessage(ctx.botToken, ctx.chatId, "Brak projektów.");
    return;
  }

  const data = await ticktick.getProjectData(token, targetProject.id);
  const activeTasks = data.tasks.filter((t) => t.status === 0);

  if (activeTasks.length === 0) {
    await sendMessage(ctx.botToken, ctx.chatId, msg.MSG_NO_TASKS);
    return;
  }

  // Cache tasks for /done command
  await store.saveTaskCache(
    activeTasks.map((t) => ({id: t.id, projectId: t.projectId, title: t.title})),
  );

  const lines = activeTasks.map((t, i) => {
    let line = `${i + 1}. ${t.title}`;
    if (t.dueDate) {
      line += ` (📅 ${t.dueDate.substring(0, 10)})`;
    }
    return line;
  });

  await sendMessage(
    ctx.botToken,
    ctx.chatId,
    `*${targetProject.name}*\n\n${lines.join("\n")}`,
  );
}

export async function handleAdd(
  ctx: CommandContext,
  args: string,
): Promise<void> {
  const token = await requireToken(ctx);
  if (!token) return;

  if (!args.trim()) return;

  // Auto-detect date from natural language (with Polish→English translation)
  let title = args.trim();
  let dueDate: string | undefined;
  const translated = translatePolishDates(title);
  const parsed = chrono.casual.parse(translated, new Date(), {forwardDate: true})[0];
  if (parsed) {
    const hasTime = parsed.start.isCertain("hour");
    dueDate = toISODateTime(parsed.date(), hasTime);
    // Remove the original Polish date text from title using same position
    title = (title.slice(0, parsed.index) + title.slice(parsed.index + parsed.text.length)).trim();
  }

  const DEFAULT_PROJECT_ID = "69626abde3c911257fd7dee6";
  const projects = await ticktick.getProjects(token);
  const defaultProject = projects.find((p) => p.id === DEFAULT_PROJECT_ID) ?? projects[0];
  const task = await ticktick.createTask(token, title, defaultProject?.id, dueDate);
  let reply = `✓ ${task.title}`;
  if (task.dueDate) {
    reply += ` (📅 ${task.dueDate.substring(0, 10)}`;
    if (task.dueDate.includes("T") && !task.dueDate.includes("T00:00:00")) {
      reply += ` ⏰ ${task.dueDate.substring(11, 16)}`;
    }
    reply += ")";
  }
  await sendMessage(ctx.botToken, ctx.chatId, reply);
}

export async function handleDone(
  ctx: CommandContext,
  args: string,
): Promise<void> {
  const token = await requireToken(ctx);
  if (!token) return;

  const num = parseInt(args.trim(), 10);
  if (isNaN(num) || num < 1) {
    await sendMessage(
      ctx.botToken,
      ctx.chatId,
      "Użycie: /done <numer> (numer z listy /tasks)",
    );
    return;
  }

  const cache = await store.getTaskCache();
  if (!cache || num > cache.length) {
    await sendMessage(
      ctx.botToken,
      ctx.chatId,
      "Nie znaleziono zadania. Użyj /tasks aby odświeżyć listę.",
    );
    return;
  }

  const task = cache[num - 1];
  await ticktick.completeTask(token, task.projectId, task.id);
  await sendMessage(ctx.botToken, ctx.chatId, `Ukończono: ${task.title}`);
}

// --- Helpers ---

async function requireToken(ctx: CommandContext): Promise<string | null> {
  const tokenData = await store.getToken();
  if (!tokenData) {
    await sendMessage(ctx.botToken, ctx.chatId, msg.MSG_NOT_LOGGED_IN);
    return null;
  }
  return tokenData.access_token;
}


function getWarsawOffset(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Warsaw",
    timeZoneName: "shortOffset",
  });
  const parts = fmt.formatToParts(d);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const match = tz.match(/GMT([+-])(\d+)/);
  if (match) {
    return `${match[1]}${match[2].padStart(2, "0")}00`;
  }
  return "+0100";
}

function toISODateTime(d: Date, includeTime: boolean): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (!includeTime) {
    return `${yyyy}-${mm}-${dd}T00:00:00.000+0000`;
  }
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const offset = getWarsawOffset(d);
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00.000${offset}`;
}

function translatePolishDates(text: string): string {
  const map: [RegExp, string][] = [
    [/\bdzisiaj\b/gi, "today"],
    [/\bdziś\b/gi, "today"],
    [/\bjutro\b/gi, "tomorrow"],
    [/\bpojutrze\b/gi, "in 2 days"],
    [/\bponiedzialek\b|\bponiedzialek\b/gi, "monday"],
    [/\bponiedziałek\b/gi, "monday"],
    [/\bwtorek\b/gi, "tuesday"],
    [/\bśrodę\b|\bsrodę\b|\bśroda\b|\bsroda\b|\bw środę\b/gi, "wednesday"],
    [/\bczwartek\b/gi, "thursday"],
    [/\bpiątek\b|\bpiatek\b/gi, "friday"],
    [/\bsobotę\b|\bsobota\b|\bsobote\b/gi, "saturday"],
    [/\bniedzielę\b|\bniedziela\b|\bniedziele\b/gi, "sunday"],
    [/\bstyczeń\b|\bstycznia\b/gi, "january"],
    [/\blutego\b|\bluty\b/gi, "february"],
    [/\bmarca\b|\bmarzec\b/gi, "march"],
    [/\bkwietnia\b|\bkwiecień\b/gi, "april"],
    [/\bmaja\b|\bmaj\b/gi, "may"],
    [/\bczerwca\b|\bczerwiec\b/gi, "june"],
    [/\blipca\b|\blipiec\b/gi, "july"],
    [/\bsierpnia\b|\bsierpień\b/gi, "august"],
    [/\bwrześnia\b|\bwrzesień\b/gi, "september"],
    [/\bpaździernika\b|\bpaździernik\b/gi, "october"],
    [/\blistopada\b|\blistopad\b/gi, "november"],
    [/\bgrudnia\b|\bgrudzień\b/gi, "december"],
    [/\bza tydzień\b/gi, "next week"],
    [/\bza miesiąc\b/gi, "next month"],
    [/\bza (\d+) dni\b/gi, "in $1 days"],
    [/\bna (\d{1,2}[:.]\d{2})\b/gi, "at $1"],
    [/\bo (\d{1,2}[:.]\d{2})\b/gi, "at $1"],
    [/\bo godz\.?\s*(\d{1,2}[:.]\d{2})\b/gi, "at $1"],
  ];
  return map.reduce((t, [re, rep]) => t.replace(re, rep), text);
}
