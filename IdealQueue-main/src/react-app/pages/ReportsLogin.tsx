import { useState } from 'react';
import { useNavigate } from 'react-router';
import bcrypt from 'bcryptjs';
import { Lock, Eye, EyeOff, BarChart3, User } from 'lucide-react';
import { Button } from '@/react-app/components/ui/button';
import { Input } from '@/react-app/components/ui/input';
import { Label } from '@/react-app/components/ui/label';
import { supabase } from '@/react-app/lib/supabaseClient';

const LOGO_URL = 'https://019cbac0-d37d-7fe6-9252-d88c892cf697.mochausercontent.com/image.png_5543.png';
const SESSION_KEY = 'idealfila_reports_auth';

// Hash bcrypt da senha do admin (gerado com bcrypt.hashSync('1234', 12))
// Para alterar a senha: gere um novo hash e substitua esta constante
const ADMIN_PASSWORD_HASH = '$2b$12$K7N0aMGUMXf/rppdvMKTJ.qta/auL4KXJ0fEX34922giAXOQ2u3V2';

export function setReportsSession() {
  sessionStorage.setItem(SESSION_KEY, 'true');
}

export function checkReportsSession(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

export function clearReportsSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export default function ReportsLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Busca o usuário no Supabase
      const { data, error: dbError } = await supabase
        .from('users')
        .select('id, username, role')
        .ilike('username', username.trim())
        .eq('is_active', true)
        .single();

      if (dbError || !data) {
        setError('Usuário ou senha incorretos.');
        setLoading(false);
        return;
      }

      // 2. Verifica se é admin
      if (data.role !== 'admin') {
        setError('Acesso negado. Apenas administradores podem acessar os relatórios.');
        setLoading(false);
        return;
      }

      // 3. Verifica a senha com bcrypt
      const passwordMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      if (!passwordMatch) {
        setError('Usuário ou senha incorretos.');
        setLoading(false);
        return;
      }

      // 4. Autenticado com sucesso
      setReportsSession();
      navigate('/reports');
    } catch {
      setError('Erro ao verificar credenciais. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center px-4"
      style={{ fontFamily: 'Poppins, sans-serif' }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl p-10">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img src={LOGO_URL} alt="IdealFila" className="h-16 w-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900">IdealFila</h1>
            <p className="text-slate-500 text-sm mt-1">Acesso aos Relatórios</p>
          </div>

          {/* Ícone */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Usuário */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-700 font-semibold">
                Usuário
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  placeholder="Digite seu usuário"
                  className="pl-10 h-12"
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-semibold">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Digite sua senha"
                  className="pl-10 pr-10 h-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold mt-2"
              disabled={loading || !username || !password}
            >
              {loading ? 'Verificando...' : 'Acessar Relatórios'}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Acesso restrito — apenas administrador
          </p>
        </div>
      </div>
    </div>
  );
}