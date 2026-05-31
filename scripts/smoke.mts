// Engine checks for the pieces that remain after the AI-first slim-down:
// language detection (AI hint + Monaco), redaction, guard review, markdown wrap.
import { detectLanguage } from "../src/engine/detect/detectLanguage";
import { redact } from "../src/engine/redactor/redact";
import { review } from "../src/engine/guard/review";
import { wrapMarkdown } from "../src/engine/markdown/wrapMarkdown";
import type { RedactSettings } from "../src/engine/types";

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

const defRedact: RedactSettings = {
  mode: "placeholder",
  redactEmail: false,
  redactIp: false,
  redactDomain: false,
};

// ---- Detection ----
console.log("Detection:");
check("json", detectLanguage('{"a":1}').language === "json");
check("sql", detectLanguage("SELECT * FROM users WHERE id=1;").language === "sql");
check(
  "docker-compose",
  detectLanguage("docker compose -f x.yml exec postgres psql").language ===
    "docker-compose"
);
check("env", detectLanguage("PORT=8000\nSECRET=abc").language === "env");
check(
  "powershell",
  detectLanguage("Test-NetConnection 10.0.0.13 -Port 22").language === "powershell"
);

// ---- Markdown wrap ----
console.log("Markdown:");
const md = wrapMarkdown("docker compose ps", "docker");
check("markdown fence bash", md.startsWith("```bash\n") && md.endsWith("```"), md);

// ---- Redactor ----
console.log("Redactor:");
const r1 = redact("RESEND_API_KEY=re_TFB8mUnT_KTENvM2JjxNioo7iFeq5d1xi", defRedact);
check("resend key found", r1.findings.length >= 1 && r1.text.includes("<"), r1.text);
const r2 = redact("Authorization: Bearer abcdef123456ghijkl", defRedact);
check("bearer found", r2.findings.some((f) => f.type === "Bearer Token"), r2.findings);
const r3 = redact("DATABASE_URL=postgres://user:pass@host:5432/db", defRedact);
check("db connstring found", r3.findings.some((f) => f.type.includes("Database")), r3.findings);

// ---- Guard ----
console.log("Guard:");
check("rm -rf / critical", review("rm -rf /").level === "critical");
check(
  "compose down -v high",
  review("docker compose down -v").findings.some((f) => f.severity === "high")
);
check(
  "update no where",
  review("UPDATE users SET password='x';").findings.some(
    (f) => f.ruleId === "sql.update-no-where"
  )
);
check(
  "delete no where",
  review("DELETE FROM users;").findings.some((f) => f.ruleId === "sql.delete-no-where")
);
check(
  "curl pipe bash",
  review("curl http://example.com/install.sh | bash").findings.some(
    (f) => f.ruleId === "shell.curl-pipe-shell"
  )
);
check(
  "update WITH where is safe",
  !review("UPDATE users SET x=1 WHERE id=2;").findings.some((f) =>
    f.ruleId.includes("no-where")
  )
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
