/**
 * Tests for mock-data.js — covering the branches missed by the API test suite.
 *
 * Specifically targets:
 *   L138  — mockFetchAll merges an already-approved doc from _approvedDocs
 *   L158  — mockCheckStatus returns from _approvedDocs when doc is approved
 *   L172  — mockCheckStatus returns { status: '' } for unknown docId
 *   L185  — mockApprove returns alreadyApproved=true when _approvedDocs tracker fires
 *   L220  — _resetMockState clears _approvedDocs
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockFetchAll,
  mockCheckStatus,
  mockApprove,
  _resetMockState,
} from '../../src/services/mock-data.js';

describe('Mock Data Service', () => {
  beforeEach(() => {
    _resetMockState();
  });

  // ─── mockFetchAll ───────────────────────────────────────────────────────────

  it('mockFetchAll() returns participants and booth mapping', async () => {
    const { participants, boothMapping } = await mockFetchAll();
    expect(Array.isArray(participants)).toBe(true);
    expect(participants.length).toBeGreaterThan(0);
    expect(Array.isArray(boothMapping)).toBe(true);
  });

  it('mockFetchAll() merges _approvedDocs back into participant list (L138)', async () => {
    // Approve a participant first so _approvedDocs gets populated
    const { participants: initial } = await mockFetchAll();
    const firstDocId = initial[0]._docId;

    await mockApprove(firstDocId); // populates _approvedDocs

    // Now fetchAll should merge the approved fields back in
    const { participants: updated } = await mockFetchAll();
    const found = updated.find(p => p._docId === firstDocId);
    expect(found).toBeDefined();
    expect(found['สถานะการเข้างาน']).toBe('อนุมัติแล้ว');
  });

  // ─── mockCheckStatus ────────────────────────────────────────────────────────

  it('mockCheckStatus() returns status from _approvedDocs when approved (L158)', async () => {
    const { participants } = await mockFetchAll();
    const docId = participants[0]._docId;

    await mockApprove(docId);

    const status = await mockCheckStatus(docId);
    expect(status.status).toBe('อนุมัติแล้ว');
    expect(typeof status.approvedAt).toBe('string');
  });

  it('mockCheckStatus() returns { status: "" } for unknown docId (L172)', async () => {
    const result = await mockCheckStatus('non-existent-doc-id');
    expect(result).toEqual({ status: '' });
  });

  it('mockCheckStatus() returns existing status for known pending participant', async () => {
    const { participants } = await mockFetchAll();
    // Use a participant that is still pending (first fetch, _approvedDocs is clear)
    const docId = participants[0]._docId;
    const result = await mockCheckStatus(docId);
    expect(typeof result.status).toBe('string');
  });

  // ─── mockApprove ────────────────────────────────────────────────────────────

  it('mockApprove() succeeds for a pending participant', async () => {
    const { participants } = await mockFetchAll();
    const docId = participants[0]._docId;
    const result = await mockApprove(docId);
    expect(result.success).toBe(true);
    expect(result.alreadyApproved).toBe(false);
  });

  it('mockApprove() detects already-approved via _approvedDocs tracker (L185)', async () => {
    const { participants } = await mockFetchAll();
    const docId = participants[0]._docId;

    // First approve sets _approvedDocs
    await mockApprove(docId);

    // Second approve should detect via tracker (L185)
    const result = await mockApprove(docId);
    expect(result.success).toBe(true);
    expect(result.alreadyApproved).toBe(true);
  });

  // ─── _resetMockState ────────────────────────────────────────────────────────

  it('_resetMockState() clears _approvedDocs so approve succeeds again (L220)', async () => {
    const { participants } = await mockFetchAll();
    const docId = participants[0]._docId;

    await mockApprove(docId);

    // Confirm it's now in tracker
    let result = await mockApprove(docId);
    expect(result.alreadyApproved).toBe(true);

    // Reset and approve again — should succeed
    _resetMockState();
    result = await mockApprove(docId);
    expect(result.alreadyApproved).toBe(false);
    expect(result.success).toBe(true);
  });
});
