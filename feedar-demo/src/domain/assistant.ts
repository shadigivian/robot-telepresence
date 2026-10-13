import type { AssistantAnswer, Database } from './models';
const normalize=(text:string)=>text.toLowerCase().normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[^\p{L}\p{N}\s]/gu,' ');
export function answerFromKnowledge(db:Database,organizationId:string,question:string,language:'en'|'fa'|'tr'='en'):AssistantAnswer{
    const org=db.organizations.find(o=>o.id===organizationId&&o.status==='active');
    if(!org)throw new Error('This organization’s public assistant is unavailable.');
    if(!question.trim()||question.length>2000)throw new Error('Enter a question up to 2,000 characters.');
    const q=normalize(question);
    const points=db.points.filter(p=>p.organizationId===org.id);
    const aliases:Record<string,string[]>={'Reception':['reception','پذیرش','resepsiyon'],'Radiology':['radiology','رادیولوژی','radyoloji'],'Help Desk':['help desk','راهنما','yardım'],'Elevator':['elevator','آسانسور','asansör'],'Charging Dock':['charging','شارژ','şarj']};
    const point=points.find(p=>[p.name,...(aliases[p.name]??[])].some(alias=>q.includes(normalize(alias))));
    if(/navigate|take me|ببر|هدایت|götür/.test(q)&&point)return{text:language==='fa'?'درخواست مسیر نمایشی برای تأیید اپراتور آماده است. حرکت واقعی انجام نمی‌شود.':language==='tr'?'Gösterim rotası operatör onayına hazır. Gerçek robot hareketi yapılmaz.':'A demonstration navigation request is ready for operator approval. This route does not control physical hardware.',references:[point.name],tool:'request_navigation',pointId:point.id};
    if(/video|call|تماس|ویدیو|arama|görüntülü/.test(q))return{text:'Demo assistant: I can create a simulated human video-help request. No remote participant is connected.',references:['Human help and contact'],tool:'start_video_call'};
    if(/ticket|support|پشتیبانی|destek/.test(q))return{text:'Demo assistant: I can create a local support ticket for this organization. It stays in this browser.',references:['Human help and contact'],tool:'create_support_ticket'};
    if(/notify|admin|اطلاع|مدیر|bildir/.test(q))return{text:'Demo assistant: I can add a same-browser notification for this organization’s administrators.',references:['Human help and contact'],tool:'notify_admin'};
    if(/robot status|battery|باتری|وضعیت ربات|pil/.test(q)){const robot=db.robots.find(r=>r.organizationId===org.id&&r.pairing==='paired'&&r.status==='active');return{text:robot?`Demo telemetry: ${robot.name} is ${robot.connectivity}, battery ${robot.battery}%, mode ${robot.mode}. These measurements are simulated.`:'No paired public demo robot is available.',references:['Simulated robot telemetry'],tool:'check_robot_status'};}
    if(point)return{text:language==='fa'?`${point.name} در نقشه نمایشی مشخص شده است. مقیاس و مکان‌یابی واقعی اعتبارسنجی نشده‌اند.`:language==='tr'?`${point.name} gösterim haritasında işaretlendi. Gerçek konum ve ölçek doğrulanmadı.`:`${point.name} is marked on the demonstration floor map. Position and routing are simulated; ask the help desk for real directions.`,references:[point.name],tool:'find_location',pointId:point.id};
    if(/map|نقشه|harita/.test(q))return{text:'Demo assistant: open the approved active floor plan. Coordinates are schematic percentages, not verified physical localization.',references:['Active demonstration floor map'],tool:'show_map'};
    const keywords=q.split(/\s+/).filter(w=>w.length>2);
    const sources=db.knowledge.filter(k=>k.organizationId===org.id&&k.status==='published'&&!k.filename);
    const scored=sources.map(source=>({source,score:keywords.filter(w=>normalize(source.title+' '+source.text+' '+source.category).includes(w)).length})).sort((a,b)=>b.score-a.score);
    if(scored[0]&&scored[0].score>0)return{text:`Demo assistant — ${scored[0].source.text}`,references:[scored[0].source.title]};
    const fallback=language==='fa'?'در منابع منتشرشده این سازمان پاسخی پیدا نکردم. لطفاً از میز راهنما کمک بگیرید.':language==='tr'?'Bu kuruluşun yayımlanan kaynaklarında yanıt bulamadım. Lütfen yardım masasına başvurun.':'I could not find that information in this organization’s published demo knowledge. Please contact the help desk for human assistance.';
    return{text:fallback,references:[],tool:'notify_admin'};
}
