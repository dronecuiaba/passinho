# Passinho — tarefas, mesada e banho

Versão 2.1.0. Web no GitHub Pages e APK Android usam o mesmo build de interface e o mesmo Firebase Firestore. Os dados do Passinho são privados por família e compartilhados em tempo real entre aparelhos vinculados.

## Primeiro acesso

1. Abra o site ou instale o APK atualizado e escolha **Criar minha família**.
2. Crie o primeiro responsável com nome e senha. Não há senha padrão.
3. Em **Banho da vez**, use **Importar do Banho da Vez** para aproveitar as crianças, a ordem e a data inicial do app anterior. Crianças importadas começam com mesada de R$ 0; defina o valor em **Crianças**.
4. Cadastre as tarefas de cada criança e os dias da semana.
5. Em **Aparelhos**, mostre o código da família. Nos demais aparelhos, escolha **Conectar a uma família existente** e informe esse código uma única vez. Não crie outra família no segundo aparelho.
6. Bloqueie a área dos responsáveis. As crianças entram escolhendo o nome, sem senha.

## Rotina e mesada

Cada repetição agendada de uma tarefa conta como uma ocorrência mensal. O desconto acumulado é `mesada × ocorrências não concluídas em dias fechados ÷ ocorrências agendadas no mês`, arredondado uma única vez para centavos. O saldo nunca fica negativo.

Dias abertos não descontam. A meia-noite de Brasília fecha o dia automaticamente, mantém os checks concluídos e considera tarefas sem check como não concluídas. Isso é calculado pela data, sem depender de manter o app aberto.

O responsável pode marcar uma tarefa como não concluída durante o dia, bloqueando a alteração pela criança. Pode validar e fechar antes da meia-noite e corrigir dias anteriores. Alterar a mesada recalcula o mês atual e vale nos próximos; meses anteriores mantêm seus valores. A agenda nova começa hoje, ou amanhã se hoje já estiver fechado, preservando o histórico anterior. Mudanças de agenda podem alterar o peso de cada ocorrência no mês atual.

Cadastros no meio do mês usam a mesada integral, distribuída entre as ocorrências agendadas a partir da criação. Sem tarefas, não há desconto. O banho é uma fila diária com previsão de sete dias, participantes ordenados e opção de reiniciar. Seus participantes usam o mesmo cadastro das tarefas.

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
