with open('src/ui/login.html', 'rb') as f:
    content = f.read().decode('utf-8')

old = 'width="88" height="60" viewBox="0 0 88 60"'
new = 'width="130" height="88" viewBox="0 0 88 60"'

if old in content:
    content = content.replace(old, new, 1)
    with open('src/ui/login.html', 'wb') as f:
        f.write(content.encode('utf-8'))
    print('SUCCESS: card SVG enlarged to 130x88')
else:
    print('NOT FOUND - checking what is in the file...')
    for line in content.split('\r\n'):
        if 'nfc-card-svg' in line or ('width=' in line and 'height=' in line and '60' in line):
            print(repr(line))
