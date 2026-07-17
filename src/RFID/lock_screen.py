import tkinter as tk
import requests
from smartcard.System import readers
from smartcard.Exceptions import NoCardException, CardConnectionException

SERVER_URL = "http://10.10.218.74:5000"
API_TOKEN = "change_this_secret_token"


def read_card():
    available_readers = readers()

    if not available_readers:
        return None, "No smart card reader detected."

    reader = available_readers[0]

    try:
        connection = reader.createConnection()
        connection.connect()

        atr = connection.getATR()
        card_id = "".join(format(byte, "02X") for byte in atr)

        return card_id, None

    except NoCardException:
        return None, "Waiting for card..."

    except CardConnectionException:
        return None, "Unable to connect to card."

    except Exception as e:
        return None, str(e)


def verify_card(card_id):
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


class LockScreen:
    def __init__(self, root):
        self.root = root
        self.root.title("Smart Card Server Test")
        self.root.geometry("700x400")
        self.root.configure(bg="black")

        self.title_label = tk.Label(
            root,
            text="SMART CARD SERVER TEST",
            fg="white",
            bg="black",
            font=("Arial", 24, "bold")
        )
        self.title_label.pack(pady=50)

        self.status_label = tk.Label(
            root,
            text="Waiting for card...",
            fg="yellow",
            bg="black",
            font=("Arial", 16)
        )
        self.status_label.pack(pady=30)

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
        card_id, error = read_card()

        if card_id:
            if card_id != self.last_card_id:
                self.last_card_id = card_id

                self.status_label.config(
                    text="Card detected. Checking server...",
                    fg="yellow"
                )

                authorized, owner_name, server_error = verify_card(card_id)

                if authorized:
                    self.status_label.config(
                        text=f"Authorized. Welcome, {owner_name}!",
                        fg="lightgreen"
                    )
                else:
                    self.status_label.config(
                        text=server_error,
                        fg="red"
                    )
        else:
            self.last_card_id = None
            self.status_label.config(
                text=error,
                fg="yellow"
            )

        self.root.after(2000, self.check_loop)


if __name__ == "__main__":
    root = tk.Tk()
    app = LockScreen(root)
    root.mainloop()