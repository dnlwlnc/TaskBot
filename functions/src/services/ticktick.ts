import {TickTickProject, TickTickProjectData, TickTickTask} from "../types";

const BASE_URL = "https://api.ticktick.com/open/v1";

async function apiRequest<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TickTick API ${method} ${path}: ${res.status} ${text}`);
  }
  // Some endpoints return empty body (e.g. complete)
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export async function getProjects(token: string): Promise<TickTickProject[]> {
  return apiRequest<TickTickProject[]>(token, "GET", "/project");
}

export async function getProjectData(
  token: string,
  projectId: string,
): Promise<TickTickProjectData> {
  return apiRequest<TickTickProjectData>(token, "GET", `/project/${projectId}/data`);
}

export async function createTask(
  token: string,
  title: string,
  projectId?: string,
  dueDate?: string,
): Promise<TickTickTask> {
  const body: Record<string, unknown> = {title};
  if (projectId) body.projectId = projectId;
  if (dueDate) body.dueDate = dueDate;
  return apiRequest<TickTickTask>(token, "POST", "/task", body);
}

export async function completeTask(
  token: string,
  projectId: string,
  taskId: string,
): Promise<void> {
  await apiRequest<unknown>(
    token,
    "POST",
    `/project/${projectId}/task/${taskId}/complete`,
  );
}
