import { useEffect, useState } from 'react';
import { authApi } from '../../api/auth';
import { workspaceApi } from '../../api/workspace';
import { useAuthStore } from '../../stores/authStore';
import type { CreditLog } from '../../types';
import { getErrorMessage } from '../../utils/api';
import { formatDateTime } from '../../utils/format';

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const updateCredits = useAuthStore((state) => state.updateCredits);
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([authApi.getMe(), workspaceApi.getBalance(), workspaceApi.getCreditHistory()])
      .then(([me, balance, history]) => {
        setUser(me);
        updateCredits(balance);
        setLogs(history.logs);
      })
      .catch((loadError) => setError(getErrorMessage(loadError, '加载个人中心失败')));
  }, [setUser, updateCredits]);

  return (
    <div className="list-stack">
      <div className="page-header">
        <div>
          <h1>个人中心</h1>
          <p>查看账号信息、ApiKey 与积分变动记录。</p>
        </div>
      </div>
      {error ? <div className="error-text">{error}</div> : null}
      <section className="two-column">
        <article className="panel list-stack">
          <h2 className="card-title">账号信息</h2>
          <div>
            <div className="muted-label">邮箱</div>
            <div>{user?.email}</div>
          </div>
          <div>
            <div className="muted-label">角色</div>
            <div>{user?.role}</div>
          </div>
          <div>
            <div className="muted-label">ApiKey</div>
            <div className="code-chip">{user?.apiKey ?? '-'}</div>
          </div>
          <div>
            <div className="muted-label">积分余额</div>
            <div>{user?.credits ?? 0}</div>
          </div>
        </article>
        <article className="panel list-stack">
          <h2 className="card-title">使用提示</h2>
          <div className="panel">当前版本默认启用本地 Mock AI，可完整验证任务流、积分扣减与记录查询。</div>
          <div className="panel">若积分不足，请联系管理员在后台“积分管理”中为你充值。</div>
          <div className="panel">后续可将 Mock AI 切换为真实第三方接口而无需改动前端流程。</div>
        </article>
      </section>
      <section className="table-card">
        <h2 className="card-title">积分记录</h2>
        <div className="table-wrapper" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>变动</th>
                <th>余额</th>
                <th>原因</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.delta > 0 ? `+${log.delta}` : log.delta}</td>
                  <td>{log.balanceAfter}</td>
                  <td>{log.reason}</td>
                  <td>{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
