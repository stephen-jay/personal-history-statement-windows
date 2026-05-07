with open('src/ui/login.html', 'rb') as f:
    content = f.read().decode('utf-8')

lines = content.split('\r\n')
print(f'Total lines: {len(lines)}')

# Step 2 block is lines 112-153 (1-indexed) = indices 111-152
new_step2 = [
    '            <!-- STEP 2: Tap Card -->',
    '            <div class="step-content" id="step-card" hidden>',
    '              <h2>Tap your assigned card</h2>',
    '              <p class="step-desc">Hold your NFC/RFID card near the reader<br/>to continue securely.</p>',
    '',
    '              <!-- Circular NFC Reader -->',
    '              <div class="nfc-orbit" id="nfc-orbit">',
    '                <div class="nfc-ring nfc-ring-1"></div>',
    '                <div class="nfc-ring nfc-ring-2"></div>',
    '                <div class="nfc-ring nfc-ring-3"></div>',
    '                <div class="nfc-card-wrap">',
    '                  <svg class="nfc-card-svg" width="88" height="60" viewBox="0 0 88 60" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '                    <rect width="88" height="60" rx="7" fill="#1e293b"/>',
    '                    <rect x="10" y="16" width="16" height="12" rx="2" fill="#94a3b8"/>',
    '                    <line x1="14" y1="16" x2="14" y2="28" stroke="#64748b" stroke-width="0.8"/>',
    '                    <line x1="18" y1="16" x2="18" y2="28" stroke="#64748b" stroke-width="0.8"/>',
    '                    <line x1="10" y1="20" x2="26" y2="20" stroke="#64748b" stroke-width="0.8"/>',
    '                    <line x1="10" y1="24" x2="26" y2="24" stroke="#64748b" stroke-width="0.8"/>',
    '                    <path d="M 62 22 A 6 6 0 0 1 62 38" stroke="#475569" stroke-width="2" stroke-linecap="round" fill="none"/>',
    '                    <path d="M 66 18 A 12 12 0 0 1 66 42" stroke="#475569" stroke-width="2" stroke-linecap="round" fill="none"/>',
    '                    <path d="M 70 14 A 18 18 0 0 1 70 46" stroke="#475569" stroke-width="2" stroke-linecap="round" fill="none"/>',
    '                    <rect x="10" y="46" width="68" height="3" rx="1.5" fill="#0f172a"/>',
    '                  </svg>',
    '                </div>',
    '              </div>',
    '',
    '              <!-- Status -->',
    '              <div class="nfc-status" id="nfc-status">',
    '                <span class="nfc-status-dot"></span>',
    '                <span class="nfc-status-text" id="card-login-message">Waiting for NFC/RFID card...</span>',
    '              </div>',
    '',
    '              <button class="btn-link" id="btn-cancel-card">Cancel</button>',
    '            </div>',
]

# Replace lines 111-152 (0-indexed) with new block
result_lines = lines[:111] + new_step2 + lines[153:]
new_content = '\r\n'.join(result_lines)

with open('src/ui/login.html', 'wb') as f:
    f.write(new_content.encode('utf-8'))

print(f'SUCCESS. Lines: {len(lines)} -> {len(result_lines)}')
