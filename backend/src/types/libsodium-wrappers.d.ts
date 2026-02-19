declare module 'libsodium-wrappers' {
  export const ready: Promise<void>;
  export function crypto_secretbox_easy(
    message: string | Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  export function crypto_secretbox_open_easy(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  export function randombytes_buf(length: number): Uint8Array;
  export function from_base64(input: string): Uint8Array;
  export function to_base64(input: Uint8Array): string;
  export function from_string(input: string): Uint8Array;
  export function to_string(input: Uint8Array): string;
  export const crypto_secretbox_NONCEBYTES: number;
  export const crypto_secretbox_KEYBYTES: number;
}
