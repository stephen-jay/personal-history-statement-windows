import json
import sys
import time
import tkinter as tk
import requests

from smartcard.System import readers
from smartcard.CardRequest import CardRequest
from smartcard.CardType import AnyCardType


SERVER_URL = "http://10.10.218.74:5000"
API_TOKEN = "change_this_secret_token"

GET_UID_COMMAND = [0xFF, 0xCA, 0x00, 0x00, 0x00]
WATCH_POLL_SECONDS = 0.35


def bytes_to_hex(byte_list):
    return "".join(format(byte, "02X") for byte in byte_list)


def show_readers():
    available_readers = readers()

    if not available_readers:
        print("No smart card / NFC reader detected.", flush=True)
        return

    print("Detected readers:", flush=True)
    for index, reader in enumerate(available_readers, start=1):
        print(f"{index}. {reader}", flush=True)


def read_from_specific_reader(reader, timeout_seconds=1):
    try:
        card_request = CardRequest(
            timeout=timeout_seconds,
            cardType=AnyCardType(),
            readers=[reader]
        )

        card_service = card_request.waitforcard()
        connection = card_service.connection
        connection.connect()

        try:
            data, sw1, sw2 = connection.transmit(GET_UID_COMMAND)

            if sw1 == 0x90 and sw2 == 0x00 and data:
                return {
                    "card_id": bytes_to_hex(data),
                    "card_type": "NFC_UID",
                    "reader_name": str(reader)
                }

        except Exception:
            pass

        atr = connection.getATR()

        if atr:
            return {
                "card_id": bytes_to_hex(atr),
                "card_type": "SMART_CARD_ATR",
                "reader_name": str(reader)
            }

        return None

    except Exception:
        return None


def scan_any_card(timeout_seconds=1):
    available_readers = readers()

    if not available_readers:
        return None, "No smart card / NFC reader detected."

    for reader in available_readers:
        card_data = read_from_specific_reader(reader, timeout_seconds=timeout_seconds)

        if card_data:
            return card_data, None

    return None, "No card detected. Tap NFC card or insert smart card."


def verify_card_on_server(card_id):
    try:
        response = requests.post(
            f"{SERVER_URL}/verify-card",
            json={"card_id": card_id},
            headers={"X-API-Token": API_TOKEN},
            timeout=5
        )

        data = response.json()

        if data.get("authorized"):
            return True, data.get("owner_name"), None

        return False, None, "Unauthorized card."

    except requests.exceptions.ConnectionError:
        return False, None, "Cannot connect to server."

    except requests.exceptions.Timeout:
        return False, None, "Server timeout."

    except Exception as e:
        return False, None, str(e)


def add_card_to_server(card_id, owner_name):
    try:
        response = requests.post(
            f"{SERVER_URL}/add-card",
            json={
                "card_id": card_id,
                "owner_name": owner_name
            },
            headers={"X-API-Token": API_TOKEN},
            timeout=5
        )

        return response.json()

    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Cannot connect to server."}

    except requests.exceptions.Timeout:
        return {"success": False, "error": "Server timeout."}

    except Exception as e:
        return {"success": False, "error": str(e)}


def mode_read():
    show_readers()

    print()
    print("Tap NFC card on ACR122U or insert smart card into CT30.", flush=True)
    print("Scanning...", flush=True)

    card_data, error = scan_any_card()

    if not card_data:
        print(error, flush=True)
        return

    print()
    print("Card detected.", flush=True)
    print(f"Reader: {card_data['reader_name']}", flush=True)
    print(f"Type: {card_data['card_type']}", flush=True)
    print(f"Card ID: {card_data['card_id']}", flush=True)


def mode_add():
    show_readers()

    print()
    input("Tap/insert the card, then press ENTER...")

    card_data, error = scan_any_card()

    if not card_data:
        print(error, flush=True)
        return

    print()
    print("Card detected.", flush=True)
    print(f"Reader: {card_data['reader_name']}", flush=True)
    print(f"Type: {card_data['card_type']}", flush=True)
    print(f"Card ID: {card_data['card_id']}", flush=True)

    owner_name = input("Enter owner name: ").strip()

    if not owner_name:
        print("Owner name is required.", flush=True)
        return

    result = add_card_to_server(card_data["card_id"], owner_name)
    print(result, flush=True)


def mode_check():
    show_readers()

    print()
    input("Tap/insert the card, then press ENTER...")

    card_data, error = scan_any_card()

    if not card_data:
        print(error, flush=True)
        return

    print()
    print("Card detected.", flush=True)
    print(f"Reader: {card_data['reader_name']}", flush=True)
    print(f"Type: {card_data['card_type']}", flush=True)
    print(f"Card ID: {card_data['card_id']}", flush=True)

    authorized, owner_name, server_error = verify_card_on_server(card_data["card_id"])

    if authorized:
        print(f"AUTHORIZED. Welcome, {owner_name}!", flush=True)
    else:
        print(server_error, flush=True)


def mode_watch():
    print("RFID watcher started.", flush=True)

    last_card_id = None
    last_status = None

    while True:
        try:
            card_data, error = scan_any_card(timeout_seconds=WATCH_POLL_SECONDS)

            if card_data:
                card_id = card_data["card_id"]
                if card_id != last_card_id:
                    last_card_id = card_id
                    last_status = None
                    print(
                        "CARD_DETECTED " + json.dumps(card_data, ensure_ascii=True),
                        flush=True
                    )
            else:
                last_card_id = None
                if error and error != last_status:
                    last_status = error
                    print("RFID_STATUS " + error, flush=True)
        except KeyboardInterrupt:
            print("RFID watcher stopped.", flush=True)
            break
        except Exception as e:
            message = str(e)
            if message != last_status:
                last_status = message
                print("RFID_ERROR " + message, flush=True)

        time.sleep(0.15)


class LockScreen:
    def __init__(self, root):
        self.root = root
        self.root.title("Smart Card / NFC Server Test")
        self.root.geometry("760x430")
        self.root.configure(bg="black")

        self.title_label = tk.Label(
            root,
            text="SMART CARD / NFC SERVER TEST",
            fg="white",
            bg="black",
            font=("Arial", 24, "bold")
        )
        self.title_label.pack(pady=40)

        self.status_label = tk.Label(
            root,
            text="Waiting for card...",
            fg="yellow",
            bg="black",
            font=("Arial", 16),
            justify="center"
        )
        self.status_label.pack(pady=25)

        self.info_label = tk.Label(
            root,
            text="ACR122U: tap NFC card\nCT30: insert smart card",
            fg="white",
            bg="black",
            font=("Arial", 13),
            justify="center"
        )
        self.info_label.pack(pady=10)

        self.note_label = tk.Label(
            root,
            text="Press ESC to close",
            fg="gray",
            bg="black",
            font=("Arial", 12)
        )
        self.note_label.pack(pady=20)

        self.root.bind("<Escape>", lambda event: self.root.destroy())

        self.last_card_id = None
        self.check_loop()

    def check_loop(self):
        card_data, error = scan_any_card()

        if card_data:
            card_id = card_data["card_id"]
            card_type = card_data["card_type"]
            reader_name = card_data["reader_name"]

            if card_id != self.last_card_id:
                self.last_card_id = card_id

                authorized, owner_name, server_error = verify_card_on_server(card_id)

                if authorized:
                    self.status_label.config(
                        text=f"AUTHORIZED\nWelcome, {owner_name}!\n\n{card_type}\n{reader_name}",
                        fg="lightgreen"
                    )
                else:
                    self.status_label.config(
                        text=f"DENIED\n{server_error}\n\n{card_type}\n{reader_name}",
                        fg="red"
                    )
        else:
            self.last_card_id = None
            self.status_label.config(
                text=error,
                fg="yellow"
            )

        self.root.after(2000, self.check_loop)


def mode_lock():
    root = tk.Tk()
    app = LockScreen(root)
    root.mainloop()


def show_help():
    print("Smart Card / NFC Combined System")
    print()
    print("Commands:")
    print("  python card_system.py readers")
    print("  python card_system.py read")
    print("  python card_system.py add")
    print("  python card_system.py check")
    print("  python card_system.py lock")
    print("  python card_system.py watch")


def main():
    if len(sys.argv) < 2:
        show_help()
        return

    command = sys.argv[1].lower().strip()

    if command == "readers":
        show_readers()
    elif command == "read":
        mode_read()
    elif command == "add":
        mode_add()
    elif command == "check":
        mode_check()
    elif command == "lock":
        mode_lock()
    elif command == "watch":
        mode_watch()
    else:
        show_help()


if __name__ == "__main__":
    main()