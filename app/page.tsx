'use client';

import { useState, useRef, useEffect } from 'react';
import { submitWord, getWizardResponse } from './actions/game';
import { register, login, logout, getUser, saveHighScore, changeMyPassword } from './actions/auth';
import { searchWords, deleteWord, addWordsBulk, getStats, getUsers, getPendingSuggestions, resolveSuggestion, updateWordLevel, resetUserPassword } from './actions/admin';
import { suggestWord, getWeeklyLeaderboard } from './actions/community';
import { Heart, Trophy, RotateCcw, AlertCircle, HelpCircle, User as UserIcon, LogOut, Users, Book, MessageSquare, Check, X, Sparkles, Key } from 'lucide-react';
import { getRequiredNextSyllable } from '@/lib/game';

type GameMode = 'classic' | 'sudden';
type Difficulty = 'aprendiz' | 'sabio' | 'supremo';
type Screen = 'auth' | 'menu' | 'how' | 'game' | 'over' | 'admin';

interface UserData {
  id: number;
  username: string;
  score: number;
}

export default function GamePage() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [user, setUser] = useState<UserData | null>(null);
  
  // Auth state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Game configuration
  const [mode, setMode] = useState<GameMode>('classic');
  const [difficulty, setDifficulty] = useState<Difficulty>('aprendiz');
  
  // In-game state
  const [playedWords, setPlayedWords] = useState<string[]>([]);
  const [requiredPrevWord, setRequiredPrevWord] = useState<string | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [error, setError] = useState('');
  const [isShake, setIsShake] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newRecord, setNewRecord] = useState(false);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(20);
  const [timerActive, setTimerActive] = useState(false);
  
  // Wizard state
  const [wizardEmoji, setWizardEmoji] = useState('🧙‍♂️');
  const [hint, setHint] = useState('¡Empieza! Escribe cualquier palabra...');
  const [uiWord, setUiWord] = useState('¡ADELANTE!');
  
  // Mirror state
  const [mirrorAvailable, setMirrorAvailable] = useState(true);
  const [wizardMirrorAvailable, setWizardMirrorAvailable] = useState(true);
  const [isMirrorInEffect, setIsMirrorInEffect] = useState(false);

  // Community state
  const [leaderboard, setLeaderboard] = useState<{
    aprendiz: {username: string, score: number}[],
    sabio: {username: string, score: number}[],
    supremo: {username: string, score: number}[]
  } | null>(null);
  const [leaderboardTab, setLeaderboardTab] = useState<Difficulty>('aprendiz');
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestInput, setSuggestInput] = useState('');
  const [suggestMessage, setSuggestMessage] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  // Admin state
  const [adminTab, setAdminTab] = useState<'diccionario' | 'usuarios' | 'sugerencias'>('diccionario');
  const [adminTotalWords, setAdminTotalWords] = useState(0);
  const [adminUsers, setAdminUsers] = useState<{id: number, username: string, score: number, createdAt: Date, _count: { suggestions: number }}[]>([]);
  const [adminSuggestions, setAdminSuggestions] = useState<{id: number, text: string, user: { username: string }}[]>([]);
  const [adminQuery, setAdminQuery] = useState('');
  const [adminFilterLevel, setAdminFilterLevel] = useState<number>(0);
  const [adminMatchType, setAdminMatchType] = useState<'contains' | 'startsWith' | 'endsWith'>('contains');
  const [adminResults, setAdminResults] = useState<{id: number, text: string, level: number}[]>([]);
  const [adminAddWord, setAdminAddWord] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [resetUser, setResetUser] = useState<{id: number, username: string} | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch data
  useEffect(() => {
    if (screen === 'auth' || screen === 'menu') {
      getUser().then(u => {
        if (u) {
          setUser(u);
          if (screen === 'auth') setScreen('menu');
        }
      });
    }

    if (screen === 'menu') {
      getWeeklyLeaderboard().then(l => setLeaderboard(l));
    }
    
    if (screen === 'admin' && user?.username === 'intivinu') {
      getStats().then(s => setAdminTotalWords(s.totalWords));
      getUsers().then(u => setAdminUsers(u as any));
      getPendingSuggestions().then(s => setAdminSuggestions(s));
    }
  }, [screen, user?.username]);

  // Timer logic
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft((prev) => prev - 0.1);
      }, 100);
    } else if (timerActive && timeLeft <= 0) {
      handleError("¡TIEMPO AGOTADO!");
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, timerActive]);

  useEffect(() => {
    if (screen === 'game' && !isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [screen, isLoading]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError('');
    
    if (username.length < 3) {
      setAuthError('El usuario debe tener al menos 3 letras');
      setIsLoading(false);
      return;
    }
    if (password.length < 4) {
      setAuthError('La contraseña debe tener al menos 4 letras');
      setIsLoading(false);
      return;
    }

    try {
      const action = authMode === 'login' ? login : register;
      const res = await action(username, password);
      
      if (res.success) {
        const u = await getUser();
        setUser(u);
        setScreen('menu');
      } else {
        setAuthError(res.error || 'Error de autenticación');
      }
    } catch (err: any) {
      setAuthError('Error de conexión con el servidor (Vercel). Revisa tus variables de entorno.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setUsername('');
    setPassword('');
    setAuthError('');
    setScreen('auth');
  };

  const initGame = (selectedMode: GameMode) => {
    setMode(selectedMode);
    setLives(selectedMode === 'classic' ? 3 : 1);
    setScore(0);
    setPlayedWords([]);
    setRequiredPrevWord(null);
    setMirrorAvailable(true);
    setWizardMirrorAvailable(true);
    setIsMirrorInEffect(false);
    setError('');
    setUiWord('¡ADELANTE!');
    setHint('Escribe cualquier palabra...');
    setWizardEmoji('🧙‍♂️');
    setCurrentInput('');
    setNewRecord(false);
    setScreen('game');
    startTimer(20);
  };

  const startTimer = (seconds: number) => {
    setTimerActive(false);
    setTimeout(() => {
      setTimeLeft(seconds);
      setTimerActive(true);
    }, 50);
  };

  const handleGameOver = async (finalScore: number, finalWords: string[]) => {
    setScreen('over');
    setTimerActive(false);
    
    if (user) {
      const res = await saveHighScore(finalScore, finalWords, difficulty);
      if (res.newRecord) {
        setNewRecord(true);
        setUser({ ...user, score: finalScore });
      }
    }
  };

  const handleError = (msg: string) => {
    setTimerActive(false);
    setError(msg);
    
    const newLives = lives - 1;
    setLives(newLives);
    
    if (newLives <= 0) {
      handleGameOver(score, playedWords);
    } else {
      setIsMirrorInEffect(false);
      setWizardEmoji('🔮');
      setUiWord('¡REINTENTO!');
      setHint('Cadena reiniciada. ¡Lanza una palabra!');
      setRequiredPrevWord(null);
      setCurrentInput('');
      startTimer(20);
    }
    
    setIsShake(true);
    setTimeout(() => setIsShake(false), 400);
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (screen !== 'game' || !currentInput.trim() || isLoading) return;

    setTimerActive(false);
    setError('');
    setIsLoading(true);
    
    const word = currentInput.trim().toLowerCase();
    const prevWord = requiredPrevWord;

    try {
      const result = await submitWord(word, prevWord, playedWords);
      
      if (result.success) {
        const newPlayedWords = [...playedWords, word];
        setPlayedWords(newPlayedWords);
        setScore(score + 10);
        setCurrentInput('');
        setUiWord(word);
        setRequiredPrevWord(word);
        setHint('Mago pensando...');
        setIsMirrorInEffect(false);
        
        setTimeout(() => wizardTurn(newPlayedWords, word), 800);
      } else {
        handleError(result.reason || 'Palabra inválida');
        setIsLoading(false);
      }
    } catch (err) {
      handleError('Error de conexión.');
      setIsLoading(false);
    }
  };

  const execPlayerMirror = () => {
    if (!mirrorAvailable || isMirrorInEffect || playedWords.length === 0) return;
    setMirrorAvailable(false);
    setIsMirrorInEffect(true);
    setTimerActive(false);
    setWizardEmoji('🪞');
    setUiWord('¡ESPEJO!');
    const targetSyllable = getRequiredNextSyllable(requiredPrevWord || '');
    setHint(`Mago debe responder a: "${targetSyllable.toUpperCase()}"`);
    setIsLoading(true);
    setTimeout(() => wizardTurn(playedWords, requiredPrevWord || '', true), 800);
  };

  const wizardTurn = async (currentHistory: string[], lastPlayerWord: string, forcedByMirror = false) => {
    const requiredSyllable = getRequiredNextSyllable(lastPlayerWord);
    
    try {
      const response = await getWizardResponse(requiredSyllable, difficulty, currentHistory);
      
      if (response.success && response.word) {
        setPlayedWords([...currentHistory, response.word]);
        setRequiredPrevWord(response.word);
        setWizardEmoji('🧙‍♂️');
        setUiWord(response.word);
        
        const nextRequired = getRequiredNextSyllable(response.word);
        setHint(`Tu turno: empieza con "${nextRequired.toUpperCase()}"`);
        setIsMirrorInEffect(false);
        startTimer(Math.max(6, 20 - (score / 80)));
      } else {
        if (wizardMirrorAvailable && !forcedByMirror && !isMirrorInEffect && currentHistory.length > 0) {
          setWizardMirrorAvailable(false);
          setIsMirrorInEffect(true);
          setWizardEmoji('🪞');
          setUiWord('¡REFLEJO!');
          setHint(`¡REFLEJO! Responde tú a: "${requiredSyllable.toUpperCase()}"`);
          startTimer(15);
        } else {
          setWizardEmoji('😵');
          setUiWord('¡ME RINDO!');
          setHint('¡Ganas bonus! Cadena libre:');
          setScore(s => s + 20);
          setRequiredPrevWord(null);
          setIsMirrorInEffect(false);
          startTimer(20);
        }
      }
    } catch (err) {
      setWizardEmoji('😵');
      setUiWord('ERROR MÁGICO');
      setHint('El mago tuvo un fallo. Cadena libre.');
      setRequiredPrevWord(null);
      startTimer(20);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`game-wrapper ${isShake ? 'shake' : ''}`}>
      
      {screen === 'auth' && (
        <div className="flex-col gap-6 animate-slide-up" style={{ width: '100%', marginTop: '2rem' }}>
          <div className="magician-emoji animate-float">🧙‍♂️</div>
          <div>
            <h1>MAGO GOMA</h1>
          </div>

          <div className="glass-panel flex-col gap-4">
            <h2 className="text-accent" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </h2>
            
            <form onSubmit={handleAuth} className="input-container flex-col gap-4">
              <input
                type="text"
                placeholder="Usuario"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="game-input"
                style={{ fontSize: '1.2rem', padding: '1rem' }}
                disabled={isLoading}
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="game-input"
                style={{ fontSize: '1.2rem', padding: '1rem' }}
                disabled={isLoading}
              />
              {authError && <div className="text-error" style={{ fontSize: '0.9rem', fontWeight: 700 }}>{authError}</div>}
              
              <button type="submit" disabled={isLoading} className="btn btn-primary mt-2">
                {isLoading ? 'Cargando...' : (authMode === 'login' ? 'Entrar' : 'Registrarse')}
              </button>
            </form>

            <button 
              onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }} 
              className="text-muted mt-2" 
              style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </div>
      )}

      {screen === 'menu' && user && (
        <div className="flex-col gap-6 animate-slide-up" style={{ width: '100%' }}>
          
          <div className="glass-panel flex-between" style={{ padding: '1rem' }}>
            <div className="flex-center gap-2 font-bold text-accent">
              <UserIcon size={20} />
              {user.username}
            </div>
            <div className="flex-center gap-2">
              <button onClick={() => { setPasswordMessage(''); setShowChangePasswordModal(true); }} className="text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Cambiar Contraseña">
                <Key size={18} />
              </button>
              <button onClick={handleLogout} className="text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Cerrar Sesión">
                <LogOut size={20} />
              </button>
            </div>
          </div>

          <div className="magician-emoji animate-float">🧙‍♂️</div>
          <div>
            <h1>MAGO GOMA</h1>
            <p className="text-muted" style={{ textAlign: 'center', marginTop: '0.5rem' }}>el juego de encadenar palabras</p>
          </div>

          <div className="glass-panel flex-col gap-4">
            <div className="flex-center gap-2 text-success" style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              <Trophy size={20} /> Récord Personal: {user.score}
            </div>

            {leaderboard && (leaderboard.aprendiz.length > 0 || leaderboard.sabio.length > 0 || leaderboard.supremo.length > 0) && (
              <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '0.5rem' }}>
                <h3 className="text-accent flex-center gap-2" style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                  <Sparkles size={16} /> Top 5 Semanal <Sparkles size={16} />
                </h3>
                
                <div className="level-selector" style={{ marginBottom: '0.5rem' }}>
                  {(['aprendiz', 'sabio', 'supremo'] as Difficulty[]).map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setLeaderboardTab(lvl)}
                      className={`level-btn ${leaderboardTab === lvl ? 'active' : ''}`}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                {leaderboard[leaderboardTab].length === 0 ? (
                  <p className="text-muted" style={{ textAlign: 'center', fontSize: '0.8rem' }}>Aún no hay récords.</p>
                ) : (
                  leaderboard[leaderboardTab].map((lb, i) => (
                    <div key={i} className="flex-between" style={{ padding: '0.25rem 0', borderBottom: i < leaderboard[leaderboardTab].length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none', fontSize: '0.9rem' }}>
                      <span style={{ color: i === 0 ? 'var(--accent)' : 'inherit', fontWeight: i === 0 ? 'bold' : 'normal' }}>
                        {i + 1}. {lb.username}
                      </span>
                      <span className="text-success font-bold">{lb.score} pts</span>
                    </div>
                  ))
                )}
              </div>
            )}

            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Dificultad del Mago:</p>
            <div className="level-selector">
              {(['aprendiz', 'sabio', 'supremo'] as Difficulty[]).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setDifficulty(lvl)}
                  className={`level-btn ${difficulty === lvl ? 'active' : ''}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            
            <button onClick={() => initGame('classic')} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Modo Clásico (3 Vidas)
            </button>
            <button onClick={() => initGame('sudden')} className="btn btn-accent">
              Muerte Súbita (1 Vida)
            </button>

            <div className="flex-between gap-2" style={{ marginTop: '0.5rem' }}>
              <button onClick={() => setScreen('how')} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                <HelpCircle size={20} className="mr-1" /> Jugar
              </button>
              <button onClick={() => { setSuggestMessage(''); setSuggestInput(''); setShowSuggestModal(true); }} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                <MessageSquare size={20} className="mr-1" /> Sugerir
              </button>
            </div>
            
            {user.username === 'intivinu' && (
              <button onClick={() => { setAdminMessage(''); setScreen('admin'); }} className="btn" style={{ background: '#0984e3', color: 'white', marginTop: '0.5rem' }}>
                ⚙️ Panel Administrador
              </button>
            )}
          </div>
        </div>
      )}

      {showSuggestModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel flex-col gap-4 animate-slide-up" style={{ width: '100%', maxWidth: '400px' }}>
            <h2 className="text-accent font-bold text-center">Sugerir Palabra</h2>
            <p className="text-muted text-center" style={{ fontSize: '0.9rem' }}>Aporta nuevas palabras al diccionario para ganar reconocimiento en la comunidad.</p>
            
            <input 
              type="text" 
              value={suggestInput} 
              onChange={e => setSuggestInput(e.target.value)} 
              placeholder="Escribe la palabra..." 
              className="game-input"
              disabled={isLoading}
            />
            {suggestMessage && <p className="text-success text-center font-bold" style={{ fontSize: '0.9rem' }}>{suggestMessage}</p>}
            
            <div className="flex-between gap-2 mt-2">
              <button onClick={() => setShowSuggestModal(false)} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancelar</button>
              <button 
                onClick={async () => {
                  setIsLoading(true);
                  const res = await suggestWord(suggestInput);
                  if (res.success) {
                    setSuggestMessage('¡Sugerencia enviada! El admin la revisará.');
                    setSuggestInput('');
                  } else {
                    setSuggestMessage(res.error || 'Error al enviar');
                  }
                  setIsLoading(false);
                }} 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                disabled={isLoading || !suggestInput}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangePasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel flex-col gap-4 animate-slide-up" style={{ width: '100%', maxWidth: '400px' }}>
            <h2 className="text-accent font-bold text-center">Cambiar Contraseña</h2>
            
            <input 
              type="password" 
              value={currentPassword} 
              onChange={e => setCurrentPassword(e.target.value)} 
              placeholder="Contraseña Actual" 
              className="game-input"
              disabled={isLoading}
            />
            <input 
              type="password" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              placeholder="Nueva Contraseña (min. 4)" 
              className="game-input"
              disabled={isLoading}
            />
            {passwordMessage && <p className={passwordMessage.includes('éxito') ? "text-success text-center font-bold" : "text-error text-center font-bold"} style={{ fontSize: '0.9rem' }}>{passwordMessage}</p>}
            
            <div className="flex-between gap-2 mt-2">
              <button onClick={() => { setShowChangePasswordModal(false); setCurrentPassword(''); setNewPassword(''); setPasswordMessage(''); }} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancelar</button>
              <button 
                onClick={async () => {
                  setIsLoading(true);
                  const res = await changeMyPassword(currentPassword, newPassword);
                  if (res.success) {
                    setPasswordMessage('¡Contraseña cambiada con éxito!');
                    setCurrentPassword('');
                    setNewPassword('');
                  } else {
                    setPasswordMessage(res.error || 'Error al cambiar');
                  }
                  setIsLoading(false);
                }} 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                disabled={isLoading || !currentPassword || newPassword.length < 4}
              >
                Cambiar
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'how' && (
        <div className="glass-panel animate-slide-up flex-col gap-4">
          <h2 className="text-accent" style={{ fontSize: '1.5rem', fontWeight: 800 }}>Instrucciones</h2>
          <div style={{ lineHeight: 1.6, fontSize: '0.95rem' }} className="text-muted">
            <p style={{ marginBottom: '0.75rem' }}>1. Escribe una palabra que empiece con la <b className="text-accent">última sílaba</b> de la anterior. Tienes 20 segundos.</p>
            <p style={{ marginBottom: '0.75rem' }}>2. Las tildes no importan al encadenar: <b style={{ color: 'white' }}>Jabón</b> termina en <b className="text-accent">bon</b>, puedes seguir con <b style={{ color: 'white' }}>Bondad</b>.</p>
            <p style={{ marginBottom: '0.75rem' }}>3. <b style={{ color: 'white' }}>Efecto Espejo:</b> Devuelve la sílaba al oponente. Si el Mago no sabe qué decir, ¡lo usará contra ti! Tú puedes usarlo 1 vez por partida.</p>
            <p>4. Niveles: El Mago <b className="text-error">falla</b> más en Aprendiz y es casi <b className="text-success">perfecto</b> en Supremo.</p>
            
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid var(--accent)', marginTop: '1rem' }}>
              <p style={{ fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>🏆 Sistema de Puntos:</p>
              <p>• Palabra correcta: <b className="text-success">+10 pts</b></p>
              <p>• Si el Mago se rinde: <b className="text-accent">+20 pts extra</b></p>
            </div>
          </div>
          <button onClick={() => setScreen('menu')} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
            Entendido
          </button>
        </div>
      )}

      {screen === 'admin' && user?.username === 'intivinu' && (
        <div className="glass-panel flex-col gap-4 animate-slide-up" style={{ width: '100%', marginTop: '2rem' }}>
          <div className="flex-between" style={{ width: '100%' }}>
            <h2 className="text-accent" style={{ fontSize: '1.5rem', fontWeight: 800 }}>PANEL ADMIN</h2>
            {adminTab === 'diccionario' && <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Total Palabras: <span className="text-success">{adminTotalWords.toLocaleString()}</span></div>}
            {adminTab === 'usuarios' && <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Total Usuarios: <span className="text-accent">{adminUsers.length}</span></div>}
            {adminTab === 'sugerencias' && <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Pendientes: <span className="text-error">{adminSuggestions.length}</span></div>}
          </div>
          
          <div className="level-selector" style={{ width: '100%', marginBottom: '0.5rem' }}>
            <button onClick={() => setAdminTab('diccionario')} className={`level-btn ${adminTab === 'diccionario' ? 'active' : ''}`}><Book size={16} className="inline mr-1" /> Palabras</button>
            <button onClick={() => setAdminTab('usuarios')} className={`level-btn ${adminTab === 'usuarios' ? 'active' : ''}`}><Users size={16} className="inline mr-1" /> Usuarios</button>
            <button onClick={() => setAdminTab('sugerencias')} className={`level-btn ${adminTab === 'sugerencias' ? 'active' : ''}`}><MessageSquare size={16} className="inline mr-1" /> Sugerencias</button>
          </div>

          {adminTab === 'diccionario' ? (
            <>
              <div className="flex-between" style={{ width: '100%', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  value={adminAddWord} 
                  onChange={e => setAdminAddWord(e.target.value)} 
                  placeholder="Nueva palabra..." 
                  className="game-input" 
                  style={{ fontSize: '1rem', padding: '0.75rem', flex: 1 }} 
                />
                <button 
                  onClick={async () => {
                    if(!adminAddWord) return;
                    setIsLoading(true);
                    const res = await addWordsBulk([adminAddWord]);
                    setAdminMessage(res.count ? `Añadida: ${adminAddWord}` : 'Ya existe o es inválida');
                    setAdminAddWord('');
                    setAdminQuery('');
                    setAdminResults([]);
                    const s = await getStats();
                    setAdminTotalWords(s.totalWords);
                    setIsLoading(false);
                  }} 
                  disabled={isLoading}
                  className="btn btn-primary" 
                  style={{ width: 'auto', padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                >
                  Añadir
                </button>
              </div>

              <div className="flex-between" style={{ width: '100%', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Buscar palabra..." 
                  value={adminQuery}
                  onChange={async (e) => {
                    setAdminQuery(e.target.value);
                    if (e.target.value.length > 1 || adminFilterLevel > 0) {
                      const results = await searchWords(e.target.value, adminFilterLevel, adminMatchType);
                      setAdminResults(results);
                    } else {
                      setAdminResults([]);
                    }
                  }}
                  className="game-input" 
                  style={{ fontSize: '0.9rem', padding: '0.5rem', flex: '1 1 100%' }} 
                />
                
                <div className="flex-between" style={{ gap: '0.5rem', width: '100%' }}>
                  <select 
                    value={adminMatchType}
                    onChange={async (e) => {
                      const newType = e.target.value as 'contains' | 'startsWith' | 'endsWith';
                      setAdminMatchType(newType);
                      if (adminQuery.length > 1 || adminFilterLevel > 0) {
                        const results = await searchWords(adminQuery, adminFilterLevel, newType);
                        setAdminResults(results);
                      }
                    }}
                    className="game-input"
                    style={{ padding: '0.5rem', fontSize: '0.85rem', flex: 1 }}
                  >
                    <option value="contains">Contiene</option>
                    <option value="startsWith">Empieza con</option>
                    <option value="endsWith">Termina con</option>
                  </select>

                  <select 
                    value={adminFilterLevel}
                    onChange={async (e) => {
                      const newLevel = parseInt(e.target.value);
                      setAdminFilterLevel(newLevel);
                      if (adminQuery.length > 1 || newLevel > 0) {
                        const results = await searchWords(adminQuery, newLevel, adminMatchType);
                        setAdminResults(results);
                      } else {
                        setAdminResults([]);
                      }
                    }}
                    className="game-input"
                    style={{ padding: '0.5rem', fontSize: '0.85rem', flex: 1 }}
                  >
                    <option value={0}>Todos los Lvl</option>
                    <option value={1}>Lvl 1 (Fácil)</option>
                    <option value={2}>Lvl 2 (Medio)</option>
                    <option value={3}>Lvl 3 (Difícil)</option>
                  </select>
                </div>
              </div>

              <div style={{ width: '100%', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                {adminResults.map(w => (
                  <div key={w.id} className="flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontWeight: 'bold' }}>{w.text.toUpperCase()}</span>
                    <div className="flex-center gap-2">
                      <select 
                        value={w.level}
                        onChange={async (e) => {
                          const newLevel = parseInt(e.target.value);
                          await updateWordLevel(w.id, newLevel);
                          setAdminResults(adminResults.map(r => r.id === w.id ? { ...r, level: newLevel } : r));
                        }}
                        style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.25rem', padding: '0.2rem', fontSize: '0.8rem' }}
                      >
                        <option value={1}>Lvl 1 (Fácil)</option>
                        <option value={2}>Lvl 2 (Medio)</option>
                        <option value={3}>Lvl 3 (Difícil)</option>
                      </select>
                      <button 
                        onClick={async () => {
                          await deleteWord(w.id);
                          setAdminResults(adminResults.filter(r => r.id !== w.id));
                          const s = await getStats();
                          setAdminTotalWords(s.totalWords);
                        }}
                        style={{ background: 'var(--error)', border: 'none', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex-between" style={{ width: '100%', gap: '0.5rem' }}>
                <label className="btn" style={{ flex: 1, background: '#8b5cf6', margin: 0, padding: '0.75rem', fontSize: '0.8rem', textAlign: 'center', cursor: 'pointer' }}>
                  Importar JSON
                  <input 
                    type="file" 
                    accept=".json" 
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        try {
                          setIsLoading(true);
                          setAdminMessage('Importando...');
                          const words = JSON.parse(event.target?.result as string);
                          if (Array.isArray(words)) {
                            const res = await addWordsBulk(words);
                            setAdminMessage(`¡Se importaron ${res.count} palabras nuevas!`);
                            const s = await getStats();
                            setAdminTotalWords(s.totalWords);
                          }
                        } catch (err) {
                          setAdminMessage('Error al leer JSON');
                        } finally {
                          setIsLoading(false);
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>
            </>
          ) : adminTab === 'usuarios' ? (
            <div style={{ width: '100%', maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', padding: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', color: 'var(--accent)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Usuario</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>Récord</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>Aportes</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{u.username}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--success)' }}>{u.score}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{u._count.suggestions}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <button 
                          onClick={() => setResetUser({id: u.id, username: u.username})}
                          style={{ background: 'var(--accent)', border: 'none', color: '#fff', padding: '0.2rem 0.4rem', borderRadius: '0.25rem', cursor: 'pointer' }}
                          title="Restablecer Contraseña"
                        >
                          <Key size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resetUser && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div className="glass-panel flex-col gap-4 animate-slide-up" style={{ width: '100%', maxWidth: '300px' }}>
                    <h3 className="text-accent text-center" style={{ fontSize: '1.2rem', fontWeight: 800 }}>Reset Contraseña</h3>
                    <p className="text-muted text-center" style={{ fontSize: '0.9rem' }}>Nueva contraseña para <b>{resetUser.username}</b>:</p>
                    <input 
                      type="password" 
                      value={resetPassword}
                      onChange={e => setResetPassword(e.target.value)}
                      placeholder="Mínimo 4 letras..."
                      className="game-input"
                    />
                    <div className="flex-between gap-2 mt-2">
                      <button onClick={() => { setResetUser(null); setResetPassword(''); }} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancelar</button>
                      <button 
                        onClick={async () => {
                          if (resetPassword.length < 4) return alert('Mínimo 4 caracteres');
                          setIsLoading(true);
                          const res = await resetUserPassword(resetUser.id, resetPassword);
                          if (res.success) {
                            alert('Contraseña restablecida con éxito');
                            setResetUser(null);
                            setResetPassword('');
                          } else {
                            alert(res.error || 'Error al restablecer');
                          }
                          setIsLoading(false);
                        }} 
                        className="btn btn-primary" 
                        style={{ flex: 1 }}
                        disabled={isLoading || resetPassword.length < 4}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : adminTab === 'sugerencias' ? (
            <div style={{ width: '100%', maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', padding: '0.5rem' }}>
              {adminSuggestions.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>No hay sugerencias pendientes</p>
              ) : adminSuggestions.map(s => (
                <div key={s.id} className="flex-between" style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{s.text.toUpperCase()}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>por {s.user.username}</div>
                  </div>
                  <div className="flex-center gap-2">
                    <button 
                      onClick={async () => {
                        await resolveSuggestion(s.id, true);
                        setAdminSuggestions(adminSuggestions.filter(x => x.id !== s.id));
                        const st = await getStats();
                        setAdminTotalWords(st.totalWords);
                      }}
                      style={{ background: 'var(--success)', border: 'none', color: '#000', padding: '0.4rem', borderRadius: '0.25rem', cursor: 'pointer' }}
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={async () => {
                        await resolveSuggestion(s.id, false);
                        setAdminSuggestions(adminSuggestions.filter(x => x.id !== s.id));
                      }}
                      style={{ background: 'var(--error)', border: 'none', color: '#fff', padding: '0.4rem', borderRadius: '0.25rem', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          
          {adminMessage && adminTab === 'diccionario' && <p className="text-success" style={{ textAlign: 'center', fontWeight: 'bold' }}>{adminMessage}</p>}

          <button onClick={() => setScreen('menu')} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
            Volver
          </button>
        </div>
      )}

      {screen === 'game' && (
        <div className="flex-col animate-slide-up gap-4" style={{ width: '100%' }}>
          
          <div className="hud flex-between" style={{ width: '100%' }}>
            <div className="lives">
              {[...Array(mode === 'classic' ? 3 : 1)].map((_, i) => (
                <Heart key={i} size={24} className={i < lives ? "text-error" : "text-muted"} fill={i < lives ? "currentColor" : "none"} style={{ opacity: i < lives ? 1 : 0.3 }} />
              ))}
            </div>
            <div className="score">
              <Trophy size={20} />
              {score} PTS
            </div>
          </div>

          <div className="magician-emoji animate-float" style={{ margin: '1rem 0' }}>
            {wizardEmoji}
          </div>
          
          <div className="word-display">
            <div className="word-text text-accent">
              {uiWord}
            </div>
            <div className={`word-hint ${isMirrorInEffect ? 'text-mirror' : 'text-success'}`} style={{ color: isMirrorInEffect ? 'var(--mirror)' : 'var(--success)' }}>
              {hint}
            </div>
          </div>

          <div className="timer-track">
            <div className="timer-bar" style={{ width: `${(timeLeft / 20) * 100}%` }} />
          </div>

          <form onSubmit={handleInputSubmit} className="input-container">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder="Escribe aquí..."
              className="game-input"
              disabled={isLoading}
              autoComplete="off"
            />
            {error && (
              <div className="error-badge">
                <AlertCircle size={16} /> {error}
              </div>
            )}
          </form>

          <button 
            type="button"
            onClick={execPlayerMirror}
            disabled={!mirrorAvailable || isMirrorInEffect || playedWords.length === 0 || isLoading}
            className={`btn ${mirrorAvailable && !isMirrorInEffect && playedWords.length > 0 ? 'btn-mirror active-effect' : ''}`}
            style={{ 
              background: mirrorAvailable && !isMirrorInEffect && playedWords.length > 0 ? '' : 'rgba(255,255,255,0.1)',
              boxShadow: mirrorAvailable && !isMirrorInEffect && playedWords.length > 0 ? '' : 'none',
              transform: mirrorAvailable && !isMirrorInEffect && playedWords.length > 0 ? '' : 'translateY(0)',
              opacity: mirrorAvailable && !isMirrorInEffect && playedWords.length > 0 ? 1 : 0.5
            }}
          >
            {isMirrorInEffect ? '🚫 REFLEJO ACTIVO' : mirrorAvailable ? '🪞 USAR ESPEJO' : '🪞 ESPEJO USADO'}
          </button>

          <button onClick={() => handleGameOver(score, playedWords)} className="text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: '1rem', fontSize: '0.9rem' }}>
            Rendirse
          </button>
        </div>
      )}

      {screen === 'over' && (
        <div className="glass-panel flex-col gap-6 animate-slide-up" style={{ padding: '3rem 1.5rem', marginTop: '2rem' }}>
          <div className="magician-emoji">😵</div>
          <div className="flex-col gap-2">
            <h2 className="text-error" style={{ fontSize: '2.5rem', fontWeight: 900 }}>¡FIN DEL JUEGO!</h2>
            <p className="text-muted" style={{ fontSize: '1.2rem' }}>Tu puntuación final</p>
          </div>
          <div className="text-accent" style={{ fontSize: '5rem', fontWeight: 900, lineHeight: 1, textShadow: '0 0 30px rgba(244,63,94,0.4)' }}>
            {score}
          </div>
          
          {newRecord && (
            <div className="text-success font-bold" style={{ fontSize: '1.2rem', animation: 'pulse 1.5s infinite' }}>
              🏆 ¡NUEVO RÉCORD PERSONAL! 🏆
            </div>
          )}

          <div className="flex-col gap-4" style={{ width: '100%', marginTop: '1rem' }}>
            <button onClick={() => initGame(mode)} className="btn btn-primary">
              <RotateCcw size={20} /> Reintentar
            </button>
            <button onClick={() => setScreen('menu')} className="btn" style={{ background: 'transparent', border: '2px solid rgba(255,255,255,0.2)' }}>
              Menú Principal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
