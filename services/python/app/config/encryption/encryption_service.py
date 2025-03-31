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

    # Decrypt the message back
    try:
        encrypted = "7525cb77eb4fbb88c58ea2e7:e3b434cb193b8634be0b93c2f19ecf2a046cc361c8865d9638b4dc682d6aea24a643be00c71cf95864ef69187af4658170c70bb96efdeadce2db2ec1b0d251ecd4c0d74111af7c300593a3b9fb5ce5f47661794695f092d21b3457a4bf031f083d37769edd6a17117222922589bc5cf4a819c971d83115159d9302c2c5d21385a68c4cd7b0500b18bb815dc0dfc5383a7a6b7145b7a7c457a8a3e1aa4418bc77441b06e2eed9c3fef55d9579824951969257990e5d8087539c7b77487dcd0938af71730bb864937d3b25b341cd24407fb8b0655e70c94d2e4ffd6718424c3bc6b0cdc07c89ad8d8f9455d18cd5ba8b87dfe9f159207720ffb6b708:30d1449d53d08732cadd9220c2fcb583"
        decrypted = service.decrypt(encrypted)
        print("Decrypted:", decrypted)
    except Exception as error:
        print(error)
