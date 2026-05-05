import type { SupabaseClient } from "@supabase/supabase-js";

export const TRIAL_DAYS = 30;

export type AccessAuthType = "email_password" | "test_code";
export type AccessType = "trial_30d" | "permanent";

export type AccessPolicyRow = {
  id: string;
  identifier: string;
  auth_type: AccessAuthType;
  access_type: AccessType;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
};

export type AccessCheckResult = {
  allowed: boolean;
  reason:
    | "ok"
    | "not_found"
    | "inactive"
    | "not_started"
    | "expired"
    | "invalid_window";
  policy: AccessPolicyRow | null;
};

export function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toIso(date: Date) {
  return date.toISOString();
}

function evaluatePolicyWindow(policy: AccessPolicyRow, now: Date): AccessCheckResult {
  if (!policy.is_active) {
    return { allowed: false, reason: "inactive", policy };
  }

  if (policy.access_type === "permanent") {
    return { allowed: true, reason: "ok", policy };
  }

  const startsAt = policy.starts_at ? new Date(policy.starts_at) : null;
  const expiresAt = policy.expires_at ? new Date(policy.expires_at) : null;

  if (!startsAt && !expiresAt) {
    return { allowed: false, reason: "not_started", policy };
  }

  if (!startsAt || !expiresAt) {
    return { allowed: false, reason: "invalid_window", policy };
  }

  if (startsAt > now) {
    return { allowed: false, reason: "not_started", policy };
  }

  if (expiresAt <= now) {
    return { allowed: false, reason: "expired", policy };
  }

  return { allowed: true, reason: "ok", policy };
}

export async function getAccessPolicyByIdentifier(
  admin: SupabaseClient,
  identifier: string,
  authType: AccessAuthType,
) {
  const normalized = normalizeIdentifier(identifier);

  const { data, error } = await admin
    .from("access_policies")
    .select("id,identifier,auth_type,access_type,starts_at,expires_at,is_active")
    .eq("identifier", normalized)
    .eq("auth_type", authType)
    .maybeSingle<AccessPolicyRow>();

  if (error) throw error;
  return data;
}

export async function ensureAccessForIdentifier(
  admin: SupabaseClient,
  identifier: string,
  authType: AccessAuthType,
  opts?: { autoStartTrial?: boolean; now?: Date },
): Promise<AccessCheckResult> {
  const now = opts?.now ?? new Date();
  const autoStartTrial = opts?.autoStartTrial ?? false;

  const policy = await getAccessPolicyByIdentifier(admin, identifier, authType);
  if (!policy) {
    return { allowed: false, reason: "not_found", policy: null };
  }

  if (policy.access_type === "trial_30d" && !policy.starts_at && !policy.expires_at && autoStartTrial) {
    const startsAtIso = toIso(now);
    const expiresAtIso = toIso(addDays(now, TRIAL_DAYS));
    const { data: updated, error: updateError } = await admin
      .from("access_policies")
      .update({
        starts_at: startsAtIso,
        expires_at: expiresAtIso,
      })
      .eq("id", policy.id)
      .select("id,identifier,auth_type,access_type,starts_at,expires_at,is_active")
      .single<AccessPolicyRow>();

    if (updateError) throw updateError;
    return evaluatePolicyWindow(updated, now);
  }

  return evaluatePolicyWindow(policy, now);
}

export function getAccessDeniedMessage(result: AccessCheckResult) {
  if (result.reason === "expired") {
    return "Your test period has expired. Contact administrator.";
  }
  if (result.reason === "not_found" || result.reason === "inactive") {
    return "Your account is not allowed.";
  }
  if (result.reason === "not_started") {
    return "Your account is not activated yet.";
  }
  return "Access policy error. Contact administrator.";
}
