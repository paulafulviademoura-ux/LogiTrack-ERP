'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './SupabaseAuthProvider';
import { 
  Users, 
  Truck, 
  Layers, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { motion } from 'motion/react';

export default function DashboardSummary() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    employees: 0,
    vehicles: 0,
    fleets: 0,
    activeEmployees: 0,
    activeVehicles: 0,
    activeFleets: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const [
          { count: empCount },
          { count: activeEmpCount },
          { count: vehCount },
          { count: activeVehCount },
          { count: fleetCount },
          { count: activeFleetCount }
        ] = await Promise.all([
          supabase.from('employees').select('*', { count: 'exact', head: true }),
          supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('vehicles').select('*', { count: 'exact', head: true }),
          supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('fleets').select('*', { count: 'exact', head: true }),
          supabase.from('fleets').select('*', { count: 'exact', head: true }).eq('status', 'active')
        ]);

        setStats({
          employees: empCount || 0,
          activeEmployees: activeEmpCount || 0,
          vehicles: vehCount || 0,
          activeVehicles: activeVehCount || 0,
          fleets: fleetCount || 0,
          activeFleets: activeFleetCount || 0
        });
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const cards = [
    {
      title: 'Funcionários',
      value: stats.employees,
      active: stats.activeEmployees,
      icon: Users,
      color: 'blue',
      description: 'Total de colaboradores'
    },
    {
      title: 'Veículos',
      value: stats.vehicles,
      active: stats.activeVehicles,
      icon: Truck,
      color: 'emerald',
      description: 'Frota total disponível'
    },
    {
      title: 'Frotas',
      value: stats.fleets,
      active: stats.activeFleets,
      icon: Layers,
      color: 'violet',
      description: 'Unidades operacionais'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-white rounded-3xl border border-slate-200"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, index) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            key={card.title}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl bg-${card.color}-50 text-${card.color}-600 group-hover:scale-110 transition-transform`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold">
                <TrendingUp className="w-3 h-3" />
                <span>+12%</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-slate-500 text-sm font-medium">{card.title}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-900">{card.value}</span>
                <span className="text-slate-400 text-sm">total</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-bold text-slate-600">{card.active} ativos agora</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Atividades Recentes
          </h3>
          <div className="space-y-6">
            {[
              { text: 'Nova frota #4021 criada por admin', time: '2 horas atrás', icon: CheckCircle2, color: 'emerald' },
              { text: 'Manutenção agendada para Veículo ABC-1234', time: '5 horas atrás', icon: AlertCircle, color: 'amber' },
              { text: 'Novo funcionário João Silva cadastrado', time: '1 dia atrás', icon: Users, color: 'blue' }
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className={`w-10 h-10 rounded-xl bg-${item.color}-50 flex items-center justify-center shrink-0`}>
                  <item.icon className={`w-5 h-5 text-${item.color}-600`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.text}</p>
                  <p className="text-xs text-slate-400">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-600 p-8 rounded-3xl shadow-xl shadow-blue-600/20 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2">Dica do Dia</h3>
            <p className="text-blue-100 mb-6 leading-relaxed">
              Mantenha os documentos dos veículos sempre atualizados para evitar multas e atrasos nas operações.
            </p>
            <button className="px-6 py-3 bg-white text-blue-600 rounded-2xl font-bold hover:bg-blue-50 transition-all flex items-center gap-2">
              Ver Documentação
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute right-12 top-12 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl"></div>
        </div>
      </div>
    </div>
  );
}
