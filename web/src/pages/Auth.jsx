import { useState } from 'react';
import { api } from '../api.js';
import { Link, useRouter, useSession } from '../App.jsx';

function AuthForm({ mode }) {
  const { refresh } = useSession();
  const { navigate } = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isReg = mode === 'register';
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api(isReg ? '/auth/register' : '/auth/login', { method: 'POST', body: form });
      await refresh();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h2>{isReg ? 'අලුත් account එකක් හදන්න' : 'Login වෙන්න'}</h2>
        {isReg && (
          <label>නම<input value={form.name} onChange={set('name')} autoComplete="name" /></label>
        )}
        <label>Email<input type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></label>
        <label>Password
          <input type="password" required minLength={isReg ? 8 : undefined} value={form.password} onChange={set('password')}
            autoComplete={isReg ? 'new-password' : 'current-password'} />
        </label>
        {isReg && <p className="muted small">අවම අකුරු 8ක්</p>}
        {error && <div className="alert error">{error}</div>}
        <button className="btn full" disabled={busy}>{busy ? '...' : isReg ? 'Account එක හදන්න' : 'Login'}</button>
        <p className="muted small center">
          {isReg ? <>දැනටමත් account එකක් තියෙනවද? <Link to="/login">Login</Link></>
            : <>Account එකක් නැද්ද? <Link to="/register">Sign up</Link></>}
        </p>
      </form>
    </div>
  );
}

export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;
