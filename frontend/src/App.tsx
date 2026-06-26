import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import StrategyBuilder from './pages/StrategyBuilder';
import Dashboard from './pages/Dashboard';
import SignalHistory from './pages/SignalHistory';
import Settings from './pages/Settings';
import Strategies from './pages/Strategies';
import Backtest from './pages/Backtest';
import Fleet from './pages/Fleet';
import MLTrainer from './pages/MLTrainer';
import CrossExchange from './pages/CrossExchange';
import Documentation from './pages/Documentation';
import PaperTrading from './pages/PaperTrading';
import Layout from './components/Layout';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import { useSession } from './lib/auth-client';
import BacktestJob from './pages/BacktestJob';
import ToastContainer from './components/ToastContainer';

function PrivateRoutes() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        Загрузка...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/strategies" element={<StrategiesPage />} />
        <Route path="/signals" element={<SignalHistory />} />
        <Route path="/paper" element={<PaperTrading />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/backtest/job/:jobId" element={<BacktestJob />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/ml" element={<MLTrainer />} />
        <Route path="/cross" element={<CrossExchange />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/docs" element={<Documentation />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

function BuilderPage() {
  const location = useLocation();
  const strategy = location.state?.strategy ?? null;
  return <StrategyBuilder key={strategy?.id ?? 'new'} initialStrategy={strategy} onBack={() => window.history.back()} />;
}

function StrategiesPage() {
  return <Strategies />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage page="login" />} />
        <Route path="/signup" element={<AuthPage page="signup" />} />
        <Route path="/*" element={<PrivateRoutes />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

function AuthPage({ page }: { page: 'login' | 'signup' }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        Загрузка...
      </div>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  if (page === 'signup') {
    return <Signup />;
  }
  return <Login />;
}

export default App;
