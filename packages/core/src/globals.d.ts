// Available in Node >= 18 and all modern browsers; not declared by the ES TS lib.
declare const crypto: { randomUUID?: () => string; getRandomValues: (array: Uint8Array) => Uint8Array };
declare const structuredClone: <T>(value: T) => T;
