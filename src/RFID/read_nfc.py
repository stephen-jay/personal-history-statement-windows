import time
from smartcard.System import readers
from smartcard.CardConnection import CardConnection

GET_UID_COMMAND = [0xFF, 0xCA, 0x00, 0x00, 0x00]


def bytes_to_hex(byte_list):
    return "".join(format(byte, "02X") for byte in byte_list)


def get_acr122u_reader():
    print("Checking readers...", flush=True)

    available_readers = readers()

    if not available_readers:
        print("No reader detected.", flush=True)
        return None

    print("Detected readers:", flush=True)

    for index, reader in enumerate(available_readers, start=1):
        print(f"{index}. {reader}", flush=True)

    for reader in available_readers:
        reader_name = str(reader).upper()

        if "ACR122" in reader_name or "ACS" in reader_name or "PICC" in reader_name:
            return reader

    return None


def try_read_uid(reader):
    try:
        connection = reader.createConnection()

        try:
            connection.connect(CardConnection.T1_protocol)
        except Exception:
            try:
                connection.connect(CardConnection.T0_protocol)
            except Exception:
                return None, "No compatible NFC card detected yet."

        data, sw1, sw2 = connection.transmit(GET_UID_COMMAND)

        try:
            connection.disconnect()
        except Exception:
            pass

        if sw1 == 0x90 and sw2 == 0x00 and data:
            uid = bytes_to_hex(data)
            return uid, None

        return None, f"Card detected but UID read failed. Status: {sw1:02X} {sw2:02X}"

    except Exception as e:
        return None, str(e)


def main():
    reader = get_acr122u_reader()

    if not reader:
        print("\nACR122U NFC reader not found.", flush=True)
        return

    print(f"\nUsing NFC reader: {reader}", flush=True)
    print("Place/tap the NFC card on the ACR122U.", flush=True)
    print("Scanning for 15 seconds...", flush=True)

    for attempt in range(1, 16):
        print(f"Attempt {attempt}/15...", flush=True)

        uid, error = try_read_uid(reader)

        if uid:
            print("\nNFC card detected.", flush=True)
            print(f"NFC UID: {uid}", flush=True)
            return

        print(error, flush=True)
        time.sleep(1)

    print("\nNo readable NFC card found.", flush=True)
    print("Possible reason: the card is 125kHz RFID, not 13.56MHz NFC.", flush=True)


if __name__ == "__main__":
    main()