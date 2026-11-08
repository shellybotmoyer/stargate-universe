// Type stub for punycode polyfill — redirects TS module resolution away from
// node_modules/punycode/punycode.js (16 legacy JS TS errors with checkJs:true).
declare module "punycode" {
  export function toUnicode(domain: string): string;
  export function toASCII(domain: string): string;
  export const version: string;
  export function decode(input: string): number[];
  export function encode(codePoints: number[]): string;
  const ucs2: {
    decode(string: string): number[];
    encode(codePoints: number[]): string;
  };
  export { ucs2 };
}
