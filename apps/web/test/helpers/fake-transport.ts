/** Skriptovaný transport pro testy fronty: zaznamenává volání a vrací připravené výsledky. */
import type { Sale, SendContext, SendResult, Transport } from "@ez/fiscal-core";
import type { EetMode } from "@/lib/server/fiscal";

export interface Call {
  mode: EetMode;
  sale: Sale;
  ctx: SendContext;
}

export function fakeTransports(script?: (call: Call, n: number) => SendResult | Promise<SendResult>) {
  const calls: Call[] = [];
  const factory = (_account: unknown, mode: EetMode): Transport => ({
    name: `fake-${mode}`,
    async send(sale, ctx) {
      const call = { mode, sale, ctx };
      calls.push(call);
      if (script) return script(call, calls.length);
      return {
        ok: true,
        confirmationCode: mode === "playground" ? "11111111-2222-4333-8444-555555555555-ff" : "11111111-2222-4333-8444-555555555555-0a",
        test: mode !== "production",
        receivedAt: new Date().toISOString(),
        messageUuid: ctx.messageUuid ?? crypto.randomUUID(),
        warnings: [],
      };
    },
  });
  return { calls, factory };
}
