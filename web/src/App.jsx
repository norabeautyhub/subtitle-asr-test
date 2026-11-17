import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import Home from './pages/Home.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin.jsx';
import NewProject from './pages/NewProject.jsx';
import Project from './pages/Project.jsx';
import Settings from './pages/Settings.jsx';

// ---------------- පොඩි router එකක් ----------------
const RouterCtx = createContext(null);
export const useRouter = () => useContext(RouterCtx);

export function Link({ to, children, className, ...rest }) {
  const { navigate } = useRouter();
  return (
    <a href={to} className={className} {...rest}
      onClick={e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); navigate(to); }}>
      {children}
    </a>
  );
}

// ---------------- Login වෙලා ඉන්න user ----------------
const SessionCtx = createContext(null);
export const useSession = () => useContext(SessionCtx);

export default function App() {
  const [path, setPath] = useState(location.pathname);
  const [session, setSession] = useState({ loading: true, user: null, plan: null, balance: null });

  const navigate = useCallback(to => {
    if (to !== location.pathname) history.pushState(null, '', to);
    setPath(to);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api('/me');
      setSession({ loading: false, ...me, user: me.user || null });
    } catch {
      setSession({ loading: false, user: null, plan: null, balance: null });
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
    await refresh();
    navigate('/');
  };

  let page;
  const { user, loading } = session;
  if (loading) page = <div className="center muted">Loading...</div>;
  else if (path === '/login') page = user ? <Redirect to="/dashboard" /> : <Login />;
  else if (path === '/register') page = user ? <Redirect to="/dashboard" /> : <Register />;
  else if (path === '/dashboard') page = user ? <Dashboard /> : <Redirect to="/login" />;
  else if (path === '/new') page = user ? <NewProject /> : <Redirect to="/login" />;
  else if (path === '/settings') page = user ? <Settings /> : <Redirect to="/login" />;
  else if (path.startsWith('/projects/')) page = user ? <Project key={path} id={path.split('/')[2]} /> : <Redirect to="/login" />;
  else if (path.startsWith('/admin')) page = !user ? <Redirect to="/login" /> : user.role === 'admin' ? <Admin /> : <NotFound />;
  else if (path === '/') page = <Home />;
  else page = <NotFound />;

  return (
    <RouterCtx.Provider value={{ path, navigate }}>
      <SessionCtx.Provider value={{ ...session, refresh, logout }}>
        <Header />
        <main className="container">{page}</main>
        <footer className="footer muted">© {new Date().getFullYear()} Novi Productions (Pvt) Ltd</footer>
      </SessionCtx.Provider>
    </RouterCtx.Provider>
  );
}

function Redirect({ to }) {
  const { navigate } = useRouter();
  useEffect(() => { navigate(to); }, [to, navigate]);
  return null;
}

function NotFound() {
  return <div className="center"><h2>Page එක හම්බවුණේ නෑ</h2><Link to="/">මුල් පිටුවට</Link></div>;
}

function Header() {
  const { user, logout } = useSession();
  return (
    <header className="header">
      <div className="container header-in">
        <Link to="/" className="logo">Novi<span>Subtitles</span></Link>
        <nav>
          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/settings">Settings</Link>
              {user.role === 'admin' && <Link to="/admin">Admin</Link>}
              <button className="btn ghost sm" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register" className="btn sm">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
