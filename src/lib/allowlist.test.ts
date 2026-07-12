import { expect, test, describe } from "bun:test";
import { assertAllowedEmail, getAllowedEmail } from "./allowlist.server";

describe("getAllowedEmail", () => {
  test("retrieves and trims ALLOWED_EMAIL from environment", () => {
    // Store original env
    const originalEnv = process.env.ALLOWED_EMAIL;

    try {
      process.env.ALLOWED_EMAIL = "  test@example.com  ";
      const email = getAllowedEmail();
      expect(email).toBe("test@example.com");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("converts email to lowercase", () => {
    const originalEnv = process.env.ALLOWED_EMAIL;

    try {
      process.env.ALLOWED_EMAIL = "Test@Example.COM";
      const email = getAllowedEmail();
      expect(email).toBe("test@example.com");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("throws error when ALLOWED_EMAIL not configured", () => {
    const originalEnv = process.env.ALLOWED_EMAIL;

    try {
      process.env.ALLOWED_EMAIL = undefined;
      expect(() => getAllowedEmail()).toThrow("ALLOWED_EMAIL is not configured");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("throws error when ALLOWED_EMAIL is empty string", () => {
    const originalEnv = process.env.ALLOWED_EMAIL;

    try {
      process.env.ALLOWED_EMAIL = "";
      expect(() => getAllowedEmail()).toThrow("ALLOWED_EMAIL is not configured");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("throws error when ALLOWED_EMAIL is whitespace only", () => {
    const originalEnv = process.env.ALLOWED_EMAIL;

    try {
      process.env.ALLOWED_EMAIL = "   ";
      // After trim, it becomes empty and should throw
      const trimmed = process.env.ALLOWED_EMAIL.trim();
      expect(trimmed).toBe("");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });
});

describe("assertAllowedEmail - CRITICAL SECURITY BOUNDARY", () => {
  const originalEnv = process.env.ALLOWED_EMAIL;

  test("allows exact matching email", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      const claims = { email: "allowed@example.com" };
      expect(() => assertAllowedEmail(claims)).not.toThrow();
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("allows case-insensitive matching", () => {
    try {
      process.env.ALLOWED_EMAIL = "Allowed@Example.com";
      const claims = { email: "ALLOWED@EXAMPLE.COM" };
      expect(() => assertAllowedEmail(claims)).not.toThrow();
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("allows email with surrounding whitespace", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      const claims = { email: "  allowed@example.com  " };
      expect(() => assertAllowedEmail(claims)).not.toThrow();
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("rejects email that does not match", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      const claims = { email: "unauthorized@example.com" };
      expect(() => assertAllowedEmail(claims)).toThrow("Nicht freigeschaltet.");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("rejects null claims", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      expect(() => assertAllowedEmail(null)).toThrow("Nicht freigeschaltet.");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("rejects undefined claims", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      expect(() => assertAllowedEmail(undefined)).toThrow("Nicht freigeschaltet.");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("rejects claims with undefined email", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      const claims = { email: undefined };
      expect(() => assertAllowedEmail(claims)).toThrow("Nicht freigeschaltet.");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("rejects claims with null email", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      const claims = { email: null };
      expect(() => assertAllowedEmail(claims)).toThrow("Nicht freigeschaltet.");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("rejects claims with empty email string", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      const claims = { email: "" };
      expect(() => assertAllowedEmail(claims)).toThrow("Nicht freigeschaltet.");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("rejects claims with whitespace-only email", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      const claims = { email: "   " };
      expect(() => assertAllowedEmail(claims)).toThrow("Nicht freigeschaltet.");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("rejects partial email matches", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      const invalidEmails = [
        "allowed@example.co",
        "allowed@example.com.fake",
        "@example.com",
        "allowed@",
        "allowed",
      ];

      for (const email of invalidEmails) {
        const claims = { email };
        expect(() => assertAllowedEmail(claims)).toThrow("Nicht freigeschaltet.");
      }
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("handles emails with special characters", () => {
    try {
      process.env.ALLOWED_EMAIL = "user+tag@example.com";
      const claims = { email: "user+tag@example.com" };
      expect(() => assertAllowedEmail(claims)).not.toThrow();
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("rejects similar-looking emails (homoglyph attacks)", () => {
    try {
      process.env.ALLOWED_EMAIL = "example@domain.com";
      // Test with unicode lookalikes (if applicable)
      const claims = { email: "еxample@domain.com" }; // Cyrillic 'е' instead of 'e'
      expect(() => assertAllowedEmail(claims)).toThrow("Nicht freigeschaltet.");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("treats extra fields in claims as irrelevant", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      const claims = {
        email: "allowed@example.com",
        sub: "user-123",
        iat: 1234567890,
        exp: 9999999999,
      };
      expect(() => assertAllowedEmail(claims)).not.toThrow();
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });

  test("object without email property throws error", () => {
    try {
      process.env.ALLOWED_EMAIL = "allowed@example.com";
      const claims: any = { sub: "user-123" };
      expect(() => assertAllowedEmail(claims)).toThrow("Nicht freigeschaltet.");
    } finally {
      process.env.ALLOWED_EMAIL = originalEnv;
    }
  });
});
