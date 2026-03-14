export const MSG_START =
  "Cześć! Jestem TaskBot — zarządzam Twoimi zadaniami w TickTick.\n\n" +
  "Dostępne komendy:\n" +
  "/login — połącz konto TickTick\n" +
  "/logout — rozłącz konto\n" +
  "/tasks — lista zadań\n" +
  "/projects — lista projektów\n" +
  "/add <treść> — dodaj zadanie\n" +
  "/done <nr> — oznacz jako ukończone";

export const MSG_NOT_LOGGED_IN =
  "Nie jesteś zalogowany. Użyj /login aby połączyć konto TickTick.";

export const MSG_LOGGED_IN = "Zalogowano pomyślnie! Możesz teraz używać /tasks i /add.";

export const MSG_LOGGED_OUT = "Wylogowano. Token TickTick został usunięty.";

export const MSG_NO_TASKS = "Brak zadań w tym projekcie.";

export const MSG_UNAUTHORIZED = "Brak dostępu.";
