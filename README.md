# TaskBot

Prywatny bot Telegram do zarządzania zadaniami w [TickTick](https://ticktick.com) — napisz co masz do zrobienia, a zadanie pojawi się od razu na liście.

## Jak działa

Wystarczy napisać wiadomość. Bot automatycznie wykrywa daty w języku polskim i ustawia due date.

```
Ty:  Kupić mleko
Bot: ✓ Kupić mleko

Ty:  Zadzwonić do dentysty w piątek
Bot: ✓ Zadzwonić do dentysty (📅 2026-03-20)

Ty:  Wizyta lekarska 20 marca
Bot: ✓ Wizyta lekarska (📅 2026-03-20)
```

## Komendy

| Komenda | Opis |
|---------|------|
| `/tasks` | Lista aktywnych zadań z domyślnego projektu |
| `/tasks <projekt>` | Lista zadań z wybranego projektu |
| `/done <nr>` | Oznacz zadanie jako ukończone |
| `/projects` | Lista projektów |
| `/login` | Połącz konto TickTick (OAuth2) |
| `/logout` | Rozłącz konto |

## Stack

- **Firebase Cloud Functions** (Node.js 20, 2nd gen) — logika bota i OAuth2 callback
- **Cloud Firestore** — przechowywanie tokenów i cache zadań
- **Telegram Bot API** — interfejs użytkownika
- **TickTick Open API** — zarządzanie zadaniami
- **chrono-node** — parsowanie dat w języku naturalnym

## Infrastruktura

```
Telegram
   │ webhook
   ▼
Cloud Function: telegramWebhook  ──▶  TickTick API
        │
        ▼
   Firestore

Cloud Function: oauthCallback  ◀──  TickTick OAuth2
```

## Setup

### Wymagania

- Firebase CLI (`npm install -g firebase-tools`)
- Projekt Firebase z Blaze Plan
- Konto deweloperskie TickTick
- Bot Telegram ([@BotFather](https://t.me/BotFather))

### 1. Klonowanie i instalacja

```bash
git clone https://github.com/dnlwlnc/TaskBot.git
cd TaskBot
npm --prefix functions install
```

### 2. Konfiguracja Firebase

```bash
firebase login
firebase use denver-task-bot
```

### 3. Sekrety

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TICKTICK_CLIENT_ID
firebase functions:secrets:set TICKTICK_CLIENT_SECRET
firebase functions:secrets:set TELEGRAM_ALLOWED_IDS   # np. 123456789,987654321
```

Redirect URI do wpisania w panelu TickTick Developer:
```
https://europe-central2-denver-task-bot.cloudfunctions.net/oauthCallback
```

### 4. Deploy

```bash
firebase deploy --only functions,firestore
```

### 5. Ustawienie webhooka

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://europe-central2-denver-task-bot.cloudfunctions.net/telegramWebhook"
```

### 6. Pierwsze uruchomienie

Napisz `/login` do bota, kliknij link, autoryzuj w TickTick. Gotowe.
