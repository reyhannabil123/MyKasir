/** Cetak langsung lewat Web Bluetooth (Chrome Android/desktop). Hanya untuk printer Bluetooth jenis BLE. */

// UUID layanan yang umum dipakai printer thermal. Web Bluetooth hanya boleh membuka layanan yang didaftarkan di sini.
const SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "38eb4a80-c570-11e3-9507-0002a5d5c51b",
];

type BtChar = { properties: { write: boolean; writeWithoutResponse: boolean }; writeValue(v: BufferSource): Promise<void>; writeValueWithoutResponse(v: BufferSource): Promise<void> };
type BtServer = { connected: boolean; getPrimaryServices(): Promise<{ getCharacteristics(): Promise<BtChar[]> }[]> };
type BtDevice = { name?: string; gatt?: { connected: boolean; connect(): Promise<BtServer> } };
type Nav = { bluetooth?: { requestDevice(o: unknown): Promise<BtDevice> } };

export const btSupported = () => typeof navigator !== "undefined" && !!(navigator as unknown as Nav).bluetooth;

let device: BtDevice | null = null;
let ch: BtChar | null = null;

async function connect(): Promise<BtChar> {
  if (device?.gatt?.connected && ch) return ch;
  const bt = (navigator as unknown as Nav).bluetooth!;
  if (!device) device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
  const server = await device.gatt!.connect();
  for (const svc of await server.getPrimaryServices()) {
    for (const c of await svc.getCharacteristics()) {
      if (c.properties.write || c.properties.writeWithoutResponse) { ch = c; return c; }
    }
  }
  device = null; ch = null;
  throw new Error("Printer terhubung tapi tidak menyediakan jalur cetak yang dikenali.");
}

export async function printBluetooth(data: Uint8Array): Promise<void> {
  let c: BtChar;
  try { c = await connect(); }
  catch (e) {
    device = null; ch = null;
    const name = e instanceof Error ? e.name : "";
    if (name === "NotFoundError") throw new Error("Tidak ada printer yang dipilih. Pastikan printer menyala dan dekat dengan HP.");
    throw e instanceof Error ? e : new Error("Gagal terhubung ke printer.");
  }
  const SIZE = 100; // potongan kecil agar tidak melebihi batas paket Bluetooth
  try {
    for (let i = 0; i < data.length; i += SIZE) {
      const part = data.slice(i, i + SIZE);
      if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(part);
      else await c.writeValue(part);
      await new Promise((r) => setTimeout(r, 25));
    }
  } catch {
    device = null; ch = null;
    throw new Error("Pengiriman ke printer terputus. Coba lagi.");
  }
}
