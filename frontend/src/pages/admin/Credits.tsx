import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import type { CreditLog, Customer } from '../../types';
import { getErrorMessage } from '../../utils/api';
import { formatDateTime } from '../../utils/format';

export default function CreditsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [amount, setAmount] = useState(20);
  const [error, setError] = useState('');

  const applyData = (customerData: Customer[], logData: CreditLog[]) => {
    setCustomers(customerData);
    setLogs(logData);
    setSelectedUserId((current) => current || customerData[0]?.id || '');
  };

  const loadData = async () => {
    try {
      const [customerData, logData] = await Promise.all([adminApi.getCustomers(), adminApi.getCreditLogs()]);
      applyData(customerData, logData);
    } catch (loadError) {
      setError(getErrorMessage(loadError, '加载积分数据失败'));
    }
  };

  useEffect(() => {
    let cancelled = false;

    Promise.all([adminApi.getCustomers(), adminApi.getCreditLogs()])
      .then(([customerData, logData]) => {
        if (cancelled) {
          return;
        }

        applyData(customerData, logData);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError, '加载积分数据失败'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRecharge = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!selectedUserId) {
      setError('请先选择客户');
      return;
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      setError('充值积分必须是大于 0 的整数');
      return;
    }

    try {
      await adminApi.rechargeCredits({ userId: selectedUserId, amount });
      await loadData();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '充值失败'));
    }
  };

  return (
    <div className="list-stack">
      <div className="page-header">
        <div>
          <h1>积分管理</h1>
          <p>为客户充值并查看全局积分变动日志。</p>
        </div>
      </div>
      <section className="two-column">
        <article className="panel">
          <h2 className="card-title">积分充值</h2>
          <form className="form-grid" style={{ marginTop: 16 }} onSubmit={handleRecharge}>
            <div className="field">
              <label htmlFor="credit-customer">选择客户</label>
              <select id="credit-customer" className="select" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.email}（当前 {customer.credits}）</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="credit-amount">充值积分</label>
              <input
                id="credit-amount"
                className="input"
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
              />
            </div>
            {error ? <div className="error-text">{error}</div> : null}
            <button className="btn" type="submit" disabled={!customers.length}>确认充值</button>
          </form>
        </article>
        <article className="panel">
          <h2 className="card-title">客户余额概览</h2>
          <div className="list-stack" style={{ marginTop: 16 }}>
            {customers.map((customer) => (
              <div key={customer.id} className="panel inline-actions" style={{ justifyContent: 'space-between' }}>
                <span>{customer.email}</span>
                <strong>{customer.credits} 积分</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="table-card">
        <h2 className="card-title">积分日志</h2>
        <div className="table-wrapper" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>客户</th>
                <th>变动</th>
                <th>余额</th>
                <th>原因</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.user?.email ?? '-'}</td>
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
