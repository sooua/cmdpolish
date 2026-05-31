import type { Severity } from "../types";

export type GuardRule = {
  ruleId: string;
  title: string;
  severity: Severity;
  test: RegExp;
  message: string;
  suggestion?: string;
};

export const GUARD_RULES: GuardRule[] = [
  // ---- Shell / Linux ----
  {
    ruleId: "shell.rm-rf-root",
    title: "Recursive delete of root",
    severity: "critical",
    test: /\brm\s+(-[A-Za-z]*\s+)*-[A-Za-z]*[rf][A-Za-z]*\s+(-[A-Za-z]+\s+)*\/(\s|\*|$)/,
    message: "rm -rf targeting / will destroy the entire filesystem.",
    suggestion: "Double-check the target path; never run rm -rf on / or /*.",
  },
  {
    ruleId: "shell.chmod-777-root",
    title: "World-writable permissions on root",
    severity: "critical",
    test: /\bchmod\s+(-R\s+)?0?777\s+\//,
    message: "chmod -R 777 / opens the whole system to every user.",
    suggestion: "Scope permissions to the specific directory that needs them.",
  },
  {
    ruleId: "shell.fork-bomb",
    title: "Fork bomb",
    severity: "critical",
    test: /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/,
    message: "This is a fork bomb that will exhaust system resources.",
  },
  {
    ruleId: "shell.mkfs",
    title: "Filesystem creation (data wipe)",
    severity: "critical",
    test: /\bmkfs(\.\w+)?\s+\/dev\//,
    message: "mkfs will format a device and destroy all data on it.",
    suggestion: "Verify the device path before formatting.",
  },
  {
    ruleId: "shell.dd-device",
    title: "Raw write to a block device",
    severity: "high",
    test: /\bdd\s+.*\bof=\/dev\//,
    message: "dd writing to /dev/... can irreversibly overwrite a disk.",
  },
  {
    ruleId: "shell.iptables-flush",
    title: "Firewall flush",
    severity: "high",
    test: /\biptables\s+-F\b|\bufw\s+disable\b/,
    message: "Flushing/disabling the firewall removes network protection.",
  },
  {
    ruleId: "shell.disable-ssh",
    title: "Stopping/disabling SSH",
    severity: "high",
    test: /\bsystemctl\s+(stop|disable)\s+(ssh|sshd)\b/,
    message: "Stopping SSH may lock you out of a remote machine.",
    suggestion: "Make sure you have console access before disabling SSH.",
  },

  // ---- Docker ----
  {
    ruleId: "docker.compose-down-volumes",
    title: "docker compose down -v",
    severity: "high",
    test: /\bdocker\s+(compose|-compose)\s+down\b[^\n]*\s-v\b|--volumes\b/,
    message: "down -v deletes named volumes — database data can be lost.",
    suggestion: "Confirm volumes are backed up before running this.",
  },
  {
    ruleId: "docker.prune-volumes",
    title: "docker system prune --volumes",
    severity: "high",
    test: /\bdocker\s+system\s+prune\b[^\n]*--volumes/,
    message: "Pruning with --volumes removes all unused volumes and their data.",
  },
  {
    ruleId: "docker.volume-rm",
    title: "docker volume rm",
    severity: "high",
    test: /\bdocker\s+volume\s+rm\b/,
    message: "Removing a volume permanently deletes its data.",
  },
  {
    ruleId: "docker.force-remove",
    title: "Force remove container/image",
    severity: "medium",
    test: /\bdocker\s+rm[i]?\s+(-[A-Za-z]*\s+)*-f\b/,
    message: "Force removal skips safety checks on running resources.",
  },

  // ---- Kubernetes ----
  {
    ruleId: "k8s.delete-namespace",
    title: "Delete namespace",
    severity: "critical",
    test: /\bkubectl\s+delete\s+(ns|namespace)\b/,
    message: "Deleting a namespace removes every resource inside it.",
  },
  {
    ruleId: "k8s.delete-all",
    title: "Delete all resources",
    severity: "high",
    test: /\bkubectl\s+delete\s+all\s+--all\b/,
    message: "delete all --all removes every resource in the namespace.",
  },
  {
    ruleId: "k8s.apply-remote",
    title: "Apply manifest from URL",
    severity: "medium",
    test: /\bkubectl\s+apply\s+-f\s+https?:\/\//,
    message: "Applying a remote manifest runs unreviewed cluster changes.",
    suggestion: "Download and inspect the manifest before applying.",
  },

  // ---- curl | bash ----
  {
    ruleId: "shell.curl-pipe-shell",
    title: "Pipe remote script to a shell",
    severity: "high",
    test: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(bash|sh|zsh)\b|<\(\s*(curl|wget)\b/,
    message: "Piping a downloaded script straight into a shell runs unvetted code.",
    suggestion: "Download the script, read it, then run it.",
  },
];

// ---- SQL rules need structural checks, handled separately ----
export const SQL_DESTRUCTIVE = /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE(\s+TABLE)?|ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN)\b/i;
