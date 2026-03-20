import {onRequest} from "firebase-functions/v2/https";
import {defineString} from "firebase-functions/params";
import * as admin from "firebase-admin";
import {TelegramUpdate} from "./types";
import {sendMessage} from "./services/telegram";
import {MSG_UNAUTHORIZED} from "./bot/messages";
import * as commands from "./bot/commands";

const telegramBotToken = defineString("TELEGRAM_BOT_TOKEN");
const ticktickClientId = defineString("TICKTICK_CLIENT_ID");
const ticktickClientSecret = defineString("TICKTICK_CLIENT_SECRET");
const telegramAllowedIds = defineString("TELEGRAM_ALLOWED_IDS");

if (!admin.apps.length) {
  admin.initializeApp();
}

export const telegramWebhook = onRequest(
  {region: "europe-central2"},
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(200).send("OK");
      return;
    }

    const update = req.body as TelegramUpdate;
    const message = update.message;

    if (!message?.text || !message.from) {
      res.status(200).send("OK");
      return;
    }

    const chatId = message.chat.id;
    const userId = message.from.id;
    const botToken = telegramBotToken.value();

    // Allowlist check — strip any non-digit chars to handle invisible characters from copy-paste
    const allowedIds = telegramAllowedIds.value().split(",").map((id) => id.replace(/\D/g, ""));
    if (!allowedIds.includes(String(userId))) {
      await sendMessage(botToken, chatId, MSG_UNAUTHORIZED);
      res.status(200).send("OK");
      return;
    }

    const oauthRedirectUri =
      `https://europe-central2-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/oauthCallback`;

    const ctx = {
      botToken,
      chatId,
      userId,
      firstName: message.from.first_name,
      allowedIds,
      clientId: ticktickClientId.value(),
      clientSecret: ticktickClientSecret.value(),
      oauthRedirectUri,
    };

    const text = message.text.trim();
    const [command, ...argParts] = text.split(" ");
    const args = argParts.join(" ");

    try {
      switch (command) {
      case "/start":
        await commands.handleStart(ctx);
        break;
      case "/login":
        await commands.handleLogin(ctx);
        break;
      case "/logout":
        await commands.handleLogout(ctx);
        break;
      case "/projects":
        await commands.handleProjects(ctx);
        break;
      case "/tasks":
        await commands.handleTasks(ctx, args);
        break;
      case "/add":
        await commands.handleAdd(ctx, args);
        break;
      case "/done":
        await commands.handleDone(ctx, args);
        break;
      default:
        // Anything that's not a command → add as task
        await commands.handleAdd(ctx, text);
      }
    } catch (err) {
      console.error("Command error:", err);
      const errorMsg = err instanceof Error ? err.message : "Nieznany błąd";
      if (errorMsg.includes("401")) {
        await sendMessage(botToken, chatId, "Sesja wygasła. Użyj /login aby zalogować się ponownie.");
      } else {
        await sendMessage(botToken, chatId, `Błąd: ${errorMsg}`);
      }
    }

    res.status(200).send("OK");
  },
);
