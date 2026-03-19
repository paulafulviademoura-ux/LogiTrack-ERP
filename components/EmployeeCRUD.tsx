'use client';

import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { useAuth } from './SupabaseAuthProvider';
import Image from 'next/image';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  User as UserIcon, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Loader2,
  LogOut,
  LogIn,
  FileText,
  Upload,
  ExternalLink,
  MessageCircle,
  Camera
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

interface Employee {
  id: string;
  name: string;
  cpf: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'vacation';
  photoUrl?: string;
  cnhNumber?: string;
  cnhExpiration?: string;
  cnhCategory?: string;
  cnhPdfUrl?: string;
  whatsapp?: string;
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

export default function EmployeeCRUD() {
  const { user, login, logout, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCnhFile, setSelectedCnhFile] = useState<File | null>(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    email: '',
    role: '',
    status: 'active' as 'active' | 'inactive' | 'vacation',
    photoUrl: '',
    cnhNumber: '',
    cnhExpiration: '',
    cnhCategory: '',
    cnhPdfUrl: '',
    whatsapp: ''
  });

  useEffect(() => {
    if (!user) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Map snake_case from DB back to camelCase for the UI
        const mappedData = (data || []).map(e => ({
          ...e,
          photoUrl: e.photo_url,
          cnhNumber: e.cnh_number,
          cnhExpiration: e.cnh_expiration,
          cnhCategory: e.cnh_category,
          cnhPdfUrl: e.cnh_pdf_url,
          createdAt: e.created_at
        }));
        
        setEmployees(mappedData as Employee[]);
      } catch (err) {
        console.error("Erro ao carregar funcionários:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();

    // Inscrição em tempo real
    const channel = supabase
      .channel('employees_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        fetchEmployees();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleCnhFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleCnhFileChange disparado");
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedCnhFile(file);
    
    // Auto-extract data using Gemini
    setExtracting(true);
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
      
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
      });

      const base64Data = await base64Promise;
      
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: {
          parts: [
            {
              text: "Extraia os dados desta CNH brasileira. Retorne um JSON com os campos: name (nome completo), cpf (apenas números), cnhNumber (número de registro), cnhExpiration (data de validade no formato YYYY-MM-DD), cnhCategory (categorias)."
            },
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
              name: { type: Type.STRING, description: "Nome completo" },
              cpf: { type: Type.STRING, description: "CPF (apenas números)" },
              cnhNumber: { type: Type.STRING, description: "Número de registro CNH" },
              cnhExpiration: { type: Type.STRING, description: "Data de validade (YYYY-MM-DD)" },
              cnhCategory: { type: Type.STRING, description: "Categorias da CNH" }
            }
          }
        }
      });

      if (response.text) {
        const extracted = JSON.parse(response.text);
        setFormData(prev => ({
          ...prev,
          name: extracted.name || prev.name,
          cpf: extracted.cpf || prev.cpf,
          cnhNumber: extracted.cnhNumber || prev.cnhNumber,
          cnhExpiration: extracted.cnhExpiration || prev.cnhExpiration,
          cnhCategory: extracted.cnhCategory || prev.cnhCategory
        }));
      }
    } catch (error: any) {
      console.error("Erro ao extrair dados do PDF:", error);
      const errorMessage = error.message || "";
      
      if (errorMessage === "API_KEY_MISSING") {
        setError("A chave de API não foi detectada pelo sistema. Certifique-se de que o nome do Segredo é exatamente NEXT_PUBLIC_GEMINI_API_KEY (sem espaços) e tente atualizar a página.");
      } else if (errorMessage.includes("API key") || errorMessage.includes("NEXT_PUBLIC_GEMINI_API_KEY") || errorMessage.includes("403") || errorMessage.includes("401")) {
        setError(`Erro na chave de API (403/401). Verifique se a chave é válida e se você tem acesso ao modelo no Google AI Studio. Detalhes: ${errorMessage.substring(0, 100)}`);
      } else {
        setError(`Erro ao ler PDF: ${errorMessage || "Verifique se o arquivo é um PDF válido e legível."}`);
      }
    } finally {
      setExtracting(false);
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPhotoFile(file);
    }
  };

  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Usuário não autenticado.");
      return;
    }

    console.log("Iniciando salvamento...");
    
    // Basic CPF validation
    const cleanCpf = formData.cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError("O CPF deve conter 11 dígitos.");
      return;
    }

    setUploading(true);
    setUploadProgress({ 'Processamento': 100 });
    setError(null);
    
    try {
      let cnhPdfUrl = formData.cnhPdfUrl;
      let photoUrl = formData.photoUrl;

      // Upload CNH PDF if selected
      if (selectedCnhFile) {
        console.log("Enviando PDF da CNH para Supabase...");
        try {
          setUploadProgress(prev => ({ ...prev, 'Documento': 50 }));
          const fileName = `${user.id}/cnh/${Date.now()}_${selectedCnhFile.name}`;
          
          const { data, error: uploadError } = await supabase.storage
            .from('app-assets')
            .upload(fileName, selectedCnhFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('app-assets')
            .getPublicUrl(fileName);

          cnhPdfUrl = publicUrl;
          setUploadProgress(prev => ({ ...prev, 'Documento': 100 }));
          console.log("PDF enviado para Supabase com sucesso.");
        } catch (err: any) {
          console.error("Erro no upload do PDF para Supabase:", err);
          setError("Erro ao enviar PDF para o Supabase.");
          setUploading(false);
          return;
        }
      }

      // Upload Photo if selected
      if (selectedPhotoFile) {
        console.log("Otimizando imagem para Supabase Storage...");
        try {
          setUploadProgress(prev => ({ ...prev, 'Otimização': 50 }));
          const compressedPhoto = await optimizeImage(selectedPhotoFile, 1200, 0.8);
          setUploadProgress(prev => ({ ...prev, 'Otimização': 100 }));
          
          console.log("Iniciando upload para Supabase...");
          const fileName = `${user.id}/employees/${Date.now()}_${selectedPhotoFile.name}`;
          
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
          console.error("Erro no upload da foto para Supabase:", err);
          setError("Erro ao enviar foto para o Supabase.");
          setUploading(false);
          return;
        }
      }

      setUploadProgress(prev => ({ ...prev, 'Salvando': 50 }));
      console.log("Gravando dados no Supabase...");

      const dbData = {
        name: formData.name,
        cpf: formData.cpf,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        whatsapp: formData.whatsapp,
        cnh_number: formData.cnhNumber,
        cnh_expiration: formData.cnhExpiration,
        cnh_category: formData.cnhCategory,
        cnh_pdf_url: cnhPdfUrl,
        photo_url: photoUrl,
        updated_at: new Date().toISOString()
      };

      if (editingEmployee) {
        console.log("Atualizando funcionário no Supabase...");
        const { error: dbError } = await supabase
          .from('employees')
          .update(dbData)
          .eq('id', editingEmployee.id);
          
        if (dbError) throw dbError;
        setUploadProgress(prev => ({ ...prev, 'Salvando': 100 }));
        console.log("Funcionário atualizado.");
      } else {
        console.log("Criando novo funcionário no Supabase...");
        const { error: dbError } = await supabase
          .from('employees')
          .insert([{
            ...dbData,
            uid: user.id,
            created_at: new Date().toISOString()
          }]);
          
        if (dbError) throw dbError;
        setUploadProgress(prev => ({ ...prev, 'Salvando': 100 }));
        console.log("Funcionário criado.");
      }
      
      // Small delay to show 100% before closing
      await new Promise(resolve => setTimeout(resolve, 500));
      closeModal();
    } catch (error: any) {
      console.error("Erro completo capturado:", error);
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

      if (detailedError.includes('permission-denied') || detailedError.includes('Missing or insufficient permissions') || error.code === 'storage/unauthorized') {
        message = "Permissão negada. Você não tem autorização ou o servidor de arquivos bloqueou o envio.";
      } else if (detailedError.includes('quota-exceeded')) {
        message = "Limite de uso do banco de dados atingido. Tente novamente amanhã.";
      } else if (detailedError.includes('Timeout')) {
        message = "O envio demorou muito. Verifique sua conexão ou tente fotos menores.";
      } else if (detailedError.includes('offline')) {
        message = "Você parece estar offline. Verifique sua conexão com a internet.";
      } else if (error.code === 'storage/retry-limit-exceeded') {
        message = "Erro de rede persistente ao enviar arquivos. Verifique sua internet.";
      } else if (error.code === 'storage/canceled') {
        message = "O envio foi cancelado por demora excessiva.";
      }
      
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', deleteConfirmId);
        
      if (error) throw error;
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Erro ao deletar funcionário:", error);
      setError("Erro ao deletar funcionário no Supabase.");
    }
  };

  const openModal = (employee?: Employee) => {
    setUploading(false);
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        cpf: employee.cpf,
        email: employee.email,
        role: employee.role,
        status: employee.status,
        photoUrl: employee.photoUrl || '',
        cnhNumber: employee.cnhNumber || '',
        cnhExpiration: employee.cnhExpiration || '',
        cnhCategory: employee.cnhCategory || '',
        cnhPdfUrl: employee.cnhPdfUrl || '',
        whatsapp: employee.whatsapp || ''
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        name: '',
        cpf: '',
        email: '',
        role: '',
        status: 'active',
        photoUrl: '',
        cnhNumber: '',
        cnhExpiration: '',
        cnhCategory: '',
        cnhPdfUrl: '',
        whatsapp: ''
      });
    }
    setSelectedCnhFile(null);
    setSelectedPhotoFile(null);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setSelectedCnhFile(null);
    setSelectedPhotoFile(null);
    setError(null);
    setUploading(false);
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cpf.includes(searchTerm)
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-primary/5 p-8 rounded-2xl border border-primary/10 shadow-xl"
        >
          <UserIcon className="w-16 h-16 mx-auto mb-6 text-primary opacity-50" />
          <h1 className="text-2xl font-bold mb-4">Bem-vindo ao LogiTrack ERP</h1>
          <p className="text-slate-500 mb-8">Faça login para gerenciar o cadastro de funcionários e frotas.</p>
          <button 
            onClick={login}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          >
            <LogIn className="w-5 h-5" />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cadastro de Funcionários</h1>
          <p className="text-slate-500">Gerencie a equipe e documentações em tempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => openModal()}
            className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
            Novo Funcionário
          </button>
          <button 
            onClick={logout}
            className="p-3 text-slate-400 hover:text-red-500 transition-colors"
            title="Sair"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
        <input 
          type="text"
          placeholder="Buscar por nome, cargo ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-primary/5 border border-primary/10 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <motion.div 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                key={`skeleton-${i}`} 
                className="h-48 rounded-2xl bg-slate-100 dark:bg-primary/5 animate-pulse" 
              />
            ))
          ) : filteredEmployees.length > 0 ? (
            filteredEmployees.map((employee) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={employee.id}
                className="bg-white dark:bg-primary/5 border border-primary/10 rounded-2xl p-6 hover:border-primary/40 transition-all group relative overflow-hidden"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-primary/20 relative shrink-0">
                    {employee.photoUrl && employee.photoUrl.startsWith('http') ? (
                      <Image 
                        src={employee.photoUrl} 
                        alt={employee.name} 
                        fill 
                        sizes="64px"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <UserIcon className="w-8 h-8 text-primary opacity-50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{employee.name}</h3>
                    <p className="text-sm text-slate-500 truncate">{employee.role}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                        employee.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                        employee.status === 'vacation' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        'bg-slate-500/10 text-slate-500 border-slate-500/20'
                      }`}>
                        {employee.status === 'active' ? 'Ativo' : employee.status === 'vacation' ? 'Em Férias' : 'Inativo'}
                      </span>
                      {employee.whatsapp && (
                        <a 
                          href={`https://wa.me/${employee.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-green-500 hover:bg-green-500/10 rounded-full transition-all"
                          title="Abrir WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-primary/5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">CPF</p>
                    <p className="text-sm font-medium">{employee.cpf}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Cadastro</p>
                    <p className="text-sm font-medium">{formatDate(employee.createdAt)}</p>
                  </div>
                  {employee.cnhNumber && (
                    <div className="col-span-2 mt-2 pt-2 border-t border-primary/5 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">CNH</p>
                        <p className="text-xs font-medium">{employee.cnhNumber}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Validade</p>
                        <p className="text-xs font-medium">{employee.cnhExpiration ? new Date(employee.cnhExpiration).toLocaleDateString('pt-BR') : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Cat.</p>
                        <p className="text-xs font-medium">{employee.cnhCategory}</p>
                      </div>
                      {employee.cnhPdfUrl && (
                        <div className="col-span-3 mt-2">
                          <a 
                            href={employee.cnhPdfUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                          >
                            <FileText className="w-3 h-3" />
                            VER DOCUMENTO CNH (PDF)
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => openModal(employee)}
                    className="p-2 bg-white dark:bg-background-dark border border-primary/10 rounded-lg text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmId(employee.id)}
                    className="p-2 bg-white dark:bg-background-dark border border-primary/10 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="empty-employees"
              className="col-span-full py-20 text-center"
            >
              <p className="text-slate-500">Nenhum funcionário encontrado.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Form */}
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
              className="absolute inset-0 bg-background-dark/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl max-h-[90vh] bg-white dark:bg-background-dark rounded-3xl shadow-2xl border border-primary/10 overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-primary/10 flex items-center justify-between shrink-0 bg-white dark:bg-background-dark z-10">
                <h2 className="text-xl font-bold">{editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
                <button onClick={closeModal} className="p-2 hover:bg-primary/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
                {/* Error and Progress - Fixed at top of form */}
                <div className="px-6 pt-4 space-y-3 shrink-0">
                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500 text-sm animate-shake">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold mb-1">Ops! Algo deu errado:</p>
                        <p>{error}</p>
                        <p className="mt-2 text-xs opacity-70 italic">Dica: Se o erro persistir, tente salvar sem anexar foto ou PDF para testar.</p>
                        {error.includes('envio') && (
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedCnhFile(null);
                              setSelectedPhotoFile(null);
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
                    <label className="text-sm font-medium text-slate-400">Nome Completo</label>
                    <input 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="Ex: João Silva"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">CPF</label>
                    <input 
                      required
                      value={formData.cpf}
                      onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Email Corporativo</label>
                    <input 
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="joao@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Cargo</label>
                    <select 
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all appearance-none"
                    >
                      <option value="" disabled>Selecione um cargo</option>
                      <option value="Motorista">Motorista</option>
                      <option value="Admin">Admin</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Status</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      className="w-full bg-slate-50 dark:bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all appearance-none"
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                      <option value="vacation">Em Férias</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Foto do Funcionário</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-primary/20 relative">
                        {selectedPhotoFile ? (
                          <Image 
                            src={URL.createObjectURL(selectedPhotoFile)} 
                            alt="Preview" 
                            fill 
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : formData.photoUrl && formData.photoUrl.startsWith('http') ? (
                          <Image 
                            src={formData.photoUrl} 
                            alt="Atual" 
                            fill 
                            sizes="64px"
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <UserIcon className="w-8 h-8 text-primary opacity-50" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoFileChange}
                          className="hidden"
                          id="photo-upload"
                        />
                        <label 
                          htmlFor="photo-upload"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-primary/5 border border-primary/10 rounded-lg text-xs font-bold cursor-pointer hover:bg-primary/5 transition-all"
                        >
                          <Camera className="w-4 h-4" />
                          {selectedPhotoFile || formData.photoUrl ? 'Trocar Foto' : 'Selecionar Foto'}
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Nº CNH (Opcional)</label>
                    <input 
                      value={formData.cnhNumber}
                      onChange={(e) => setFormData({...formData, cnhNumber: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="00000000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Validade CNH</label>
                    <input 
                      type="date"
                      value={formData.cnhExpiration}
                      onChange={(e) => setFormData({...formData, cnhExpiration: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Categoria CNH</label>
                    <input 
                      value={formData.cnhCategory}
                      onChange={(e) => setFormData({...formData, cnhCategory: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="Ex: AB, D"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">WhatsApp</label>
                    <input 
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="Ex: 11999999999"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-400">Documento CNH (PDF)</label>
                    <div className="relative">
                      <input 
                        type="file"
                        accept="application/pdf"
                        onChange={handleCnhFileChange}
                        className="hidden"
                        id="cnh-pdf-upload"
                      />
                      <label 
                        htmlFor="cnh-pdf-upload"
                        className={`flex flex-col items-center justify-center gap-2 w-full bg-slate-50 dark:bg-primary/5 border-2 border-dashed rounded-xl px-4 py-6 cursor-pointer transition-all ${
                          extracting ? 'border-primary animate-pulse' : 'border-primary/10 hover:border-primary/30'
                        }`}
                      >
                        {extracting ? (
                          <>
                            <Loader2 className="w-6 h-6 text-primary animate-spin" />
                            <span className="text-sm font-bold text-primary">Extraindo dados do PDF...</span>
                          </>
                        ) : selectedCnhFile ? (
                          <>
                            <FileText className="w-5 h-5 text-primary" />
                            <span className="text-sm font-medium truncate max-w-[200px]">{selectedCnhFile.name}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Clique para trocar</span>
                          </>
                        ) : formData.cnhPdfUrl ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium">PDF já enviado (Clique para trocar)</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-slate-400" />
                            <span className="text-sm font-medium text-slate-500">Clique para selecionar o PDF da CNH</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Os dados serão extraídos automaticamente</span>
                          </>
                        )}
                      </label>
                      {formData.cnhPdfUrl && (
                        <a 
                          href={formData.cnhPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                          title="Visualizar PDF atual"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                  {editingEmployee && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400">Data de Cadastro</label>
                      <input 
                        disabled
                        value={formatDate(editingEmployee.createdAt)}
                        className="w-full bg-slate-100 dark:bg-primary/10 border border-primary/10 rounded-xl px-4 py-3 outline-none opacity-70 cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-primary/10 flex gap-3 bg-white dark:bg-background-dark shrink-0">
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-4 rounded-xl font-bold border border-primary/10 hover:bg-slate-50 dark:hover:bg-primary/5 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className={`flex-1 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                      uploading 
                        ? 'bg-slate-400 text-white cursor-not-allowed opacity-70' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-blue-600/20'
                    }`}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <span>{editingEmployee ? 'Salvar Alterações' : 'Cadastrar Funcionário'}</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div 
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-background-dark/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-white dark:bg-background-dark rounded-3xl shadow-2xl border border-primary/10 p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Excluir Funcionário?</h2>
              <p className="text-slate-500 mb-8">Esta ação não pode ser desfeita. Todos os dados deste registro serão removidos permanentemente.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 rounded-xl font-bold border border-primary/10 hover:bg-slate-50 dark:hover:bg-primary/5 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
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
