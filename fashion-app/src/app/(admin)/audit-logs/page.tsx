import AuditLogsContent from './AuditLogsContent'

export const metadata = {
  title: '操作审计日志 - Amou 服装工作室',
  description: '记录所有管理员的敏感操作，方便溯源与审查',
}

export default function AuditLogsPage() {
  return <AuditLogsContent />
}
