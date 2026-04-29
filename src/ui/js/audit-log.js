
export function initAuditLogs({
  isAdmin,
  phsModalCtl,
  listView,
  analyticsView,
  adminView,
  auditView,
  setActiveNav,
  setAppView,
  topbarSection,
  setTopbarSection,
  auditLogsContainer,
  auditSearch,
  auditFilterAction,
  adminApi,
  toast
}) {
  let allAuditLogs = [];

  function showAuditLogs() {
      if (!isAdmin) {
        toast.error('Admin access required.');
        return;
      }
      if (phsModalCtl && phsModalCtl.isOpen()) {
        phsModalCtl.close(false);
      }
      if (listView) {
        listView.classList.remove('active');
        listView.setAttribute('aria-hidden', 'true');
      }
      if (analyticsView) {
        analyticsView.classList.remove('active');
        analyticsView.setAttribute('aria-hidden', 'true');
      }
      if (adminView) {
        adminView.classList.remove('active');
        adminView.setAttribute('aria-hidden', 'true');
      }
      if (auditView) {
        auditView.classList.add('active');
        auditView.setAttribute('aria-hidden', 'false');
      }
      setActiveNav('audit');
      setAppView('audit');
      setTopbarSection(topbarSection, 'System Audit Logs');
      loadAuditLogs();
    }

    function loadAuditLogs() {
      if (!auditLogsContainer) return;
      auditLogsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">Loading audit records...</div>';
      
      adminApi.getAuditLogs().then(function (logs) {
        allAuditLogs = logs || [];
        applyAuditFilters();
      }).catch(function (err) {
        console.error(err);
        auditLogsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #b91c1c;">Failed to load logs: ' + (err.message || String(err)) + '</div>';
      });
    }

    function applyAuditFilters() {
      const searchTerm = (auditSearch && auditSearch.value ? auditSearch.value : '').toLowerCase().trim();
      const actionFilter = auditFilterAction && auditFilterAction.value ? auditFilterAction.value : '';

      const filteredLogs = allAuditLogs.filter(log => {
        const matchesAction = !actionFilter || log.action === actionFilter;
        const searchTarget = `${log.admin_name || ''} ${log.target_personnel_name || ''} ${log.action} ${log.table_name}`.toLowerCase();
        const matchesSearch = !searchTerm || searchTarget.includes(searchTerm);
        return matchesAction && matchesSearch;
      });

      renderAuditLogs(filteredLogs);
    }

    if (auditSearch) auditSearch.addEventListener('input', applyAuditFilters);
    if (auditFilterAction) auditFilterAction.addEventListener('change', applyAuditFilters);
    
    if (auditLogsContainer) {
      auditLogsContainer.addEventListener('click', function(e) {
        const header = e.target.closest('.timeline-summary.expandable');
        if (header) {
          const item = header.closest('.timeline-item');
          if (item) item.classList.toggle('expanded');
        }
      });
    }

    function renderAuditLogs(logs) {
      if (!auditLogsContainer) return;
      if (!logs || logs.length === 0) {
        auditLogsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">No activity logs found matching your criteria.</div>';
        return;
      }

      const imageFields = [
        'photoDataUrl', 'signatureDataUrl', 'leftThumbMarkDataUrl', 
        'rightThumbMarkDataUrl', 'handwrittenEntryDataUrl',
        'photo_data_url', 'signature_data_url', 'left_thumb_mark_data_url',
        'right_thumb_mark_data_url', 'handwritten_entry_data_url'
      ];
      
      // Group logs by date
      const groupedLogs = {};
      logs.forEach(log => {
        const d = new Date(log.changed_at);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateKey;
        if (d.toDateString() === today.toDateString()) dateKey = 'Today';
        else if (d.toDateString() === yesterday.toDateString()) dateKey = 'Yesterday';
        else dateKey = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        
        if (!groupedLogs[dateKey]) groupedLogs[dateKey] = [];
        groupedLogs[dateKey].push(log);
      });

      let html = '<div class="timeline-container">';
      let index = 0;
      
      for (const [dateGrp, grpLogs] of Object.entries(groupedLogs)) {
        html += `
          <div class="timeline-group">
            <div class="timeline-date-header">${dateGrp}</div>
            <div class="timeline-items">
        `;
        
        for (const log of grpLogs) {
          const actionClass = log.action.toLowerCase();
          const dateObj = new Date(log.changed_at);
          const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                          
          const adminName = log.admin_name || 'System User';
          let targetName = log.target_personnel_name || `Record ID: ${log.record_id.slice(0,8)}...`;
          if (log.table_name !== 'personnel') {
             targetName += ` (${log.table_name.replace('personnel_', '').replace(/_/g, ' ')})`;
          }
          
          let summaryText = '';
          let diffGridHtml = '';
          let hasDiff = false;
  
          if (log.action === 'UPDATE' && log.old_data && log.new_data) {
            let changeCount = 0;
            const diffRows = [];
            
            for (const key in log.new_data) {
              if (JSON.stringify(log.old_data[key]) !== JSON.stringify(log.new_data[key])) {
                if (['updated_at', 'version', 'created_at', 'deleted_at'].includes(key)) continue;
                
                changeCount++;
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                if (imageFields.includes(key)) {
                  diffRows.push(`
                    <tr>
                      <td class="diff-label">${label}</td>
                      <td colspan="3" class="diff-media"><span class="diff-media-badge">Media File Updated</span></td>
                    </tr>
                  `);
                  continue;
                }
  
                const oldVal = log.old_data[key] == null || log.old_data[key] === '' ? '<span class="diff-empty">empty</span>' : String(log.old_data[key]);
                const newVal = log.new_data[key] == null || log.new_data[key] === '' ? '<span class="diff-empty">empty</span>' : String(log.new_data[key]);
                
                const displayOld = oldVal.length > 80 ? oldVal.slice(0, 77) + '...' : oldVal;
                const displayNew = newVal.length > 80 ? newVal.slice(0, 77) + '...' : newVal;
  
                diffRows.push(`
                  <tr>
                    <td class="diff-label">${label}</td>
                    <td class="diff-old">${displayOld}</td>
                    <td class="diff-arrow">→</td>
                    <td class="diff-new">${displayNew}</td>
                  </tr>
                `);
              }
            }
            
            if (changeCount > 0) {
              summaryText = `Modified ${changeCount} field${changeCount !== 1 ? 's' : ''}`;
              diffGridHtml = `
                <table class="timeline-diff-table">
                  <tbody>${diffRows.join('')}</tbody>
                </table>
              `;
              hasDiff = true;
            } else {
              summaryText = `System metadata updated`;
              diffGridHtml = `<div class="timeline-no-diff">Only internal system fields (like timestamps) were modified.</div>`;
            }
          } else if (log.action === 'INSERT') {
             summaryText = `Created new record`;
             diffGridHtml = `<div class="timeline-no-diff success">Initial record data saved successfully.</div>`;
          } else if (log.action === 'DELETE') {
             summaryText = `Removed record from active roster`;
             diffGridHtml = `<div class="timeline-no-diff danger">Record moved to archive/trash.</div>`;
          }
          
          let titleHtml = '';
          if (log.action === 'UPDATE') {
             titleHtml = `<strong>${adminName}</strong> updated record for <strong>${targetName}</strong>`;
          } else if (log.action === 'INSERT') {
             titleHtml = `<strong>${adminName}</strong> created record for <strong>${targetName}</strong>`;
          } else if (log.action === 'DELETE') {
             titleHtml = `<strong>${adminName}</strong> deleted record for <strong>${targetName}</strong>`;
          }
          
          html += `
            <div class="timeline-item audit-card" data-index="${index}">
              <div class="timeline-marker ${actionClass}"></div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <div class="timeline-title">${titleHtml}</div>
                  <div class="timeline-time">${timeStr}</div>
                </div>
                <div class="timeline-body">
                  <div class="timeline-summary ${hasDiff ? 'audit-card-header expandable' : ''}">
                    <div class="timeline-summary-info">
                      <span class="timeline-action-badge ${actionClass}">${log.action}</span>
                      <span class="timeline-summary-text">${summaryText}</span>
                    </div>
                    ${hasDiff ? '<div class="timeline-expand-icon audit-toggle-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></div>' : ''}
                  </div>
                  ${hasDiff ? `
                  <div class="timeline-details audit-details-container">
                    ${diffGridHtml}
                  </div>` : `
                  <div class="timeline-details-inline">
                    ${diffGridHtml}
                  </div>
                  `}
                </div>
              </div>
            </div>
          `;
          index++;
        }
        
        html += `
            </div>
          </div>
        `;
      }
      
      html += '</div>';
      auditLogsContainer.innerHTML = html;
    }

    

  return { showAuditLogs };
}
