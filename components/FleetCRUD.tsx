'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './SupabaseAuthProvider';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  X,
  Loader2,
  Layers,
  User,
  Truck,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Employee {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  plate: string;
  type: string;
  model: string;
  status: string;
}

interface Fleet {
  fleet_number: string;
  employee_id: string;
  cavalo_id: string;
  carreta_id: string;
  status: 'active' | 'inactive';
  created_at: string;
  employee?: Employee;
  cavalo?: Vehicle;
  carreta?: Vehicle;
}

export default function FleetCRUD() {
  const { user } = useAuth();
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    fleetNumber: '',
    employeeId: '',
    cavaloId: '',
    carretaId: '',
    status: 'active' as 'active' | 'inactive'
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Fetch Employees for selection
        const { data: empData, error: empError } = await supabase
          .from('employees')
          .select('id, name, role, status');
        
        if (empError) {
          console.error("Erro ao buscar funcionários:", empError);
        } else {
          setEmployees(empData || []);
        }

        // 2. Fetch Vehicles for selection
        const { data: vehData, error: vehError } = await supabase
          .from('vehicles')
          .select('id, plate, type, model, status');
        
        if (vehError) {
          console.error("Erro ao buscar veículos:", vehError);
        } else {
          setVehicles(vehData || []);
        }

        // 3. Fetch Fleets with joined data
        // Tentamos buscar com joins. Se falhar, buscamos sem joins para não quebrar a tela.
        const { data: fleetsData, error: fleetsError } = await supabase
          .from('fleets')
          .select(`
            *,
            employee:employees(id, name),
            cavalo:vehicles!cavalo_id(id, plate, type, model),
            carreta:vehicles!carreta_id(id, plate, type, model)
          `)
          .order('fleet_number', { ascending: true });

        if (fleetsError) {
          console.warn("Erro na busca com joins, tentando busca simples:", fleetsError);
          const { data: simpleData, error: simpleError } = await supabase
            .from('fleets')
            .select('*')
            .order('fleet_number', { ascending: true });
            
          if (simpleError) throw simpleError;
          setFleets(simpleData || []);
        } else {
          setFleets(fleetsData || []);
        }
      } catch (err: any) {
        console.error("Erro ao carregar dados:", err);
        setError("Erro ao carregar dados. Verifique a conexão com o banco.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Inscrição em tempo real para todas as tabelas relevantes
    const fleetsChannel = supabase
      .channel('fleets_all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleets' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(fleetsChannel);
    };
  }, [user]);

  const openModal = (fleet: Fleet | null = null) => {
    if (fleet) {
      setEditingFleet(fleet);
      setFormData({
        fleetNumber: fleet.fleet_number,
        employeeId: fleet.employee_id,
        cavaloId: fleet.cavalo_id,
        carretaId: fleet.carreta_id,
        status: fleet.status
      });
    } else {
      setEditingFleet(null);
      setFormData({
        fleetNumber: '',
        employeeId: '',
        cavaloId: '',
        carretaId: '',
        status: 'active'
      });
    }
    setIsModalOpen(true);
    setError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingFleet(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.fleetNumber.length !== 4 || !/^\d+$/.test(formData.fleetNumber)) {
      setError("O número da frota deve ter exatamente 4 dígitos.");
      return;
    }

    if (!formData.employeeId || !formData.cavaloId || !formData.carretaId) {
      setError("Selecione o motorista e ambos os veículos.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const dbData = {
        fleet_number: formData.fleetNumber,
        employee_id: formData.employeeId,
        cavalo_id: formData.cavaloId,
        carreta_id: formData.carretaId,
        status: formData.status,
        uid: user.id,
        updated_at: new Date().toISOString()
      };

      if (editingFleet) {
        const { error: dbError } = await supabase
          .from('fleets')
          .update(dbData)
          .eq('fleet_number', editingFleet.fleet_number);
        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase
          .from('fleets')
          .insert([{ ...dbData, created_at: new Date().toISOString() }]);
        if (dbError) throw dbError;
      }

      closeModal();
    } catch (err: any) {
      console.error("Erro ao salvar frota:", err);
      setError(err.message || "Erro ao salvar dados no banco.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fleetNumber: string) => {
    if (!confirm("Tem certeza que deseja excluir esta frota?")) return;

    try {
      const { error } = await supabase
        .from('fleets')
        .delete()
        .eq('fleet_number', fleetNumber);
      if (error) throw error;
    } catch (err: any) {
      console.error("Erro ao excluir frota:", err);
      alert("Erro ao excluir frota.");
    }
  };

  // Enriquecemos os dados das frotas manualmente caso o join do Supabase tenha falhado
  const enrichedFleets = fleets.map(fleet => {
    const employee = fleet.employee || employees.find(e => e.id === fleet.employee_id);
    const cavalo = fleet.cavalo || vehicles.find(v => v.id === fleet.cavalo_id);
    const carreta = fleet.carreta || vehicles.find(v => v.id === fleet.carreta_id);
    return { ...fleet, employee, cavalo, carreta };
  });

  const filteredFleets = enrichedFleets.filter(f => 
    f.fleet_number.includes(searchTerm) || 
    f.employee?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.cavalo?.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.carreta?.plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cavalos = vehicles.filter(v => v.type === 'Cavalo');
  const carretas = vehicles.filter(v => v.type === 'Carreta');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Buscar por frota, motorista ou placa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
          />
        </div>
        <button 
          onClick={() => openModal()}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Nova Frota
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium">Carregando frotas...</p>
        </div>
      ) : filteredFleets.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Layers className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Nenhuma frota encontrada</h3>
          <p className="text-slate-500 max-w-xs mx-auto">Comece cadastrando uma nova frota associando motoristas e veículos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFleets.map((fleet) => (
            <motion.div 
              layout
              key={fleet.fleet_number}
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
            >
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-bold text-xl">
                      {fleet.fleet_number}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Frota {fleet.fleet_number}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        fleet.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {fleet.status === 'active' ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openModal(fleet)}
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(fleet.fleet_number)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                    <User className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Motorista</p>
                      <p className="text-sm font-bold text-slate-700">
                        {fleet.employee?.name || (fleet.employee_id ? `ID: ${fleet.employee_id.substring(0, 8)}...` : 'Não associado')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <Truck className="w-5 h-5 text-slate-400 mb-1" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Cavalo</p>
                      <p className="text-sm font-bold text-slate-700">
                        {fleet.cavalo?.plate || (fleet.cavalo_id ? `ID: ${fleet.cavalo_id.substring(0, 8)}...` : '-')}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{fleet.cavalo?.model}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <Layers className="w-5 h-5 text-slate-400 mb-1" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Carreta</p>
                      <p className="text-sm font-bold text-slate-700">
                        {fleet.carreta?.plate || (fleet.carreta_id ? `ID: ${fleet.carreta_id.substring(0, 8)}...` : '-')}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{fleet.carreta?.model}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div 
              onClick={closeModal}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingFleet ? 'Editar Frota' : 'Nova Frota'}
                </h2>
                <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Número da Frota (4 dígitos)</label>
                    <input 
                      required
                      maxLength={4}
                      value={formData.fleetNumber}
                      onChange={(e) => setFormData({...formData, fleetNumber: e.target.value.replace(/\D/g, '')})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-mono text-lg tracking-widest"
                      placeholder="0000"
                      disabled={!!editingFleet}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Motorista Responsável</label>
                    <select 
                      required
                      value={formData.employeeId}
                      onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                    >
                      <option value="">Selecione um motorista</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                    {employees.length === 0 && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        Nenhum funcionário encontrado.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Cavalo (Caminhão)</label>
                      <select 
                        required
                        value={formData.cavaloId}
                        onChange={(e) => setFormData({...formData, cavaloId: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                      >
                        <option value="">Selecione</option>
                        {cavalos.map(v => (
                          <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                        ))}
                      </select>
                      {cavalos.length === 0 && (
                        <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          Nenhum veículo encontrado.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Carreta (Trailer)</label>
                      <select 
                        required
                        value={formData.carretaId}
                        onChange={(e) => setFormData({...formData, carretaId: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                      >
                        <option value="">Selecione</option>
                        {carretas.map(v => (
                          <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                        ))}
                      </select>
                      {carretas.length === 0 && (
                        <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          Nenhum veículo encontrado.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Status da Frota</label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, status: 'active'})}
                        className={`flex-1 py-3 rounded-xl font-bold border transition-all ${
                          formData.status === 'active' 
                          ? 'bg-green-50 border-green-200 text-green-600' 
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        Ativa
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, status: 'inactive'})}
                        className={`flex-1 py-3 rounded-xl font-bold border transition-all ${
                          formData.status === 'inactive' 
                          ? 'bg-red-50 border-red-200 text-red-600' 
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        Inativa
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-4 rounded-2xl font-bold border border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    {editingFleet ? 'Salvar Alterações' : 'Criar Frota'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
