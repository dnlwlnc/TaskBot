const TELEGRAM_API = "https://api.telegram.org/bot";

export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  parseMode: "Markdown" | "HTML" = "Markdown",
): Promise<void> {
  const url = `${TELEGRAM_API}${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
  }
}
