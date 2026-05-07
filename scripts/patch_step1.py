with open('src/ui/login.html', 'rb') as f:
    content = f.read().decode('utf-8')

lines = content.split('\r\n')
print(f'Total lines: {len(lines)}')

# ── Patch 1: Step 1 username block (lines 89-96, 0-indexed 88-95) ────────────
old_step1 = [
    '            <!-- STEP 1: Username -->',
    '            <div class="step-content visible" id="step-username">',
    '              <h2>Enter your username</h2>',
    '              <div class="input-wrap">',
    '                <span class="input-icon">\U0001f464</span>',
    '                <input type="text" id="username-input" placeholder="Enter your username" autocomplete="username" />',
    '              </div>',
    '              <button class="btn-primary" id="btn-next-username">Next</button>',
    '            </div>',
]

new_step1 = [
    '            <!-- STEP 1: Username -->',
    '            <div class="step-content visible" id="step-username">',
    '              <div class="username-card">',
    '                <div class="username-avatar">',
    '                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">',
    '                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>',
    '                    <circle cx="12" cy="7" r="4"/>',
    '                  </svg>',
    '                </div>',
    '                <h2>Enter your username</h2>',
    '                <p class="username-subtitle">Enter your assigned personnel username<br/>to continue securely.</p>',
    '                <div class="input-wrap">',
    '                  <span class="input-icon">',
    '                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>',
    '                      <circle cx="12" cy="7" r="4"/>',
    '                    </svg>',
    '                  </span>',
    '                  <input type="text" id="username-input" placeholder="Enter your username" autocomplete="username" />',
    '                </div>',
    '                <button class="btn-primary" id="btn-next-username">Next <span>&rarr;</span></button>',
    '              </div>',
    '            </div>',
]

# ── Patch 2: Footer (line 212, 0-indexed 211) ─────────────────────────────────
old_footer = '          <span>FAQ</span> | <span>Features</span> | <span>Support</span>'
new_footer = (
    '          <span class="footer-item">'
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    ' FAQ</span>'
    ' | '
    '<span class="footer-item">'
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
    ' Features</span>'
    ' | '
    '<span class="footer-item">'
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>'
    ' Support</span>'
)

# Apply patch 1 - find and replace lines
old_joined = '\r\n'.join(old_step1)
new_joined = '\r\n'.join(new_step1)
if old_joined in content:
    content = content.replace(old_joined, new_joined, 1)
    print('Patch 1 (step-username): SUCCESS')
else:
    print('Patch 1 (step-username): FAILED - block not found')
    # Debug: print lines around where it should be
    for i, l in enumerate(lines[86:100], start=87):
        print(f'  {i}: {repr(l)}')

# Apply patch 2 - footer
if old_footer in content:
    content = content.replace(old_footer, new_footer, 1)
    print('Patch 2 (footer): SUCCESS')
else:
    print('Patch 2 (footer): FAILED - footer text not found')

with open('src/ui/login.html', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done.')
