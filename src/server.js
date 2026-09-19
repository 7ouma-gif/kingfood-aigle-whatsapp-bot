import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import {categories,restaurant} from './catalog.js';

const app=express();
app.use(express.json({verify:(req,_res,buf)=>{req.rawBody=buf;}}));
app.use(express.static('public'));
const sessions=new Map(),orders=[];
const money=n=>`${n.toFixed(2)} CHF`;
const numbered=items=>items.map((x,i)=>`${i+1}. ${x.name}${x.price?` — ${money(x.price)}`:''}`).join('\n');
const normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

async function send(to,body){
 if(!process.env.WHATSAPP_TOKEN){console.log(`[DEMO → ${to}] ${body}`);return;}
 await fetch(`https://graph.facebook.com/${process.env.GRAPH_API_VERSION||'v23.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body}})});
}
function requireAdmin(req,res,next){
 const supplied=req.get('x-admin-pin');
 if(!process.env.ADMIN_PIN||!supplied)return res.sendStatus(401);
 const a=Buffer.from(supplied),b=Buffer.from(process.env.ADMIN_PIN);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.sendStatus(401);
 next();
}
function validMetaSignature(req){
 const secret=process.env.META_APP_SECRET,header=req.get('x-hub-signature-256');
 if(!secret||!header||!req.rawBody)return false;
 const expected='sha256='+crypto.createHmac('sha256',secret).update(req.rawBody).digest('hex');
 const a=Buffer.from(header),b=Buffer.from(expected);
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function delivery(city,subtotal){
 const key=normalize(city); const zone=restaurant.delivery.zones.find(z=>z.cities.includes(key));
 if(!zone)return {ok:false,message:"Commune hors des zones enregistrées : le restaurant doit vérifier la livraison."};
 if(subtotal<zone.minimum)return {ok:false,message:`Minimum pour ${city} : ${money(zone.minimum)} (hors frais).`};
 return {ok:true,fee:restaurant.delivery.freeCities.includes(key)?0:restaurant.delivery.fee,minimum:zone.minimum};
}
function start(id){const s={id,step:'channel',cart:[],draft:null};sessions.set(id,s);return s;}
function parseChoices(text,max){return [...new Set(text.split(/[, +]/).map(Number).filter(n=>n>=1&&n<=max))];}
async function handle(id,text){
 let s=sessions.get(id)||start(id); text=text.trim();
 if(/^menu|recommencer|bonjour|salut$/i.test(text))s=start(id);
 if(s.step==='channel'){s.step='category';return send(id,"👑 Bienvenue chez King Food chez Hassan – Aigle\n1. À emporter\n2. Livraison\n\nRépondez 1 ou 2.");}
 if(s.step==='category'&&!s.channel){if(!['1','2'].includes(text))return send(id,'Répondez 1 pour emporter ou 2 pour livraison.');s.channel=text==='1'?'À emporter':'Livraison';return send(id,`Choisissez une catégorie :\n${numbered(categories)}\n\n0. Terminer la commande`);}
 if(s.step==='category'){
  if(text==='0'){if(!s.cart.length)return send(id,'Votre panier est vide. Choisissez une catégorie.');s.step=s.channel==='Livraison'?'city':'name';return send(id,s.step==='city'?'Indiquez votre commune de livraison.':'Indiquez votre prénom.');}
  const c=categories[Number(text)-1];if(!c)return send(id,'Numéro de catégorie invalide.');s.category=c;s.step='product';return send(id,`${c.name}\n${numbered(c.products)}\n\nRépondez avec le numéro.`);
 }
 if(s.step==='product'){
  const p=s.category.products[Number(text)-1];if(!p)return send(id,'Numéro de produit invalide.');s.draft={product:p,selections:[],price:p.price};s.groupIndex=0;
  if(!p.groups.length){s.step='quantity';return send(id,'Quelle quantité ?');}s.step='group';return askGroup(id,s);
 }
 if(s.step==='group'){
  const g=s.draft.product.groups[s.groupIndex],nums=text==='0'?[]:parseChoices(text,g.options.length);
  if(nums.length<g.min||nums.length>g.max)return send(id,`Choisissez entre ${g.min} et ${g.max} option(s). Répondez avec les numéros séparés par des virgules.`);
  const chosen=nums.map(n=>g.options[n-1]);s.draft.selections.push({group:g.name,chosen});s.draft.price+=chosen.reduce((a,x)=>a+x.price,0);s.groupIndex++;
  if(s.groupIndex<s.draft.product.groups.length)return askGroup(id,s);s.step='quantity';return send(id,'Quelle quantité ?');
 }
 if(s.step==='quantity'){
  const q=Number(text);if(!Number.isInteger(q)||q<1||q>20)return send(id,'Indiquez une quantité entre 1 et 20.');s.draft.quantity=q;s.cart.push(s.draft);s.draft=null;s.step='category';return send(id,`✅ Ajouté. Panier : ${money(total(s))}\n\nChoisissez une autre catégorie :\n${numbered(categories)}\n\n0. Terminer la commande`);
 }
 if(s.step==='city'){s.city=text;const d=delivery(text,total(s));s.delivery=d;if(!d.ok)return send(id,`${d.message}\nIndiquez une autre commune ou écrivez EMPLOYÉ.`);s.step='address';return send(id,`Livraison ${d.fee?'à '+money(d.fee):'offerte'} pour ${text}.\nIndiquez l’adresse complète.`);}
 if(s.step==='address'){s.address=text;s.step='name';return send(id,'Indiquez votre prénom.');}
 if(s.step==='name'){s.name=text;s.step='time';return send(id,'À quelle heure souhaitez-vous la commande ?');}
 if(s.step==='time'){s.time=text;s.step='confirm';return send(id,summary(s)+"\n\nRépondez CONFIRMER ou ANNULER. La commande sera ensuite validée par le restaurant.");}
 if(s.step==='confirm'){
  if(/^annuler$/i.test(text)){start(id);return send(id,'Commande annulée. Écrivez MENU pour recommencer.');}
  if(!/^confirmer$/i.test(text))return send(id,'Répondez CONFIRMER ou ANNULER.');
  const order={...s,orderId:crypto.randomUUID().slice(0,8).toUpperCase(),status:'NOUVELLE',createdAt:new Date().toISOString()};orders.unshift(order);sessions.delete(id);
  return send(id,`🕐 Commande ${order.orderId} transmise. Elle n’est acceptée qu’après confirmation du restaurant.`);
 }
}
function askGroup(id,s){const g=s.draft.product.groups[s.groupIndex];return send(id,`${g.name} :\n${numbered(g.options)}\n${g.min===0?'0. Aucun\n':''}Répondez avec ${g.max>1?'un ou plusieurs numéros séparés par des virgules':'le numéro'}.`);}
function total(s){return s.cart.reduce((a,x)=>a+x.price*x.quantity,0);}
function summary(s){const lines=s.cart.map(x=>`${x.quantity}× ${x.product.name} — ${money(x.price*x.quantity)}\n${x.selections.map(y=>`  ${y.group}: ${y.chosen.map(z=>z.name).join(', ')||'Aucun'}`).join('\n')}`);const fee=s.delivery?.fee||0;return `🧾 Récapitulatif\n${lines.join('\n')}\n${fee?`Livraison : ${money(fee)}\n`:''}TOTAL : ${money(total(s)+fee)}\n${s.channel}${s.city?` — ${s.city}, ${s.address}`:''}\nPrénom : ${s.name}\nHeure : ${s.time}`;}

app.get('/webhook',(req,res)=>req.query['hub.verify_token']===process.env.VERIFY_TOKEN?res.send(req.query['hub.challenge']):res.sendStatus(403));
app.post('/webhook',(req,res)=>{if(!validMetaSignature(req))return res.sendStatus(401);res.sendStatus(200);for(const e of req.body.entry||[])for(const c of e.changes||[])for(const m of c.value?.messages||[])if(m.type==='text')handle(m.from,m.text.body).catch(console.error);});
app.post('/api/demo',requireAdmin,(req,res)=>{handle(req.body.from||'41797171860',req.body.text||'bonjour').then(()=>res.json({ok:true,session:sessions.get(req.body.from||'41797171860'),orders}));});
app.get('/api/orders',requireAdmin,(req,res)=>res.json(orders));
app.patch('/api/orders/:id',requireAdmin,(req,res)=>{const o=orders.find(x=>x.orderId===req.params.id);if(!o)return res.sendStatus(404);if(!['ACCEPTEE','REFUSEE'].includes(req.body.status))return res.sendStatus(400);o.status=req.body.status;o.eta=req.body.eta;if(o.status==='ACCEPTEE')send(o.id,`✅ Commande ${o.orderId} acceptée. Délai estimé : ${o.eta||25} minutes.`);if(o.status==='REFUSEE')send(o.id,`❌ Commande ${o.orderId} non acceptée. Appelez-nous au ${restaurant.phone}.`);res.json(o);});
app.get('/api/config',(req,res)=>res.json({restaurant,categories}));
app.get('/health',(_,res)=>res.json({ok:true}));
app.listen(process.env.PORT||3000,()=>console.log(`King Food bot: http://localhost:${process.env.PORT||3000}`));
