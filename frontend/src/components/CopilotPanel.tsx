import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Brain, Sparkles, Check, RefreshCw } from 'lucide-react';
import { useLanguageStore } from '../stores/useLanguageStore';
import { freeAiApi } from '../api/free-ai';
import { getLayoutedElements } from '../utils/layout';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  thinking?: string;
  strategy?: {
    name: string;
    description: string;
    nodes: any[];
    edges: any[];
  } | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nodes: any[];
  edges: any[];
  setNodes: (nodes: any[]) => void;
  setEdges: (edges: any[]) => void;
  pair: string;
  timeframe: string;
}

export const CopilotPanel = ({ isOpen, onClose, nodes, edges, setNodes, setEdges, pair, timeframe }: Props) => {
  const { language } = useLanguageStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: language === 'ru' 
        ? 'Привет! Я твой ИИ-копилот. Опиши мне торговую стратегию, которую ты хочешь построить, или попроси улучшить текущую.' 
        : 'Hello! I am your AI Copilot. Describe the trading strategy you want to build, or ask me to modify the current one.'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<'qwen' | 'deepseek'>('qwen');
  const [includeContext, setIncludeContext] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMsgText = inputText;
    setInputText('');
    
    // Add user message
    setMessages(prev => [...prev, { sender: 'user', text: userMsgText }]);
    setIsLoading(true);

    try {
      const res = await freeAiApi.copilot({
        provider,
        prompt: userMsgText,
        currentNodes: includeContext ? nodes : undefined,
        currentEdges: includeContext ? edges : undefined,
        pair,
        timeframe
      });

      const { thinking, strategy, rawAnswer } = res.data.data;
      
      let cleanAnswer = rawAnswer;
      const jsonMatch = rawAnswer.match(/```json([\s\S]*?)```/);
      if (jsonMatch) {
        cleanAnswer = rawAnswer.replace(jsonMatch[0], '').trim();
      }

      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: cleanAnswer || (language === 'ru' ? 'Стратегия сгенерирована!' : 'Strategy generated!'),
        thinking,
        strategy
      }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: language === 'ru' 
          ? `Ошибка при генерации: ${err.response?.data?.message || err.message}` 
          : `Generation error: ${err.response?.data?.message || err.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyStrategy = (strat: any) => {
    if (!strat || !strat.nodes) return;
    
    // Position/layout automatically using layout helper
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(strat.nodes, strat.edges || []);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    setMessages(prev => [...prev, {
      sender: 'assistant',
      text: language === 'ru'
        ? `✅ Стратегия "${strat.name || 'AI Strategy'}" успешно загружена на холст!`
        : `✅ Strategy "${strat.name || 'AI Strategy'}" has been loaded onto the canvas!`
    }]);
  };

  // Styles
  const panelStyle: React.CSSProperties = {
    width: isOpen ? '360px' : '0px',
    minWidth: isOpen ? '360px' : '0px',
    opacity: isOpen ? 1 : 0,
    background: 'rgba(15, 18, 25, 0.9)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderLeft: isOpen ? '1px solid rgba(99, 102, 241, 0.3)' : 'none',
    boxShadow: isOpen ? '-10px 0 30px rgba(0,0,0,0.6)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden'
  };

  return (
    <aside style={panelStyle}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(99, 102, 241, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--accent-color)" />
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
            AI Strategy Copilot
          </div>
        </div>
        <button 
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Provider & Options Toggle */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.01)'
      }}>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '8px' }}>
          <button 
            onClick={() => setProvider('qwen')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: provider === 'qwen' ? 'var(--accent-color)' : 'transparent',
              color: provider === 'qwen' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            Qwen Max
          </button>
          <button 
            onClick={() => setProvider('deepseek')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: provider === 'deepseek' ? 'var(--accent-color)' : 'transparent',
              color: provider === 'deepseek' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            DeepSeek
          </button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={includeContext} 
            onChange={(e) => setIncludeContext(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          {language === 'ru' ? 'Контекст холста' : 'Canvas context'}
        </label>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((msg, index) => (
          <div 
            key={index}
            style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{
              background: msg.sender === 'user' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
              border: msg.sender === 'user' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-color)',
              borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
              padding: '12px 16px',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-line'
            }}>
              {msg.text}
            </div>

            {msg.thinking && (
              <details style={{
                marginTop: '4px',
                border: '1px dashed rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '8px',
                background: 'rgba(0,0,0,0.2)'
              }}>
                <summary style={{
                  fontSize: '11px',
                  color: 'var(--accent-color)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Brain size={12} /> {language === 'ru' ? 'Ход мыслей ИИ' : 'AI Reasoning'}
                </summary>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  marginTop: '6px',
                  lineHeight: 1.4,
                  maxHeight: '120px',
                  overflowY: 'auto',
                  fontStyle: 'italic',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.thinking}
                </div>
              </details>
            )}

            {msg.strategy && (
              <div style={{
                marginTop: '8px',
                background: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '10px',
                padding: '10px 12px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--success)' }}>
                  {msg.strategy.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.3 }}>
                  {msg.strategy.description}
                </div>
                <button
                  onClick={() => applyStrategy(msg.strategy)}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--success)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)'
                  }}
                >
                  <Check size={14} />
                  {language === 'ru' ? 'Применить к холсту' : 'Apply to Canvas'}
                </button>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <RefreshCw size={14} className="animate-spin" color="var(--accent-color)" />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {language === 'ru' ? 'Думаю...' : 'Thinking...'}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-color)',
        background: 'rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              language === 'ru' 
                ? 'Например: Создай стратегию с RSI < 30 для покупки и LONG выходом...' 
                : 'E.g., Create a strategy with RSI < 30 for buying and a LONG exit...'
            }
            style={{
              flex: 1,
              background: 'var(--bg-accent)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'none',
              height: '60px',
              fontFamily: 'inherit'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading}
            style={{
              background: inputText.trim() && !isLoading ? 'var(--accent-color)' : 'rgba(255,255,255,0.02)',
              border: 'none',
              borderRadius: '10px',
              width: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputText.trim() && !isLoading ? 'pointer' : 'default',
              color: inputText.trim() && !isLoading ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};
