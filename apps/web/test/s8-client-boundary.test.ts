/**
 * S8 (знахідка при скріншотах /pripojit): серверний компонент, що імпортує з модуля "use client" не компонент
 * (масив, константу, функцію), отримує в RSC клієнтське посилання – `SCOPES.filter is not a function`. Vitest RSC-межу
 * не моделює, тож правило перевіряємо статично: зі "use client" модулів сервер бере лише компоненти (з великої літери) і типи.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../src");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []));
const isClient = (src: string) => /^\s*["']use client["']/.test(src);

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

describe("S8 – server code imports only components from client modules", () => {
  it("gate: no lowercase / UPPER_CASE value imported from a 'use client' module into a server file", () => {
    const bad: string[] = [];
    for (const f of walk(SRC)) {
      const src = readFileSync(f, "utf8");
      if (isClient(src)) continue;
      for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)) {
        if (m[1]) continue;
        const target = resolveImport(f, m[3]!);
        if (!target || !isClient(readFileSync(target, "utf8"))) continue;
        for (const raw of m[2]!.split(",")) {
          const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!;
          if (!name || raw.trim().startsWith("type ")) continue;
          // komponenta = PascalCase (ne SCREAMING_CASE)
          if (!/^[A-Z][a-z]/.test(name)) bad.push(`${f.replace(SRC, "src")}: ${name} from ${m[3]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
