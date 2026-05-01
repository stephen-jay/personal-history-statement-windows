# Fix: Organization Filter Elements Not Found

## Problem
HTML file has the org filter elements, but Electron app is serving stale HTML from memory.

```
[ORG-FILTER] Init - btn: false dropdown: false searchInput: false
[ORG-FILTER] Missing required DOM elements
```

## Root Cause
This is an Electron app. Electron loads the HTML when the window is created. Changes to `src/ui/index.html` aren't automatically reloaded.

## Solution
**RESTART THE ELECTRON APP**

### Step 1: Close the app
- Close the APOLLO Personnel Database window

### Step 2: Re-open the app
```bash
npm start
```

### Step 3: Verify in DevTools Console
Open DevTools (F12) and you should now see:
```
[ORG-FILTER] Init - btn: true dropdown: true searchInput: true
[ORG-FILTER] All elements found, attaching listeners
[ORG-FILTER] Updated org list: ['Org A', 'Org B', ...]
```

### Step 4: Test the Filter
1. Click the **Organization** column header
2. The dropdown should open with a list of organizations
3. Select an organization
4. The table should instantly filter to show only that organization's personnel
5. Type in the search box - both filters should work together

## If Still Not Working

**Double-check the HTML file contains these IDs:**
- `id="org-filter-btn"` (button)
- `id="org-filter-dropdown"` (dropdown container)
- `id="org-filter-search"` (search input)
- `id="org-filter-list"` (options list)

Expected location in index.html: **Lines 175-186** in the `<thead>` section, inside the `<th>` for the Organization column.

File path: `src/ui/index.html`
