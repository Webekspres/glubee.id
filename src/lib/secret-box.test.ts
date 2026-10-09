import { describe, expect, test } from "bun:test";
import { fromBytea, keyedHash, openText, sealText, toBytea } from "./secret-box";

const env = { DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") };
const other = { DATA_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString("base64") };

describe("secret-box", () => {
  test("round-trips text and uses a fresh IV", () => {
    const a = sealText("rahasia", env);
    expect(openText(a, env)).toBe("rahasia");
    expect(a.equals(sealText("rahasia", env))).toBe(false);
  });
  test("rejects tampering and the wrong key", () => {
    const a = sealText("rahasia", env);
    a[a.length - 1] ^= 1;
    expect(() => openText(a, env)).toThrow();
    expect(() => openText(sealText("x", env), other)).toThrow();
  });
  test("keyed hash is stable per key", () => {
    expect(keyedHash("a", env).equals(keyedHash("a", env))).toBe(true);
    expect(keyedHash("a", env).equals(keyedHash("a", other))).toBe(false);
    expect(keyedHash("a", env)).toHaveLength(32);
  });
  test("missing key fails loudly", () => {
    expect(() => sealText("x", {})).toThrow("DATA_ENCRYPTION_KEY");
  });
  test("bytea hex round-trip", () => {
    const b = Buffer.from([0, 255, 16]);
    expect(toBytea(b)).toBe("\\x00ff10");
    expect(fromBytea(toBytea(b)).equals(b)).toBe(true);
  });
});
