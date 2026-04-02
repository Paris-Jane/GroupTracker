import { NavLink, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { getMembers } from './api/client';
import type { GroupMember } from './types';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import TasksPage from './pages/TasksPage';
import ScrumPage from './pages/ScrumPage';
import ResourcesPage from './pages/ResourcesPage';
import SchedulePage from './pages/SchedulePage';
import AdminPage from './pages/AdminPage';
import UserAvatar from './components/common/UserAvatar';
import SupabaseConfigMissing from './components/SupabaseConfigMissing';
import { isSupabaseConfigured } from './lib/supabaseConfig';
import { isAdminUser } from './lib/admin';
import './index.css';

function navClass({ isActive }: { isActive: boolean }) {
  return `app-nav-link${isActive ? ' active' : ''}`;
}

export default function App() {
  const { user, logout, loading } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    getMembers().then(setMembers);
  }, [user]);

  if (import.meta.env.PROD && !isSupabaseConfigured) {
    return <SupabaseConfigMissing />;
  }

  if (loading) {
    return (
      <div className="app-shell app-shell--centered">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <header className="app-topnav">
        <div className="app-brand">ProjectHub</div>
        <nav className="app-nav" aria-label="Main">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          <NavLink to="/scrum" className={navClass}>
            Sprint
          </NavLink>
          <NavLink to="/tasks" className={navClass}>
            Tasks
          </NavLink>
          <NavLink to="/resources" className={navClass}>
            Resources
          </NavLink>
          <NavLink to="/schedule" className={navClass}>
            Schedule
          </NavLink>
          {isAdminUser(user) ? (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          ) : null}
        </nav>
        <div className="app-user">
          <UserAvatar member={user} size="sm" />
          <span className="app-user-name">{user.name}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tasks" element={<TasksPage currentMember={user} members={members} />} />
          <Route path="/scrum" element={<ScrumPage currentMember={user} members={members} />} />
          <Route path="/resources" element={<ResourcesPage currentMember={user} members={members} />} />
          <Route path="/schedule" element={<SchedulePage currentMember={user} members={members} />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}
