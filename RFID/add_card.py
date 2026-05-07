import requests

SERVER_URL = "http://10.10.218.74:5000"
API_TOKEN = "change_this_secret_token"

card_id = input("Enter Card ID / ATR: ").strip()
owner_name = input("Enter owner name: ").strip()

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