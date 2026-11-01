import br.com.rotina.Engine;
import com.sun.net.httpserver.*;
import java.net.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.concurrent.Executors;

/** Loopback-only desktop preview, using exactly the Android domain engine. */
public class Preview {
    public static void main(String[] args) throws Exception {
        Path root=Path.of("app/src/main/assets").toAbsolutePath();
        Path data=Path.of("build/preview-family.json").toAbsolutePath();
        Files.createDirectories(data.getParent());
        Engine engine=new Engine(new Engine.Store(){
            public String read() throws Exception{return Files.exists(data)?Files.readString(data):null;}
            public void write(String v) throws Exception{Path tmp=data.resolveSibling("preview-family.tmp");Files.writeString(tmp,v);Files.move(tmp,data,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);}
        },Clock.systemDefaultZone());
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",4173),0);
        server.createContext("/api",x->{
            if(!x.getRequestMethod().equals("POST")){x.sendResponseHeaders(405,-1);x.close();return;}
            String origin=x.getRequestHeaders().getFirst("Origin");
            if(origin!=null&&!origin.equals("http://127.0.0.1:4173")){x.sendResponseHeaders(403,-1);x.close();return;}
            byte[] raw=x.getRequestBody().readNBytes(5_100_001);
            if(raw.length>5_100_000){x.sendResponseHeaders(413,-1);x.close();return;}
            byte[] response=engine.request(new String(raw,StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
            x.getResponseHeaders().set("Content-Type","application/json; charset=utf-8");x.getResponseHeaders().set("Cache-Control","no-store");
            x.sendResponseHeaders(200,response.length);x.getResponseBody().write(response);x.close();
        });
        server.createContext("/",x->{
            String uri=x.getRequestURI().getPath();Path file=root.resolve(uri.equals("/")?"index.html":uri.substring(1)).normalize();
            if(!file.startsWith(root)||!Files.isRegularFile(file)){x.sendResponseHeaders(404,-1);x.close();return;}
            byte[] bytes=Files.readAllBytes(file);String ext=file.toString();
            x.getResponseHeaders().set("Content-Type",ext.endsWith(".html")?"text/html; charset=utf-8":ext.endsWith(".js")?"text/javascript; charset=utf-8":"text/css; charset=utf-8");
            x.getResponseHeaders().set("Cache-Control","no-store");x.sendResponseHeaders(200,bytes.length);x.getResponseBody().write(bytes);x.close();
        });
        server.setExecutor(Executors.newFixedThreadPool(4));server.start();System.out.println("Preview: http://127.0.0.1:4173");
    }
}
