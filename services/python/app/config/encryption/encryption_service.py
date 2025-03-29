import os
import logging
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Custom error classes matching the Node.js implementation
class EncryptionError(Exception):
    def __init__(self, message, detail=None):
        super().__init__(f"{message}: {detail}" if detail else message)

class DecryptionError(Exception):
    def __init__(self, message, detail=None):
        super().__init__(f"{message}: {detail}" if detail else message)

class InvalidKeyFormatError(Exception):
    def __init__(self, message):
        super().__init__(message)

# Setup logger to mimic Logger service in Node.js
logger = logging.getLogger("Encryption Service")
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)


class EncryptionService:
    _instance = None

    def __init__(self, algorithm: str, secret_key: str):
        # In this example, algorithm should be "aes-256-gcm"
        self.algorithm = algorithm
        self.secret_key = secret_key  # this is a hex string

    @classmethod
    def get_instance(cls, algorithm: str, secret_key: str):
        if cls._instance is None:
            cls._instance = EncryptionService(algorithm, secret_key)
        return cls._instance

    def encrypt(self, text: str) -> str:
        try:
            # Recommended IV length for GCM is 12 bytes
            iv = os.urandom(12)
            key = bytes.fromhex(self.secret_key)
            aesgcm = AESGCM(key)
            # Encrypt returns ciphertext with the tag appended (last 16 bytes)
            encrypted = aesgcm.encrypt(iv, text.encode('utf-8'), None)
            # Split ciphertext and auth tag
            ciphertext = encrypted[:-16]
            auth_tag = encrypted[-16:]
            # Return the encrypted string as "iv:ciphertext:authTag"
            return f"{iv.hex()}:{ciphertext.hex()}:{auth_tag.hex()}"
        except Exception as e:
            logger.error("Encryption failed", exc_info=True)
            raise EncryptionError("Encryption failed", str(e))

    def decrypt(self, encrypted_text: str) -> str:
        if encrypted_text is None:
            raise DecryptionError("Decryption failed, encrypted text is None")
        try:
            # For AES-256-GCM, expect format "iv:ciphertext:authTag"
            parts = encrypted_text.split(':')
            if len(parts) != 3:
                raise InvalidKeyFormatError("Invalid encrypted text format; expected format iv:ciphertext:authTag")
            iv_hex, ciphertext_hex, auth_tag_hex = parts
            iv = bytes.fromhex(iv_hex)
            ciphertext = bytes.fromhex(ciphertext_hex)
            auth_tag = bytes.fromhex(auth_tag_hex)
            key = bytes.fromhex(self.secret_key)
            # Recombine ciphertext and auth tag as expected by AESGCM.decrypt
            combined = ciphertext + auth_tag
            aesgcm = AESGCM(key)
            decrypted = aesgcm.decrypt(iv, combined, None)
            return decrypted.decode('utf-8')
        except Exception as e:
            logger.error("Decryption failed", exc_info=True)
            raise DecryptionError("Decryption failed, could be due to different encryption algorithm or secret key", str(e))


# Example usage:
if __name__ == "__main__":
    # Replace these with your actual values.
    secret_key = "47eabdd76483a14975e4f6349cbd6812992f9d10cdac3c388a147206e69bed3b"
    service = EncryptionService.get_instance("aes-256-gcm", secret_key)

    # Encrypt a sample message
    message = "Hello, Secure World!"
    encrypted = service.encrypt(message)
    print("Encrypted:", encrypted)
    
    decrypted = service.decrypt(encrypted)
    print("Decrypted:", decrypted)

    # Decrypt the message back
    try:
        encrypted = "387db511587a354c3dc1b444:a7cd5200d1b1424e92ae129c528ac8656b2ed49af5a4400d7ff741151cbb9b4686824ced62bffc25eb6d8379639eb1111872507d3d86b174bee82d5c37ba073708bbe8508ad01628a9498e0b4bd144f5d395acd8f4547dc5c7895d2b9dd8408d32c658414dbd1956dbbe7c7aa2a02e706c1b05c90e9d843f1cd800e775c49c3370f1207a23b6db9b0193bda5724226d16de14107352b1f5d5754c2745e884fe5:d6c0a7ea920842ba40ad2c78867f804b"
        decrypted = service.decrypt(encrypted)
        print("Decrypted:", decrypted)
    except Exception as error:
        print(error)
