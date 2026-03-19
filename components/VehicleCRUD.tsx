'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from './SupabaseAuthProvider';
import { GoogleGenAI, Type } from "@google/genai";
import Image from 'next/image';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Loader2,
  FileText,
  Upload,
  ExternalLink,
  Camera,
  Car,
  Calendar,
  Hash,
  Palette,
  Settings,
  Sparkles,
  Wand2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { optimizeImage } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleDatabaseError(error: unknown, operationType: OperationType, path: string | null, user: any) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.id,
      email: user?.email,
    },
    operationType,
    path
  }
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Vehicle {
  id: string;
  plate: string;
  type: 'Carreta' | 'Cavalo' | 'Carro';
  model: string;
  brand: string;
  year: number;
  color: string;
  renavam: string;
  chassi: string;
  status: 'active' | 'maintenance' | 'inactive';
  photoUrl?: string;
  documentUrl?: string;
  uid: string;
  createdAt: any;
}

const formatDate = (dateString: any) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function VehicleCRUD() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    plate: '',
    type: 'Carro' as 'Carreta' | 'Cavalo' | 'Carro',
    model: '',
    brand: '',
    year: new Date().getFullYear(),
    color: '',
    renavam: '',
    chassi: '',
    status: 'active' as 'active' | 'maintenance' | 'inactive',
    photoUrl: '',
    documentUrl: ''
  });

  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) {
      setVehicles([]);
      setLoading(false);
      return;
    }

        const fetchVehicles = async () => {
      try {
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Map snake_case from DB back to camelCase for the UI
        const mappedData = (data || []).map(v => ({
          ...v,
          photoUrl: v.photo_url,
          documentUrl: v.document_url,
          createdAt: v.created_at
        }));
        
        setVehicles(mappedData as Vehicle[]);
      } catch (err) {
        console.error("Erro ao carregar veículos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();

    // Inscrição em tempo real
    const channel = supabase
      .channel('vehicles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        fetchVehicles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedPhotoFile(file);
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedDocFile(file);
      // Automatically trigger analysis if it's a PDF
      if (file.type === 'application/pdf') {
        analyzePDF(file);
      }
    }
  };

  const analyzePDF = async (file: File) => {
    setAnalyzing(true);
    setError(null);
    try {
      // Try standard Next.js public variable first, fallback to common AI Studio names
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 
                     (process.env as any).GEMINI_API_KEY || 
                     (process.env as any).API_KEY;

      if (!apiKey) {
        console.error("API Key is missing in process.env");
        throw new Error("API_KEY_MISSING");
      }

      const ai = new GoogleGenAI({ apiKey });
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;
      
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: {
          parts: [
            { text: "Extraia os dados deste documento de veículo (CRLV). Retorne apenas o JSON." },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data
              }
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              plate: { type: Type.STRING, description: "Placa do veículo" },
              type: { type: Type.STRING, enum: ["Carreta", "Cavalo", "Carro"], description: "Tipo do veículo" },
              brand: { type: Type.STRING, description: "Marca do veículo" },
              model: { type: Type.STRING, description: "Modelo do veículo" },
              year: { type: Type.INTEGER, description: "Ano de fabricação" },
              color: { type: Type.STRING, description: "Cor predominante" },
              renavam: { type: Type.STRING, description: "Número do RENAVAM" },
              chassi: { type: Type.STRING, description: "Número do Chassi" }
            }
          }
        }
      });

      if (response.text) {
        const result = JSON.parse(response.text);
        
        setFormData(prev => ({
          ...prev,
          plate: result.plate || prev.plate,
          type: result.type || prev.type,
          brand: result.brand || prev.brand,
          model: result.model || prev.model,
          year: result.year || prev.year,
          color: result.color || prev.color,
          renavam: result.renavam || prev.renavam,
          chassi: result.chassi || prev.chassi
        }));
        console.log("Dados extraídos com sucesso:", result);
      }
    } catch (err: any) {
      console.error("Erro na análise da IA:", err);
      const errorMessage = err.message || "";
      
      if (errorMessage === "API_KEY_MISSING") {
        setError("A chave de API não foi detectada pelo sistema. Certifique-se de que o nome do Segredo é exatamente NEXT_PUBLIC_GEMINI_API_KEY (sem espaços) e tente atualizar a página.");
      } else if (errorMessage.includes("API key") || errorMessage.includes("NEXT_PUBLIC_GEMINI_API_KEY") || errorMessage.includes("403") || errorMessage.includes("401")) {
        setError(`Erro na chave de API (403/401). Verifique se a chave é válida e se você tem acesso ao modelo no Google AI Studio. Detalhes: ${errorMessage.substring(0, 100)}`);
      } else {
        setError(`Erro ao ler PDF: ${errorMessage || "Verifique se o arquivo é um PDF válido e legível."}`);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Basic Plate validation
    const cleanPlate = formData.plate.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanPlate.length < 7 || cleanPlate.length > 8) {
      setError("A placa deve conter entre 7 e 8 caracteres.");
      return;
    }

    setUploading(true);
    setUploadProgress({ 'Processamento': 100 });
    setError(null);

    try {
      let photoUrl = formData.photoUrl;
      let documentUrl = formData.documentUrl;

      if (selectedPhotoFile) {
        console.log("Otimizando imagem do veículo para Supabase Storage...");
        try {
          setUploadProgress(prev => ({ ...prev, 'Otimização': 50 }));
          const compressedPhoto = await optimizeImage(selectedPhotoFile, 1200, 0.8);
          setUploadProgress(prev => ({ ...prev, 'Otimização': 100 }));
          
          console.log("Iniciando upload para Supabase...");
          const fileName = `${user.id}/photos/${Date.now()}_${selectedPhotoFile.name}`;
          
          const { data, error: uploadError } = await supabase.storage
            .from('app-assets')
            .upload(fileName, compressedPhoto, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('app-assets')
            .getPublicUrl(fileName);

          photoUrl = publicUrl;
          console.log("Foto enviada para Supabase com sucesso.");
        } catch (err: any) {
          console.error("Erro no upload para Supabase:", err);
          setError("Erro ao enviar foto para o Supabase. Verifique se o bucket 'app-assets' existe e é público.");
          setUploading(false);
          return;
        }
      }

      if (selectedDocFile) {
        console.log("Enviando documento (CRLV) para Supabase...");
        try {
          setUploadProgress(prev => ({ ...prev, 'Documento': 50 }));
          const fileName = `${user.id}/docs/${Date.now()}_${selectedDocFile.name}`;
          
          const { data, error: uploadError } = await supabase.storage
            .from('app-assets')
            .upload(fileName, selectedDocFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('app-assets')
            .getPublicUrl(fileName);

          documentUrl = publicUrl;
          setUploadProgress(prev => ({ ...prev, 'Documento': 100 }));
          console.log("Documento enviado para Supabase com sucesso.");
        } catch (err: any) {
          console.error("Erro no upload do documento:", err);
          setError("Erro ao enviar documento para o Supabase.");
          setUploading(false);
          return;
        }
      }

      setUploadProgress(prev => ({ ...prev, 'Salvando': 50 }));
      console.log("Gravando dados do veículo no Supabase...");

      const yearValue = parseInt(String(formData.year));
      const dbData = {
        plate: formData.plate,
        type: formData.type,
        model: formData.model,
        brand: formData.brand,
        year: isNaN(yearValue) ? new Date().getFullYear() : yearValue,
        color: formData.color,
        renavam: formData.renavam,
        chassi: formData.chassi,
        status: formData.status,
        photo_url: photoUrl,
        document_url: documentUrl,
        updated_at: new Date().toISOString()
      };
      
      if (editingVehicle) {
        const { error: dbError } = await supabase
          .from('vehicles')
          .update(dbData)
          .eq('id', editingVehicle.id);
          
        if (dbError) throw dbError;
        setUploadProgress(prev => ({ ...prev, 'Salvando': 100 }));
      } else {
        const { error: dbError } = await supabase
          .from('vehicles')
          .insert([{
            ...dbData,
            uid: user.id,
            created_at: new Date().toISOString()
          }]);
          
        if (dbError) throw dbError;
        setUploadProgress(prev => ({ ...prev, 'Salvando': 100 }));
      }
      
      // Small delay to show 100% before closing
      await new Promise(resolve => setTimeout(resolve, 500));
      closeModal();
    } catch (error: any) {
      console.error("Erro completo ao salvar veículo:", error);
      setUploadProgress({}); // Clear progress on error to show the error message clearly
      
      let message = "Erro ao salvar. Verifique sua conexão e tente novamente.";
      let detailedError = "";
      
      try {
        // Try to parse if it's our JSON error
        const parsed = JSON.parse(error.message);
        detailedError = parsed.error || "";
      } catch {
        detailedError = error.message || "";
      }

      if (detailedError.includes('permission-denied') || detailedError.includes('Missing or insufficient permissions')) {
        message = "Permissão negada. Você não tem autorização para realizar esta operação.";
      } else if (detailedError.includes('quota-exceeded')) {
        message = "Limite de uso do banco de dados atingido. Tente novamente mais tarde.";
      } else if (detailedError.includes('Timeout')) {
        message = "O envio demorou muito. A imagem pode ser muito grande ou sua conexão está instável.";
      } else if (detailedError.includes('offline')) {
        message = "Você parece estar offline. Verifique sua conexão com a internet.";
      }
      
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const openModal = (vehicle: Vehicle | null = null) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        plate: vehicle.plate,
        type: vehicle.type,
        model: vehicle.model,
        brand: vehicle.brand,
        year: vehicle.year,
        color: vehicle.color,
        renavam: vehicle.renavam,
        chassi: vehicle.chassi,
        status: vehicle.status,
        photoUrl: vehicle.photoUrl || '',
        documentUrl: vehicle.documentUrl || ''
      });
    } else {
      setEditingVehicle(null);
      setFormData({
        plate: '',
        type: 'Carro',
        model: '',
        brand: '',
        year: new Date().getFullYear(),
        color: '',
        renavam: '',
        chassi: '',
        status: 'active',
        photoUrl: '',
        documentUrl: ''
      });
    }
    setSelectedPhotoFile(null);
    setSelectedDocFile(null);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
    setError(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', deleteConfirmId);
        
      if (error) throw error;
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Erro ao deletar veículo:", error);
      setError("Erro ao deletar veículo no Supabase.");
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por placa, modelo ou marca..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Novo Veículo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredVehicles.map((vehicle) => (
            <motion.div
              key={vehicle.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all group"
            >
              <div className="relative h-48 w-full bg-slate-100">
                {vehicle.photoUrl && vehicle.photoUrl.startsWith('http') ? (
                  <Image
                    src={vehicle.photoUrl}
                    alt={vehicle.model}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Car className="w-16 h-16" />
                  </div>
                )}
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${
                    vehicle.status === 'active' ? 'bg-emerald-500 text-white' :
                    vehicle.status === 'maintenance' ? 'bg-amber-500 text-white' :
                    'bg-slate-500 text-white'
                  }`}>
                    {vehicle.status === 'active' ? 'Ativo' :
                     vehicle.status === 'maintenance' ? 'Manutenção' : 'Inativo'}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">{vehicle.brand} {vehicle.model}</h3>
                    <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">{vehicle.plate}</p>
                  </div>
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                    {vehicle.type}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-4 h-4" />
                    <span>Ano: {vehicle.year}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Palette className="w-4 h-4" />
                    <span>Cor: {vehicle.color}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(vehicle)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(vehicle.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  {vehicle.documentUrl && (
                    <a
                      href={vehicle.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                    >
                      <FileText className="w-4 h-4" />
                      CRLV
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-slate-200 rounded-full transition-all">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
              <div className="px-6 pt-4 space-y-3 shrink-0">
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500 text-sm animate-shake">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold mb-1">Ops! Algo deu errado:</p>
                      <p>{error}</p>
                      {error.includes('envio') && (
                        <button 
                          type="button"
                          onClick={() => {
                            setSelectedPhotoFile(null);
                            setSelectedDocFile(null);
                            setError(null);
                          }}
                          className="mt-3 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-all"
                        >
                          Limpar anexos e tentar de novo
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {uploading && Object.keys(uploadProgress).length > 0 && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Progresso do Envio</p>
                    {Object.entries(uploadProgress).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{key}</span>
                          <span>{value.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${value}%` }}
                            className="bg-blue-600 h-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Tipo de Veículo</label>
                    <select
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    >
                      <option value="Carro">Carro</option>
                      <option value="Cavalo">Cavalo</option>
                      <option value="Carreta">Carreta</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Placa</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        required
                        type="text"
                        placeholder="ABC-1234"
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                        value={formData.plate}
                        onChange={(e) => setFormData({...formData, plate: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Marca</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Volkswagen"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.brand}
                      onChange={(e) => setFormData({...formData, brand: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Modelo</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Gol"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.model}
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Ano</label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.year}
                      onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Cor</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Status</label>
                    <select
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="active">Ativo</option>
                      <option value="maintenance">Manutenção</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">RENAVAM</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.renavam}
                      onChange={(e) => setFormData({...formData, renavam: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Chassi</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.chassi}
                      onChange={(e) => setFormData({...formData, chassi: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Foto do Veículo</label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 relative shrink-0">
                        {selectedPhotoFile ? (
                          <Image 
                            src={URL.createObjectURL(selectedPhotoFile)} 
                            alt="Preview" 
                            fill 
                            sizes="80px"
                            className="object-cover"
                          />
                        ) : formData.photoUrl && formData.photoUrl.startsWith('http') ? (
                          <Image 
                            src={formData.photoUrl} 
                            alt="Atual" 
                            fill 
                            sizes="80px"
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Car className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                        <Camera className="w-5 h-5 text-slate-400" />
                        <span className="text-sm text-slate-600 truncate">
                          {selectedPhotoFile ? selectedPhotoFile.name : 'Selecionar Foto'}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Documento (CRLV PDF)</label>
                    <div className="flex flex-col gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                        {analyzing ? (
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 text-slate-400" />
                        )}
                        <span className="text-sm text-slate-600 truncate">
                          {analyzing ? 'Analisando documento...' : selectedDocFile ? selectedDocFile.name : 'Selecionar PDF'}
                        </span>
                        <input type="file" accept="application/pdf" className="hidden" onChange={handleDocChange} disabled={analyzing} />
                      </label>
                      {selectedDocFile && !analyzing && (
                        <button 
                          type="button"
                          onClick={() => analyzePDF(selectedDocFile)}
                          className="flex items-center justify-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 py-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          Tentar ler dados novamente
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-[2] px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      {editingVehicle ? 'Salvar Alterações' : 'Cadastrar Veículo'}
                    </>
                  )}
                </button>
              </div>
            </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Deletion Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center"
            >
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Confirmar Exclusão</h3>
                <p className="text-slate-500 mb-8">
                  Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                  >
                    Excluir
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
