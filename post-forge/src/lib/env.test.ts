/**
 * env.ts fail-fast tests (T18 BRD §4.4).
 *
 * Pure unit tests over `env()`/`requireEnv()`/`requireOpenRouterKey()` --
 * no network, no Mongo. Uses `vi.stubEnv`/`vi.unstubAllEnvs` (vitest 5's
 * documented env-mocking API, https://vitest.dev/api/vi.html#vi-stubenv)
 * rather than mutating `process.env` directly, so each test's env changes
 * are automatically reverted.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { env, requireEnv, requireOpenRouterKey, MissingEnvError } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env()", () => {
  it("returns undefined for an unset var", () => {
    vi.stubEnv("SERPER_API_KEY", undefined as unknown as string);
    delete process.env.SERPER_API_KEY;
    expect(env("SERPER_API_KEY")).toBeUndefined();
  });

  it("treats an empty string as unset", () => {
    vi.stubEnv("SERPER_API_KEY", "");
    expect(env("SERPER_API_KEY")).toBeUndefined();
  });

  it("returns the value when set", () => {
    vi.stubEnv("SERPER_API_KEY", "test-key-123");
    expect(env("SERPER_API_KEY")).toBe("test-key-123");
  });
});

describe("requireEnv()", () => {
  it("throws a named MissingEnvError when the var is missing", () => {
    delete process.env.MONGODB_URI;
    expect(() => requireEnv("MONGODB_URI")).toThrow(MissingEnvError);
    try {
      requireEnv("MONGODB_URI");
      throw new Error("expected requireEnv to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingEnvError);
      expect((err as Error).name).toBe("MissingEnvError");
      expect((err as Error).message).toContain("MONGODB_URI");
    }
  });

  it("throws when the var is set to an empty string", () => {
    vi.stubEnv("MONGODB_URI", "");
    expect(() => requireEnv("MONGODB_URI")).toThrow(MissingEnvError);
  });

  it("returns the value when set", () => {
    vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:27017/test");
    expect(requireEnv("MONGODB_URI")).toBe("mongodb://127.0.0.1:27017/test");
  });
});

describe("requireOpenRouterKey()", () => {
  it("throws MissingEnvError named OPENROUTER_API_KEY when neither var is set", () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPEN_ROUTER;
    try {
      requireOpenRouterKey();
      throw new Error("expected requireOpenRouterKey to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingEnvError);
      expect((err as Error).message).toContain("OPENROUTER_API_KEY");
    }
  });

  it("accepts OPENROUTER_API_KEY", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-primary");
    delete process.env.OPEN_ROUTER;
    expect(requireOpenRouterKey()).toBe("sk-primary");
  });

  it("falls back to the legacy OPEN_ROUTER alias", () => {
    delete process.env.OPENROUTER_API_KEY;
    vi.stubEnv("OPEN_ROUTER", "sk-legacy");
    expect(requireOpenRouterKey()).toBe("sk-legacy");
  });
});
