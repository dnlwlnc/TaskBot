# TaskBot

Prywatny bot Telegram do zarządzania zadaniami w [TickTick](https://ticktick.com) — napisz co masz do zrobienia, a zadanie pojawi się od razu na liście.

## Jak działa

Wystarczy napisać wiadomość. Bot automatycznie wykrywa daty i godziny w języku polskim i ustawia due date.

```
Ty:  Kupić mleko
Bot: ✓ Kupić mleko

Ty:  Zadzwonić do dentysty w piątek
Bot: ✓ Zadzwonić do dentysty (📅 2026-03-20)

Ty:  Spotkanie jutro na 7:30
Bot: ✓ Spotkanie (📅 2026-03-17 ⏰ 07:30)

Ty:  Wizyta lekarska 20 marca o 14:00
Bot: ✓ Wizyta lekarska (📅 2026-03-20 ⏰ 14:00)
```

### Obsługiwane formaty dat i godzin

- Dni tygodnia: *w piątek*, *we wtorek*, *w środę*
- Daty względne: *jutro*, *pojutrze*, *za tydzień*, *za 3 dni*
- Daty bezwzględne: *20 marca*, *5 kwietnia*
- Miesiące: *stycznia* ... *grudnia* (odmiana polska)
- Godziny: *na 7:30*, *o 14:00*, *o godz. 9:00*
- Kombinacje: *jutro na 7:30*, *w piątek o 14:00*

Strefa czasowa (CET/CEST) wykrywana automatycznie.

## Komendy

| Komenda | Opis |
|---------|------|
| `/tasks` | Lista aktywnych zadań z domyślnego projektu |
| `/tasks <projekt>` | Lista zadań z wybranego projektu |
| `/done <nr>` | Oznacz zadanie jako ukończone (numer z listy `/tasks`) |
| `/projects` | Lista projektów TickTick |
| `/login` | Połącz konto TickTick (OAuth2) |
| `/logout` | Rozłącz konto |
| `/start` | Powitanie i lista komend |

Wszystko co nie jest komendą traktowane jest jako nowe zadanie.

### Powiadomienia

Gdy ktoś doda zadanie, pozostali użytkownicy z `TELEGRAM_ALLOWED_IDS` dostają powiadomienie:

```
📌 Ania: Kupić mleko (📅 2026-03-18 ⏰ 09:00)
```

## Stack

- **Firebase Cloud Functions** (Node.js 20, 2nd gen) — logika bota i OAuth2 callback
- **Cloud Firestore** — przechowywanie tokenu OAuth2 i cache zadań
- **Telegram Bot API** — interfejs użytkownika
- **TickTick Open API** — zarządzanie zadaniami (CRUD)
- **chrono-node** — parsowanie dat i godzin w języku naturalnym

## Architektura

```
Telegram
   │ webhook
   ▼
Cloud Function: telegramWebhook  ──▶  TickTick API
        │
        ▼
   Firestore (token, cache)

Cloud Function: oauthCallback  ◀──  TickTick OAuth2
```

### Dostęp

Bot jest prywatny — akceptuje wiadomości tylko od użytkowników z listy `TELEGRAM_ALLOWED_IDS`. Wszyscy pozostali dostają "Brak dostępu."

## Setup

### Wymagania

- Firebase CLI (`npm install -g firebase-tools`)
- Projekt Firebase z Blaze Plan
- Konto deweloperskie [TickTick](https://developer.ticktick.com)
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

### 3. Zmienne środowiskowe

Utwórz plik `functions/.env.denver-task-bot`:

```env
TELEGRAM_BOT_TOKEN=<token z @BotFather>
TICKTICK_CLIENT_ID=<client id z developer.ticktick.com>
TICKTICK_CLIENT_SECRET=<client secret>
TELEGRAM_ALLOWED_IDS=<id1>,<id2>
```

Telegram ID sprawdzisz przez [@userinfobot](https://t.me/userinfobot).

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

Napisz `/login` do bota, kliknij link, autoryzuj w TickTick. Gotowe — pisz zadania!
