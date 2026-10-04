"use server";

import { revalidatePath } from "next/cache";
import { setInboxDisconnected, currentUserId } from "@/lib/user";
import { writeAudit } from "@/lib/audit";
import { env } from "@/lib/env";

// Demo inbox connect/disconnect (a stub: the inbox is a read-only fixture).
// Disconnected means email facts are not used in findings or evidence.
export async function toggleInbox(formData: FormData) {
  const off = formData.get("off") === "1";
  const lang = String(formData.get("lang") ?? "en");
  await setInboxDisconnected(off);
  const userId = await currentUserId();
  if (userId && env.DATABASE_URL) {
    await writeAudit({ actor: "user", event: off ? "inbox.disconnected" : "inbox.reconnected", userId }).catch(() => {});
  }
  revalidatePath(`/${lang}/dashboard`);
}
