import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import type { Customer } from '../../types';
import { getErrorMessage } from '../../utils/api';
import { formatDateTime } from '../../utils/format';
import { hasMinPasswordLength, isValidEmail, normalizeEmail } from '../../utils/validation';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initialCredits, setInitialCredits] = useState(20);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingApiKey, setEditingApiKey] = useState('');

  const loadCustomers = async () => {
    try {
      setCustomers(await adminApi.getCustomers());
    } catch (loadError) {
      setError(getErrorMessage(loadError, '加载客户列表失败'));
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setError('请输入有效邮箱');
      return;
    }

    if (!hasMinPasswordLength(password)) {
      setError('初始密码至少为 6 位');
      return;
    }

    if (!Number.isInteger(initialCredits) || initialCredits < 0) {
      setError('初始积分必须是大于或等于 0 的整数');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await adminApi.createCustomer({
        email: normalizedEmail,
        password,
        initialCredits,
        apiKey: apiKey.trim() || undefined,
      });
      setEmail('');
      setPassword('');
      setInitialCredits(20);
      setApiKey('');
      await loadCustomers();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '创建客户失败'));
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (customer: Customer) => {
    try {
      await adminApi.updateCustomerStatus(customer.id, !customer.isActive);
      await loadCustomers();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '更新客户状态失败'));
    }
  };

  const startEditApiKey = (customer: Customer) => {
    setEditingCustomerId(customer.id);
    setEditingApiKey(customer.apiKey);
  };

  const cancelEditApiKey = () => {
    setEditingCustomerId(null);
    setEditingApiKey('');
  };

  const saveApiKey = async (customerId: string) => {
    if (!editingApiKey.trim()) {
      setError('API Key 不能为空');
      return;
    }

    try {
      await adminApi.updateCustomerApiKey(customerId, editingApiKey.trim());
      setEditingCustomerId(null);
      setEditingApiKey('');
      await loadCustomers();
    } catch (submitError) {
      setError(getErrorMessage(submitError, '更新 API Key 失败'));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板');
    }).catch(() => {
      alert('复制失败');
    });
  };

  return (
    <div className="list-stack">
      <div className="page-header">
        <div>
          <h1>客户管理</h1>
          <p>创建客户、设置 API Key、启用或禁用账号。</p>
        </div>
      </div>
      
      {error && <div className="error-text">{error}</div>}

      <div className="panel">
        <h2 className="card-title">新建客户</h2>
        <form className="form-grid" onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="customer-email">邮箱 *</label>
            <input
              id="customer-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="customer-password">初始密码 *</label>
            <input
              id="customer-password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 6 位"
            />
          </div>
          <div className="field">
            <label htmlFor="customer-credits">初始积分</label>
            <input
              id="customer-credits"
              className="input"
              type="number"
              min={0}
              step={1}
              value={initialCredits}
              onChange={(event) => setInitialCredits(Math.max(0, Number(event.target.value) || 0))}
            />
          </div>
          <div className="field">
            <label htmlFor="customer-api-key">API Key（可选）</label>
            <input
              id="customer-api-key"
              className="input"
              type="text"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="留空则自动生成"
            />
          </div>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? '创建中...' : '创建客户'}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2 className="card-title">客户列表</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>邮箱</th>
                <th>API Key</th>
                <th>积分</th>
                <th>任务数</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{customer.email}</div>
                  </td>
                  <td>
                    {editingCustomerId === customer.id ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          className="input"
                          type="text"
                          value={editingApiKey}
                          onChange={(e) => setEditingApiKey(e.target.value)}
                          style={{ fontSize: '12px', padding: '6px 8px' }}
                        />
                        <button
                          className="btn"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => saveApiKey(customer.id)}
                        >
                          保存
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={cancelEditApiKey}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="code-chip">{customer.apiKey}</span>
                        <button
                          className="btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => copyToClipboard(customer.apiKey)}
                        >
                          复制
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => startEditApiKey(customer)}
                        >
                          修改
                        </button>
                      </div>
                    )}
                  </td>
                  <td>{customer.credits}</td>
                  <td>{customer.taskCount}</td>
                  <td>
                    <span className={`status-pill ${customer.isActive ? 'status-active' : 'status-inactive'}`}>
                      {customer.isActive ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td>{formatDateTime(customer.createdAt)}</td>
                  <td>
                    <button
                      className={customer.isActive ? 'btn-danger' : 'btn-secondary'}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      type="button"
                      onClick={() => toggleStatus(customer)}
                    >
                      {customer.isActive ? '禁用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
