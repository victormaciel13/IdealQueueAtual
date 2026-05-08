import { useState } from 'react';
import { Button } from '@/react-app/components/ui/button';
import { Input } from '@/react-app/components/ui/input';
import { Label } from '@/react-app/components/ui/label';
import { Checkbox } from '@/react-app/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/react-app/components/ui/card';
import { UserPlus, Baby } from 'lucide-react';

interface PersonFormProps {
  onSubmit: (data: {
    name: string;
    cpf: string;
    is_pregnant: boolean;
    has_infant: boolean;
  }) => Promise<boolean>;
}

export function PersonForm({ onSubmit }: PersonFormProps) {
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [hasInfant, setHasInfant] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cpf.trim()) return;

    setSubmitting(true);
    const success = await onSubmit({
      name: name.trim(),
      cpf: cpf.trim(),
      is_pregnant: false,
      has_infant: hasInfant
    });

    if (success) {
      setName('');
      setCpf('');
      setHasInfant(false);
    }
    setSubmitting(false);
  };

  const formatRG = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}-${numbers.slice(8, 9)}`;
  };

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-primary" />
          </div>
          Novo Cadastro
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite o nome"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={cpf}
              onChange={(e) => setCpf(formatRG(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={12}
              required
            />
          </div>

          <div className="space-y-3 pt-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Prioridade (opcional)
            </Label>
            
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Checkbox
                id="infant"
                checked={hasInfant}
                onCheckedChange={(checked) => {
                  setHasInfant(checked === true);
                }}
              />
              <Label htmlFor="infant" className="flex items-center gap-2 cursor-pointer text-blue-700">
                <Baby className="w-4 h-4" />
                Criança de Colo
              </Label>
            </div>
          </div>

          <Button type="submit" className="w-full mt-4" disabled={submitting}>
            {submitting ? 'Cadastrando...' : 'Cadastrar na Fila'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}