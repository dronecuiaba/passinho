# Passinho Android 3.1

O APK empacota o mesmo build web descrito no README da raiz. Rotina, mesada e banho usam o Firebase compartilhado com o GitHub Pages.

Execute `npm run build` e `npm run android:assets` na raiz antes de compilar este módulo. Requer JDK 17, Android SDK 36 e Build Tools 36.0.0. Os assets são gerados e não versionados.

```powershell
.\gradlew.bat :app:assembleRelease
```

O release precisa ser assinado com a mesma chave do APK 1.0 para permitir atualização. O identificador continua `br.com.passinho.familia`; a versão é 3.1.1, código 7. Não inclua a chave privada no repositório.

MainActivity permite conteúdo local empacotado e conexões HTTPS com Firestore, Identity Toolkit e Secure Token. A ponte oferece gravação de backup pelo seletor de arquivos e cópia do código de conexão. Engine.java e seus testes antigos foram preservados como referência para os dados locais 1.0; o fluxo ativo usa domain.js e cloud.js da raiz.

Sem aparelho Android conectado nesta entrega. Compilação e assinatura são verificadas aqui; teclado, seletores de arquivo, persistência do WebView e uso em segundo plano precisam ser conferidos no tablet.

O botão Atualizar app usa a ponte openApkDownload para abrir no navegador o APK mais recente. Cada release deve publicar também o nome fixo Passinho.apk.
