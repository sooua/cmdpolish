// Verifies the localStorage history backend (search / filter / remove / clear).
// Shims localStorage so it runs under node/tsx.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
(globalThis as unknown as { localStorage: MemStorage }).localStorage =
  new MemStorage();

const { LocalHistoryBackend } = await import("../src/lib/history/localBackend");
import type { HistoryEntry } from "../src/lib/history/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`, extra ?? "");
  }
}

function entry(p: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: Math.random().toString(36).slice(2),
    title: "t",
    language: "bash",
    inputText: "",
    outputText: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hasSecrets: false,
    riskLevel: "none",
    ...p,
  };
}

const be = new LocalHistoryBackend();
await be.init();

await be.add(entry({ id: "a", title: "docker compose ps", language: "docker" }));
await new Promise((r) => setTimeout(r, 2));
await be.add(entry({ id: "b", title: "SELECT * FROM users", language: "sql" }));
await new Promise((r) => setTimeout(r, 2));
await be.add(entry({ id: "c", title: "rm -rf tmp", language: "bash", riskLevel: "high" }));

console.log("History backend:");
let all = await be.list();
check("lists all 3", all.length === 3, all.length);
check("newest first", all[0].id === "c", all[0].id);

const sql = await be.list({ language: "sql" });
check("filter by language", sql.length === 1 && sql[0].id === "b");

const search = await be.list({ search: "docker" });
check("search by text", search.length === 1 && search[0].id === "a", search);

await be.remove("a");
all = await be.list();
check("remove one", all.length === 2 && !all.find((e) => e.id === "a"));

await be.add(entry({ id: "b", title: "updated", language: "sql" }));
all = await be.list();
check("re-add same id replaces", all.filter((e) => e.id === "b").length === 1);

await be.clear();
all = await be.list();
check("clear empties", all.length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
