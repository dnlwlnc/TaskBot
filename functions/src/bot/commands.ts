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

  const projects = await ticktick.getProjects(token);
  let targetProject = projects[0]; // default: first project

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

  if (!args.trim()) {
    await sendMessage(ctx.botToken, ctx.chatId, "Użycie: /add <treść zadania> [--due <data>]");
    return;
  }

  // Parse --due flag
  let title = args.trim();
  let dueDate: string | undefined;
  const dueMatch = title.match(/--due\s+(\S+)/);
  if (dueMatch) {
    dueDate = parseDueDate(dueMatch[1]);
    title = title.replace(/--due\s+\S+/, "").trim();
  }

  const projects = await ticktick.getProjects(token);
  const defaultProject = projects[0];
  const task = await ticktick.createTask(token, title, defaultProject?.id, dueDate);
  let reply = `Dodano: ${task.title}`;
  if (task.dueDate) reply += ` (📅 ${task.dueDate.substring(0, 10)})`;
  if (defaultProject) reply += `\n_→ ${defaultProject.name}_`;
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

function parseDueDate(input: string): string {
  const now = new Date();
  switch (input.toLowerCase()) {
  case "today":
    return toISODate(now);
  case "tomorrow": {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  }
  default:
    // Assume ISO format (YYYY-MM-DD), pass through with time
    return `${input}T00:00:00.000+0000`;
  }
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T00:00:00.000+0000`;
}
