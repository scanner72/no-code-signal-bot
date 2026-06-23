import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const WASM_URLS = [
  'https://chat.deepseek.com/_next/static/chunks/sha3_wasm_bg.wasm',
  'https://cdn.deepseek.com/static/sha3_wasm_bg.wasm',
];
const WASM_CACHE_PATH = path.join(process.cwd(), '.free-ai', 'sha3_wasm_bg.wasm');

interface WasmExports {
  wasm_solve: (
    retptr: number,
    challengePtr: number,
    challengeLen: number,
    prefixPtr: number,
    prefixLen: number,
    difficulty: number,
  ) => void;
  memory: WebAssembly.Memory;
  __wbindgen_add_to_stack_pointer: (n: number) => number;
  __wbindgen_export_0: (size: number, align: number) => number;
  __wbindgen_export_2: (ptr: number, size: number, align: number) => void;
}

/**
 * DeepSeekPowSolver
 *
 * Solves the Proof-of-Work (PoW) challenge required by DeepSeek before each
 * chat completion request.
 *
 * Flow:
 *   1. POST /api/v0/chat/create_pow_challenge  → get { algorithm, challenge, salt, difficulty }
 *   2. Call wasm_solve(challenge, salt, difficulty) from sha3_wasm_bg.wasm
 *   3. Base64-encode the response JSON and set as `X-DS-PoW-Response` header
 */
@Injectable()
export class DeepSeekPowSolver implements OnModuleInit {
  private readonly logger = new Logger(DeepSeekPowSolver.name);
  private wasmExports: WasmExports | null = null;
  private ready = false;

  async onModuleInit() {
    await this.initWasm();
  }

  private async initWasm(): Promise<void> {
    try {
      const wasmBuffer = await this.loadWasm();
      // Convert Buffer to Uint8Array so TypeScript resolves the correct overload
      // returning WebAssemblyInstantiatedSource { instance, module }
      const wasmBytes = new Uint8Array(wasmBuffer.buffer, wasmBuffer.byteOffset, wasmBuffer.byteLength);
      const result = (await WebAssembly.instantiate(wasmBytes, {
        wbg: {
          __wbindgen_placeholder__: () => {},
        },
      })) as unknown as WebAssembly.WebAssemblyInstantiatedSource;
      this.wasmExports = result.instance.exports as unknown as WasmExports;
      this.ready = true;
      this.logger.log('DeepSeek PoW WASM solver initialized successfully.');
    } catch (err: any) {
      this.logger.warn(`DeepSeek PoW WASM init failed (will use fallback JS solver): ${err.message}`);
    }
  }

  private async loadWasm(): Promise<Buffer> {
    // Check disk cache — but validate magic bytes first (avoid caching HTML error pages)
    if (fs.existsSync(WASM_CACHE_PATH)) {
      const cached = fs.readFileSync(WASM_CACHE_PATH);
      if (this.isValidWasm(cached)) {
        this.logger.debug('Loading WASM from local cache.');
        return cached;
      }
      this.logger.warn('Cached WASM file is invalid (not a WASM binary), re-downloading...');
      fs.unlinkSync(WASM_CACHE_PATH);
    }

    // Try each URL in sequence
    for (const url of WASM_URLS) {
      try {
        this.logger.log(`Trying WASM download from ${url}...`);
        const buffer = await this.downloadFile(url);
        if (this.isValidWasm(buffer)) {
          fs.mkdirSync(path.dirname(WASM_CACHE_PATH), { recursive: true });
          fs.writeFileSync(WASM_CACHE_PATH, buffer);
          this.logger.log('WASM PoW solver downloaded and cached.');
          return buffer;
        }
        this.logger.warn(`Response from ${url} is not a valid WASM binary, skipping...`);
      } catch (err: any) {
        this.logger.warn(`WASM download failed from ${url}: ${err.message}`);
      }
    }

    throw new Error('Could not download a valid WASM PoW solver — JS fallback will be used.');
  }

  /** Validate WASM magic number: first 4 bytes must be 0x00 0x61 0x73 0x6d */
  private isValidWasm(buf: Buffer): boolean {
    return buf.length >= 4 && buf[0] === 0x00 && buf[1] === 0x61 && buf[2] === 0x73 && buf[3] === 0x6d;
  }

  private downloadFile(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Solves the PoW challenge and returns the Base64-encoded header value.
   */
  solve(challenge: string, salt: string, difficulty: number, expireAt?: number, signature?: string, targetPath?: string): string {
    const expire = expireAt ?? (Date.now() + 300000);
    const prefix = `${salt}_${expire}_`;
    let answer: number | null = null;

    if (this.ready && this.wasmExports) {
      try {
        const exports = this.wasmExports as any;
        const lTextEncoder = new TextEncoder();

        const writeString = (str: string): [number, number] => {
          const bytes = lTextEncoder.encode(str);
          const ptr = exports.__wbindgen_export_0(bytes.length, 1);
          new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes);
          return [ptr, bytes.length];
        };

        const retptr = exports.__wbindgen_add_to_stack_pointer(-16);
        const [challengePtr, challengeLen] = writeString(challenge);
        const [prefixPtr, prefixLen] = writeString(prefix);

        exports.wasm_solve(
          retptr,
          challengePtr,
          challengeLen,
          prefixPtr,
          prefixLen,
          difficulty
        );

        const resultView = new DataView(exports.memory.buffer);
        const status = resultView.getInt32(retptr, true);
        const value = resultView.getFloat64(retptr + 8, true);

        // Free resources by restoring stack pointer (skip heap string deallocation to avoid WASM panic)
        exports.__wbindgen_add_to_stack_pointer(16);

        if (status === 1) {
          answer = Math.floor(value);
        } else {
          this.logger.warn('PoW WASM solver returned failure status.');
        }
      } catch (err: any) {
        this.logger.warn(`PoW WASM solver execution failed: ${err.message}`);
      }
    }

    if (answer === null) {
      throw new Error('PoW solving failed or timed out. Retrying...');
    }

    const payload = {
      algorithm: 'DeepSeekHashV1',
      challenge,
      salt,
      answer,
      signature,
      difficulty,
      expire_at: expire,
      target_path: targetPath,
    };

    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  get isReady(): boolean {
    return this.ready;
  }
}
