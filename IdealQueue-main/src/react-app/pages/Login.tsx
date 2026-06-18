import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Lock, UserCircle2, TrendingUp } from 'lucide-react';
import { useQueue } from '@/react-app/hooks/useQueue';
import { Button } from '@/react-app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/react-app/components/ui/card';

const LOGO_URL =
  'https://019cbac0-d37d-7fe6-9252-d88c892cf697.mochausercontent.com/image.png_5543.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, error } = useQueue();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const goByRole = (role: string) => {
    if (role === 'admin') { navigate('/dashboard'); return; }
    if (role === 'reception') { navigate('/'); return; }
    if (role.startsWith('guiche')) { navigate('/guiche'); return; }
    if (role.startsWith('dp')) { navigate('/dp'); return; }
    navigate('/login');
  };

  const handleLogin = async () => {
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.success && result.user) {
      goByRole(result.user.role);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 px-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-2">
            <div className="mb-4 flex items-center gap-4">
              <img
                src={LOGO_URL}
                alt="IdealFila"
                className="h-14 w-14 rounded-2xl object-cover"
              />
              <div>
                <CardTitle className="text-2xl text-slate-900">
                  IdealFila
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Sistema de atendimento com recepção, guichês e DP
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Usuário
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <UserCircle2 className="h-5 w-5 text-slate-400" />
                <input
                  className="w-full border-0 bg-transparent outline-none"
                  placeholder="Digite seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin(); }}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Senha
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Lock className="h-5 w-5 text-slate-400" />
                <input
                  type="password"
                  className="w-full border-0 bg-transparent outline-none"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin(); }}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              className="h-11 w-full bg-slate-900 hover:bg-slate-800"
              onClick={() => void handleLogin()}
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Acesso ao painel de indicadores (diretoria / RH) — canto inferior direito */}
      <button
        type="button"
        onClick={() => navigate('/indicadores-login')}
        className="absolute bottom-6 right-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-slate-900"
        title="Painel de Turnover & Absenteísmo"
      >
        <TrendingUp className="h-4 w-4 text-blue-700" />
        Painel de Indicadores
      </button>
    </div>
  );
}