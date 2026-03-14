import {onRequest} from "firebase-functions/v2/https";
import {defineString} from "firebase-functions/params";
import * as admin from "firebase-admin";
import {saveToken} from "./services/firestore";
import {sendMessage} from "./services/telegram";
import {MSG_LOGGED_IN} from "./bot/messages";
import {TickTickTokenData} from "./types";

const ticktickClientId = defineString("TICKTICK_CLIENT_ID");
const ticktickClientSecret = defineString("TICKTICK_CLIENT_SECRET");
const telegramBotToken = defineString("TELEGRAM_BOT_TOKEN");

// Initialize admin if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

export const oauthCallback = onRequest(
  {region: "europe-central2"},
  async (req, res) => {
    const code = req.query.code as string;
    const chatId = req.query.state as string;

    if (!code || !chatId) {
      res.status(400).send("Missing code or state parameter.");
      return;
    }

    const redirectUri =
      `https://europe-central2-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/oauthCallback`;

    // Exchange code for token
    const tokenRes = await fetch("https://ticktick.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " +
          Buffer.from(
            `${ticktickClientId.value()}:${ticktickClientSecret.value()}`,
          ).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      res.status(500).send(`Token exchange failed: ${errorText}`);
      return;
    }

    const tokenData = (await tokenRes.json()) as TickTickTokenData;
    tokenData.saved_at = Date.now();
    await saveToken(tokenData);

    // Notify user via Telegram
    await sendMessage(telegramBotToken.value(), parseInt(chatId, 10), MSG_LOGGED_IN);

    res.send("Zalogowano! Możesz wrócić do Telegrama.");
  },
);
