package br.com.rotina;

import com.github.openjson.*;
import java.time.*;
import java.util.*;
import java.security.*;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** The same offline domain engine runs on Android and in the desktop QA server. */
public final class Engine {
    public interface Store { String read() throws Exception; void write(String value) throws Exception; }
    private final Store store;
    private final Clock clock;
    private JSONObject db;
    private String session = "", actor = "";
    private long lastActivity, blockedUntil;
    private int failures;
    public Engine(Store store, Clock clock) throws Exception {
        this.store = store; this.clock = clock;
        String raw = store.read();
        db = raw == null || raw.isEmpty() ? new JSONObject("{\"schema\":1,\"children\":[],\"tasks\":[],\"guardians\":[],\"days\":{},\"audit\":[]}") : new JSONObject(raw);
    }
    private LocalDate today() { return LocalDate.now(clock); }
    private String id() { return UUID.randomUUID().toString(); }
    private JSONArray rows(String key) { return db.getJSONArray(key); }
    private JSONObject find(String key, String id) {
        JSONArray arr = rows(key);
        for (int i=0;i<arr.length();i++) if (arr.getJSONObject(i).getString("id").equals(id)) return arr.getJSONObject(i);
        throw new IllegalArgumentException("Cadastro não encontrado.");
    }
    private boolean authorized(String token) {
        return !session.isEmpty() && MessageDigest.isEqual(session.getBytes(java.nio.charset.StandardCharsets.UTF_8), token.getBytes(java.nio.charset.StandardCharsets.UTF_8)) && clock.millis()-lastActivity < 300_000;
    }
    private void requireAdmin(JSONObject a) {
        if (!authorized(a.optString("token"))) throw new SecurityException("Entre novamente na área dos responsáveis.");
        lastActivity=clock.millis();
    }
    public synchronized void lock() { session=""; actor=""; }
    public synchronized String request(String raw) {
        String previous = db.toString();
        try {
            JSONObject a = new JSONObject(raw);
            LocalDate.parse(a.optString("date",today().toString()));
            YearMonth.parse(a.optString("month",YearMonth.from(today()).toString()));
            String op = a.optString("op", "get");
            boolean admin = authorized(a.optString("token"));
            if(admin && a.optBoolean("activity")) lastActivity=clock.millis();
            String message="";
            JSONObject result = new JSONObject();
            if (op.equals("setup")) {
                if (rows("guardians").length()!=0) throw new SecurityException("A família já foi configurada. Entre com sua senha.");
                JSONObject g = guardian(a, null); rows("guardians").put(g); startSession(g.getString("id"));
                result.put("token",session); message="Família configurada. Agora cadastre as crianças.";
            } else if (op.equals("login")) {
                if(clock.millis()<blockedUntil) throw new SecurityException("Muitas tentativas. Aguarde 30 segundos.");
                JSONObject g = find("guardians",a.getString("guardianId"));
                byte[] expected = Base64.getDecoder().decode(g.getString("hash"));
                byte[] actual = hash(a.getString("password"), Base64.getDecoder().decode(g.getString("salt")));
                if(!MessageDigest.isEqual(expected,actual)) {
                    failures++;
                    if(failures>=5) { blockedUntil=clock.millis()+30_000; failures=0; }
                    throw new SecurityException("Senha incorreta.");
                }
                failures=0; startSession(g.getString("id")); result.put("token",session); message="Área dos responsáveis desbloqueada.";
            } else if (op.equals("logout")) { lock(); }
            else if (op.equals("childCheck")) {
                LocalDate date = LocalDate.parse(a.getString("date"));
                if (!date.equals(today())) throw new SecurityException("Só é possível marcar as tarefas de hoje.");
                String cid=a.getString("childId"), tid=a.getString("taskId");
                find("children",cid);
                if (isClosed(cid,date)) throw new SecurityException("O dia já foi fechado pelo responsável.");
                if (occurrences(cid,date).stream().noneMatch(t->t.getString("id").equals(tid))) throw new IllegalArgumentException("Essa tarefa não está na agenda de hoje.");
                JSONObject checks=day(cid,date,true).getJSONObject("checks");
                JSONObject existing=checks.optJSONObject(tid);
                if(existing!=null && existing.optBoolean("reviewed")) throw new SecurityException("Essa tarefa foi avaliada pelo responsável. Peça a ele para alterar.");
                checks.put(tid,new JSONObject().put("status",a.getBoolean("done")?"done":"pending").put("reviewed",false));
                message=a.getBoolean("done")?"Tarefa marcada. Um passo a mais!":"Marcação desfeita.";
            } else if (!op.equals("get")) {
                requireAdmin(a);
                switch(op) {
                    case "saveChild": {
                        String cid=a.optString("id");
                        JSONObject c;
                        if(cid.isEmpty()) { c=new JSONObject().put("id",id()).put("createdOn",today().toString()).put("allowances",new JSONObject()); rows("children").put(c); }
                        else c=find("children",cid);
                        c.put("name",text(a,"name",40)); c.put("avatar",Math.floorMod(a.optInt("avatar",0),8));
                        long amount=a.getLong("amount");
                        if(amount<0 || amount>100_000_000) throw new IllegalArgumentException("Informe uma mesada entre R$ 0 e R$ 1.000.000.");
                        c.getJSONObject("allowances").put(YearMonth.from(today()).toString(),amount);
                        a.put("childId",c.getString("id")); message="Criança salva. A mesada vale para este mês e os próximos.";
                        audit("Cadastro e mesada de "+c.getString("name")); break;
                    }
                    case "saveTask": {
                        String cid=a.getString("childId"); find("children",cid);
                        String tid=a.optString("id"); JSONObject t;
                        JSONArray days=a.getJSONArray("weekdays");
                        if(days.length()==0 || days.length()>7) throw new IllegalArgumentException("Escolha pelo menos um dia da semana.");
                        Set<Integer> unique=new HashSet<>();
                        for(int i=0;i<days.length();i++) if(days.getInt(i)<0 || days.getInt(i)>6 || !unique.add(days.getInt(i))) throw new IllegalArgumentException("Dias da semana inválidos.");
                        if(tid.isEmpty()) { t=new JSONObject().put("id",id()).put("childId",cid).put("versions",new JSONArray()); rows("tasks").put(t); }
                        else { t=find("tasks",tid); if(!t.getString("childId").equals(cid)) throw new IllegalArgumentException("Criança incorreta."); }
                        LocalDate from=isClosed(cid,today())?today().plusDays(1):today();
                        JSONArray versions=t.getJSONArray("versions");
                        for(int i=versions.length()-1;i>=0;i--) if(!LocalDate.parse(versions.getJSONObject(i).getString("from")).isBefore(from)) versions.remove(i);
                        versions.put(new JSONObject().put("from",from.toString()).put("title",text(a,"title",100)).put("weekdays",days).put("icon",Math.floorMod(a.optInt("icon",0),8)).put("active",a.optBoolean("active",true)));
                        message="Agenda salva a partir de "+(from.equals(today())?"hoje.":"amanhã, pois o dia já está fechado."); audit("Alteração na agenda de "+find("children",cid).getString("name")); break;
                    }
                    case "review": {
                        LocalDate date=allowedDate(a);
                        String cid=a.getString("childId"), tid=a.getString("taskId"), status=a.getString("status");
                        if(!Arrays.asList("pending","failed","done").contains(status)) throw new IllegalArgumentException("Status inválido.");
                        if(occurrences(cid,date).stream().noneMatch(t->t.getString("id").equals(tid))) throw new IllegalArgumentException("Tarefa fora da agenda.");
                        day(cid,date,true).getJSONObject("checks").put(tid,new JSONObject().put("status",status).put("reviewed",!status.equals("pending")).put("by",actor));
                        audit("Revisão de tarefa em "+date+" · "+find("children",cid).getString("name")); message="Avaliação salva. O saldo foi recalculado."; break;
                    }
                    case "closeDay": {
                        LocalDate date=allowedDate(a); String cid=a.getString("childId"); find("children",cid);
                        JSONObject d=day(cid,date,true); d.put("closed",true).put("closedBy",actor);
                        JSONObject checks=d.getJSONObject("checks");
                        for(JSONObject t:occurrences(cid,date)) {
                            JSONObject c=checks.optJSONObject(t.getString("id"));
                            if(c==null || c.optString("status").equals("pending")) c=new JSONObject().put("status","failed");
                            c.put("reviewed",true).put("by",actor); checks.put(t.getString("id"),c);
                        }
                        audit("Fechamento de "+date+" · "+find("children",cid).getString("name")); message="Dia validado e fechado."; break;
                    }
                    case "saveGuardian": {
                        String gid=a.optString("id"); JSONObject old=gid.isEmpty()?null:find("guardians",gid);
                        JSONObject g=guardian(a,old);
                        if(old==null) rows("guardians").put(g);
                        audit("Cadastro de responsável: "+g.getString("name")); message="Responsável salvo."; break;
                    }
                    case "deleteGuardian": {
                        String gid=a.getString("id");
                        if(rows("guardians").length()<2 || gid.equals(actor)) throw new IllegalArgumentException("Mantenha ao menos um responsável. Você não pode excluir seu próprio acesso.");
                        JSONArray gs=rows("guardians"); for(int i=0;i<gs.length();i++) if(gs.getJSONObject(i).getString("id").equals(gid)) gs.remove(i);
                        audit("Exclusão de responsável"); message="Responsável removido."; break;
                    }
                    case "backup": result.put("backup",db.toString()); break;
                    case "restore": {
                        JSONObject incoming=new JSONObject(a.getString("backup")); validateBackup(incoming);
                        db=incoming; audit("Backup restaurado"); lock(); message="Backup restaurado. Entre com a senha de um responsável do backup."; break;
                    }
                    default: throw new IllegalArgumentException("Ação desconhecida.");
                }
            }
            admin=authorized(a.optString("token")) || result.has("token");
            result.put("ok",true).put("message",message).put("state",snapshot(a,admin));
            if(!previous.equals(db.toString())) store.write(db.toString());
            return result.toString();
        } catch(Exception e) {
            db=new JSONObject(previous);
            return new JSONObject().put("ok",false).put("error",e.getMessage()==null?"Não foi possível salvar. Tente novamente.":e.getMessage()).toString();
        }
    }
    private String text(JSONObject a,String key,int max) {
        String s=a.getString(key).trim();
        if(s.isEmpty() || s.length()>max) throw new IllegalArgumentException("Preencha o nome com até "+max+" caracteres.");
        return s;
    }
    private JSONObject guardian(JSONObject a,JSONObject old) throws Exception {
        JSONObject g=old==null?new JSONObject().put("id",id()):old;
        g.put("name",text(a,"name",40));
        String password=a.optString("password");
        if(old==null || !password.isEmpty()) {
            if(password.length()<6 || password.length()>128) throw new IllegalArgumentException("Use uma senha com 6 a 128 caracteres.");
            byte[] salt=new byte[24]; new SecureRandom().nextBytes(salt);
            g.put("salt",Base64.getEncoder().encodeToString(salt)).put("hash",Base64.getEncoder().encodeToString(hash(password,salt)));
        }
        return g;
    }
    private byte[] hash(String password,byte[] salt) throws Exception {
        PBEKeySpec spec=new PBEKeySpec(password.toCharArray(),salt,180_000,256);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); } finally { spec.clearPassword(); }
    }
    private void startSession(String gid) { session=id()+id(); actor=gid; lastActivity=clock.millis(); }
    private LocalDate allowedDate(JSONObject a) {
        LocalDate date=LocalDate.parse(a.getString("date"));
        if(date.isAfter(today())) throw new IllegalArgumentException("Não é possível avaliar dias futuros.");
        JSONObject child=find("children",a.getString("childId"));
        if(date.isBefore(LocalDate.parse(child.getString("createdOn")))) throw new IllegalArgumentException("Data anterior ao cadastro da criança.");
        return date;
    }
    private void audit(String message) {
        JSONArray log=rows("audit");
        log.put(new JSONObject().put("at",Instant.now(clock).toString()).put("actor",actor).put("message",message));
        while(log.length()>500) log.remove(0);
    }
    private JSONObject version(JSONObject task,LocalDate date) {
        JSONObject v=null; JSONArray vs=task.getJSONArray("versions");
        for(int i=0;i<vs.length();i++) if(!LocalDate.parse(vs.getJSONObject(i).getString("from")).isAfter(date)) v=vs.getJSONObject(i);
        return v;
    }
    private List<JSONObject> occurrences(String cid,LocalDate date) {
        List<JSONObject> result=new ArrayList<>();
        JSONObject child=find("children",cid);
        if(date.isBefore(LocalDate.parse(child.getString("createdOn")))) return result;
        int wd=date.getDayOfWeek().getValue()%7;
        JSONArray tasks=rows("tasks");
        for(int i=0;i<tasks.length();i++) {
            JSONObject t=tasks.getJSONObject(i);
            if(!t.getString("childId").equals(cid)) continue;
            JSONObject v=version(t,date);
            if(v==null || !v.getBoolean("active")) continue;
            JSONArray days=v.getJSONArray("weekdays");
            for(int j=0;j<days.length();j++) if(days.getInt(j)==wd) { result.add(new JSONObject(v.toString()).put("id",t.getString("id"))); break; }
        }
        return result;
    }
    private JSONObject day(String cid,LocalDate date,boolean create) {
        JSONObject all=db.getJSONObject("days"); String key=cid+"|"+date;
        JSONObject d=all.optJSONObject(key);
        if(d==null) { d=new JSONObject().put("closed",false).put("checks",new JSONObject()); if(create) all.put(key,d); }
        return d;
    }
    private boolean isClosed(String cid,LocalDate date) { return date.isBefore(today()) || day(cid,date,false).optBoolean("closed"); }
    private JSONObject dayView(String cid,LocalDate date) {
        JSONObject d=day(cid,date,false), checks=d.getJSONObject("checks"); boolean closed=isClosed(cid,date);
        JSONArray tasks=new JSONArray(); int done=0,failed=0;
        for(JSONObject t:occurrences(cid,date)) {
            JSONObject c=checks.optJSONObject(t.getString("id"));
            String status=c==null?"pending":c.getString("status");
            if(closed && status.equals("pending")) status="failed";
            if(status.equals("done")) done++;
            if(status.equals("failed")) failed++;
            tasks.put(new JSONObject().put("id",t.getString("id")).put("title",t.getString("title")).put("icon",t.getInt("icon")).put("status",status).put("reviewed",c!=null&&c.optBoolean("reviewed")));
        }
        return new JSONObject().put("date",date.toString()).put("closed",closed).put("closureSource",d.optBoolean("closed")?"guardian":closed?"automatic":"open").put("tasks",tasks).put("total",tasks.length()).put("done",done).put("failed",failed);
    }
    private long allowance(JSONObject child,YearMonth month) {
        JSONObject values=child.getJSONObject("allowances"); String latest=""; long amount=0;
        Iterator<String> keys=values.keys();
        while(keys.hasNext()) { String key=keys.next(); if(key.compareTo(month.toString())<=0 && key.compareTo(latest)>0) { latest=key; amount=values.getLong(key); } }
        return amount;
    }
    private JSONObject summary(JSONObject child,YearMonth month) {
        int total=0,missed=0,completed=0; String cid=child.getString("id");
        for(int i=1;i<=month.lengthOfMonth();i++) {
            JSONObject d=dayView(cid,month.atDay(i)); total+=d.getInt("total");
            if(d.getBoolean("closed")) { missed+=d.getInt("total")-d.getInt("done"); completed+=d.getInt("done"); }
        }
        long amount=allowance(child,month);
        // Round only the aggregate: missing every occurrence always deducts exactly the allowance.
        long deducted=total==0?0:Math.min(amount,(amount*missed+total/2)/total);
        return new JSONObject().put("id",cid).put("name",child.getString("name")).put("avatar",child.getInt("avatar")).put("createdOn",child.getString("createdOn")).put("amount",amount).put("deducted",deducted).put("balance",amount-deducted).put("occurrences",total).put("missed",missed).put("completed",completed);
    }
    private JSONObject snapshot(JSONObject a,boolean admin) {
        LocalDate selected=LocalDate.parse(a.optString("date",today().toString()));
        YearMonth month=YearMonth.parse(a.optString("month",YearMonth.from(selected).toString()));
        JSONArray children=new JSONArray(),guardians=new JSONArray(),templates=new JSONArray(),calendar=new JSONArray();
        JSONObject selectedChild=null; String cid=a.optString("childId");
        for(int i=0;i<rows("children").length();i++) {
            JSONObject c=rows("children").getJSONObject(i),s=summary(c,month); children.put(s);
            if(c.getString("id").equals(cid)) selectedChild=s;
        }
        if(selectedChild==null && children.length()>0) selectedChild=children.getJSONObject(0);
        for(int i=0;i<rows("guardians").length();i++) { JSONObject g=rows("guardians").getJSONObject(i); guardians.put(new JSONObject().put("id",g.getString("id")).put("name",g.getString("name"))); }
        JSONObject result=new JSONObject().put("today",today().toString()).put("date",selected.toString()).put("month",month.toString()).put("children",children).put("guardians",guardians).put("authenticated",admin).put("actor",admin?actor:"").put("setup",guardians.length()==0);
        if(selectedChild!=null) {
            cid=selectedChild.getString("id"); result.put("child",selectedChild).put("day",dayView(cid,selected));
            if(admin) {
                for(int i=1;i<=month.lengthOfMonth();i++) calendar.put(dayView(cid,month.atDay(i)));
                for(int i=0;i<rows("tasks").length();i++) {
                    JSONObject t=rows("tasks").getJSONObject(i);
                    if(t.getString("childId").equals(cid)) {
                        JSONObject v=version(t,today().plusDays(1));
                        if(v!=null) templates.put(new JSONObject(v.toString()).put("id",t.getString("id")));
                    }
                }
            }
        }
        if(admin) result.put("calendar",calendar).put("templates",templates).put("audit",rows("audit"));
        return result;
    }
    private void validateBackup(JSONObject data) {
        if(data.getInt("schema")!=1 || data.getJSONArray("guardians").length()<1) throw new IllegalArgumentException("Backup incompatível.");
        Engine.Store none=new Store(){ public String read(){return data.toString();} public void write(String value){} };
        try {
            Engine candidate=new Engine(none,clock);
            Set<String> ids=new HashSet<>();
            for(int i=0;i<data.getJSONArray("guardians").length();i++) {
                JSONObject g=data.getJSONArray("guardians").getJSONObject(i);
                if(!ids.add(g.getString("id")) || g.getString("name").trim().isEmpty() || Base64.getDecoder().decode(g.getString("salt")).length!=24 || Base64.getDecoder().decode(g.getString("hash")).length!=32) throw new IllegalArgumentException();
            }
            ids.clear();
            for(int i=0;i<data.getJSONArray("children").length();i++) {
                JSONObject c=data.getJSONArray("children").getJSONObject(i);
                if(!ids.add(c.getString("id")) || LocalDate.parse(c.getString("createdOn")).isAfter(today()) || c.getString("name").trim().isEmpty() || c.getInt("avatar")<0 || c.getInt("avatar")>7) throw new IllegalArgumentException();
                JSONObject values=c.getJSONObject("allowances"); Iterator<String> keys=values.keys();
                while(keys.hasNext()) { String key=keys.next(); YearMonth.parse(key); if(values.getLong(key)<0 || values.getLong(key)>100_000_000) throw new IllegalArgumentException(); }
            }
            for(int i=0;i<data.getJSONArray("tasks").length();i++) {
                JSONObject t=data.getJSONArray("tasks").getJSONObject(i); if(!ids.contains(t.getString("childId"))) throw new IllegalArgumentException();
                JSONArray vs=t.getJSONArray("versions"); String previous="";
                for(int j=0;j<vs.length();j++) {
                    JSONObject v=vs.getJSONObject(j); String from=v.getString("from"); LocalDate.parse(from);
                    if(from.compareTo(previous)<=0 || v.getString("title").trim().isEmpty()) throw new IllegalArgumentException(); previous=from;
                    v.getBoolean("active"); v.getInt("icon"); JSONArray ds=v.getJSONArray("weekdays"); Set<Integer> days=new HashSet<>();
                    if(ds.length()==0) throw new IllegalArgumentException();
                    for(int k=0;k<ds.length();k++) if(ds.getInt(k)<0||ds.getInt(k)>6||!days.add(ds.getInt(k))) throw new IllegalArgumentException();
                }
            }
            JSONObject days=data.getJSONObject("days"); Iterator<String> keys=days.keys();
            while(keys.hasNext()) { String key=keys.next(); int sep=key.lastIndexOf('|'); if(sep<0||!ids.contains(key.substring(0,sep))) throw new IllegalArgumentException(); LocalDate.parse(key.substring(sep+1)); JSONObject checks=days.getJSONObject(key).getJSONObject("checks"); Iterator<String> ts=checks.keys(); while(ts.hasNext()) if(!Arrays.asList("pending","done","failed").contains(checks.getJSONObject(ts.next()).getString("status"))) throw new IllegalArgumentException(); }
            data.getJSONArray("audit"); candidate.snapshot(new JSONObject(),true);
        } catch(Exception e) { throw new IllegalArgumentException("Backup inválido ou danificado. Os dados atuais foram mantidos."); }
    }
}
