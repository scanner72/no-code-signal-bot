import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import { useSession } from './lib/auth-client';
import ToastContainer from './components/ToastContainer';
import VersionChecker from './components/VersionChecker';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';

import { cloudRoutes, CloudLanding, CLOUD_HOME } from './cloud';

const StrategyBuilder = lazy(() => import('./pages/StrategyBuilder'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SignalHistory = lazy(() => import('./pages/SignalHistory'));
const Settings = lazy(() => import('./pages/Settings'));
const Strategies = lazy(() => import('./pages/Strategies'));
const Backtest = lazy(() => import('./pages/Backtest'));
const Fleet = lazy(() => import('./pages/Fleet'));
const MLTrainer = lazy(() => import('./pages/MLTrainer'));
const CrossExchange = lazy(() => import('./pages/CrossExchange'));
const Documentation = lazy(() => import('./pages/Documentation'));
const PaperTrading = lazy(() => import('./pages/PaperTrading'));
const PineImport = lazy(() => import('./pages/PineImport'));


function PageLoader() {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      Загрузка...
    </div>
  );
}

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
    <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to={CLOUD_HOME} replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/strategies" element={<StrategiesPage />} />
                <Route path="/pine-import" element={<PineImport />} />
                <Route path="/signals" element={<SignalHistory />} />
                <Route path="/paper" element={<PaperTrading />} />
                <Route path="/backtest" element={<Backtest />} />
                <Route path="/fleet" element={<Fleet />} />
                <Route path="/ml" element={<MLTrainer />} />
                <Route path="/cross" element={<CrossExchange />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/docs" element={<Documentation />} />
                {cloudRoutes.map(({ path, Component }) => (
                  <Route key={path} path={path} element={<Component />} />
                ))}
                <Route path="*" element={<Navigate to={CLOUD_HOME} replace />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
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

function LandingPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        Загрузка...
      </div>
    );
  }

  if (session) {
    return <Navigate to={CLOUD_HOME} replace />;
  }

  if (!CloudLanding) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <CloudLanding />
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage page="login" />} />
        <Route path="/signup" element={<AuthPage page="signup" />} />
        <Route path="/*" element={<PrivateRoutes />} />
      </Routes>
      <ToastContainer />
      <VersionChecker />
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
    return <Navigate to={CLOUD_HOME} replace />;
  }

  if (page === 'signup') {
    return <Signup />;
  }
  return <Login />;
}

export default App;
