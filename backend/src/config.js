import { env } from "cloudflare:workers";

const required = ["JWT_SECRET", "SETUP_TOKEN"];

export function validateConfig() {
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  if (env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
}

export const config = {
  get frontendOrigins() { return (env.FRONTEND_ORIGIN || "http://localhost:5173").split(",").map((value) => value.trim()); },
  get jwtSecret() { return env.JWT_SECRET; },
  get setupToken() { return env.SETUP_TOKEN; },
  get jwtExpiresIn() { return env.JWT_EXPIRES_IN || "8h"; }
};
