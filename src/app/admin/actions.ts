"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export type AdminResult = { ok: boolean; message: string } | null;

const text = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/**
 * Create or update a product. RLS enforces products.manage, this never
 * second-guesses it, it just surfaces the database's answer.
 */
export async function saveProduct(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  const supabase = await createClient();

  const id = text(formData, "id");
  const name = text(formData, "name");
  const brandId = text(formData, "brand_id");
  const price = Number(formData.get("price"));

  if (!name) return { ok: false, message: "Name is required." };
  if (!brandId) return { ok: false, message: "Pick a brand." };
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, message: "Enter a valid price." };
  }

  const sizes = String(formData.get("sizes") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const payload = {
    name,
    brand_id: brandId,
    category_id: text(formData, "category_id"),
    description: text(formData, "description"),
    price,
    compare_at_price: formData.get("compare_at_price")
      ? Number(formData.get("compare_at_price"))
      : null,
    image_url: text(formData, "image_url") ?? `/ph/${slugify(name)}`,
    sizes: sizes.length > 0 ? sizes : ["S", "M", "L", "XL"],
    stock_count: Math.max(0, Number(formData.get("stock_count")) || 0),
    is_published: formData.get("is_published") === "on",
    is_featured: formData.get("is_featured") === "on",
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("products").update(payload).eq("id", id)
    : await supabase
        .from("products")
        .insert({ ...payload, slug: `${slugify(name)}-${Date.now().toString(36)}` });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true, message: id ? "Product updated." : "Product created." };
}

/** Publish toggle, split out so it can be granted separately from editing. */
export async function togglePublished(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const next = formData.get("next") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ is_published: next, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function deleteProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("products").delete().eq("id", id);

  revalidatePath("/admin/products");
  revalidatePath("/");
}

/** Status / priority / assignment from the ticket detail rail. */
export async function updateTicket(formData: FormData) {
  const id = String(formData.get("ticket_id") ?? "");
  if (!id) return;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const status = text(formData, "status");
  const priority = text(formData, "priority");
  const assign = formData.get("assign_to_me") === "true";

  if (status) patch.status = status;
  if (priority) patch.priority = priority;

  const supabase = await createClient();

  if (assign) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    patch.assigned_to = user?.id ?? null;
  }

  await supabase.from("tickets").update(patch).eq("id", id);

  revalidatePath(`/admin/tickets/${id}`);
  revalidatePath("/admin/tickets");
}

/** Store-credit refund. The scope check lives in the SQL function. */
export async function issueCredit(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  const ticketId = String(formData.get("ticket_id") ?? "");
  const amount = Number(formData.get("amount"));
  const note = text(formData, "note");

  if (!ticketId) return { ok: false, message: "Missing ticket." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter an amount above zero." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_store_credit", {
    p_ticket_id: ticketId,
    p_amount: amount,
    p_note: note,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
  return {
    ok: true,
    message: `Credit issued. New balance: $${Number(data).toFixed(2)}.`,
  };
}

/** Master-admin only: set a person's role and their exact scope set. */
export async function setStaffAccess(
  _prev: AdminResult,
  formData: FormData,
): Promise<AdminResult> {
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "customer") as UserRole;
  const scopes = formData.getAll("scopes").map(String);

  if (!userId) return { ok: false, message: "Missing user." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_access", {
    p_user_id: userId,
    p_role: role,
    p_scopes: scopes,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/staff");
  return { ok: true, message: "Access updated." };
}
