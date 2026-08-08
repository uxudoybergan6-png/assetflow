import assert from "node:assert/strict";
import { cleanupExpiredPluginTokens, ensurePluginToken, revokePluginToken } from "../dist/routes/plugin.js";
import { revokeWebSession } from "../dist/routes/auth.js";

function nowIso(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

function createMockDb() {
  const state = {
    pluginTokens: [],
    users: [],
    calls: {
      pluginCreate: 0,
      pluginDeleteMany: 0,
      pluginFindUnique: 0,
      userUpdate: 0,
    },
  };

  const matchPluginWhere = (row, where = {}) => {
    if (where.token !== undefined && row.token !== where.token) return false;
    if (where.userId !== undefined && row.userId !== where.userId) return false;
    if (where.expiresAt?.lt) {
      return row.expiresAt < where.expiresAt.lt;
    }
    return true;
  };

  return {
    state,
    pluginToken: {
      create: async ({ data }) => {
        state.calls.pluginCreate += 1;
        const row = {
          token: String(data.token),
          userId: String(data.userId),
          createdAt: new Date(),
          expiresAt: data.expiresAt,
        };
        state.pluginTokens.push(row);
        return row;
      },
      deleteMany: async ({ where }) => {
        state.calls.pluginDeleteMany += 1;
        const before = state.pluginTokens.length;
        state.pluginTokens = state.pluginTokens.filter((row) => !matchPluginWhere(row, where));
        return { count: before - state.pluginTokens.length };
      },
      findUnique: async ({ where, select }) => {
        state.calls.pluginFindUnique += 1;
        const row = state.pluginTokens.find((entry) => entry.token === where.token) || null;
        if (!row || !select) return row ? { ...row } : null;
        const out = {};
        if (select.createdAt) out.createdAt = row.createdAt;
        if (select.expiresAt) out.expiresAt = row.expiresAt;
        return out;
      },
    },
    user: {
      update: async ({ where, data }) => {
        state.calls.userUpdate += 1;
        const user = state.users.find((entry) => entry.id === where.id);
        if (user) user.tokenVersion = data.tokenVersion.increment + (user.tokenVersion ?? 0);
        return user ?? null;
      },
    },
  };
}

function addToken(db, userId, token, expiresAtIso) {
  db.state.pluginTokens.push({
    userId,
    token,
    createdAt: new Date(expiresAtIso || nowIso(-120)),
    expiresAt: new Date(expiresAtIso),
  });
}

const db = createMockDb();
db.state.users.push({ id: "user-1", tokenVersion: 0 });

db.state.pluginTokens = [];
addToken(db, "user-1", "legacy-valid", nowIso(60 * 24));
addToken(db, "user-1", "legacy-expired", nowIso(-60));

const firstToken = await ensurePluginToken("user-1", false, db);
const pluginRowsAfterFirst = db.state.pluginTokens.filter((row) => row.userId === "user-1");

assert.equal(pluginRowsAfterFirst.length, 2, "ensurePluginToken keeps existing valid rows");
assert.equal(pluginRowsAfterFirst.every((row) => row.expiresAt > new Date()), true, "expired rows are removed");
assert.equal(firstToken.userId, "user-1", "created token belongs to requesting user");

const secondToken = await ensurePluginToken("user-1", false, db);
const pluginRowsAfterSecond = db.state.pluginTokens.filter((row) => row.userId === "user-1");
assert.equal(pluginRowsAfterSecond.length, 3, "same-user session refresh creates a sibling token, not replacement");
assert.equal(firstToken.token !== secondToken.token, true, "session renew/login always creates a new token value");

await revokePluginToken("user-1", firstToken.token, db);
const pluginRowsAfterRevoke = db.state.pluginTokens.filter((row) => row.userId === "user-1");
assert.equal(
  pluginRowsAfterRevoke.some((row) => row.token === firstToken.token),
  false,
  "revokePluginToken deletes only the requested token"
);
assert.equal(
  pluginRowsAfterRevoke.some((row) => row.token === secondToken.token),
  true,
  "other installation sessions stay untouched"
);

// cleanupExpiredPluginTokens is scoped to a single user.
addToken(db, "user-2", "other-valid", nowIso(60 * 24));
addToken(db, "user-2", "other-expired", nowIso(-60));
await cleanupExpiredPluginTokens("user-2", db);
assert.equal(db.state.pluginTokens.some((row) => row.token === "other-valid"), true, "cleanup keeps non-expired rows");
assert.equal(db.state.pluginTokens.some((row) => row.token === "other-expired"), false, "cleanup deletes only expired for target user");
assert.equal(db.state.pluginTokens.some((row) => row.token === secondToken.token), true, "other user cleanup doesn't delete target user rows");

const webUser = "user-1";
await revokeWebSession(webUser, db);
const webUserState = db.state.users.find((u) => u.id === webUser);
assert.equal(webUserState?.tokenVersion, 1, "web logout increments tokenVersion only");
assert.equal(
  db.state.pluginTokens.some((row) => row.token === secondToken.token),
  true,
  "web logout does not revoke plugin tokens"
);

await cleanupExpiredPluginTokens("user-1", db);
const tokenTableRows = db.state.pluginTokens.filter((row) => row.userId === "user-1");
const expiredExist = tokenTableRows.some((row) => row.expiresAt < new Date());
assert.equal(expiredExist, false, "all expired rows for user are removed by maintenance cleanups");

console.log(`Plugin API session policy checks passed: ${db.state.calls.pluginCreate} creation operations, ${db.state.calls.pluginDeleteMany} delete operations`);
