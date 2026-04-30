# Organization Filter Integration Map

## ✅ WIRING VERIFIED

### STEP 1: Initial Load → Filter Initialization
```
bootstrap() [main.js:51]
  ↓
loadList() [main.js:730]
  ↓
loadAllDataAndRender() [main.js:312]
  ├─ renderRosterSkeleton() [shows loader]
  ↓
renderList(records, listDeps) [main.js:327]
  ├─ Imported from list.js [main.js:6]
  ↓
list.js:renderList() [list.js:340]
  ├─ initializeOrganizationFilter(records, deps)
  │   ├─ Find DOM elements: org-filter-btn, org-filter-dropdown, org-filter-search
  │   ├─ Attach click listener to button
  │   ├─ Attach input listener to search box
  │   └─ Attach outside-click listener to close dropdown
  │
  ├─ updateOrganizationList(records)
  │   ├─ Extract unique orgs via getUniqueOrganizations()
  │   ├─ Store in global: currentOrgs = [...]
  │   └─ Call renderOrgOptions() to populate dropdown
  │
  └─ rerenderRoster(records, deps)
      └─ Apply BOTH filters:
         ├─ organizationFilter (global state)
         └─ name search (from deps.searchInput)
```

### STEP 2: User Selects Organization
```
User clicks org in dropdown
  ↓
renderOrgOptions() click handler [list.js:50-60]
  ├─ Set: organizationFilter = selectedOrg
  └─ Call: closeOrgDropdown()
      ├─ Hide dropdown
      ├─ Dispatch CustomEvent('phs-org-filter-changed')
      ↓
Main.js event listener [main.js:695]
  ├─ Catch: 'phs-org-filter-changed'
  ├─ Call: renderList(rosterCache.records, listDeps)
  ↓
rerenderRoster() [list.js:140]
  ├─ Filtered = records.filter(r ⇒ 
  │    organizationFilter match && name search match)
  ├─ Render filtered rows to table
  └─ Restore listeners on new rows (edit, delete, view)
```

### STEP 3: User Searches by Name (keeps org filter active)
```
User types in search input
  ↓
Search input listener [main.js:675]
  ├─ Call: renderList(rosterCache.records, listDeps)
  ├─ [renderList calls initializeOrganizationFilter() AGAIN]
  │   ↓ But: organizationFilterInitialized=true so returns early ✅
  │   This preserves: organizationFilter state
  ↓
rerenderRoster() [list.js:140]
  ├─ BOTH filters applied:
  │   ├─ Organization filter: organizationFilter (preserved)
  │   └─ Name search: query from searchInput.value
  └─ Result: Only records matching BOTH filters shown
```

---

## 🔍 DEBUGGING CHECKLIST

**Reload app and open DevTools (F12 → Console). You should see:**

1. **On initial load:**
   ```
   [ORG-FILTER] renderList called with X records
   [ORG-FILTER] Init - btn: true, dropdown: true, searchInput: true
   [ORG-FILTER] All elements found, attaching listeners
   [ORG-FILTER] Updated org list: ['Org A', 'Org B', 'Org C', ...]
   ```

2. **When you click Organization button:**
   ```
   (Dropdown opens, options visible)
   ```

3. **When you select an organization:**
   ```
   [ORG-FILTER] Selected org: 'Org A'
   [MAIN] Org filter changed event received
   [ORG-FILTER] renderList called with X records
   [ORG-FILTER] Already initialized, skipping
   [ORG-FILTER] Updated org list: [...]
   (Table re-renders with only Org A personnel)
   ```

4. **When you search while org filter active:**
   ```
   [ORG-FILTER] renderList called with X records
   [ORG-FILTER] Already initialized, skipping
   [ORG-FILTER] Updated org list: [...]
   (Table re-renders with both filters applied)
   ```

---

## ❌ IF YOU DON'T SEE LOGS

**Problem: DOM elements not found**
- Check HTML has: `id="org-filter-btn"`, `id="org-filter-dropdown"`, `id="org-filter-search"`, `id="org-filter-list"`
- Location: [src/ui/index.html](src/ui/index.html#L175-L186)

**Problem: renderList() not called**
- Check browser Network tab: Does API call succeed?
- Verify records are returned (check Network → XHR → personnel response)

**Problem: Event listener not triggering rerender**
- Manually call in console: `window.dispatchEvent(new CustomEvent('phs-org-filter-changed'))`
- Should see logs and table should re-render

---

## 📋 CODE FILES

| File | Function | Line | Purpose |
|------|----------|------|---------|
| main.js | bootstrap() | 51 | App init |
| main.js | loadList() | 361 | Entry to load flow |
| main.js | loadAllDataAndRender() | 312 | Cache + fetch logic |
| main.js | search listener | 675 | Trigger rerender on search |
| main.js | org filter listener | 695 | **← Event handler for filter changes** |
| list.js | renderList() | 340 | Main render orchestrator |
| list.js | initializeOrganizationFilter() | 98 | **← ONE-TIME init of filter UI** |
| list.js | updateOrganizationList() | 15 | Extract orgs from records |
| list.js | renderOrgOptions() | 25 | Render dropdown options |
| list.js | rerenderRoster() | 140 | Apply both filters to table |
| index.html | — | 175 | Filter UI HTML |
