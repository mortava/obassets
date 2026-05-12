// Server-side env resolution. Used as a default credential source if the
// request body does not provide overrides.

import type { EncompassCredentials, EncompassEnv, EncompassGrantType } from "./encompass.types";

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function credsFromEnv(): Partial<EncompassCredentials> {
  return {
    env: (read("ENCOMPASS_ENV") as EncompassEnv | undefined) ?? "sandbox",
    grantType: (read("ENCOMPASS_GRANT_TYPE") as EncompassGrantType | undefined) ?? "client_credentials",
    clientId: read("ENCOMPASS_CLIENT_ID"),
    clientSecret: read("ENCOMPASS_CLIENT_SECRET"),
    instanceId: read("ENCOMPASS_INSTANCE_ID"),
    apiUser: read("ENCOMPASS_API_USER"),
    apiPassword: read("ENCOMPASS_API_PASSWORD"),
    scope: read("ENCOMPASS_SCOPE"),
    apiBaseUrl: read("ENCOMPASS_API_BASE_URL"),
    oauthBaseUrl: read("ENCOMPASS_OAUTH_BASE_URL"),
  };
}

export function envOrOverride<T extends Partial<EncompassCredentials>>(
  override: T
): EncompassCredentials {
  const fromEnv = credsFromEnv();
  const merged: Partial<EncompassCredentials> = { ...fromEnv, ...stripUndefined(override) };
  return merged as EncompassCredentials;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(o) as (keyof T)[]) {
    if (o[k] !== undefined && o[k] !== "") out[k] = o[k];
  }
  return out;
}
