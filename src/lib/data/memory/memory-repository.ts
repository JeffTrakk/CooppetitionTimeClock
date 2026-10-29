// In-process implementation of Repository for the demo and local dev.
// State lives on globalThis so it survives hot reloads. It resets when the
// server restarts (and per instance on serverless hosts) — that is expected;
// production uses SupabaseRepository.

import type { NewRecord, Repository } from "../repository";
import type { Message, MessageDelivery } from "../../domain/types";
import { buildSeed, type Store } from "./seed";

const g = globalThis as unknown as { __timeclockStore?: Store };

function store(): Store {
  if (!g.__timeclockStore) g.__timeclockStore = buildSeed();
  return g.__timeclockStore;
}

const id = () => crypto.randomUUID();
const clone = <T>(v: T): T => structuredClone(v);

function mustFind<T extends { id: string }>(list: T[], key: string, what: string): T {
  const found = list.find((x) => x.id === key);
  if (!found) throw new Error(`${what} ${key} not found`);
  return found;
}

function inRange(iso: string, from?: string, to?: string) {
  return (!from || iso >= from) && (!to || iso <= to);
}

export class MemoryRepository implements Repository {
  async listCompanies() { return clone(store().companies); }
  async getCompany(cid: string) { return clone(store().companies.find((c) => c.id === cid) ?? null); }
  async updateCompany(cid: string, patch: Parameters<Repository["updateCompany"]>[1]) {
    const c = mustFind(store().companies, cid, "Company");
    Object.assign(c, patch);
    return clone(c);
  }

  async listUsers(companyId: string) { return clone(store().users.filter((u) => u.companyId === companyId)); }
  async getUser(uid: string) { return clone(store().users.find((u) => u.id === uid) ?? null); }
  async findUserByPin(companyId: string, pin: string) {
    return clone(store().users.find((u) => u.companyId === companyId && u.kioskPin === pin && u.active) ?? null);
  }
  async createUser(input: Parameters<Repository["createUser"]>[0]) {
    const u = { ...input, id: id() };
    store().users.push(u);
    return clone(u);
  }
  async updateUser(uid: string, patch: Parameters<Repository["updateUser"]>[1]) {
    const u = mustFind(store().users, uid, "User");
    Object.assign(u, patch);
    return clone(u);
  }

  async listJobs(companyId: string) { return clone(store().jobs.filter((j) => j.companyId === companyId)); }
  async getJob(jid: string) { return clone(store().jobs.find((j) => j.id === jid) ?? null); }
  async findJobByQrToken(token: string) { return clone(store().jobs.find((j) => j.qrToken === token) ?? null); }
  async createJob(input: Parameters<Repository["createJob"]>[0]) {
    const j = { ...input, id: id() };
    store().jobs.push(j);
    return clone(j);
  }
  async updateJob(jid: string, patch: Parameters<Repository["updateJob"]>[1]) {
    const j = mustFind(store().jobs, jid, "Job");
    Object.assign(j, patch);
    return clone(j);
  }
  async listCostCodes(companyId: string) { return clone(store().costCodes.filter((c) => c.companyId === companyId)); }
  async createCostCode(input: Parameters<Repository["createCostCode"]>[0]) {
    const c = { ...input, id: id() };
    store().costCodes.push(c);
    return clone(c);
  }

  async listShifts(companyId: string, r: Parameters<Repository["listShifts"]>[1]) {
    return clone(
      store().shifts
        .filter((s) => s.companyId === companyId && s.start < r.to && s.end > r.from && (!r.userId || s.userId === r.userId) && (!r.jobId || s.jobId === r.jobId))
        .sort((a, b) => a.start.localeCompare(b.start)),
    );
  }
  async getShift(sid: string) { return clone(store().shifts.find((s) => s.id === sid) ?? null); }
  async createShift(input: Parameters<Repository["createShift"]>[0]) {
    const s = { ...input, id: id() };
    store().shifts.push(s);
    return clone(s);
  }
  async deleteShift(sid: string) {
    store().shifts = store().shifts.filter((s) => s.id !== sid);
  }

  async listPunches(companyId: string, f: Parameters<Repository["listPunches"]>[1]) {
    return clone(
      store().punches
        .filter((p) => p.companyId === companyId && (!f.userId || p.userId === f.userId) && (!f.jobId || p.jobId === f.jobId) && inRange(p.occurredAt, f.from, f.to))
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    );
  }
  async getPunch(pid: string) { return clone(store().punches.find((p) => p.id === pid) ?? null); }
  async findPunchByClientId(companyId: string, clientId: string) {
    return clone(store().punches.find((p) => p.companyId === companyId && p.clientId === clientId) ?? null);
  }
  async createPunch(input: Parameters<Repository["createPunch"]>[0]) {
    const p = { ...input, id: id() };
    store().punches.push(p);
    return clone(p);
  }
  async updatePunch(pid: string, patch: Parameters<Repository["updatePunch"]>[1]) {
    const p = mustFind(store().punches, pid, "Punch");
    Object.assign(p, patch);
    return clone(p);
  }
  async createLocationPing(input: Parameters<Repository["createLocationPing"]>[0]) {
    const l = { ...input, id: id() };
    store().locationPings.push(l);
    return clone(l);
  }
  async listLocationPings(companyId: string, f: { userId: string; from: string }) {
    return clone(store().locationPings.filter((l) => l.companyId === companyId && l.userId === f.userId && l.at >= f.from));
  }

  async getTimesheet(companyId: string, userId: string, periodStart: string) {
    return clone(store().timesheets.find((t) => t.companyId === companyId && t.userId === userId && t.periodStart === periodStart) ?? null);
  }
  async listTimesheets(companyId: string, periodStart: string) {
    return clone(store().timesheets.filter((t) => t.companyId === companyId && t.periodStart === periodStart));
  }
  async upsertTimesheet(input: Parameters<Repository["upsertTimesheet"]>[0]) {
    const s = store();
    const existing = s.timesheets.find((t) => t.companyId === input.companyId && t.userId === input.userId && t.periodStart === input.periodStart);
    if (existing) {
      Object.assign(existing, input);
      return clone(existing);
    }
    const t = { ...input, id: id() };
    s.timesheets.push(t);
    return clone(t);
  }

  async appendAudit(input: Parameters<Repository["appendAudit"]>[0]) {
    store().audit.push({ ...input, id: id() });
  }
  async listAudit(companyId: string, f: { entity?: string; entityId?: string; limit?: number } = {}) {
    return clone(
      store().audit
        .filter((a) => a.companyId === companyId && (!f.entity || a.entity === f.entity) && (!f.entityId || a.entityId === f.entityId))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, f.limit ?? 100),
    );
  }

  async createMessage(input: NewRecord<Message>, deliveries: Omit<MessageDelivery, "messageId">[]) {
    const m = { ...input, id: id() };
    store().messages.push(m);
    store().deliveries.push(...deliveries.map((d) => ({ ...d, messageId: m.id })));
    return clone(m);
  }
  async listMessagesForUser(companyId: string, userId: string) {
    const s = store();
    return clone(
      s.deliveries
        .filter((d) => d.userId === userId && d.channel === "in_app")
        .map((d) => ({ ...s.messages.find((m) => m.id === d.messageId)!, delivery: d }))
        .filter((m) => m.companyId === companyId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }
  async listSentMessages(companyId: string) {
    const s = store();
    return clone(
      s.messages
        .filter((m) => m.companyId === companyId)
        .map((m) => ({ ...m, deliveries: s.deliveries.filter((d) => d.messageId === m.id) }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }
  async markMessageRead(messageId: string, userId: string) {
    for (const d of store().deliveries) if (d.messageId === messageId && d.userId === userId && !d.readAt) d.readAt = new Date().toISOString();
  }

  async listIntegrationConnections(companyId: string) {
    return clone(store().integrationConnections.filter((c) => c.companyId === companyId));
  }
  async recordPayrollExport(input: Parameters<Repository["recordPayrollExport"]>[0]) {
    const e = { ...input, id: id() };
    store().payrollExports.push(e);
    return clone(e);
  }
  async listPayrollExports(companyId: string) {
    return clone(store().payrollExports.filter((e) => e.companyId === companyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
}
