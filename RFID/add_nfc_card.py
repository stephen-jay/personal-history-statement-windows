import requests

SERVER_URL = "http://10.10.218.74:5000"
API_TOKEN = "change_this_secret_token"


def add_nfc_card():
    card_id = input("Enter NFC UID: ").strip().upper()
    owner_name = input("Enter owner name: ").strip()

    if not card_id:
        print("NFC UID is required.")
        return

    if not owner_name:
        print("Owner name is required.")
        return

    try:
        response = requests.post(
            f"{SERVER_URL}/add-card",
            json={
                "card_id": card_id,
                "owner_name": owner_name
            },
            headers={
                "X-API-Token": API_TOKEN
            },
            timeout=5
        )

        print(response.json())

    except requests.exceptions.ConnectionError:
        print("Cannot connect to server.")

    except requests.exceptions.Timeout:
        print("Server request timed out.")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    add_nfc_card()