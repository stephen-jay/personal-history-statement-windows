import sys

with open('src/ui/login.html', 'rb') as f:
    content = f.read().decode('utf-8')

lines = content.split('\r\n')

# Lines 158-185 (0-indexed: 157-184) are the old enrollment block
# We'll replace them with the new block

new_lines = [
    '            <!-- STEP 3B: TOTP Enrollment (Hidden) -->',
    '            <div class="step-content" id="step-enroll" hidden>',
    '              <div class="enroll-header">',
    '                <div class="enroll-icon-badge">',
    '                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>',
    '                </div>',
    '                <div>',
    '                  <h2>Setup Authenticator</h2>',
    '                  <p class="enroll-subtitle">Link your authenticator app to continue.</p>',
    '                </div>',
    '              </div>',
    '',
    '              <div class="enroll-layout">',
    '                <div class="qr-container">',
    '                  <img id="totp-qr" src="" alt="QR Code" />',
    '                  <div class="qr-label">Scan with your app</div>',
    '                </div>',
    '                <div class="manual-info">',
    '                  <ol class="enroll-steps">',
    '                    <li>Get <strong>Google Authenticator</strong> or <strong>Authy</strong></li>',
    '                    <li>Scan the QR code</li>',
    '                    <li>Enter the 6-digit code to confirm</li>',
    '                  </ol>',
    '                  <div class="secret-box">',
    '                    <code id="totp-secret-text"></code>',
    '                    <button id="btn-copy-secret" class="btn-copy" type="button">',
    '                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    '                      Copy',
    '                    </button>',
    '                  </div>',
    '                </div>',
    '              </div>',
    '',
    '              <div class="enroll-otp-label">ENTER THE CODE FROM YOUR APP TO CONFIRM SETUP</div>',
    '              <div class="otp-row" id="enroll-otp-row">',
    '                <input class="otp-box-enroll" maxlength="1" type="text" inputmode="numeric" />',
    '                <input class="otp-box-enroll" maxlength="1" type="text" inputmode="numeric" />',
    '                <input class="otp-box-enroll" maxlength="1" type="text" inputmode="numeric" />',
    '                <input class="otp-box-enroll" maxlength="1" type="text" inputmode="numeric" />',
    '                <input class="otp-box-enroll" maxlength="1" type="text" inputmode="numeric" />',
    '                <input class="otp-box-enroll" maxlength="1" type="text" inputmode="numeric" />',
    '              </div>',
    '              <input type="hidden" id="enroll-otp" />',
    '              <button class="btn-primary" id="btn-verify-enroll">Verify &amp; Login <span>\u2192</span></button>',
    '              <p class="enroll-trouble">&#x24D8; Having trouble? Rescan the QR code or <button class="btn-inline-link" id="btn-cancel-enroll" type="button">try again</button>.</p>',
    '            </div>',
]

# Replace lines 157-184 (0-indexed) with new block
# Original: lines 158-185 (1-indexed) = indices 157-184
result_lines = lines[:157] + new_lines + lines[185:]

new_content = '\r\n'.join(result_lines)

with open('src/ui/login.html', 'wb') as f:
    f.write(new_content.encode('utf-8'))

print('SUCCESS: login.html patched.')
print(f'Original lines: {len(lines)}, New lines: {len(result_lines)}')
