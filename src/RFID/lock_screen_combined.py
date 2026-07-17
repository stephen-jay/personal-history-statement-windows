import tkinter as tk
import requests

from smartcard.System import readers
from smartcard.CardConnection import CardConnection


SERVER_URL = "http://10.10.218.74:5000"
API_TOKEN = "change_this_secret_token"

GET_UID_COMMAND = [0xFF, 0xCA, 0x00, 0x00, 0x00]


def bytes_to_hex(byte_list):
    return "".join(format(byte, "02X") for byte in byte_list)


def get_all_readers():
    return readers()


def find_acr122u_reader():
    available_readers = get_all_readers()

    for reader in available_readers:
        reader_name = str(reader).upper()

        if "ACR122" in reader_name or "ACS" in reader_name or "PICC" in reader_name:
            return reader

    return None


def find_gemalto_reader():
    available_readers = get_all_readers()

    for reader in available_readers:
        reader_name = str(reader).upper()

        if "GEMALTO" in reader_name or "USB SMART CARD" in reader_name:
            return reader

    return None


def try_connect(connection):
    try:
        connection.connect(CardConnection.T1_protocol)
        return True
    except Exception:
        pass

    try:
        connection.connect(CardConnection.T0_protocol)
        return True
    except Exception:
        pass

    try:
        connection.connect()
        return True
    except Exception:
        pass

    return False


def read_nfc_uid():
    reader = find_acr122u_reader()

    if not reader:
        return None

    try:
        connection = reader.createConnection()

        if not try_connect(connection):
            return None

        data, sw1, sw2 = connection.transmit(GET_UID_COMMAND)

        try:
            connection.disconnect()
        except Exception:
            pass

        if sw1 == 0x90 and sw2 == 0x00 and data:
            return {
                "card_id": bytes_to_hex(data),
                "card_type": "NFC_UID",
                "reader_name": str(reader)
            }

        return None

    except Exception:
        return None


def read_smart_card_atr():
    reader = find_gemalto_reader()

    if not reader:
        return None

    try:
        connection = reader.createConnection()

        if not try_connect(connection):
            return None

        atr = connection.getATR()

        try:
            connection.disconnect()
        except Exception:
            pass

        if atr:
            return {
                "card_id": bytes_to_hex(atr),
                "card_type": "SMART_CARD_ATR",
                "reader_name": str(reader)
            }

        return None

    except Exception:
        return None


def scan_card():
    available_readers = get_all_readers()

    if not available_readers:
        return None, "No card reader detected."

    nfc_card = read_nfc_uid()

    if nfc_card:
        return nfc_card, None

    smart_card = read_smart_card_atr()

    if smart_card:
        return smart_card, None

    return None, "Waiting for NFC card or smart card..."


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
        return False, None, "Server request timed out."

    except Exception as e:
        return False, None, str(e)


class CombinedLockScreen:
    def __init__(self, root):
        self.root = root
        self.root.title("Combined Smart Card / NFC Lock Screen")
        self.root.geometry("780x430")
        self.root.configure(bg="black")

        self.title_label = tk.Label(
            root,
            text="SMART CARD / NFC SERVER LOCK",
            fg="white",
            bg="black",
            font=("Arial", 24, "bold")
        )
        self.title_label.pack(pady=40)

        self.status_label = tk.Label(
            root,
            text="Waiting for NFC card or smart card...",
            fg="yellow",
            bg="black",
            font=("Arial", 16),
            justify="center"
        )
        self.status_label.pack(pady=25)

        self.info_label = tk.Label(
            root,
            text="ACR122U: tap NFC card\nGemalto CT30: insert smart card",
            fg="white",
            bg="black",
            font=("Arial", 13),
            justify="center"
        )
        self.info_label.pack(pady=10)

        self.note_label = tk.Label(
            root,
            text="Safe test mode: Press ESC to close",
            fg="gray",
            bg="black",
            font=("Arial", 12)
        )
        self.note_label.pack(pady=20)

        self.root.bind("<Escape>", lambda event: self.root.destroy())

        self.last_card_id = None
        self.check_loop()

    def check_loop(self):
        card_data, error = scan_card()

        if card_data:
            card_id = card_data["card_id"]
            card_type = card_data["card_type"]
            reader_name = card_data["reader_name"]

            if card_id != self.last_card_id:
                self.last_card_id = card_id

                self.status_label.config(
                    text=(
                        f"Card detected!\n"
                        f"Type: {card_type}\n"
                        f"Reader: {reader_name}\n"
                        f"Checking server..."
                    ),
                    fg="yellow"
                )

                authorized, owner_name, server_error = verify_card_on_server(card_id)

                if authorized:
                    self.status_label.config(
                        text=(
                            f"AUTHORIZED\n"
                            f"Welcome, {owner_name}!\n\n"
                            f"Type: {card_type}"
                        ),
                        fg="lightgreen"
                    )
                else:
                    self.status_label.config(
                        text=(
                            f"DENIED\n"
                            f"{server_error}\n\n"
                            f"Card ID: {card_id}"
                        ),
                        fg="red"
                    )
        else:
            self.last_card_id = None
            self.status_label.config(
                text=error,
                fg="yellow"
            )

        self.root.after(1500, self.check_loop)


if __name__ == "__main__":
    root = tk.Tk()
    app = CombinedLockScreen(root)
    root.mainloop()