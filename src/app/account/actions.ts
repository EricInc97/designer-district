"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TicketKind } from "@/lib/types";

export type ActionResult = { ok: boolean; message: string } | null;

/** Settings page. RLS + the guard trigger stop role/credit from being touched. */
export async function updateProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "You are signed out." };

  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: str("full_name"),
      phone: str("phone"),
      address_line1: str("address_line1"),
      address_line2: str("address_line2"),
      city: str("city"),
      state: str("state"),
      postal_code: str("postal_code"),
      country: str("country"),
    })
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/account");
  return { ok: true, message: "Saved." };
}

/**
 * Changing the login email sends a confirmation link to the new address -
 * Supabase does not switch it over until that link is clicked.
 */
export async function updateEmail(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Enter an email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email });

  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    message: `Confirmation sent to ${email}. Your login stays the same until you confirm.`,
  };
}

/** Opens a support ticket and drops the customer straight into its chat. */
export async function createTicket(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/account/tickets");

  const kind = String(formData.get("kind") ?? "general") as TicketKind;
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const orderId = String(formData.get("order_id") ?? "").trim() || null;
  const orderItemId = String(formData.get("order_item_id") ?? "").trim() || null;

  if (!subject || !body) redirect("/account/tickets?error=missing");

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      user_id: user.id,
      order_id: orderId,
      order_item_id: orderItemId,
      kind,
      subject,
      // Money and faults jump the queue; general questions do not.
      priority: kind === "refund" || kind === "complaint" ? "high" : "normal",
    })
    .select("id")
    .single();

  if (error || !ticket) redirect("/account/tickets?error=failed");

  await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    is_staff: false,
    body,
  });

  revalidatePath("/account/tickets");
  redirect(`/account/tickets/${ticket.id}`);
}

export async function closeTicket(formData: FormData) {
  const id = String(formData.get("ticket_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("tickets").update({ status: "closed" }).eq("id", id);

  revalidatePath(`/account/tickets/${id}`);
  revalidatePath("/account/tickets");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
