-- Migrações para o Supabase

-- Tabela de Funcionários
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT,
  cnh_number TEXT,
  cnh_expiration DATE,
  cnh_category TEXT,
  cnh_pdf_url TEXT,
  whatsapp TEXT,
  status TEXT DEFAULT 'active',
  photo_url TEXT,
  uid TEXT NOT NULL, -- UID do proprietário (Firebase UID)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Veículos
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT UNIQUE NOT NULL,
  type TEXT,
  model TEXT,
  brand TEXT,
  year INTEGER,
  color TEXT,
  renavam TEXT,
  chassi TEXT,
  status TEXT DEFAULT 'active',
  photo_url TEXT,
  document_url TEXT,
  uid TEXT NOT NULL, -- UID do proprietário
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Exemplo: Usuário só vê seus próprios dados)
DROP POLICY IF EXISTS "Users can view their own employees" ON employees;
DROP POLICY IF EXISTS "Users can insert their own employees" ON employees;
DROP POLICY IF EXISTS "Users can update their own employees" ON employees;
DROP POLICY IF EXISTS "Users can delete their own employees" ON employees;

CREATE POLICY "Users can view their own employees" ON employees
  FOR SELECT USING (auth.uid()::text = uid);

CREATE POLICY "Users can insert their own employees" ON employees
  FOR INSERT WITH CHECK (auth.uid()::text = uid);

CREATE POLICY "Users can update their own employees" ON employees
  FOR UPDATE USING (auth.uid()::text = uid);

CREATE POLICY "Users can delete their own employees" ON employees
  FOR DELETE USING (auth.uid()::text = uid);

-- Repetir para veículos
DROP POLICY IF EXISTS "Users can view their own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can insert their own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can update their own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can delete their own vehicles" ON vehicles;

CREATE POLICY "Users can view their own vehicles" ON vehicles
  FOR SELECT USING (auth.uid()::text = uid);

CREATE POLICY "Users can insert their own vehicles" ON vehicles
  FOR INSERT WITH CHECK (auth.uid()::text = uid);

CREATE POLICY "Users can update their own vehicles" ON vehicles
  FOR UPDATE USING (auth.uid()::text = uid);

CREATE POLICY "Users can delete their own vehicles" ON vehicles
  FOR DELETE USING (auth.uid()::text = uid);

-- Tabela de Frotas
CREATE TABLE IF NOT EXISTS fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_number TEXT UNIQUE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  cavalo_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  carreta_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',
  uid TEXT NOT NULL, -- UID do proprietário
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para frotas
ALTER TABLE fleets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own fleets" ON fleets;
DROP POLICY IF EXISTS "Users can insert their own fleets" ON fleets;
DROP POLICY IF EXISTS "Users can update their own fleets" ON fleets;
DROP POLICY IF EXISTS "Users can delete their own fleets" ON fleets;

CREATE POLICY "Users can view their own fleets" ON fleets
  FOR SELECT USING (auth.uid()::text = uid);

CREATE POLICY "Users can insert their own fleets" ON fleets
  FOR INSERT WITH CHECK (auth.uid()::text = uid);

CREATE POLICY "Users can update their own fleets" ON fleets
  FOR UPDATE USING (auth.uid()::text = uid);

CREATE POLICY "Users can delete their own fleets" ON fleets
  FOR DELETE USING (auth.uid()::text = uid);

-- Configuração de Storage (Opcional via SQL, mas útil como referência)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('app-assets', 'app-assets', true) ON CONFLICT (id) DO NOTHING;
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'app-assets');
-- CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'app-assets' AND auth.role() = 'authenticated');
