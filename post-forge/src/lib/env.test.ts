/**
 * env.ts fail-fast tests (T18 BRD §4.4).
 *
 * Pure unit tests over `env()`/`requireEnv()`/`requireGeminiKey()`/
 * `requireReplicateKey()` -- no network, no Mongo. Uses
 * `vi.stubEnv`/`vi.unstubAllEnvs` (vitest 5's documented env-mocking API,
 * https://vitest.dev/api/vi.html#vi-stubenv) rather than mutating
 * `process.env` directly, so each test's env changes are automatically
 * reverted.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { env, requireEnv, requireGeminiKey, requireReplicateKey, MissingEnvError } from "./env";

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

describe("requireGeminiKey()", () => {
  it("throws MissingEnvError named GEMINI_API_KEY when unset", () => {
    delete process.env.GEMINI_API_KEY;
    try {
      requireGeminiKey();
      throw new Error("expected requireGeminiKey to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingEnvError);
      expect((err as Error).message).toContain("GEMINI_API_KEY");
    }
  });

  it("returns the value when set", () => {
    vi.stubEnv("GEMINI_API_KEY", "sk-gemini");
    expect(requireGeminiKey()).toBe("sk-gemini");
  });
});

describe("requireReplicateKey()", () => {
  it("throws MissingEnvError named REPLICATE_API_KEY when unset", () => {
    delete process.env.REPLICATE_API_KEY;
    try {
      requireReplicateKey();
      throw new Error("expected requireReplicateKey to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingEnvError);
      expect((err as Error).message).toContain("REPLICATE_API_KEY");
    }
  });

  it("returns the value when set", () => {
    vi.stubEnv("REPLICATE_API_KEY", "r8_test");
    expect(requireReplicateKey()).toBe("r8_test");
  });
});
