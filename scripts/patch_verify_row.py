with open('src/ui/login.html', 'rb') as f:
    content = f.read().decode('utf-8')

# Add id to verify otp-row div (the one without an ID)
old = '              <div class="otp-row">'
new = '              <div class="otp-row" id="verify-otp-row">'
if old in content:
    content = content.replace(old, new, 1)
    with open('src/ui/login.html', 'wb') as f:
        f.write(content.encode('utf-8'))
    print('SUCCESS: added verify-otp-row id')
else:
    print('ERROR: target not found')
