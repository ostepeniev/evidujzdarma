import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as anchors from "../src/eet2/trust-anchors.ts";

const files: Record<keyof typeof anchors, string> = {
  playgroundIntermediate: "official/response-trust/playground/ica-public-rsa-06-2022.pem",
  playgroundRoot: "official/response-trust/playground/ica-root-rsa-05-2022.pem",
  productionIntermediate: "official/response-trust/production/nca-subca2-rsa-12-2023.der",
  productionRoot: "official/response-trust/production/nca-root-rsa-10-2023.der",
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
