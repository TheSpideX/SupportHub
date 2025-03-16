import { SHA256, enc } from 'crypto-js';

export const hashPassword = (password: string): string => {
  if (!password) {
    throw new Error("Password is required");
  }
  return SHA256(password).toString(enc.Hex);
};
