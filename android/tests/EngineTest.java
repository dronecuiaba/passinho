import br.com.rotina.Engine;
import com.github.openjson.*;
import java.time.*;

public final class EngineTest {
    static int checks=0;
    static class Time extends Clock {
        Instant instant; final ZoneId zone=ZoneId.of("America/Sao_Paulo");
        Time(String date){set(date);}
        void set(String date){instant=LocalDate.parse(date).atTime(12,0).atZone(zone).toInstant();}
        public ZoneId getZone(){return zone;} public Clock withZone(ZoneId z){return this;} public Instant instant(){return instant;}
    }
    static class Memory implements Engine.Store {
        String value; boolean fail;
        public String read(){return value;} public void write(String v)throws Exception{if(fail)throw new java.io.IOException("Falha simulada ao salvar");value=v;}
    }
    static class Family {
        Time clock; Memory store=new Memory(); Engine engine; String token,cid,tid;
        Family(String date)throws Exception{clock=new Time(date);engine=new Engine(store,clock);JSONObject r=ok("setup","name","Mãe","password","senha-teste");token=r.getString("token");}
        JSONObject raw(String op,Object... kv){JSONObject a=new JSONObject().put("op",op);if(token!=null)a.put("token",token);if(cid!=null)a.put("childId",cid);for(int i=0;i<kv.length;i+=2)a.put(kv[i].toString(),kv[i+1]);return new JSONObject(engine.request(a.toString()));}
        JSONObject ok(String op,Object... kv){JSONObject r=raw(op,kv);assertThat(r.optBoolean("ok"),op+" should succeed: "+r);return r;}
        JSONObject state(Object...kv){return ok("get",kv).getJSONObject("state");}
        JSONObject child(){return state().getJSONObject("child");}
        void child(String name,long amount){JSONObject s=ok("saveChild","name",name,"amount",amount).getJSONObject("state");cid=s.getJSONObject("child").getString("id");}
        String task(String title,int... days){JSONArray ds=new JSONArray();for(int d:days)ds.put(d);JSONObject s=ok("saveTask","title",title,"weekdays",ds).getJSONObject("state");JSONArray ts=s.getJSONArray("templates");tid=ts.getJSONObject(ts.length()-1).getString("id");return tid;}
        void mark(String task,boolean done){ok("childCheck","date",LocalDate.now(clock).toString(),"taskId",task,"done",done);}
        void review(String task,String date,String status){ok("review","date",date,"taskId",task,"status",status);}
        void login(){String gid=state().getJSONArray("guardians").getJSONObject(0).getString("id");token=ok("login","guardianId",gid,"password","senha-teste").getString("token");}
    }
    static void assertThat(boolean condition,String message){checks++;if(!condition)throw new AssertionError(message);}
    static void eq(long actual,long expected,String message){assertThat(actual==expected,message+": "+actual+" != "+expected);}
    static void no(JSONObject r,String message){assertThat(!r.getBoolean("ok"),message);}
    public static void main(String[] args)throws Exception{
        Family f=new Family("2026-11-01");
        no(f.raw("setup","name","Outra","password","123456"),"setup cannot overwrite existing family");
        f.child("Lia",30000);String bed=f.task("Arrumar a cama",0,1,2,3,4,5,6);
        eq(f.child().getInt("occurrences"),30,"30 daily occurrences in November");
        eq(f.child().getLong("balance"),30000,"future tasks do not deduct");
        f.review(bed,"2026-11-01","failed");
        eq(f.child().getLong("deducted"),0,"open-day failures are provisional");
        no(f.raw("childCheck","date","2026-11-01","taskId",bed,"done",true),"child cannot override guardian");
        f.review(bed,"2026-11-01","pending");f.mark(bed,true);
        String teeth=f.task("Escovar os dentes",0,1,2,3,4,5,6);
        f.clock.set("2026-11-02");
        JSONObject closed=f.state("date","2026-11-01").getJSONObject("day");
        assertThat(closed.getBoolean("closed"),"date closes without any manual validation");
        eq(closed.getInt("done"),1,"child's completed check survives auto close");
        eq(closed.getInt("failed"),1,"unmarked task auto becomes failed");
        eq(f.child().getLong("deducted"),500,"one missed of sixty = 500 cents");
        no(f.raw("childCheck","date","2026-11-01","taskId",teeth,"done",true),"child cannot edit past");
        f.login();f.review(teeth,"2026-11-01","done");eq(f.child().getLong("deducted"),0,"past correction refunds discount");
        f.review(teeth,"2026-11-01","failed");
        f.ok("saveChild","id",f.cid,"name","Lia","amount",60000);eq(f.child().getLong("deducted"),1000,"new allowance recalculates current month");
        f.ok("saveTask","id",teeth,"title","Dentes","weekdays",new JSONArray("[1,2,3,4,5]"),"icon",1);
        eq(f.state("date","2026-11-01").getJSONObject("day").getInt("total"),2,"schedule edit preserves past occurrences");
        assertThat(f.state("date","2026-11-01").getJSONObject("day").getJSONArray("tasks").getJSONObject(1).getString("title").equals("Escovar os dentes"),"historical task title preserved");
        f.ok("closeDay","date","2026-11-02");
        no(f.raw("childCheck","date","2026-11-02","taskId",bed,"done",true),"manual closure blocks child");
        f.ok("saveTask","title","Guardar brinquedos","weekdays",new JSONArray("[0,1,2,3,4,5,6]"));
        eq(f.state("date","2026-11-02").getJSONObject("day").getInt("total"),2,"new task starts tomorrow if today is closed");
        eq(f.state("date","2026-11-03").getJSONObject("day").getInt("total"),3,"new task appears tomorrow");
        no(f.raw("review","date","2026-11-03","taskId",bed,"status","done"),"future review rejected");
        no(f.raw("closeDay","date","2026-11-03"),"future closing rejected");
        String saved=f.store.value;f.engine=new Engine(f.store,f.clock);f.token="";
        no(f.raw("saveChild","name","Invasor","amount",0),"admin mutation requires native session");
        JSONObject pub=f.state();assertThat(!pub.has("templates")&&!pub.has("audit")&&!pub.toString().contains("hash")&&!pub.toString().contains("senha-teste"),"public snapshot contains no password material");
        assertThat(!saved.contains("senha-teste"),"password never stored in plaintext");
        eq(pub.getJSONObject("day").getInt("total"),2,"data survives process restart");
        f.login();
        JSONObject oldNovember=f.child();f.clock.set("2026-12-01");f.login();
        f.ok("saveChild","id",f.cid,"name","Lia","amount",10000);
        eq(f.state("month","2026-11").getJSONObject("child").getLong("amount"),60000,"previous month allowance is immutable");
        eq(f.state("month","2027-01").getJSONObject("child").getLong("amount"),10000,"allowance carries forward to future months");
        String backup=f.ok("backup").getString("backup");
        no(f.raw("restore","backup","{\"schema\":2}"),"corrupted backup rejected");
        eq(f.child().getLong("amount"),10000,"failed import preserves current data");
        f.ok("restore","backup",backup);assertThat(!f.state().getBoolean("authenticated"),"restore locks guardian area");
        f.login();f.store.fail=true;no(f.raw("saveChild","name","Não salvar","amount",50),"write failure visible to UI");f.store.fail=false;eq(f.state().getJSONArray("children").length(),1,"write failure rolls back in-memory data");

        Family rounding=new Family("2026-11-01");rounding.child("Rui",10000);String task=rounding.task("Tarefa",0,1,2,3,4,5,6);
        rounding.clock.set("2026-11-02");eq(rounding.child().getLong("deducted"),333,"one third-cent rounds once");
        rounding.clock.set("2026-11-03");eq(rounding.child().getLong("deducted"),667,"two occurrences aggregate before rounding");
        rounding.clock.set("2026-12-01");eq(rounding.state("month","2026-11").getJSONObject("child").getLong("deducted"),10000,"all missed occurrences deduct exactly full allowance");
        Family empty=new Family("2026-11-15");empty.child("Sem tarefas",12345);empty.clock.set("2026-12-01");eq(empty.state("month","2026-11").getJSONObject("child").getLong("balance"),12345,"no tasks means no division by zero and no discount");
        Family leap=new Family("2028-02-01");leap.child("Bia",29000);leap.task("Diária",0,1,2,3,4,5,6);eq(leap.child().getInt("occurrences"),29,"leap February has 29 occurrences");
        Family partial=new Family("2026-11-15");partial.child("Meio do mês",16000);partial.task("Diária",0,1,2,3,4,5,6);eq(partial.child().getInt("occurrences"),16,"no penalties before creation");
        partial.clock.set("2026-11-16");eq(partial.child().getLong("deducted"),1000,"partial month uses remaining scheduled occurrences");
        Family weekly=new Family("2026-11-01");weekly.child("Semanal",10000);weekly.task("Dias úteis",1,2,3,4,5);long count=LocalDate.of(2026,11,1).datesUntil(LocalDate.of(2026,12,1)).filter(d->d.getDayOfWeek().getValue()<=5).count();eq(weekly.child().getInt("occurrences"),count,"weekdays counted correctly");
        Family security=new Family("2026-11-01");String gid=security.state().getJSONArray("guardians").getJSONObject(0).getString("id");
        for(int i=0;i<5;i++)no(security.raw("login","guardianId",gid,"password","incorreta"),"wrong password rejected");
        no(security.raw("login","guardianId",gid,"password","senha-teste"),"brute-force cooldown enforced");
        security.clock.instant=security.clock.instant.plusSeconds(31);security.login();
        security.clock.instant=security.clock.instant.plusSeconds(301);no(security.raw("saveGuardian","name","Extra","password","123456"),"idle session expires");
        System.out.println("PASS: "+checks+" assertions. Accounting, closure, schedule history, authentication, backup and persistence verified.");
    }
}
