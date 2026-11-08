"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import type { NotificationItem, SearchResult } from "@/types/database";

export async function globalSearchAction(query: string): Promise<ActionResult<SearchResult[]>> {
  return runAction(z.string().trim().max(80), query, async (q) => {
    await assertUser();
    if (q.length < 1) return ok([]);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("global_search", { p_query: q });
    if (error) throw error;
    return ok((data ?? []) as SearchResult[]);
  });
}

export async function getNotificationsAction(): Promise<ActionResult<NotificationItem[]>> {
  return runAction(z.undefined(), undefined, async () => {
    await assertUser();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_notifications");
    if (error) throw error;
    return ok((data ?? []) as NotificationItem[]);
  });
}

export async function markNotificationsReadAction(keys: string[]): Promise<ActionResult<null>> {
  return runAction(z.array(z.string().min(1).max(200)).max(300), keys, async (list) => {
    const user = await assertUser();
    if (!list.length) return ok(null);
    const supabase = await createClient();
    const { error } = await supabase
      .from("notification_reads")
      .upsert(list.map((k) => ({ user_id: user.id, notification_key: k })), { onConflict: "user_id,notification_key", ignoreDuplicates: true });
    if (error) throw error;
    return ok(null);
  });
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
