import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LoginInput = z.object({
  pin: z.string().regex(/^\d{4}$/, "Bitte genau vier Ziffern eingeben."),
});

export const loginWithPin = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoginInput.parse(input))
  .handler(async ({ data }) => {
    const expectedPin = process.env.APP_PIN;
    if (!expectedPin) throw new Error("APP_PIN fehlt.");
    if (data.pin !== expectedPin) {
      throw new Error("Falscher Code");
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
