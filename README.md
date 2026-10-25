# AlongamentosCaratinga

Sistema web para administrar um studio de unhas, feito em **Next.js 16 (App Router), React 19, TypeScript e Supabase**. Interface em português, verde sálvia, off-white e branco, responsiva para computador e celular. Projeto independente com funcionalidades de gestão inspiradas nas necessidades observadas no ManiPro; não reutiliza código, marca nem dados privados daquele aplicativo.

## Rodar agora

Requer Node.js 20.9 ou superior (desenvolvido com Node 22).

```powershell
cd C:\Alongamentoscaratinga
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

**O painel exige Supabase configurado e a conta administrativa autorizada.** Sem essa configuração, o acesso privado é negado. Os exemplos de demonstração permanecem apenas como suporte aos testes; não substituem o banco real do negócio. O endereço localhost não é um link que outras clientes consigam abrir pela internet.

## O que foi implementado

| Área | Recursos |
| --- | --- |
| Visão geral | Resumo do dia, recebimentos do mês, agenda, gráfico de entradas, clientes sem visita recente e acesso ao link público. |
| Agenda | Visão diária, semanal e mensal, filtro de profissional, criação e edição, remarcação, confirmação, conclusão, cancelamento, faltas, bloqueios e exportação CSV. |
| Clientes | Cadastro e edição, aniversário, preferências, histórico, busca, filtros de 30/60/90 dias, importação CSV com prévia e exportação. |
| Serviços | Nome, descrição, categoria, duração, preço, foto opcional com upload/HTTPS, cor e ativação. |
| Pacotes | Catálogo, venda por cliente, validade, pagamento, contagem de sessões, resgate vinculado ao serviço e reversão ao cancelar atendimento concluído. |
| Financeiro | Recebimentos de atendimentos concluídos e pagos, vendas de pacotes, receitas avulsas, despesas, saldo, valores em aberto, produção e previsão de comissões, filtro de mês e CSV. |
| Equipe | Cadastro, especialidade, cor de agenda, percentual de comissão e desativação. A conta administrativa é da proprietária; não há logins individuais para profissionais. |
| Site público | Identidade do studio, serviços, profissionais, galeria, horários livres, reserva sem conta e contato com WhatsApp/Instagram. Reservas chegam como pendentes. |
| Configurações | Dados do studio, endereço do link, expediente, intervalo, antecedência, prazo para solicitar cancelamento, formas de pagamento e configuração de lembretes. |
| Acesso | Conta administrativa única com e-mail/senha, recuperação de senha e sessão em cookies. Cadastro público desativado no app e no Supabase. |
| Avisos | Reservas pendentes, aniversariantes do dia e lembretes de hoje/amanhã. WhatsApp com mensagem preparada para envio manual. |
| E-mail | Rota protegida para lembretes automáticos com Resend, opcional e dependente de configuração externa. |

Os pagamentos são registrados no sistema e realizados diretamente ao studio. Não há cobrança de cartão, integração bancária ou Pix automático. Comissões são uma previsão com o percentual atual da profissional; registre o pagamento como despesa para descontá-lo do caixa. Pacotes geram receita na venda e suas sessões não geram receita ou comissão duplicada. Fotos são de divulgação pública. O manifesto permite adicionar o app à tela inicial; não há operação offline com Supabase.

## Conectar o Supabase

1. Crie um projeto em [Supabase](https://supabase.com/dashboard).
2. No **SQL Editor**, execute [001_initial.sql](supabase/migrations/001_initial.sql), [002_service_photos.sql](supabase/migrations/002_service_photos.sql) e [003_single_admin.sql](supabase/migrations/003_single_admin.sql), nessa ordem. Em projetos existentes, execute apenas as migrations que ainda não foram aplicadas. A migration 003 restringe o acesso privado à conta definida em `private.admin_access`; sem essa configuração, o acesso privado é negado. As migrations são transacionais: se alguma falhar, corrija a causa antes de executar novamente.
3. Em **Project Settings → API**, copie a URL e a chave pública **publishable** (ou a chave legada anon).
4. Na pasta do projeto:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env.local
```

5. Preencha:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_USER_ID=UUID-DA-CONTA-ADMINISTRATIVA
STUDIO_PUBLIC_SLUG=slug-do-studio
# Opcional: slugs antigos separados por vírgula redirecionam para o endereço atual.
STUDIO_LEGACY_SLUGS=
```

6. No Supabase, em **Authentication → URL Configuration**, configure o Site URL como `http://localhost:3000` e adicione os Redirect URLs:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?next=/redefinir-senha
```

Em produção, adicione os mesmos caminhos com seu domínio HTTPS. Configure um SMTP próprio no Supabase para os e-mails de confirmação/recuperação da conta quando for usar em produção. Esses e-mails são separados dos lembretes de atendimento do Resend.

7. Crie a única conta administrativa pelo painel do Supabase em **Authentication → Users → Add user** e copie o UUID para `ADMIN_USER_ID` no servidor. No SQL Editor, configure o mesmo UUID: `insert into private.admin_access(singleton,admin_user_id) values(true,'UUID-DA-CONTA') on conflict(singleton) do update set admin_user_id=excluded.admin_user_id;`. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up** e mantenha os acessos anônimos desativados. Reinicie `npm run dev` e entre em `/entrar`. O primeiro acesso de uma instalação nova cria um studio vazio e uma profissional inicial. Preencha `STUDIO_PUBLIC_SLUG` com o slug configurado para o studio.
8. Configure dados do studio, equipe, serviços e horários. Importe as clientes se desejar. Os exemplos locais não são transferidos automaticamente para o banco.

Mantenha apenas a conta administrativa em Authentication. A tela e a rota de acesso não permitem cadastro; o proxy e o banco rejeitam outros UUIDs. O agendamento público continua disponível sem conta. Senhas e chaves secretas não devem ser incluídas no código ou no Git.

### Segurança e disponibilidade

- Todas as nove tabelas de negócio usam Row Level Security. Proprietárias acessam somente seus próprios dados.
- Chaves estrangeiras compostas impedem referências cruzadas entre studios.
- Uma exclusão GiST impede sobreposição entre agendamentos e bloqueios, inclusive em reservas concorrentes. Horários consecutivos são permitidos.
- O público acessa somente funções específicas: `get_public_studio`, `get_available_slots` e `book_appointment`. Não pode consultar clientes, observações ou finanças.
- A função de reserva verifica profissional e serviço ativos, expediente, intervalo, antecedência e disponibilidade. A janela pública vai até 90 dias. Não há alteração pública de um cadastro existente de cliente.
- Há limites básicos no banco: até três reservas futuras por telefone e 30 reservas públicas por studio por hora. Para exposição ampla, acrescente proteção contra abuso no host (por exemplo, WAF/Turnstile) conforme a necessidade.
- A agenda sincroniza reservas por Realtime quando configurado; também é atualizada ao retornar à janela.
- As fotos da galeria e dos serviços são públicas. Em **Serviços → Novo serviço/Editar → Foto do serviço**, é possível enviar JPG, PNG ou WebP de até 5 MB, trocar/remover a foto ou informar um link HTTPS. Na demonstração, o limite é de 800 KB por imagem. A gravação no Storage é restrita à pasta do studio autenticado. Remover uma foto retira sua exibição; arquivos já enviados podem ser limpos pelo painel Storage do Supabase.
- Depois de reservar pelo link público, a cliente vê dia, horário de Brasília e endereço em um cartão destacado, com acesso ao mapa. O endereço vem de **Configurações → Dados do studio**; se estiver vazio, a tela informa que o studio vai fornecer o local. A reserva continua pendente até a confirmação pelo studio.
- O botão **Confirmar pelo WhatsApp** dessa tela prepara a confirmação da cliente para **+55 31 9731-1275**, com nome completo, serviço, profissional, data, hora e endereço. O destino está definido em `src/lib/whatsapp-confirmations.ts`, independentemente do telefone de contato geral do studio.
- Em **Visão geral → Confirmar os próximos atendimentos**, reservas pendentes/confirmadas aparecem durante os 60 minutos anteriores ao início. O botão **Confirmar atendimento** abre o WhatsApp da cliente com a mensagem pronta; se faltar um telefone válido, há um atalho para cadastrar o contato. A janela se atualiza enquanto o painel está aberto e ao retornar à aba. O envio é manual no WhatsApp e não altera o status da agenda.
- Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em variável `NEXT_PUBLIC_*`, no navegador ou no Git. Ela é opcional e necessária somente para o job de lembretes.
- O backup dos dados reais depende das opções e rotinas do seu projeto Supabase. A exportação CSV ajuda nas rotinas operacionais, mas não substitui backup completo.

## Lembretes automáticos por e-mail (opcional)

1. Crie uma conta no [Resend](https://resend.com), verifique seu domínio remetente e gere uma chave.
2. Adicione ao ambiente do servidor:

```dotenv
RESEND_API_KEY=re_...
REMINDER_FROM_EMAIL=AlongamentosCaratinga <agenda@seu-dominio.com.br>
CRON_SECRET=UM_SEGREDO_ALEATORIO_COM_PELO_MENOS_24_CARACTERES
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SECRETA_DO_SERVIDOR
```

3. Ative o envio em **Configurações → Avisos e lembretes**. Cadastre o e-mail das clientes.
4. Configure um agendador externo para chamar a cada hora:

```text
GET https://SEU-DOMINIO/api/lembretes
Authorization: Bearer SEU_CRON_SECRET
```

O job envia apenas para atendimentos confirmados, futuros, dentro da antecedência configurada e ainda sem envio registrado. Usa chave de idempotência do Resend para reduzir duplicidade em tentativas concorrentes e marca o envio após sucesso. Remarcações reiniciam o controle do lembrete. Há limite de 100 registros por execução; para o uso de um studio isso é suficiente. Atendimentos cancelados não entram na fila. O agendador deve rodar com a frequência configurada para não perder a janela do lembrete.

**Sem Resend, chave do servidor e agendador configurados, não são enviados lembretes automáticos.** O WhatsApp funciona com links de mensagem e requer revisão/envio manual. A cliente solicita cancelamento/remarcação pelo contato do studio, e a proprietária atualiza a agenda.

## Publicar

O projeto usa Next.js padrão e pode ser publicado em Vercel ou em um servidor Node.js. Não foi publicado automaticamente nem foi criado um projeto/assinatura externa.

```powershell
npm run build
npm start
```

Cadastre as variáveis no host, configure o domínio HTTPS, atualize `NEXT_PUBLIC_APP_URL` e os Redirect URLs do Supabase e faça um novo build. Variáveis `NEXT_PUBLIC_*` são incorporadas na compilação. Depois de publicado, copie o endereço em **Meu link de agendamento**. Não publique com a demonstração habilitada para operar com dados reais.

## Validação

```powershell
npm run typecheck
npm test
npm run build
```

Os testes incluem datas no fuso de Brasília, disponibilidade, intervalo, importação CSV, pacotes e uma execução real da migration em PostgreSQL embarcado (PGlite), com stubs dos schemas gerenciados `auth` e `storage`. Verificam RLS entre proprietárias, funções públicas, reservas, conflitos, bloqueios e reversão de sessões. Isso não substitui a validação de Auth, Storage, Realtime e envio de e-mail em um projeto Supabase real.

## Estrutura

```text
src/app/                    Rotas Next.js, API de reserva, job e callback de autenticação
src/components/             Painel, formulários, página pública, login e estilos de componentes
src/lib/                    Tipos, regras de agenda, utilitários, exemplos e clientes Supabase
src/proxy.ts                Renovação da sessão e proteção das rotas do painel
supabase/migrations/        Estrutura e regras do banco
tests/                      Testes de domínio e integração PostgreSQL
public/                     Ícone do aplicativo
```
