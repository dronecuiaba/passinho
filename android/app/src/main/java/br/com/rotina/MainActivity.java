package br.com.rotina;

import android.app.*;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.util.AtomicFile;
import android.view.*;
import android.webkit.*;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import com.github.openjson.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Clock;

public class MainActivity extends Activity {
    private WebView web;
    private Engine engine;
    private boolean picker=false;
    private String pendingBackup;
    private ValueCallback<Uri[]> fileCallback;
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            AtomicFile file=new AtomicFile(new File(getFilesDir(),"family.json"));
            engine=new Engine(new Engine.Store() {
                public String read() throws Exception {
                    try { return new String(file.readFully(),StandardCharsets.UTF_8); }
                    catch(FileNotFoundException firstLaunch) { return null; }
                }
                public void write(String value) throws Exception {
                    FileOutputStream stream=null;
                    try { stream=file.startWrite(); stream.write(value.getBytes(StandardCharsets.UTF_8)); file.finishWrite(stream); }
                    catch(Exception ex) { if(stream!=null) file.failWrite(stream); throw ex; }
                }
            },Clock.systemDefaultZone());
        } catch(Exception ex) {
            new AlertDialog.Builder(this).setTitle("Não foi possível abrir os dados").setMessage("Os dados foram preservados. Feche o app e tente novamente.").setPositiveButton("Fechar",(d,w)->finish()).setCancelable(false).show(); return;
        }
        web=new WebView(this); setContentView(web);
        if(Build.VERSION.SDK_INT>=33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::navigateBack);
        web.setOnApplyWindowInsetsListener((v,insets)-> { v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom()); return insets; });
        web.setBackgroundColor(android.graphics.Color.rgb(246,248,252));
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false); settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r) {
                Uri u=r.getUrl();
                if("https".equals(u.getScheme()) && "appassets.androidplatform.net".equals(u.getHost()) && u.getPath()!=null && u.getPath().startsWith("/assets/")) {
                    WebResourceResponse response=loader.shouldInterceptRequest(u);
                    if(response!=null) return response;
                }
                if("https".equals(u.getScheme()) && java.util.Arrays.asList("firestore.googleapis.com","identitytoolkit.googleapis.com","securetoken.googleapis.com").contains(u.getHost())) return null;
                return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r) { return true; }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(fileCallback!=null) fileCallback.onReceiveValue(null);
                fileCallback=callback; picker=true;
                try { Intent intent=new Intent(Intent.ACTION_GET_CONTENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE); startActivityForResult(intent,101); }
                catch(Exception e) { picker=false; fileCallback.onReceiveValue(null); fileCallback=null; return false; }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(),"Android");
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }
    public final class Bridge {
            @JavascriptInterface public void openApkDownload() {
                runOnUiThread(()-> {
                    Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse("https://github.com/dronecuiaba/passinho/releases/latest/download/Passinho.apk"));
                    try { startActivity(intent); } catch(Exception e) { Toast.makeText(MainActivity.this,"Abra o site do Passinho no navegador para baixar o APK.",Toast.LENGTH_LONG).show(); }
                });
            }
            @JavascriptInterface public void copyText(String text) {
                if(text==null || text.length()>10000)return;
                runOnUiThread(()->((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Passinho",text)));
            }
            @JavascriptInterface public void saveBackup(String json) {
                if(json==null || json.length()>20_000_000) return;
                try { if(new JSONObject(json).getInt("schema")!=2) return; } catch(Exception ex) { return; }
                runOnUiThread(()-> {
                    pendingBackup=json; picker=true;
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"passinho-backup-"+java.time.LocalDate.now()+".json");
                    try { startActivityForResult(intent,102); } catch(Exception e) { pendingBackup=null; picker=false; Toast.makeText(MainActivity.this,"Não foi possível abrir o seletor de arquivos.",Toast.LENGTH_LONG).show(); }
                });
            }
            @JavascriptInterface public String request(String json) { return engine.request(json); }
            @JavascriptInterface public void exportBackup(String token) {
                JSONObject r=new JSONObject(engine.request(new JSONObject().put("op","backup").put("token",token).toString()));
                if(!r.optBoolean("ok")) return;
                runOnUiThread(()-> {
                    pendingBackup=r.getString("backup"); picker=true;
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"passinho-backup-"+java.time.LocalDate.now()+".json");
                    try { startActivityForResult(intent,102); } catch(Exception e) { pendingBackup=null; picker=false; Toast.makeText(MainActivity.this,"Não foi possível abrir o seletor de arquivos.",Toast.LENGTH_LONG).show(); }
                });
            }
    }
    @Override protected void onPause() {
        super.onPause();
        if(engine!=null&&!picker) { engine.lock(); if(web!=null) web.evaluateJavascript("window.lockFromNative && window.lockFromNative()",null); }
    }
    @Override protected void onActivityResult(int req,int result,Intent data) {
        super.onActivityResult(req,result,data);
        if(req==101 && fileCallback!=null) { fileCallback.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null); fileCallback=null; }
        if(req==102 && pendingBackup!=null) {
            if(result==RESULT_OK && data!=null) {
                try(OutputStream out=getContentResolver().openOutputStream(data.getData(),"wt")) {
                    if(out==null) throw new IOException(); out.write(pendingBackup.getBytes(StandardCharsets.UTF_8));
                    Toast.makeText(this,"Backup salvo.",Toast.LENGTH_LONG).show();
                } catch(Exception e) { Toast.makeText(this,"Não foi possível salvar o backup.",Toast.LENGTH_LONG).show(); }
            }
            pendingBackup=null;
        }
        picker=false;
    }
    private void navigateBack() { if(web!=null) web.evaluateJavascript("window.handleBack ? window.handleBack() : true",value->{if("true".equals(value))finish();}); else finish(); }
    @Override public void onBackPressed() { navigateBack(); }
    @Override protected void onDestroy() { if(engine!=null) engine.lock(); if(web!=null) { web.removeJavascriptInterface("Android"); web.destroy(); } super.onDestroy(); }
}
