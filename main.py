import sys
import numpy as np
import hashlib


def main():
    nonce = np.random.bytes(32)
    bid_int = int(sys.argv[1])
    bid_bytes = bid_int.to_bytes(32, byteorder="big", signed=False)
    hashed_bid = hashlib.sha256(bid_bytes + nonce).hexdigest()
    print(f"Hash: 0x{hashed_bid}")
    print(f"Nonce: 0x{nonce.hex()}")
    print(f"BidInt: {bid_int}")


main()
