import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Lock, UserCircle2 } from 'lucide-react';
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

const QUICK_USERS = [
  { label: 'Recepção', username: 'recepcao', password: '1234' },
  { label: 'Guichê 1', username: 'guiche1', password: '1234' },
  { label: 'Guichê 2', username: 'guiche2', password: '1234' },
  { label: 'Guichê 3', username: 'guiche3', password: '1234' },
  { label: 'Guichê 4', username: 'guiche4', password: '1234' },
  { label: 'Guichê 5', username: 'guiche5', password: '1234' },
  { label: 'Guichê 6', username: 'guiche6', password: '1234' },
  { label: 'Guichê 7', username: 'guiche7', password: '1234' },
  { label: 'Guichê 8', username: 'guiche8', password: '1234' },
  { label: 'Guichê 9', username: 'guiche9', password: '1234' },
  { label: 'Administrador', username: 'admin', password: '1234' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, error, currentUser } = useQueue();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const goByRole = (role: string) => {
    if (role === 'admin') {
      navigate('/display');
      return;
    }

    if (role === 'reception') {
      navigate('/');
      return;
    }

    if (role.startsWith('guiche')) {
      navigate('/guiche');
      return;
    }

    navigate('/login');
  };

  const handleLogin = async (customUsername?: string, customPassword?: string) => {
    setLoading(true);

    const result = await login(
      customUsername ?? username,
      customPassword ?? password,
    );

    setLoading(false);

    if (result.success && result.user) {
      goByRole(result.user.role);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 px-4 py-8">
      <div className="w-full max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-0 shadow-xl">
            <CardHeader className="pb-2">
              <div className="mb-4 flex items-center gap-4">
                <img
                  src={LOGO_URL}
                  alt="IdealQueue"
                  className="h-14 w-14 rounded-2xl object-cover"
                />
                <div>
                  <CardTitle className="text-2xl text-slate-900">
                    IdealQueue
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
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {currentUser && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Usuário atual: <strong>{currentUser.name}</strong>
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

          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Acessos rápidos</CardTitle>
              <p className="text-sm text-slate-500">
                Clique para entrar rapidamente com um perfil de teste
              </p>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {QUICK_USERS.map((item) => (
                  <button
                    key={item.username}
                    type="button"
                    onClick={() => void handleLogin(item.username, item.password)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="font-semibold text-slate-900">{item.label}</div>
                    <div className="text-sm text-slate-500">{item.username}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}