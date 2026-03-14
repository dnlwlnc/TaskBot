// Telegram types (subset we need)
export interface TelegramUpdate {
  message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from?: { id: number; first_name: string };
  chat: { id: number };
  text?: string;
}

// TickTick types
export interface TickTickProject {
  id: string;
  name: string;
  color?: string;
  sortOrder: number;
  kind?: string;
}

export interface TickTickTask {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  status: number; // 0 = active, 2 = completed
  priority: number; // 0 = none, 1 = low, 3 = medium, 5 = high
  dueDate?: string;
  startDate?: string;
  sortOrder: number;
}

export interface TickTickProjectData {
  project: TickTickProject;
  tasks: TickTickTask[];
}

export interface TickTickTokenData {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  saved_at: number;
}
