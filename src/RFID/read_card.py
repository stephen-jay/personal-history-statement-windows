from smartcard.System import readers
from smartcard.Exceptions import NoCardException, CardConnectionException

available_readers = readers()

if not available_readers:
    print("No smart card reader detected.")
    exit()

print("Detected readers:")
for index, reader in enumerate(available_readers):
    print(f"{index + 1}. {reader}")

reader = available_readers[0]
print(f"\nUsing reader: {reader}")

try:
    connection = reader.createConnection()
    connection.connect()

    atr = connection.getATR()
    card_id = "".join(format(byte, "02X") for byte in atr)

    print("\nCard detected.")
    print(f"Card ID / ATR: {card_id}")

except NoCardException:
    print("No card inserted.")

except CardConnectionException:
    print("Unable to connect to card.")

except Exception as e:
    print(f"Error: {e}")