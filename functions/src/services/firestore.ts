import * as admin from "firebase-admin";
import {TickTickTokenData} from "../types";

function db() {
  return admin.firestore();
}

const TOKEN_DOC = "config/ticktick_token";
const TASK_CACHE_DOC = "config/last_tasks";

export async function saveToken(data: TickTickTokenData): Promise<void> {
  await db().doc(TOKEN_DOC).set(data);
}

export async function getToken(): Promise<TickTickTokenData | null> {
  const snap = await db().doc(TOKEN_DOC).get();
  return snap.exists ? (snap.data() as TickTickTokenData) : null;
}

export async function deleteToken(): Promise<void> {
  await db().doc(TOKEN_DOC).delete();
}

/** Save last fetched task list so /done can reference by number */
export async function saveTaskCache(
  tasks: Array<{id: string; projectId: string; title: string}>,
): Promise<void> {
  await db().doc(TASK_CACHE_DOC).set({tasks});
}

export async function getTaskCache(): Promise<
  Array<{id: string; projectId: string; title: string}> | null
> {
  const snap = await db().doc(TASK_CACHE_DOC).get();
  if (!snap.exists) return null;
  return (snap.data() as {tasks: Array<{id: string; projectId: string; title: string}>}).tasks;
}
