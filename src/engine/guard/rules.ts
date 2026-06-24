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
    // Numeric 777/0777 or symbolic a=rwx / ugo=rwx on a top-level path.
    test: /\bchmod\s+(-R\s+)?(0?777|a=rwx|ugo=rwx|u=rwx,g=rwx,o=rwx)\s+\//,
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
  {
    ruleId: "shell.eval-untrusted",
    title: "eval of dynamic input",
    severity: "high",
    test: /\beval\s+["'`]?\$|\beval\s+["'`]?\$\(|\beval\s+["'`]?`/,
    message: "eval on a variable or command substitution executes arbitrary code.",
    suggestion: "Avoid eval; expand and inspect the value before running it.",
  },
  {
    ruleId: "shell.source-process-sub",
    title: "Source a downloaded script",
    severity: "high",
    test: /\b(?:source|\.)\s+<\(\s*(?:curl|wget)\b/,
    message: "Sourcing a downloaded script runs unvetted code in your shell.",
    suggestion: "Download the script, read it, then source it.",
  },
  {
    ruleId: "shell.crontab-remove",
    title: "Remove all cron jobs",
    severity: "high",
    test: /\bcrontab\s+-r\b/,
    message: "crontab -r deletes the user's entire crontab with no confirmation.",
    suggestion: "Use 'crontab -l' to back up first, or edit with 'crontab -e'.",
  },
  {
    ruleId: "shell.disable-selinux",
    title: "Disable SELinux enforcement",
    severity: "high",
    test: /\bsetenforce\s+0\b|\bSELINUX=disabled\b/,
    message: "Disabling SELinux removes mandatory access-control protection.",
  },
  {
    ruleId: "shell.git-force-push",
    title: "Force push",
    severity: "high",
    test: /\bgit\s+push\b[^\n]*\s(?:-f\b|--force\b)/,
    message: "git push --force can overwrite shared history and others' commits.",
    suggestion: "Prefer --force-with-lease, and avoid force-pushing shared branches.",
  },
  {
    ruleId: "shell.git-reset-hard",
    title: "Hard reset",
    severity: "medium",
    test: /\bgit\s+reset\s+--hard\b/,
    message: "git reset --hard discards all uncommitted changes irreversibly.",
    suggestion: "Stash or commit first if you might need the changes back.",
  },
  {
    ruleId: "shell.git-clean",
    title: "Force-clean untracked files",
    severity: "medium",
    test: /\bgit\s+clean\b[^\n]*\s-[a-z]*f/,
    message: "git clean -f permanently deletes untracked files.",
    suggestion: "Run 'git clean -n' first to preview what will be removed.",
  },

  // ---- Docker ----
  {
    ruleId: "docker.socket-mount",
    title: "Mount the Docker socket",
    severity: "critical",
    test: /-v\s+\/var\/run\/docker\.sock|--mount[^\n]*docker\.sock/,
    message: "Mounting /var/run/docker.sock grants full host control (container escape).",
    suggestion: "Avoid exposing the Docker socket to containers.",
  },
  {
    ruleId: "docker.privileged",
    title: "Privileged container",
    severity: "high",
    test: /\bdocker\s+run\b[^\n]*--privileged\b/,
    message: "--privileged removes container isolation and exposes the host.",
    suggestion: "Grant only the specific --cap-add capabilities you need.",
  },
  {
    ruleId: "docker.compose-down-volumes",
    title: "docker compose down -v",
    severity: "high",
    // Group the -v / --volumes alternation so it only fires within a compose down.
    test: /\bdocker(?:\s+compose|-compose)\s+down\b[^\n]*(?:\s-v\b|--volumes\b)/,
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
    // Matches `docker rm -f`, `docker rmi -f`, and `docker container rm -f`.
    test: /\bdocker\s+(?:container\s+|image\s+)?rmi?\s+(-[A-Za-z]*\s+)*-[A-Za-z]*f\b/,
    message: "Force removal skips safety checks on running resources.",
  },

  // ---- Kubernetes ----
  {
    ruleId: "k8s.delete-pv",
    title: "Delete persistent volume",
    severity: "high",
    test: /\bkubectl\s+delete\s+(pv|pvc|persistentvolume(?:claim)?s?)\b/,
    message: "Deleting a PV/PVC can destroy persistent application data.",
  },
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

  // ---- Cloud CLIs ----
  {
    ruleId: "aws.s3-rm-recursive",
    title: "Recursive S3 delete",
    severity: "high",
    test: /\baws\s+s3\s+rm\b[^\n]*--recursive\b/,
    message: "aws s3 rm --recursive permanently deletes every object under the prefix.",
    suggestion: "Double-check the bucket/prefix; consider --dryrun first.",
  },
  {
    ruleId: "aws.ec2-terminate",
    title: "Terminate EC2 instances",
    severity: "high",
    test: /\baws\s+ec2\s+terminate-instances\b/,
    message: "Terminating instances destroys them and their instance-store data.",
  },
  {
    ruleId: "aws.kms-delete-key",
    title: "Schedule KMS key deletion",
    severity: "critical",
    test: /\baws\s+kms\s+schedule-key-deletion\b/,
    message: "Deleting a KMS key makes everything it encrypted permanently unreadable.",
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
export const SQL_DESTRUCTIVE =
  /\b(DROP\s+(DATABASE|SCHEMA|TABLE|INDEX)|TRUNCATE(\s+TABLE)?|ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN|GRANT\s+ALL|xp_cmdshell|INTO\s+OUTFILE|INTO\s+DUMPFILE|LOAD_FILE)\b/i;
