import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_CRYPTO_KEY || 'default-secure-key-12345';

/**
 * Generates a cryptographically secure nonce
 * @returns Promise<string> Generated nonce
 */
export const generateNonce = async (): Promise<string> => {
  try {
    if (window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint8Array(16);
      window.crypto.getRandomValues(buffer);
      return Array.from(buffer)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    }
    // Fallback for older browsers (less secure)
    return CryptoJS.lib.WordArray.random(16).toString();
  } catch (error) {
    console.error('Nonce generation failed:', error);
    throw new Error('Failed to generate nonce');
  }
};

/**
 * Encrypts data using AES encryption
 * @param data - Data to encrypt
 * @returns Encrypted string
 */
export const encryptData = (data: string): string => {
  try {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypts AES encrypted data
 * @param encryptedData - Encrypted string to decrypt
 * @returns Decrypted string
 */
export const decryptData = (encryptedData: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
};