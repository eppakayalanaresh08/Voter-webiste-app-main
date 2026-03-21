// Thermal Printer utility using Web Bluetooth API + ESC/POS commands
// Mirrors the BLEPrinter logic from the React Native app

const PRINTER_WIDTH = 384; // Standard 58mm/80mm thermal printer dot width

export class ThermalPrinter {
  private device: any = null;
  private characteristic: any = null;

  // ─── Connection ──────────────────────────────────────────────────────────────

  async connect() {
    try {
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { services: ['0000ff00-0000-1000-8000-00805f9b34fb'] },
          { namePrefix: 'TP' },
          { namePrefix: 'Printer' },
          { namePrefix: 'MTP' },
          { namePrefix: 'InnerPrinter' },
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000ff00-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        ],
      });

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error('Could not connect to GATT server');

      const services = await server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            this.characteristic = char;
            return true;
          }
        }
      }
      throw new Error('No writable characteristic found');
    } catch (error) {
      console.error('Bluetooth error:', error);
      throw error;
    }
  }

  isConnected() {
    return !!this.characteristic;
  }

  // ─── Low-level write ─────────────────────────────────────────────────────────

  private async writeBytes(data: Uint8Array) {
    if (!this.characteristic) throw new Error('Printer not connected');
    const CHUNK = 20;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      await this.characteristic.writeValue(chunk);
      await new Promise((r) => setTimeout(r, 6));
    }
  }

  private async writeText(text: string) {
    await this.writeBytes(new TextEncoder().encode(text));
  }

  // ─── Image bitmap conversion ─────────────────────────────────────────────────

  /**
   * Convert a canvas element (or ImageBitmap/HTMLImageElement) to a 1-bit
   * monochrome bitmap + dimensions, mirroring the Android bitmap conversion.
   */
  private canvasToBitmap(canvas: HTMLCanvasElement): { data: Uint8Array; width: number; height: number } {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');

    // Scale down to PRINTER_WIDTH if too wide
    let { width, height } = canvas;
    if (width > PRINTER_WIDTH) {
      const ratio = PRINTER_WIDTH / width;
      const scaled = document.createElement('canvas');
      scaled.width = PRINTER_WIDTH;
      scaled.height = Math.floor(height * ratio);
      scaled.getContext('2d')!.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      return this.canvasToBitmap(scaled);
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data; // RGBA

    const widthBytes = Math.ceil(width / 8);
    const bitmap = new Uint8Array(height * widthBytes);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        // ITU-R BT.601 grayscale weights (same as RN code)
        const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
        const isBlack = gray < 128;

        if (isBlack) {
          const bytePos = y * widthBytes + Math.floor(x / 8);
          const bitPos = 7 - (x % 8);
          bitmap[bytePos] |= 1 << bitPos;
        }
      }
    }

    return { data: bitmap, width, height };
  }

  /**
   * Print a bitmap using GS v 0 (same command as RN BLEPrinter.printBitmap)
   */
  private async printBitmap(bitmapData: Uint8Array, width: number, height: number) {
    const widthBytes = Math.ceil(width / 8);

    // Initialize
    await this.writeBytes(new Uint8Array([0x1b, 0x40]));
    await new Promise((r) => setTimeout(r, 50));

    // Center align
    await this.writeBytes(new Uint8Array([0x1b, 0x61, 0x01]));

    // GS v 0 — Print raster bit image
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = height & 0xff;
    const yH = (height >> 8) & 0xff;

    await this.writeBytes(new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]));
    await new Promise((r) => setTimeout(r, 30));

    // Send bitmap data in 512-byte chunks
    const CHUNK = 512;
    for (let i = 0; i < bitmapData.length; i += CHUNK) {
      await this.writeBytes(bitmapData.slice(i, Math.min(i + CHUNK, bitmapData.length)));
      await new Promise((r) => setTimeout(r, 30));
    }

    // Feed paper
    await this.writeBytes(new Uint8Array([0x0a, 0x0a]));
    await new Promise((r) => setTimeout(r, 50));
  }

  // ─── Public print methods ─────────────────────────────────────────────────────

  /**
   * Print a voter card image (from a canvas/html2canvas result) + text details.
   * Call this with the voterCardCanvas from html2canvas.
   */
  async printVoterWithImage(
    canvas: HTMLCanvasElement,
    voter: {
      voter_name: string | null;
      voter_name_tamil?: string | null;
      booth_no: string | null;
      epic_id: string | null;
      house_no: string | null;
      serial_no?: string | null;
      booth_name?: string | null;
      mobile_no?: string | null;
      age?: number | null;
    }
  ) {
    if (!this.characteristic) await this.connect();
    if (!this.characteristic) throw new Error('Printer not connected');

    // ── 1. Print voter card image ──
    const { data, width, height } = this.canvasToBitmap(canvas);
    await this.printBitmap(data, width, height);

    // ── 2. Left align and print voter text details ──
    await this.writeBytes(new Uint8Array([0x1b, 0x61, 0x00])); // Left align

    const slipText = [
      '==============================',
      `Serial No. : ${voter.serial_no ?? '-'}`,
      `Name       : ${voter.voter_name ?? '-'}`,
      voter.voter_name_tamil ? `           : ${voter.voter_name_tamil}` : null,
      `Voter ID   : ${voter.epic_id ?? '-'}`,
      `Booth No.  : ${voter.booth_no ?? '-'}`,
      voter.booth_name ? `Booth      : ${voter.booth_name}` : null,
      `House No.  : ${voter.house_no ?? '-'}`,
      `Mobile     : ${voter.mobile_no ?? '-'}`,
      voter.age ? `Age        : ${voter.age}` : null,
      '==============================',
    ]
      .filter(Boolean)
      .join('\n') + '\n\n\n\n';

    await this.writeText(slipText);

    // ── 3. Paper cut ──
    await this.writeBytes(new Uint8Array([0x1d, 0x56, 0x00]));
  }

  /**
   * Text-only voter print (original method, kept as fallback)
   */
  async printVoter(voter: {
    voter_name: string | null;
    voter_name_tamil?: string | null;
    booth_no: string | null;
    epic_id: string | null;
    house_no: string | null;
    serial_no?: string | null;
    booth_name?: string | null;
    mobile_no?: string | null;
  }) {
    if (!this.characteristic) await this.connect();
    if (!this.characteristic) throw new Error('Printer not connected');

    const encoder = new TextEncoder();
    const cmds: Uint8Array[] = [];

    cmds.push(new Uint8Array([0x1b, 0x40])); // Init
    cmds.push(new Uint8Array([0x1b, 0x61, 0x01])); // Center
    cmds.push(new Uint8Array([0x1b, 0x45, 0x01])); // Bold On
    cmds.push(new Uint8Array([0x1d, 0x21, 0x11])); // Double H+W
    cmds.push(encoder.encode('\nVOTER SLIP\n\n'));
    cmds.push(new Uint8Array([0x1d, 0x21, 0x00])); // Size reset
    cmds.push(new Uint8Array([0x1b, 0x45, 0x00])); // Bold Off
    cmds.push(new Uint8Array([0x1b, 0x45, 0x01]));
    cmds.push(encoder.encode(`${voter.voter_name || ''}\n`));
    cmds.push(new Uint8Array([0x1b, 0x45, 0x00]));
    cmds.push(encoder.encode('--------------------------------\n'));
    cmds.push(new Uint8Array([0x1b, 0x61, 0x00])); // Left
    cmds.push(encoder.encode(`Booth No : ${voter.booth_no ?? '-'}\n`));
    cmds.push(encoder.encode(`Serial No: ${voter.serial_no ?? '-'}\n`));
    cmds.push(encoder.encode(`EPIC ID  : ${voter.epic_id ?? '-'}\n`));
    cmds.push(encoder.encode(`House No : ${voter.house_no ?? '-'}\n`));
    cmds.push(encoder.encode(`Mobile   : ${voter.mobile_no ?? '-'}\n`));
    if (voter.booth_name) cmds.push(encoder.encode(`Booth    : ${voter.booth_name}\n`));
    cmds.push(new Uint8Array([0x1b, 0x61, 0x01])); // Center
    cmds.push(encoder.encode('\n*** VOTE FOR BETTER FUTURE ***\n\n\n\n\n'));
    cmds.push(new Uint8Array([0x1d, 0x56, 0x41, 0x00])); // Cut

    for (const cmd of cmds) await this.writeBytes(cmd);
  }
}

export const thermalPrinter = new ThermalPrinter();
