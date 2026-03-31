📋 IdealQueue – Sistema Inteligente de Gestão de Filas

Sistema web desenvolvido para gestão eficiente de filas em clínicas populares, permitindo cadastro de pacientes, controle de atendimento em baias e gerenciamento de prioridades (idosos, gestantes, etc.).

O objetivo do sistema é reduzir tempo de espera, organizar atendimentos e melhorar a experiência do paciente.

🏥 Problema Resolvido

Clínicas populares frequentemente enfrentam problemas como:

⏱️ Longo tempo de espera

😡 Reclamações sobre prioridades

📉 Pacientes desistindo do atendimento

🧾 Falta de previsibilidade na fila

👩‍💼 Recepção sobrecarregada

O IdealQueue resolve isso através de um sistema digital de gestão de filas que organiza o fluxo de atendimento de forma clara e automática.

🚀 Funcionalidades
👤 Cadastro de Pacientes

Permite registrar novos pacientes na fila informando:

Nome completo

RG

Prioridade (opcional)

Prioridades disponíveis:

Gestante

Idoso

Pessoa com deficiência

📊 Dashboard de Controle

Painel com indicadores em tempo real:

Pessoas aguardando recepção

Pessoas em atendimento

Pessoas aguardando DP

Quantidade de prioritários

Tempo médio de espera

🪑 Controle de Baias

O sistema permite visualizar:

Baias disponíveis

Baias ocupadas

Pacientes em atendimento

📈 Regra de Prioridade Inteligente

Para garantir justiça no atendimento, o sistema aplica a regra:

A cada 3 pacientes normais atendidos, 1 paciente prioritário é chamado.

Isso evita que pacientes prioritários aguardem tempo excessivo.

📺 Tela de Exibição

Modo especial para TV ou monitor público, mostrando:

Pacientes chamados

Baias disponíveis

Status da fila

🧠 Arquitetura do Sistema

O projeto utiliza uma arquitetura moderna baseada em:

Frontend (React + Vite)
        ↓
Hooks de controle de fila
        ↓
Camada de dados
(localStorage ou API)
Estrutura simplificada:
IdealQueue
│
├── src
│   ├── react-app
│   │   ├── components
│   │   ├── hooks
│   │   ├── pages
│   │   ├── lib
│   │   └── App.tsx
│   │
│   └── styles
│
├── vite.config.ts
├── package.json
└── README.md
⚙️ Tecnologias Utilizadas
Frontend

⚛️ React

⚡ Vite

🎨 Tailwind CSS

🧩 TypeScript

Gerenciamento de estado

React Hooks

Persistência de dados

Modo local (desenvolvimento):

localStorage

Modo produção (opcional):

API REST

Cloudflare Workers

Banco D1

💻 Como Executar o Projeto
1️⃣ Instalar dependências
npm install
2️⃣ Rodar o servidor local
npm run dev
3️⃣ Abrir no navegador
http://localhost:5173
📦 Estrutura do Código
Hooks
useQueue.ts

Responsável por:

adicionar pacientes

organizar a fila

atualizar estados

useQueueDisplay.ts

Controla:

dados exibidos na tela

atualização da fila

estatísticas

Biblioteca
localQueue.ts

Gerencia dados localmente usando:

localStorage

Permite:

salvar pacientes

recuperar fila

atualizar status

🔐 Segurança e Confiabilidade

Boas práticas implementadas:

✔ validação de campos
✔ prevenção de dados vazios
✔ separação de lógica e interface
✔ arquitetura modular

📊 Escalabilidade

O sistema suporta facilmente:

centenas de pacientes na fila

múltiplas baias

várias prioridades

Em produção, recomenda-se utilizar:

banco de dados

API backend

cache

🎯 Possíveis Melhorias Futuras

🔔 Notificação por SMS ou WhatsApp

📱 Aplicativo mobile para pacientes

📈 Dashboard analítico para gestores

🧠 Previsão de tempo de espera com IA

🔗 Integração com sistemas hospitalares

👨‍💻 Autor

Desenvolvido por:

Victor Maciel


## Alterações adicionais incluídas nesta versão

- Login simples por usuário/guichê no modo local
- Medição de tempo por atendimento em cada guichê
- Registro de histórico local dos atendimentos
- Relatório mensal por atendente em `/reports`

Usuários de exemplo:
- `guiche1` / `1234`
- `guiche2` / `1234`
- `guiche3` / `1234`
- `guiche4` / `1234`
- `guiche5` / `1234`
- `admin` / `1234`
