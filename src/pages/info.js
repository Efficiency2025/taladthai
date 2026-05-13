/**
 * Info page — displays participant details, booth assignment, zone badge,
 * and wristband distribution approval action.
 *
 * Multi-table behaviour:
 *   When a participant has multiple tables (participant._allMatches.length > 1),
 *   the โต๊ะ section renders interactive per-table check-in buttons.
 *   Each button maps to its own Firestore document (_docId).
 *   The global success banner only appears when ALL tables are approved.
 */
import { getSearchResult, setSearchResult } from './search.js';
import { approve, checkStatus } from '../services/api.js';
import { getBoothInfo, getZoneFromTable, updateRow } from '../services/cache.js';
import { navigate } from '../router.js';

/**
 * Zone color mapping for wristband badges.
 * Colors match the physical wristband zones from the seating chart.
 */
const ZONE_COLORS = {
  A: { bg: '#2e7d32', text: '#ffffff', label: 'โซน A' },
  B: { bg: '#1565c0', text: '#ffffff', label: 'โซน B' },
  C: { bg: '#e65100', text: '#ffffff', label: 'โซน C' },
  D: { bg: '#c62828', text: '#ffffff', label: 'โซน D' },
  F: { bg: '#6a1b9a', text: '#ffffff', label: 'โซน F' },
  VIP: { bg: '#bf8c00', text: '#ffffff', label: 'VIP', image: '/assets/vip-badge.png' },
};

/**
 * Render the info page for the found participant.
 * @param {HTMLElement} container
 */
export function renderInfo(container) {
  const participant = getSearchResult();

  if (!participant) {
    navigate('#/search');
    return;
  }

  const name = escapeHtml(String(participant['ชื่อผู้ค้า'] || '-'));
  const shop = escapeHtml(String(participant['ชื่อร้าน'] || '-'));
  const market = escapeHtml(String(participant['ตลาด'] || '-'));
  const phone = escapeHtml(String(participant['เบอร์โทร'] || '-'));
  const seq = escapeHtml(String(participant['ลำดับ'] || '-'));
  const tableRaw = String(participant['เลขที่โต๊ะ'] || '-');
  const approvedAt = String(participant['เวลาอนุมัติ'] || '');

  // Determine multi-table mode from merged rows
  const allMatches = participant._allMatches || [];
  const isMultiTable = allMatches.length > 1;

  // Compute approval status
  let isApproved, isPartiallyApproved;
  if (isMultiTable) {
    const approvedCount = allMatches.filter(
      r => String(r['สถานะการเข้างาน'] || '') === 'อนุมัติแล้ว'
    ).length;
    isApproved = approvedCount === allMatches.length;
    isPartiallyApproved = approvedCount > 0 && !isApproved;
  } else {
    isApproved = String(participant['สถานะการเข้างาน'] || 'รออนุมัติเข้างาน') === 'อนุมัติแล้ว';
    isPartiallyApproved = false;
  }

  // Get booth info and zone from first table number
  const boothInfo = getBoothInfo(market);
  const boothNumber = boothInfo ? boothInfo['บูธลงทะเบียน'] : '-';
  const zone = getZoneFromTable(tableRaw.split(',')[0]?.trim() || tableRaw);
  const zoneStyle = ZONE_COLORS[zone] || ZONE_COLORS.A;

  // Build table section (static badges for single-table; interactive buttons for multi-table)
  const tableBadges = buildTableBadges(tableRaw, isMultiTable ? allMatches : null);

  // Status bar content
  let statusContent, statusClass;
  if (isApproved) {
    statusContent = '✅ เข้าร่วมงานเรียบร้อย';
    statusClass = 'status-approved';
  } else if (isPartiallyApproved) {
    statusContent = '✅ บางโต๊ะอนุมัติแล้ว';
    statusClass = 'status-partial';
  } else {
    statusContent = '⏳ รอแจก Wrist Band';
    statusClass = 'status-pending';
  }

  container.innerHTML = `
    <div class="info-page" id="info-page">
      <div class="awning"></div>
      <div class="info-container">
        <button class="back-btn" id="back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          กลับ
        </button>

        ${isApproved ? renderCheckedInView(name, zone, zoneStyle, boothNumber, approvedAt, tableBadges) : ''}

        <div class="info-card ${isApproved ? 'approved' : ''}" id="info-card">
          <!-- Status Badge -->
          <div class="status-bar ${statusClass}" id="status-bar">
            ${statusContent}
          </div>

          <!-- Participant Details -->
          <div class="info-fields">
            <div class="info-row">
              <span class="info-label">ลำดับ</span>
              <span class="info-value">${seq}</span>
            </div>
            <div class="info-row">
              <span class="info-label">ชื่อผู้ค้า</span>
              <span class="info-value info-name">${name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">ชื่อร้าน</span>
              <span class="info-value">${shop}</span>
            </div>
            <div class="info-row">
              <span class="info-label">ตลาด</span>
              <span class="info-value">${escapeHtml(market)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">เบอร์โทร</span>
              <span class="info-value">${phone}</span>
            </div>

            <!-- Booth Assignment -->
            <div class="info-row highlight-row">
              <span class="info-label">📍 บูธลงทะเบียน</span>
              <span class="info-value booth-value">${escapeHtml(boothNumber)}</span>
            </div>

            <!-- Zone Badge -->
            ${zone ? `
            <div class="info-row highlight-row">
              <span class="info-label">🎗️ โซนสายรัดข้อมือ</span>
              ${zoneStyle.image
                ? `<span class="zone-badge zone-badge-img"><img src="${zoneStyle.image}" alt="${zoneStyle.label}" class="vip-badge-img" /></span>`
                : `<span class="zone-badge" style="background: ${zoneStyle.bg}; color: ${zoneStyle.text};">${zoneStyle.label}</span>`
              }
            </div>
            ` : ''}

            <!-- Table Numbers: static badges (single) or interactive check-in buttons (multi) -->
            <div class="info-row table-row">
              <span class="info-label">🪑 โต๊ะ</span>
              <div class="table-badges">${tableBadges}</div>
            </div>
          </div>

          ${isApproved ? `
            <div class="approved-timestamp">
              อนุมัติเมื่อ ${escapeHtml(approvedAt)}
            </div>
          ` : ''}

          <!-- Action Area: single approve button only for single-table pending participants -->
          ${!isApproved && !isMultiTable ? `
          <div class="action-area" id="action-area">
            <button id="approve-btn" class="approve-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              แจก Wrist Band
            </button>
          </div>
          ` : ''}
        </div>
      </div>
      <div class="fruit-decoration"></div>
    </div>
  `;

  bindInfoEvents(container, participant);
}

/**
 * Render the success banner shown after check-in (all tables approved).
 */
function renderCheckedInView(name, zone, zoneStyle, booth, approvedAt, tableBadges) {
  return `
    <div class="checkin-success" id="checkin-success">
      <div class="success-icon">✅</div>
      <div class="success-title">เข้าร่วมงานเรียบร้อย</div>
      <div class="success-name">${name}</div>
      <div class="success-meta">
        ${zone
          ? (zoneStyle.image
            ? `<span class="zone-badge zone-badge-lg zone-badge-img"><img src="${zoneStyle.image}" alt="${zoneStyle.label}" class="vip-badge-img vip-badge-lg" /></span>`
            : `<span class="zone-badge zone-badge-lg" style="background: ${zoneStyle.bg}; color: ${zoneStyle.text};">${zoneStyle.label}</span>`)
          : ''}
        <span class="success-booth">บูธ ${escapeHtml(booth)}</span>
      </div>
    </div>
  `;
}

/**
 * Build table number badges or interactive per-table check-in buttons.
 *
 * Single-table mode (allMatches is null): renders static colored badges.
 * Multi-table mode (allMatches has 2+ rows): renders interactive buttons,
 *   each with its own approval status, data-doc-id, and data-table-num.
 *
 * @param {string} tableString - comma-separated table numbers (used in single-table mode)
 * @param {Array|null} allMatches - array of row objects from _allMatches (multi-table mode)
 * @returns {string} HTML string
 */
function buildTableBadges(tableString, allMatches) {
  // Multi-table interactive check-in buttons
  if (allMatches && allMatches.length > 1) {
    return allMatches.map(row => {
      const tableNum = String(row['เลขที่โต๊ะ'] || '').trim();
      const rowApproved = String(row['สถานะการเข้างาน'] || '') === 'อนุมัติแล้ว';
      const zone = getZoneFromTable(tableNum);
      const zoneStyle = ZONE_COLORS[zone] || null;
      const accentColor = zoneStyle ? zoneStyle.bg : '#2e7d32';

      return `<button
        class="table-checkin-btn${rowApproved ? ' approved' : ''}"
        data-doc-id="${escapeHtml(row._docId || '')}"
        data-table-num="${escapeHtml(tableNum)}"
        style="--table-accent: ${accentColor}"
        ${rowApproved ? 'disabled' : ''}
        id="table-btn-${escapeHtml(row._docId || tableNum)}"
      >
        <span class="table-checkin-num">${escapeHtml(tableNum)}</span>
        <span class="table-status-chip">${rowApproved ? '✅ อนุมัติแล้ว' : '⏳ แจก Wrist Band'}</span>
      </button>`;
    }).join('');
  }

  // Single-table static badges (existing behaviour)
  if (!tableString || tableString === '-') {
    return '<span class="table-badge">-</span>';
  }

  const tables = tableString.split(/[,]/).map(t => t.trim()).filter(Boolean);
  return tables.map(t => {
    const zone = getZoneFromTable(t);
    const zoneStyle = ZONE_COLORS[zone] || null;
    const borderColor = zoneStyle ? zoneStyle.bg : '#999';
    return `<span class="table-badge" style="border-color: ${borderColor}">${escapeHtml(t)}</span>`;
  }).join('');
}

/**
 * Bind events for back button and approve button(s).
 * Routes to single-table or multi-table event binding based on _allMatches.
 *
 * @param {HTMLElement} container
 * @param {Object} participant
 */
function bindInfoEvents(container, participant) {
  // Back button
  const backBtn = container.querySelector('#back-btn');
  backBtn?.addEventListener('click', () => {
    setSearchResult(null);
    navigate('#/search');
  });

  const allMatches = participant._allMatches || [];
  const isMultiTable = allMatches.length > 1;

  if (isMultiTable) {
    bindMultiTableEvents(container, participant, allMatches);
    return;
  }

  // Single-table: original approve button
  const approveBtn = container.querySelector('#approve-btn');
  if (!approveBtn) return;

  approveBtn.addEventListener('click', async () => {
    // Confirmation prompt
    const confirmed = window.confirm(
      `ยืนยันแจก Wrist Band ให้\n"${String(participant['ชื่อผู้ค้า'] || '')}" ?`
    );
    if (!confirmed) return;

    approveBtn.disabled = true;
    approveBtn.textContent = 'กำลังอนุมัติ...';

    try {
      const result = await approve(participant._docId);

      if (result.alreadyApproved) {
        // Someone else approved while this staff was viewing
        showToast(container, 'ผู้ค้ารายนี้ได้รับอนุมัติไปแล้ว', 'warning');
        participant['สถานะการเข้างาน'] = 'อนุมัติแล้ว';
        participant['เวลาอนุมัติ'] = result.approvedAt || '';
      } else if (result.success) {
        participant['สถานะการเข้างาน'] = 'อนุมัติแล้ว';
        participant['เวลาอนุมัติ'] = result.approvedAt || '';
        updateRow(participant._docId, 'อนุมัติแล้ว', result.approvedAt);
      } else {
        showToast(container, 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
        approveBtn.disabled = false;
        approveBtn.textContent = 'แจก Wrist Band';
        return;
      }

      // Re-render to show success state
      setSearchResult(participant);
      renderInfo(container);
    } catch (error) {
      console.error('Approval failed:', error);
      showToast(container, 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
      approveBtn.disabled = false;
      approveBtn.textContent = 'แจก Wrist Band';
    }
  });
}

/**
 * Bind per-table check-in events for multi-table participants.
 * Each table button approves its own Firestore document independently.
 *
 * @param {HTMLElement} container
 * @param {Object} participant - merged participant object (has _allMatches)
 * @param {Array} allMatches - array of individual row objects
 */
function bindMultiTableEvents(container, participant, allMatches) {
  // Only select non-disabled buttons (pending tables)
  const tableButtons = container.querySelectorAll('.table-checkin-btn:not([disabled])');

  tableButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const docId = btn.dataset.docId;
      const tableNum = btn.dataset.tableNum;

      const confirmed = window.confirm(
        `ยืนยันแจก Wrist Band โต๊ะ ${tableNum}\nให้ "${String(participant['ชื่อผู้ค้า'] || '')}" ?`
      );
      if (!confirmed) return;

      btn.disabled = true;
      const chip = btn.querySelector('.table-status-chip');
      if (chip) chip.textContent = 'กำลังอนุมัติ...';

      try {
        const result = await approve(docId);

        if (result.success || result.alreadyApproved) {
          // Update button to approved state
          btn.classList.add('approved');
          if (chip) chip.textContent = '✅ อนุมัติแล้ว';

          // Update the matching row in _allMatches in-memory
          const row = allMatches.find(r => r._docId === docId);
          if (row) {
            row['สถานะการเข้างาน'] = 'อนุมัติแล้ว';
            row['เวลาอนุมัติ'] = result.approvedAt || '';
          }
          updateRow(docId, 'อนุมัติแล้ว', result.approvedAt);

          // Check if ALL tables are now approved
          const allApproved = allMatches.every(
            r => String(r['สถานะการเข้างาน'] || '') === 'อนุมัติแล้ว'
          );

          if (allApproved) {
            // Full re-render to show success banner
            participant['สถานะการเข้างาน'] = 'อนุมัติแล้ว';
            participant['เวลาอนุมัติ'] = result.approvedAt || '';
            setSearchResult(participant);
            renderInfo(container);
          } else {
            // Update status bar to partial approval state
            const statusBar = container.querySelector('#status-bar');
            if (statusBar) {
              statusBar.textContent = '✅ บางโต๊ะอนุมัติแล้ว';
              statusBar.className = 'status-bar status-partial';
            }
          }
        } else {
          showToast(container, 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
          btn.disabled = false;
          if (chip) chip.textContent = '⏳ แจก Wrist Band';
        }
      } catch (error) {
        console.error('Table approval failed:', error);
        showToast(container, 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
        btn.disabled = false;
        if (chip) chip.textContent = '⏳ แจก Wrist Band';
      }
    });
  });
}

/**
 * Show a toast notification.
 * @param {HTMLElement} container
 * @param {string} message
 * @param {'warning'|'error'|'success'} type
 */
function showToast(container, message, type = 'warning') {
  const existing = container.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
