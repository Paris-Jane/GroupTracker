import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const ok = await login(username.trim(), password);
      if (!ok) setError('Invalid first name or last name. Use your first name as username and last name as password.');
    } catch {
      setError('Could not reach the database. Check Supabase configuration.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">ProjectHub</h1>
        <p className="login-sub">Group project workspace</p>
        <form onSubmit={submit} className="login-form">
          <label>
            First name (username)
            <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label>
            Last name (password)
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
