import json
import time

from smartcard.System import readers
from smartcard.CardConnection import CardConnection


GET_UID_COMMAND = [0xFF, 0xCA, 0x00, 0x00, 0x00]
POLL_INTERVAL_SECONDS = 0.25


def bytes_to_hex(byte_list):
    return "".join(format(byte, "02X") for byte in byte_list)


def list_readers():
    try:
      return readers() or []
    except Exception:
      return []


def reader_name(reader):
    return str(reader)


def is_probable_nfc_reader(reader):
    name = reader_name(reader).upper()
    return any(token in name for token in ["ACR122", "ACS", "PICC", "NFC", "SMART CARD"])


def try_connect(connection, reader_name_str=""):
    protocol_names = {CardConnection.T1_protocol: "T1", CardConnection.T0_protocol: "T0", None: "auto"}
    for protocol in (CardConnection.T1_protocol, CardConnection.T0_protocol, None):
        try:
            if protocol is None:
                connection.connect()
            else:
                connection.connect(protocol)
            return True
        except Exception:
            continue
    return False


def read_card_from_reader(reader):
    reader_name_str = reader_name(reader)
    try:
        connection = reader.createConnection()
        if not try_connect(connection, reader_name_str):
            return None

        try:
            data, sw1, sw2 = connection.transmit(GET_UID_COMMAND)
            if sw1 == 0x90 and sw2 == 0x00 and data:
                return {
                    "card_id": bytes_to_hex(data),
                    "card_type": "NFC_UID",
                    "reader_name": reader_name_str,
                }
            elif data:
                return {
                    "card_id": bytes_to_hex(data),
                    "card_type": "NFC_UID_PARTIAL",
                    "reader_name": reader_name_str,
                }
        except Exception:
            pass

        try:
            atr = connection.getATR()
            if atr:
                return {
                    "card_id": bytes_to_hex(atr),
                    "card_type": "SMART_CARD_ATR",
                    "reader_name": reader_name_str,
                }
        except Exception:
            pass

        return None
    except Exception:
        return None


def scan_once():
    available_readers = list_readers()
    if not available_readers:
        return None, "No smart card / NFC reader detected."

    for reader in available_readers:
        if not is_probable_nfc_reader(reader):
            continue
        card_data = read_card_from_reader(reader)
        if card_data:
            return card_data, None

    for reader in available_readers:
        card_data = read_card_from_reader(reader)
        if card_data:
            return card_data, None

    return None, "No card detected. Tap NFC card or insert smart card."


def watch_cards():
    print("=" * 60, flush=True)
    print("RFID watcher started.", flush=True)
    print("=" * 60, flush=True)

    last_card_id = None
    last_status = None
    last_reader_signature = None
    poll_count = 0

    while True:
        try:
            poll_count += 1
            available_readers = list_readers()
            reader_signature = "|".join(reader_name(reader) for reader in available_readers) if available_readers else ""
            
            if reader_signature != last_reader_signature:
                last_reader_signature = reader_signature
                if available_readers:
                    reader_list = ", ".join(reader_name(reader) for reader in available_readers)
                    msg = f"[POLL #{poll_count}] Found {len(available_readers)} reader(s): {reader_list}"
                    print(msg, flush=True)
                    print("RFID_STATUS " + msg, flush=True)
                else:
                    msg = f"[POLL #{poll_count}] No smart card / NFC reader detected."
                    print(msg, flush=True)
                    print("RFID_STATUS " + msg, flush=True)

            card_data, error = scan_once()

            if card_data:
                card_id = card_data["card_id"]
                if card_id != last_card_id:
                    last_card_id = card_id
                    last_status = None
                    print("=" * 60, flush=True)
                    print(f"[POLL #{poll_count}] [CARD DETECTED]", flush=True)
                    print(f"Card ID: {card_data['card_id']}", flush=True)
                    print(f"Card Type: {card_data['card_type']}", flush=True)
                    print(f"Reader: {card_data['reader_name']}", flush=True)
                    print("=" * 60, flush=True)
                    print("CARD_DETECTED " + json.dumps(card_data, ensure_ascii=True), flush=True)
            else:
                last_card_id = None
                if error and error != last_status:
                    last_status = error
                    print(f"[POLL #{poll_count}] {error}", flush=True)
                    print("RFID_STATUS " + error, flush=True)

        except KeyboardInterrupt:
            print("=" * 60, flush=True)
            print("RFID watcher stopped.", flush=True)
            print("=" * 60, flush=True)
            break
        except Exception as exc:
            message = str(exc)
            if message != last_status:
                last_status = message
                print(f"[POLL #{poll_count}] ERROR: {message}", flush=True)
                print("RFID_ERROR " + message, flush=True)

        time.sleep(POLL_INTERVAL_SECONDS)


def main():
    watch_cards()


if __name__ == "__main__":
    main()