import type { GuardFinding } from "../engine/types";
import type { Locale } from "./messages";

type GuardText = { title: string; message: string; suggestion?: string };

// Localized text for guard rules, keyed by ruleId. English lives on the rules
// themselves (rules.ts / review.ts) and is used as the fallback, so only
// non-English locales need entries here.
const zh: Record<string, GuardText> = {
  "shell.rm-rf-root": {
    title: "递归删除根目录",
    message: "rm -rf 指向 / 会摧毁整个文件系统。",
    suggestion: "仔细核对目标路径;绝不要对 / 或 /* 执行 rm -rf。",
  },
  "shell.chmod-777-root": {
    title: "对根目录设置全员可写权限",
    message: "chmod -R 777 / 会让系统对所有用户开放。",
    suggestion: "只对真正需要的目录授权。",
  },
  "shell.fork-bomb": {
    title: "Fork 炸弹",
    message: "这是一个 fork 炸弹,会耗尽系统资源。",
  },
  "shell.mkfs": {
    title: "创建文件系统(抹除数据)",
    message: "mkfs 会格式化设备并销毁其上的所有数据。",
    suggestion: "格式化前先确认设备路径。",
  },
  "shell.dd-device": {
    title: "向块设备裸写",
    message: "dd 写入 /dev/… 可能不可逆地覆盖整块磁盘。",
  },
  "shell.iptables-flush": {
    title: "清空/关闭防火墙",
    message: "清空或关闭防火墙会移除网络防护。",
  },
  "shell.disable-ssh": {
    title: "停止/禁用 SSH",
    message: "停止 SSH 可能会把你锁在远程机器之外。",
    suggestion: "禁用 SSH 前确保你有控制台访问权限。",
  },
  "docker.compose-down-volumes": {
    title: "docker compose down -v",
    message: "down -v 会删除命名卷 —— 数据库数据可能丢失。",
    suggestion: "执行前确认卷已备份。",
  },
  "docker.prune-volumes": {
    title: "docker system prune --volumes",
    message: "带 --volumes 的清理会删除所有未使用的卷及其数据。",
  },
  "docker.volume-rm": {
    title: "docker volume rm",
    message: "删除卷会永久删除其中的数据。",
  },
  "docker.force-remove": {
    title: "强制删除容器/镜像",
    message: "强制删除会跳过对运行中资源的安全检查。",
  },
  "k8s.delete-namespace": {
    title: "删除命名空间",
    message: "删除命名空间会移除其中的所有资源。",
  },
  "k8s.delete-all": {
    title: "删除全部资源",
    message: "delete all --all 会移除该命名空间内的所有资源。",
  },
  "k8s.apply-remote": {
    title: "应用远程清单",
    message: "应用远程清单会执行未经审查的集群变更。",
    suggestion: "先下载并检查清单再应用。",
  },
  "shell.curl-pipe-shell": {
    title: "把远程脚本管道给 shell 执行",
    message: "把下载的脚本直接管道进 shell 会运行未经审查的代码。",
    suggestion: "先下载脚本、读一遍,再执行。",
  },
  "sql.delete-no-where": {
    title: "DELETE 缺少 WHERE",
    message: "没有 WHERE 子句的 DELETE 会删除表中所有行。",
    suggestion: "加上 WHERE 子句,或先用 SELECT 确认范围。",
  },
  "sql.update-no-where": {
    title: "UPDATE 缺少 WHERE",
    message: "没有 WHERE 子句的 UPDATE 会修改表中所有行。",
    suggestion: "加上 WHERE 子句以精确定位目标行。",
  },
  "sql.destructive-ddl": {
    title: "破坏性 DDL",
    message: "检测到破坏性语句(DROP / TRUNCATE / ALTER … DROP COLUMN)。",
    suggestion: "执行结构/数据删除前确保已备份。",
  },
  "shell.eval-untrusted": {
    title: "eval 执行动态输入",
    message: "对变量或命令替换执行 eval 会运行任意代码。",
    suggestion: "避免使用 eval;先展开并检查内容再执行。",
  },
  "shell.source-process-sub": {
    title: "source 下载的脚本",
    message: "source 一个下载来的脚本会在你的 shell 里运行未经审查的代码。",
    suggestion: "先下载脚本、读一遍,再 source。",
  },
  "shell.crontab-remove": {
    title: "删除全部定时任务",
    message: "crontab -r 会无确认地删除该用户的整个 crontab。",
    suggestion: "先用 crontab -l 备份,或用 crontab -e 编辑。",
  },
  "shell.disable-selinux": {
    title: "关闭 SELinux 强制",
    message: "关闭 SELinux 会移除强制访问控制保护。",
  },
  "shell.git-force-push": {
    title: "强制推送",
    message: "git push --force 可能覆盖共享历史和他人的提交。",
    suggestion: "优先用 --force-with-lease,避免对共享分支强推。",
  },
  "shell.git-reset-hard": {
    title: "硬重置",
    message: "git reset --hard 会不可逆地丢弃所有未提交改动。",
    suggestion: "若可能需要找回,先 stash 或提交。",
  },
  "shell.git-clean": {
    title: "强制清理未跟踪文件",
    message: "git clean -f 会永久删除未跟踪的文件。",
    suggestion: "先运行 git clean -n 预览将被删除的内容。",
  },
  "docker.socket-mount": {
    title: "挂载 Docker socket",
    message: "挂载 /var/run/docker.sock 等于给容器完全的宿主机控制权(容器逃逸)。",
    suggestion: "不要把 Docker socket 暴露给容器。",
  },
  "docker.privileged": {
    title: "特权容器",
    message: "--privileged 会移除容器隔离并暴露宿主机。",
    suggestion: "只授予你确实需要的 --cap-add 能力。",
  },
  "k8s.delete-pv": {
    title: "删除持久卷",
    message: "删除 PV/PVC 可能销毁应用的持久化数据。",
  },
  "aws.s3-rm-recursive": {
    title: "递归删除 S3",
    message: "aws s3 rm --recursive 会永久删除该前缀下的所有对象。",
    suggestion: "仔细核对 bucket/前缀;可先用 --dryrun。",
  },
  "aws.ec2-terminate": {
    title: "终止 EC2 实例",
    message: "终止实例会销毁实例及其实例存储数据。",
  },
  "aws.kms-delete-key": {
    title: "计划删除 KMS 密钥",
    message: "删除 KMS 密钥会让它加密过的一切永久无法解密。",
  },
};

const TABLES: Partial<Record<Locale, Record<string, GuardText>>> = { zh };

/** Localize a guard finding's text, falling back to its built-in English. */
export function localizeGuard(f: GuardFinding, locale: Locale): GuardText {
  const tx = TABLES[locale]?.[f.ruleId];
  return {
    title: tx?.title ?? f.title,
    message: tx?.message ?? f.message,
    suggestion: tx?.suggestion ?? f.suggestion,
  };
}
