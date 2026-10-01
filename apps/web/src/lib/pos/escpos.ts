"use client";

/**
 * Tisk na Bluetooth termotiskárnu (ESC/POS) přes Web Bluetooth (Chrome / Android).
 * Levné tiskárny mají různé kódové stránky, proto text převádíme na ASCII bez diakritiky —
 * spolehlivě čitelné na všech modelech.
 */

// Běžné GATT služby/charakteristiky čínských termotiskáren (PT-210, MTP-II, Goojprt…)
const SERVICES = ["000018f0-0000-1000-8000-00805f9b34fb", "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "49535343-fe7d-4ae5-8fa9-9fafd205e455"];

interface BtCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
}

let cached: BtCharacteristic | null = null;

export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

function toAscii(text: string): Uint8Array {
  const plain = text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[–—−]/g, "-").replace(/[„“”]/g, '"').replace(/[^\x0a\x20-\x7e]/g, "?");
  return new TextEncoder().encode(plain);
}

async function connect(): Promise<BtCharacteristic> {
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bt = (navigator as any).bluetooth;
  const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
  const server = await device.gatt.connect();
  for (const uuid of SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars: BtCharacteristic[] = await service.getCharacteristics();
      const writable = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (writable) {
        cached = writable;
        device.addEventListener("gattserverdisconnected", () => (cached = null));
        return writable;
      }
    } catch {
      // služba na tomto modelu není
    }
  }
  throw new Error("Tiskárna nepodporuje tisk přes Bluetooth LE.");
}

export async function printEscPos(text: string, width: 32 | 42 | 48 = 32): Promise<void> {
  const ch = await connect();
  const ESC = 0x1b;
  const GS = 0x1d;
  const body = toAscii(text.split("\n").map((l) => l.slice(0, width)).join("\n"));
  const data = new Uint8Array([ESC, 0x40, ...body, 0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00]);
  // BLE má malé MTU → posíláme po 100 bajtech
  for (let i = 0; i < data.length; i += 100) {
    const chunk = data.slice(i, i + 100);
    if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(chunk);
    else await ch.writeValue(chunk);
  }
}
