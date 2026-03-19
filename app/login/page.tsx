'use client';

import { useAuth } from '@/components/SupabaseAuthProvider';
import { LogIn, LayoutDashboard, Mail, Lock, UserPlus, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const { user, login, mockLogin, signInWithEmail, signUpWithEmail, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const hasSupabaseKeys = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUpWithEmail(email, password);
        if (error) throw error;
        setMessage('Conta criada! Verifique seu e-mail para confirmar (se habilitado no Supabase).');
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6"
      >
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
          <LayoutDashboard className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">LogiTrack ERP</h1>
          <p className="text-slate-500 text-sm">Gestão inteligente para sua logística.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-700 text-xs text-left">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-700 text-xs text-left">
            {message}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 ml-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={authLoading || !hasSupabaseKeys}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {authLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {isSignUp ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                {isSignUp ? 'Criar Conta' : 'Entrar'}
              </>
            )}
          </button>
        </form>

        <div className="flex items-center gap-2 text-slate-300">
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="text-[10px] font-bold uppercase tracking-wider">ou</span>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <div className="space-y-3">
          <button
            onClick={login}
            disabled={!hasSupabaseKeys}
            className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-bold transition-all border border-slate-200 text-sm ${
              hasSupabaseKeys 
              ? 'bg-white text-slate-700 hover:bg-slate-50' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Image src="https://www.google.com/favicon.ico" alt="Google" width={16} height={16} className="w-4 h-4" />
            Google
          </button>
          
          <button
            onClick={mockLogin}
            className="w-full text-blue-600 text-xs font-bold hover:underline"
          >
            Acesso Rápido (Teste)
          </button>
        </div>

        <div className="pt-2">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-slate-500 text-xs hover:text-blue-600 transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>

        {!hasSupabaseKeys && (
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-left">
            <p className="text-amber-800 text-[10px] font-bold mb-1 uppercase tracking-tight">Configuração Pendente</p>
            <p className="text-amber-700 text-[10px] leading-relaxed">
              As chaves do Supabase não foram encontradas nas Secrets.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
