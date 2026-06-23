import React, { useState, useEffect } from 'react';
import { HelpCircle, ChevronRight, ChevronLeft, Check, Sparkles, Zap, TrendingUp, Play } from 'lucide-react';
import { useLanguageStore } from '../stores/useLanguageStore';

interface OnboardingWizardProps {
  onClose: () => void;
  isOpen: boolean;
}

const ruSteps = [
  {
    title: 'Добро пожаловать в Cyber-Quant!',
    subtitle: 'Количественный ИИ-ассистент нового поколения',
    icon: <Sparkles size={48} color="#7c3aed" style={{ filter: 'drop-shadow(0 0 15px rgba(124, 58, 237, 0.5))' }} />,
    bg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
        <p>
          Рады видеть вас! <strong>Cyber-Quant</strong> — это мощная экосистема для автоматизации торговли на криптовалютных рынках с использованием алгоритмов искусственного интеллекта.
        </p>
        <p>
          Здесь вы сможете создавать сложные торговые стратегии на базе графических нод, проводить мгновенное бэктестирование, оптимизировать параметры генетическими алгоритмами и фильтровать сигналы с помощью языковой модели <strong>Hermes AI</strong>.
        </p>
        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', color: 'var(--text-primary)' }}>
          <Zap size={16} color="#f59e0b" /> Прохождение этого гида займет менее 2 минут!
        </p>
      </div>
    )
  },
  {
    title: '1. Bento Конструктор Стратегий',
    subtitle: 'Визуальное моделирование без кода',
    icon: <Zap size={48} color="#6366f1" style={{ filter: 'drop-shadow(0 0 15px rgba(99, 102, 241, 0.5))' }} />,
    bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
        <p>
          Создавайте алгоритмы любой сложности, просто соединяя визуальные Bento-блоки на бесконечном канвасе:
        </p>
        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>🟢 <strong>Входные данные:</strong> Цена, объемы, ставка финансирования и открытый интерес в реальном времени.</li>
          <li>🔵 <strong>Индикаторы:</strong> RSI, EMA, Bollinger Bands, ATR, а также умные блоки SMC (Order Blocks, FVG, Sweeps).</li>
          <li>🟣 <strong>Логические гейты:</strong> AND / OR сравнения, пересечения (Cross Above / Below).</li>
          <li>🤖 <strong>ИИ-валидация:</strong> Hermes AI фильтрация и Heym MCP Workflow-ноды для анализа рынка.</li>
        </ul>
      </div>
    )
  },
  {
    title: '2. Генетический Оптимизатор',
    subtitle: 'Автоматический поиск лучших параметров',
    icon: <TrendingUp size={48} color="#10b981" style={{ filter: 'drop-shadow(0 0 15px rgba(16, 185, 129, 0.5))' }} />,
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
        <p>
          Больше не нужно гадать, какие настройки индикаторов работают лучше всего. Наш <strong>Генетический Оптимизатор</strong> сделает это за вас:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Эволюция ИИ</div>
            Параметры мутируют и скрещиваются для максимизации прибыли.
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Умный бэктест</div>
            Анализ сотен вариантов за секунды в изолированной песочнице.
          </div>
        </div>
      </div>
    )
  },
  {
    title: '3. Безопасный Paper Trading',
    subtitle: 'Тестируйте стратегии без финансовых рисков',
    icon: <Play size={48} color="#ec4899" style={{ filter: 'drop-shadow(0 0 15px rgba(236, 72, 153, 0.5))' }} />,
    bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(245, 158, 11 0.05) 100%)',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
        <p>
          Запускайте готовые стратегии в режиме <strong>Paper Trading (Форвард-тесты)</strong>:
        </p>
        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>📈 Симуляция торговли на реальном тикерном стриме биржи Binance.</li>
          <li>📊 Полноценный анализ доходности: итоговый Profit & Loss, просадки и винрейт.</li>
          <li>📉 <strong>Equity Curve</strong> на Dashboard в реальном времени покажет вам точную динамику баланса по дням.</li>
        </ul>
      </div>
    )
  }
];

const enSteps = [
  {
    title: 'Welcome to Cyber-Quant!',
    subtitle: 'Next-Generation Quantitative AI Assistant',
    icon: <Sparkles size={48} color="#7c3aed" style={{ filter: 'drop-shadow(0 0 15px rgba(124, 58, 237, 0.5))' }} />,
    bg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
        <p>
          We are thrilled to have you! <strong>Cyber-Quant</strong> is a powerful ecosystem for automating cryptocurrency trading using artificial intelligence algorithms.
        </p>
        <p>
          Here you can build complex graphical node-based trading strategies, perform instant backtesting, optimize parameters via genetic algorithms, and filter signals using the <strong>Hermes AI</strong> language model.
        </p>
        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', color: 'var(--text-primary)' }}>
          <Zap size={16} color="#f59e0b" /> Completing this guide will take less than 2 minutes!
        </p>
      </div>
    )
  },
  {
    title: '1. Bento Strategy Builder',
    subtitle: 'Visual modeling without code',
    icon: <Zap size={48} color="#6366f1" style={{ filter: 'drop-shadow(0 0 15px rgba(99, 102, 241, 0.5))' }} />,
    bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
        <p>
          Build algorithms of any complexity by simply connecting visual Bento blocks on an infinite canvas:
        </p>
        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>🟢 <strong>Inputs:</strong> Real-time Price, Volume, Funding Rate, and Open Interest.</li>
          <li>🔵 <strong>Indicators:</strong> RSI, EMA, Bollinger Bands, ATR, plus Smart Money Concepts (Order Blocks, FVG, Sweeps).</li>
          <li>🟣 <strong>Logic gates:</strong> AND / OR comparisons, crossovers (Cross Above / Below).</li>
          <li>🤖 <strong>AI Validation:</strong> Hermes AI filtering and Heym MCP Workflow nodes for advanced market analysis.</li>
        </ul>
      </div>
    )
  },
  {
    title: '2. Genetic Optimizer',
    subtitle: 'Automatically discover the best parameters',
    icon: <TrendingUp size={48} color="#10b981" style={{ filter: 'drop-shadow(0 0 15px rgba(16, 185, 129, 0.5))' }} />,
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
        <p>
          No more guessing which indicator configurations perform best. Our <strong>Genetic Optimizer</strong> takes care of the work:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>AI Evolution</div>
            Parameters mutate and cross over to maximize profitability.
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Smart Backtest</div>
            Analyze hundreds of variations in seconds in an isolated sandbox.
          </div>
        </div>
      </div>
    )
  },
  {
    title: '3. Safe Paper Trading',
    subtitle: 'Test strategies without financial risk',
    icon: <Play size={48} color="#ec4899" style={{ filter: 'drop-shadow(0 0 15px rgba(236, 72, 153, 0.5))' }} />,
    bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
        <p>
          Deploy your finished strategies in <strong>Paper Trading (Forward testing)</strong> mode:
        </p>
        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>📈 Simulated trading on real Binance exchange ticker streams.</li>
          <li>📊 In-depth performance statistics: Net Profit & Loss, drawdown, and win rate.</li>
          <li>📉 Live <strong>Equity Curve</strong> on your Dashboard provides real-time account balance tracking.</li>
        </ul>
      </div>
    )
  }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { language } = useLanguageStore();

  const steps = language === 'ru' ? ruSteps : enSteps;

  // Auto-close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLastStep = currentStep === steps.length - 1;
  const active = steps[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem('has_completed_onboarding', 'true');
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(5, 6, 8, 0.85)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', animation: 'fadeIn 0.25s ease-out'
    }}>
      <div className="bento-card animate-fadeIn" style={{
        maxWidth: '520px', width: '100%',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: '24px', overflow: 'hidden',
        boxShadow: '0 30px 70px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255,255,255,0.03)',
        display: 'flex', flexDirection: 'column', position: 'relative'
      }}>
        
        {/* Glow Header */}
        <div style={{
          height: '140px', background: active.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.5s ease', borderBottom: '1px solid var(--border-color)'
        }}>
          {active.icon}
        </div>

        {/* Step Content */}
        <div style={{ padding: '30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {active.title}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '20px' }}>
            {active.subtitle}
          </div>

          <div style={{ minHeight: '180px', flex: 1 }}>
            {active.content}
          </div>

          {/* Footer Controls */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-color)'
          }}>
            
            {/* Step Progress Indicators */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  style={{
                    width: idx === currentStep ? '20px' : '6px',
                    height: '6px',
                    borderRadius: '3px',
                    background: idx === currentStep ? 'var(--accent-color)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  style={{
                    background: 'var(--bg-accent)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    color: 'var(--text-primary)',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'var(--transition)'
                  }}
                >
                  <ChevronLeft size={16} /> {language === 'ru' ? 'Назад' : 'Back'}
                </button>
              )}

              <button
                onClick={handleNext}
                style={{
                  background: isLastStep ? 'linear-gradient(135deg, var(--accent-color), var(--success))' : 'var(--accent-color)',
                  boxShadow: '0 4px 15px rgba(124,58,237,0.25)',
                  borderRadius: '12px',
                  color: '#fff',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'var(--transition)'
                }}
              >
                {isLastStep ? (
                  <>{language === 'ru' ? 'Начать работу!' : 'Get Started!'} <Check size={16} /></>
                ) : (
                  <>{language === 'ru' ? 'Далее' : 'Next'} <ChevronRight size={16} /></>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
