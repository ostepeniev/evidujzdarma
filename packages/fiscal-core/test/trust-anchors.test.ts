import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as anchors from "../src/eet2/trust-anchors.ts";

const files: Record<keyof typeof anchors, string> = {
  icaIntermediate: "official/response-trust/ica/ica-public-rsa-06-2022.pem",
  icaRoot: "official/response-trust/ica/ica-root-rsa-05-2022.pem",
};

describe("embedded trust anchors", () => {
  for (const [name, path] of Object.entries(files)) {
    it(`${name} matches ${path}`, () => {
      const fromFile = new X509Certificate(readFileSync(new URL(`../${path}`, import.meta.url)));
      const embedded = new X509Certificate(anchors[name as keyof typeof anchors]);
      expect(embedded.fingerprint256).toBe(fromFile.fingerprint256);
    });
  }
});
