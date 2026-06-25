import React, { useState } from 'react';
import { signIn } from '../../lib/auth-client';
import { toast } from '../../stores/notificationStore';

const Login = ({ onLogin, onSwitchToSignup }: { onLogin: () => void, onSwitchToSignup: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await signIn.email({
        email,
        password,
      });
      if (error) {
        toast.error(error.message || 'Неверный логин или пароль');
      } else {
        toast.success('Добро пожаловать!');
        onLogin();
      }
    } catch (err: any) {
      toast.error('Ошибка сети. Проверьте соединение.');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-primary)' }}>
      <div className="bento-card" style={{ width: '400px', padding: '40px', borderRadius: 'var(--radius-xl)' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '24px', textAlign: 'center', fontSize: '24px', fontWeight: 800 }}>Вход</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required
              style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Пароль</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
              style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
          <button type="submit" style={{ padding: '14px', marginTop: '8px', borderRadius: 'var(--radius-md)', background: 'var(--accent-color)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', transition: 'var(--transition)' }}>
            Войти
          </button>
        </form>
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Нет аккаунта? <button onClick={onSwitchToSignup} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Зарегистрироваться</button>
        </div>
      </div>
    </div>
  );
};

export default Login;
