import { BrowserRouter, NavLink, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMembers } from './api/client';
import type { GroupMember } from './types';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import ResourcesPage from './pages/ResourcesPage';
import PlayGamePage from './pages/PlayGamePage';
import './index.css';

export default function App() {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [currentMember, setCurrentMember] = useState<GroupMember | null>(null);

  useEffect(() => {
    getMembers().then(data => {
      setMembers(data);
      if (data.length > 0) setCurrentMember(data[0]);
    });
  }, []);

  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <nav className="sidebar">
          <div className="sidebar-logo">
            <span className="logo-icon">📋</span>
            ProjectHub
          </div>

          <div className="sidebar-nav">
            <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon">🏠</span> Dashboard
            </NavLink>
            <NavLink to="/tasks" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon">✅</span> Tasks
            </NavLink>
            <NavLink to="/resources" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon">📁</span> Resources
            </NavLink>
            <NavLink to="/game" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon">🎮</span> Play Game
            </NavLink>
          </div>

          {/* Current user picker — lightweight auth */}
          <div className="sidebar-footer">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Viewing as
            </div>
            {currentMember && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="avatar avatar-sm" style={{ background: currentMember.color ?? '#aaa' }}>
                  {currentMember.avatarInitial}
                </span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{currentMember.name}</span>
              </div>
            )}
            <select
              value={currentMember?.id ?? ''}
              onChange={e => {
                const m = members.find(m => m.id === Number(e.target.value));
                if (m) setCurrentMember(m);
              }}
              style={{ fontSize: 13 }}
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </nav>

        {/* ── Main content ────────────────────────────────────────────── */}
        <div className="main-content">
          <Routes>
            <Route path="/" element={<DashboardPage currentMember={currentMember} members={members} />} />
            <Route path="/tasks" element={<TasksPage currentMember={currentMember} members={members} />} />
            <Route path="/resources" element={<ResourcesPage currentMember={currentMember} members={members} />} />
            <Route path="/game" element={<PlayGamePage currentMember={currentMember} members={members} />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
