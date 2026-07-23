/** Two hardcoded users — passwords come from environment variables. */
export type Role = "admin" | "operator";

export interface AppUser {
  username: string;
  role: Role;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export function resolveUser(username: string, password: string): AppUser | null {
  if (username === "admin" && password === requireEnv("ADMIN_PASSWORD")) {
    return { username: "admin", role: "admin" };
  }
  if (username === "operator" && password === requireEnv("OPERATOR_PASSWORD")) {
    return { username: "operator", role: "operator" };
  }
  return null;
}
