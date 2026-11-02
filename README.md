# Passinho — tarefas, mesada e banho

Versão 3.1.0. Web no GitHub Pages e APK Android usam o mesmo build de interface e o mesmo Firebase Firestore. Os dados do Passinho são privados por família e compartilhados em tempo real entre aparelhos vinculados.

## Primeiro acesso

1. Abra o site ou instale o APK atualizado e escolha **Criar minha família**.
2. Crie o primeiro responsável com nome e senha. Não há senha padrão.
3. Em **Banho da vez**, use **Importar do Banho da Vez** para aproveitar as crianças, a ordem e a data inicial do app anterior. Crianças importadas começam com mesada de R$ 0; defina o valor em **Crianças**.
4. Cadastre as tarefas de cada criança e os dias da semana.
5. Em **Aparelhos**, mostre o código da família. Nos demais aparelhos, escolha **Conectar a uma família existente** e informe esse código uma única vez. Não crie outra família no segundo aparelho.
6. Bloqueie a área dos responsáveis. As crianças entram escolhendo o nome, sem senha.

## Rotina e mesada

Cada criança tem dois valores mensais: **mesada fixa**, protegida de descontos, e **mesada por objetivos**, sujeita aos descontos. O mês começa com os dois valores cheios.

- **Concluída:** mantém o valor da mesada.
- **Não marcada:** é neutra, inclusive depois do fechamento automático. Não vira uma falha por ausência de check.
- **Não concluída:** gera desconto somente se a tarefa tem **Desconta da mesada por objetivos** ativado e o dia está fechado. Antes de fechar, o saldo não diminui.
- **Saldo disponível:** fixa + objetivos − descontos dos dias fechados. O desconto nunca ultrapassa a parte por objetivos.

A divisão usa somente as ocorrências mensais agendadas das tarefas participantes. Tarefas sem desconto não entram na divisão, embora apareçam normalmente na rotina. Exemplo: R$ 60 fixos + R$ 90 por objetivos, com 90 ocorrências participantes: o mês começa em R$ 150. Cada ocorrência participante não concluída desconta R$ 1 ao fechar o dia. Dez falhas deixam R$ 140. O arredondamento é feito no total dos descontos.

A meia-noite de Brasília fecha o dia automaticamente, mesmo sem abrir o app, mantendo os status. O responsável pode fechar antes e corrigir dias anteriores. Corrigir uma falha para concluída ou não marcada devolve o desconto. A criança não edita dias fechados ou tarefas avaliadas.

A opção de desconto é versionada com a tarefa: mudanças valem a partir de hoje ou amanhã se hoje já estiver fechado, preservando os dias anteriores. Adicionar, pausar ou alterar a participação de tarefas recalcula a divisão de acordo com a agenda mensal vigente. Tarefas existentes sem esse campo são consideradas participantes; o responsável pode desativar a opção.

Mudar os valores de mesada recalcula o mês atual e vale nos seguintes. Meses anteriores preservam seus valores cadastrados. Os valores antigos de mesada foram mantidos como orçamento por objetivos, com fixa inicial de R$ 0 até o responsável editar. Cadastros no meio do mês usam o orçamento integral nas ocorrências a partir da criação. Sem tarefas participantes, não há descontos. O mês seguinte começa novamente com o valor cheio vigente.

O banho continua sendo uma fila diária independente, com previsão de sete dias e os mesmos cadastros infantis.

### Atualizar o APK pela área protegida

O menu **Atualizar app**, disponível aos responsáveis autenticados, contém o link permanente `https://github.com/dronecuiaba/passinho/releases/latest/download/Passinho.apk`. A release mais recente precisa sempre conter um asset com o nome **Passinho.apk**. No Android, o botão abre o navegador para baixar o instalador; a instalação continua sendo uma ação do usuário. A versão 3.0 precisa ser instalada uma vez pelo link externo para que o menu exista no APK que antes estava offline.

### Tarefa única

No cadastro, escolha **Repetição → Tarefa única** e informe o **Dia da tarefa**. Os horários são os mesmos da rotina semanal: sem horário, hora exata, intervalo ou período do dia. A tarefa aparece apenas na data escolhida, sem repetição nas semanas ou meses seguintes. Pode ser agendada para hoje (se o dia estiver aberto) ou para uma data futura. Não é permitido criar uma ocorrência retroativa.

A opção de desconto continua disponível. Uma tarefa única participante conta como uma ocorrência somente no mês agendado. Não marcada continua neutra, e não concluída desconta apenas depois do fechamento. Editar a data preserva os dias anteriores à edição; remarcar uma tarefa cuja data já passou cria uma nova ocorrência futura no histórico dessa tarefa. Tarefas antigas continuam semanais. Atualize todos os APKs da família para que exibam a agenda nova corretamente.

### Horário opcional das tarefas

No cadastro de tarefa, escolha sem horário, hora exata (08:00), intervalo (14:00 às 16:00) ou período do dia (Manhã, Tarde, Noite ou Madrugada). A informação aparece para a criança, na lista de tarefas do responsável e na avaliação diária. É possível editar ou remover o horário. O horário é uma orientação da rotina; os checks continuam disponíveis enquanto o dia estiver aberto.

## Contas e conexão

O aparelho infantil usa uma identidade do Firebase sem pedir senha à criança. A vinculação usa um código aleatório de 192 bits. Quem recebe o código pode consultar a família e usar o espaço das crianças; compartilhe somente com os aparelhos da casa. A área dos responsáveis continua exigindo nome e senha.

Cada responsável tem uma conta no Firebase Authentication. Senhas não são armazenadas no Firestore, nos APKs ou no repositório. O app resolve internamente a conta a partir do nome selecionado. Cada responsável altera a própria senha. Outro responsável pode remover um acesso e criar um substituto. Cadastre um segundo responsável e guarde o código da família para recuperação.

A autorização é verificada no Firestore, além da interface. A criança não pode alterar valores, cadastros, fila do banho, avaliações dos responsáveis ou dias fechados. As gravações usam transações para tratar concorrência entre aparelhos. A área protegida bloqueia por inatividade e ao deixar o app.

As alterações precisam de internet para confirmação. O cache permite consultar dados já carregados enquanto estiver offline. O projeto Firebase é `banho-da-vez`, no plano Spark, sujeito às cotas do serviço. Nenhum upgrade ou serviço pago foi contratado. A configuração web do Firebase é pública; o controle de acesso está na autenticação e nas regras.

### App anterior e Alexa

O documento legado `banho/state` permanece intacto, com as mesmas permissões anteriores, para preservar o site e a skill Alexa existentes. A importação cria uma cópia da configuração dentro da família do Passinho e reutiliza as crianças pelo nome. Alterações posteriores na nova fila são sincronizadas entre web e Android do Passinho. O app antigo e a Alexa continuam consultando o documento legado; conectar a Alexa à fila privada nova exige atualizar a skill e seu acesso ao Firebase.

## Backup e migração do APK 1.0

Em **Backup**, exporte o histórico e guarde o arquivo em local privado. O arquivo também inclui o código de conexão, mas não as senhas. Restaurar substitui os dados compartilhados e preserva os acessos atuais do Firebase.

Para trazer dados do APK 1.0, exporte o backup antes de atualizar e importe o JSON na tela de Backup do novo app, após criar a família. As mesadas, agendas, versões e marcações são convertidas; os responsáveis precisam ser cadastrados no novo sistema. A restauração direta é atômica e limitada a 450 operações de documentos. Backups maiores precisam de migração assistida e são rejeitados sem alterar os dados atuais.

## Desenvolvimento

Projeto principal: `C:\Users\djalm\Documents\ChatGPT\Tarefas Diárias`. A versão 1.0 foi preservada no diretório anterior em Downloads/Codex. A assinatura original está fora do repositório, em `C:\Users\djalm\Downloads\Codex\2026-11-01\que\work\passinho-signing`; preserve essa pasta para futuras atualizações do APK.

```powershell
npm ci
npm test
npm run dev
npm run build
npm run android:assets
```

Android requer JDK 17, SDK 36 e Build Tools 36.0.0. Configure `android/local.properties` ou `ANDROID_HOME` e execute `android/gradlew.bat -p android :app:assembleRelease`. Assine o release com a chave original para atualizar o APK anterior sem desinstalar. Os assets Android são gerados a partir do build web e não são versionados.

### Testes isolados

Os testes de regras usam Java 21 e o emulador Firestore do projeto `demo-passinho`:

```powershell
npm run test:rules
```

Para testar sessões completas, inicie os emuladores e a prévia de desenvolvimento em terminais separados:

```powershell
npx firebase emulators:start --only auth,firestore --project demo-passinho
$env:VITE_USE_EMULATORS='1'
npm run dev -- --port 5174
```

O modo de emulador só existe em desenvolvimento e usa projeto e API key de teste. O build publicado sempre usa `src/firebase-config.js`. Dados, caches, chaves e arquivos de trabalho não entram no Git. Os testes visuais entre duas sessões usam dados fictícios nos emuladores, sem gravar na família real.

## Estrutura

- `src/domain.js`: cálculo em centavos, agendas versionadas, fechamento, datas e banho.
- `src/cloud.js`: autenticação, vínculo, transações, atualizações e backup.
- `src/app.js` e `src/style.css`: interface responsiva com entrada infantil prioritária.
- `firestore.rules` e `tests/`: permissões e testes de domínio e autorização.
- `android/`: pacote Android e ponte para backup e área de transferência.
- `scripts/deploy-pages.ps1`: testa, compila e publica o build na branch `gh-pages`. O Pages usa essa branch, sem exigir permissões adicionais de workflow no token local.

## Referências

- [Firebase API keys e regras](https://firebase.google.com/docs/projects/api-keys)
- [Transações e concorrência](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Plano Spark e cotas](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
