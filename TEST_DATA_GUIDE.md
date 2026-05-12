# 🧪 Test Data Guide — Talad Thai Check-In

> **Mock mode**: Set `VITE_USE_MOCK_DATA=true` in `.env.development` (default).
> All data lives in [`src/services/mock-data.js`](src/services/mock-data.js).

---

## Test Users Overview

| # | ชื่อผู้ค้า | เบอร์โทร | ตลาด | โต๊ะ | โซน | สถานะ | Test Purpose |
|---|-----------|----------|------|------|-----|-------|-------------|
| 1 | สมชาย ใจดี | 081-234-5678 | ตลาดไท | A101-1 | A | รอ | Standard user, duplicate name |
| 2 | สมหญิง รักไทย | 089-876-5432 | ตลาดไท | A102-3 | A | รอ | Standard single-match user |
| 3 | วิชัย มั่งมี | 062-111-2222 | ตลาดสี่มุมเมือง | B205-2 | B | ✅ อนุมัติแล้ว | Pre-approved user |
| 4 | นิตยา สวัสดิ์ | 095-333-4444 | ตลาดไทย | C310-5 | C | รอ | Zone C user |
| 5 | ประยุทธ์ พาณิชย์ | 088-555-6666 | ตลาดไท | D412-1 | D | รอ | Zone D user |
| 6 | มาลี ทองสุข | 091-777-8888 | ตลาดไท | F501-2 | F | รอ | Multi-table user (2 tables) |
| 7 | สุรชัย เจริญ | 082-999-0000 | ตลาดสี่มุมเมือง | VIP-01 | VIP | รอ | VIP zone user |
| 8 | สมชาย ใจดี | 063-222-3333 | ตลาดสี่มุมเมือง | B210-4 | B | รอ | Same name, different person |
| 9 | มาลี ทองสุข | 091-777-8888 | ตลาดไท | F502-1 | F | รอ | Second table for user #6 |
| 10 | พิชัย รุ่งเรือง | 064-444-5555 | ตลาดไทย | A115-2 | A | รอ | Standard single-match user |

---

## Booth Mapping

| ตลาด | บูธลงทะเบียน | จำนวนที่นั่ง |
|------|-------------|------------|
| ตลาดไท | บูธ A (หน้าทางเข้า) | 500 |
| ตลาดสี่มุมเมือง | บูธ B (โซนจอดรถ) | 300 |
| ตลาดไทย | บูธ C (ศูนย์อาหาร) | 200 |

---

## Flow Scenarios

### 1️⃣ Search by Phone → Single Result → Approve

**Goal:** Happy path — staff searches a participant, views details, and approves check-in.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Type `0898765432` in search | Matches สมหญิง รักไทย |
| 2 | → Info page loads | Shows name, shop, ตลาดไท, table A102-3, Zone A badge (green) |
| 3 | Shows booth info | 📍 บูธ A (หน้าทางเข้า) |
| 4 | Status bar shows | ⏳ รอแจก Wrist Band |
| 5 | Click "แจก Wrist Band" | Loading spinner, then ✅ toast "อนุมัติสำเร็จ" |
| 6 | Status bar updates | ✅ เข้าร่วมงานเรียบร้อย |

> **Also try:** `089-876-5432` (with dashes) — should normalize and match the same.

---

### 2️⃣ Search by ลำดับ (Sequence Number)

**Goal:** Quick lookup by the sequence number printed on participant lists.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Type `5` in search | Matches ประยุทธ์ พาณิชย์ (ลำดับ 5) |
| 2 | → Info page loads | Shows Zone D badge (red), table D412-1 |
| 3 | Type `3` in search | Matches วิชัย มั่งมี (ลำดับ 3) |
| 4 | → Info page loads | Status already shows ✅ อนุมัติแล้ว |

---

### 3️⃣ Search by Name → Multiple Results

**Goal:** When a name matches more than one unique person, the user picks from a list.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Type `สมชาย` in search | Shows **2 results** list (สมชาย ใจดี × 2 different phone numbers) |
| 2 | Result #1 shows | สมชาย ใจดี — ตลาดไท — 081-234-5678 |
| 3 | Result #2 shows | สมชาย ใจดี — ตลาดสี่มุมเมือง — 063-222-3333 |
| 4 | Click result #1 | → Info page for ตลาดไท user, Zone A, table A101-1 |
| 5 | Go back, click result #2 | → Info page for ตลาดสี่มุมเมือง user, Zone B, table B210-4 |

---

### 4️⃣ Same Person, Multiple Tables (Merged View)

**Goal:** When one person (same name + same phone) has multiple table entries, they merge into one card.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Type `0917778888` in search | Matches มาลี ทองสุข (phone match) |
| 2 | → Info page loads | Table field shows **F501-2 , F502-1** (merged) |
| 3 | Zone badge shows | โซน F (purple) |
| 4 | Booth shows | บูธ A (หน้าทางเข้า) — because ตลาด = ตลาดไท |

> **Also try:** Search by name `มาลี` — since there's only one unique name+phone combo, it goes directly to info (no multi-picker).

---

### 5️⃣ Already Approved User (Duplicate Check-In Prevention)

**Goal:** Prevent double check-in when someone who was already approved is searched again.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Type `0621112222` in search | Matches วิชัย มั่งมี |
| 2 | → Info page loads | Status bar: ✅ เข้าร่วมงานเรียบร้อย |
| 3 | Approve button | Hidden or disabled (already approved) |
| 4 | Approved timestamp shown | 2026-05-08 10:30:00 |

---

### 6️⃣ VIP Zone User

**Goal:** Verify VIP zone styling and badge rendering.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Type `0829990000` in search | Matches สุรชัย เจริญ |
| 2 | → Info page loads | Zone badge shows **VIP** (gold, bg #bf8c00) |
| 3 | Table field | VIP-01 |
| 4 | Booth shows | บูธ B (โซนจอดรถ) — because ตลาด = ตลาดสี่มุมเมือง |

---

### 7️⃣ Each Zone Color Verification

**Goal:** Walk through one user per zone to verify wristband badge colors.

| Zone | User | Phone | Badge Color |
|------|------|-------|-------------|
| A (green) | สมหญิง รักไทย | `0898765432` | bg: `#2e7d32` |
| B (blue) | วิชัย มั่งมี | `0621112222` | bg: `#1565c0` |
| C (orange) | นิตยา สวัสดิ์ | `0953334444` | bg: `#e65100` |
| D (red) | ประยุทธ์ พาณิชย์ | `0885556666` | bg: `#c62828` |
| F (purple) | มาลี ทองสุข | `0917778888` | bg: `#6a1b9a` |
| VIP (gold) | สุรชัย เจริญ | `0829990000` | bg: `#bf8c00` |

---

### 8️⃣ No Match Found

**Goal:** Verify error handling when no participant is found.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Type `0000000000` in search | No match → shows "ไม่พบข้อมูล" message |
| 2 | Type `xxxxxx` in search | No match → same error message |
| 3 | Type empty string + click search | Validation prevents empty search |

---

### 9️⃣ Approve → Re-search (Session Persistence)

**Goal:** After approving a user, searching them again shows the updated status.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Search `0953334444` | Matches นิตยา สวัสดิ์ — status: ⏳ รอ |
| 2 | Click approve | ✅ อนุมัติสำเร็จ toast |
| 3 | Go back to search page | — |
| 4 | Search `0953334444` again | Same user — status now ✅ อนุมัติแล้ว |
| 5 | Approve button | Hidden/disabled (mock tracks approval in memory) |

> ⚠️ Mock approvals reset when the page is refreshed (in-memory only).

---

### 🔟 Partial Name Search

**Goal:** Verify partial Thai name matching.

| Query | Expected Matches |
|-------|-----------------|
| `สม` | 2 results: สมชาย ใจดี (×2 unique people) + สมหญิง รักไทย → **3 unique** |
| `ทอง` | 1 result: มาลี ทองสุข (direct → info page, merged tables) |
| `รุ่ง` | 1 result: พิชัย รุ่งเรือง (direct → info page) |
| `จริ` | 0 results → "ไม่พบข้อมูล" |

---

## Quick Reference: Search Input → Result Type

| Input Type | Example | Result |
|-----------|---------|--------|
| Phone (no dashes) | `0812345678` | → Single info page |
| Phone (with dashes) | `081-234-5678` | → Single info page (normalized) |
| ลำดับ number | `7` | → Single info page |
| Exact full name | `พิชัย รุ่งเรือง` | → Single info page |
| Partial name (unique) | `ทอง` | → Single info page |
| Partial name (multiple) | `สมชาย` | → Multi-result picker |
| Non-existent | `zzzzz` | → "ไม่พบข้อมูล" |
| Empty | `` | → Input validation error |

---

## Enable / Disable Mock Mode

```bash
# .env.development — use mock data (default for dev)
VITE_USE_MOCK_DATA=true

# .env.development — use real Google Apps Script
VITE_USE_MOCK_DATA=false
```

Production (`.env.production`) never has this flag, so it always hits the real backend.
