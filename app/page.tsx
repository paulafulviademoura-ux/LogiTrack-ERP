'use client';

import { useState } from 'react';
import { useAuth } from '@/components/SupabaseAuthProvider';
import EmployeeCRUD from '@/components/EmployeeCRUD';
import VehicleCRUD from '@/components/VehicleCRUD';
import FleetCRUD from '@/components/FleetCRUD';
import DashboardSummary from '@/components/DashboardSummary';
import { Users, Truck, LogOut, LogIn, LayoutDashboard, Layers, Home as HomeIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function Dashboard() {
  const { user, login, mockLogin, logout, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'vehicles' | 'fleets'>('dashboard');
  const hasSupabaseKeys = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
            <LayoutDashboard className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">LogiTrack ERP</h1>
            <p className="text-slate-500">Gestão inteligente para sua logística. Entre para acessar o painel.</p>
          </div>

          {!hasSupabaseKeys && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-left">
              <p className="text-amber-800 text-sm font-bold mb-1">Configuração Necessária</p>
              <p className="text-amber-700 text-xs leading-relaxed">
                As chaves do Supabase não foram encontradas. Configure as Secrets no AI Studio para habilitar o login real.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={login}
              disabled={!hasSupabaseKeys}
              className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all shadow-lg ${
                hasSupabaseKeys 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <LogIn className="w-5 h-5" />
              Entrar com Google
            </button>
            
            <button
              onClick={mockLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-slate-600 border-2 border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
            >
              Acesso Rápido (Teste)
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar / Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-white border-b border-slate-200 z-40 px-6">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 hidden sm:block">LogiTrack</span>
          </div>

          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                activeTab === 'dashboard' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <HomeIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Início</span>
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                activeTab === 'employees' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="hidden sm:inline">Funcionários</span>
            </button>
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                activeTab === 'vehicles' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Truck className="w-5 h-5" />
              <span className="hidden sm:inline">Veículos</span>
            </button>
            <button
              onClick={() => setActiveTab('fleets')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                activeTab === 'fleets' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers className="w-5 h-5" />
              <span className="hidden sm:inline">Frotas</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-slate-900">{user.user_metadata?.full_name || user.email}</span>
              <span className="text-xs text-slate-500">{user.email}</span>
            </div>
            <button
              onClick={logout}
              className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Sair"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto pt-28 pb-12 px-6">
        <header className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">
            {activeTab === 'dashboard' ? 'Painel de Controle' : activeTab === 'employees' ? 'Gestão de Funcionários' : activeTab === 'vehicles' ? 'Gestão de Veículos' : 'Gestão de Frotas'}
          </h2>
          <p className="text-slate-500">
            {activeTab === 'dashboard' 
              ? 'Bem-vindo ao LogiTrack. Veja o resumo das suas operações.'
              : activeTab === 'employees' 
                ? 'Visualize e gerencie todos os colaboradores da sua empresa.' 
                : activeTab === 'vehicles' 
                  ? 'Controle sua frota, manutenções e documentações.'
                  : 'Associe motoristas a veículos para formar frotas operacionais.'}
          </p>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' ? <DashboardSummary /> : activeTab === 'employees' ? <EmployeeCRUD /> : activeTab === 'vehicles' ? <VehicleCRUD /> : <FleetCRUD />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function Home() {
  return <Dashboard />;
}
