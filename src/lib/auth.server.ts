import { timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LoginInput = z.object({
  pin: z.string().regex(/^\d{4}$/, "Please enter exactly four digits."),
});

export const loginWithPin = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoginInput.parse(input))
  .handler(async ({ data }) => {
    const expectedPin = process.env.APP_PIN;
    if (!expectedPin) throw new Error("APP_PIN is missing.");
    const pinMatch =
      data.pin.length === expectedPin.length &&
      timingSafeEqual(Buffer.from(data.pin), Buffer.from(expectedPin));
    if (!pinMatch) {
      throw new Error("Wrong code");
    }
    const { loginCookie } = await import("./auth-session.server");
    loginCookie();
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutCookie } = await import("./auth-session.server");
  logoutCookie();
  return { ok: true as const };
});

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { isAuthenticated } = await import("./auth-session.server");
  return { authenticated: isAuthenticated() };
});
