import React, { useState } from 'react';
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

import ToastContainer from './components/ToastContainer';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editStrategy, setEditStrategy] = useState<any>(null);

  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Загрузка...</div>;
  }

  if (!session) {
    if (activeTab === 'signup') {
      return <Signup onSignup={() => setActiveTab('dashboard')} onSwitchToLogin={() => setActiveTab('login')} />;
    }
    return <Login onLogin={() => setActiveTab('dashboard')} onSwitchToSignup={() => setActiveTab('signup')} />;
  }

  const openBuilder = (strategy?: any) => {
    setEditStrategy(strategy ?? null);
    setActiveTab('builder');
  };

  let content;
  if (activeTab === 'dashboard') content = <Dashboard onTabChange={setActiveTab} />;
  else if (activeTab === 'builder') content = <StrategyBuilder key={editStrategy?.id ?? 'new'} initialStrategy={editStrategy} onBack={() => setActiveTab('strategies')} />;
  else if (activeTab === 'signals') content = <SignalHistory />;
  else if (activeTab === 'paper') content = <PaperTrading />;
  else if (activeTab === 'strategies') content = <Strategies onOpenBuilder={() => openBuilder()} onEditStrategy={openBuilder} />;
  else if (activeTab === 'backtest') content = <Backtest />;
  else if (activeTab === 'fleet') content = <Fleet />;
  else if (activeTab === 'ml') content = <MLTrainer />;
  else if (activeTab === 'cross') content = <CrossExchange />;
  else if (activeTab === 'settings') content = <Settings />;
  else if (activeTab === 'docs') content = <Documentation />;

  return (
    <>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {content}
      </Layout>
      <ToastContainer />
    </>
  );
}

export default App;
