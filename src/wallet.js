import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const ISSUER_ID='3388000000023213939';
export const CLASS_ID=ISSUER_ID+'.kingfood_fidelite';

function credentials(){
  const raw=process.env.GOOGLE_WALLET_CREDENTIALS;
  if(!raw) throw new Error('GOOGLE_WALLET_CREDENTIALS manquant');
  const c=JSON.parse(raw);
  if(!c.client_email||!c.private_key) throw new Error('Identifiants Google Wallet invalides');
  return c;
}
export function createTestWalletLink(){
  const c=credentials();
  const objectId=ISSUER_ID+'.test_client_001';
  const loyaltyObject={
    id:objectId,
    classId:CLASS_ID,
    state:'ACTIVE',
    heroImage:{sourceUri:{uri:'https://kingfood-wallet-production.up.railway.app/kingfood-wallet-hero.png'},contentDescription:{defaultValue:{language:'fr-FR',value:'Récompenses fidélité King Food'}}},
    accountName:'Client Test',
    accountId:'KF-TEST-001',
    loyaltyPoints:{label:'Points',balance:{int:0}},
    barcode:{type:'QR_CODE',value:'KF-TEST-001',alternateText:'KF-TEST-001'},
    textModulesData:[
      {id:'reward',header:'⭐ VOS POINTS KING FOOD',body:'1 CHF dépensé = 10 points\nRécompenses dès 600 points'},
      {id:'birthday',header:'🎂 ANNIVERSAIRE',body:'○ À UTILISER LE JOUR DE VOTRE ANNIVERSAIRE\n1 menu offert le jour de votre anniversaire'}
    ]
  };
  const claims={
    iss:c.client_email,
    aud:'google',
    typ:'savetowallet',
    iat:Math.floor(Date.now()/1000),
    origins:['https://kingfood-wallet-production.up.railway.app'],
    payload:{loyaltyObjects:[loyaltyObject]}
  };
  const token=jwt.sign(claims,c.private_key,{algorithm:'RS256'});
  return {url:'https://pay.google.com/gp/v/save/'+token,objectId};
}

export function createCustomerWalletLink({firstName,lastName,memberId}){
  const c=credentials();
  const member=memberId||('KF-'+crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase());
  const objectId=ISSUER_ID+'.'+member.toLowerCase().replace(/-/g,'_');
  const displayName=[firstName,lastName].filter(Boolean).join(' ').trim().slice(0,60);
  const loyaltyObject={
    id:objectId,classId:CLASS_ID,state:'ACTIVE',
    heroImage:{sourceUri:{uri:'https://kingfood-wallet-production.up.railway.app/kingfood-wallet-hero.png'},contentDescription:{defaultValue:{language:'fr-FR',value:'Récompenses fidélité King Food'}}},
    
    accountName:displayName,accountId:member,
    loyaltyPoints:{label:'Points',balance:{int:0}},
    barcode:{type:'QR_CODE',value:member,alternateText:member},
    textModulesData:[
      {id:'reward',header:'⭐ VOS POINTS KING FOOD',body:'1 CHF dépensé = 10 points\nRécompenses dès 600 points'},
      {id:'birthday',header:'🎂 ANNIVERSAIRE',body:'○ À UTILISER LE JOUR DE VOTRE ANNIVERSAIRE\n1 menu offert le jour de votre anniversaire'}
    ]
  };
  const claims={iss:c.client_email,aud:'google',typ:'savetowallet',iat:Math.floor(Date.now()/1000),origins:['https://kingfood-wallet-production.up.railway.app'],payload:{loyaltyObjects:[loyaltyObject]}};
  const token=jwt.sign(claims,c.private_key,{algorithm:'RS256'});
  return {url:'https://pay.google.com/gp/v/save/'+token,member,objectId};
}


async function walletAccessToken(){
 const c=credentials(),now=Math.floor(Date.now()/1000);
 const assertion=jwt.sign({iss:c.client_email,scope:'https://www.googleapis.com/auth/wallet_object.issuer',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600},c.private_key,{algorithm:'RS256'});
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 const j=await r.json();if(!r.ok)throw new Error('OAuth Google Wallet refusé');return j.access_token;
}
function birthdayWalletStatus(customer){
 const now=new Date(), parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=t=>Number(parts.find(x=>x.type===t)?.value), year=get('year'),month=get('month'),day=get('day');
 const raw=customer.birth_date instanceof Date?customer.birth_date.toISOString().slice(0,10):String(customer.birth_date||'').slice(0,10);
 const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/),isToday=!!m&&Number(m[2])===month&&Number(m[3])===day,used=Number(customer.birthday_redeemed_year)===year;
 if(used)return '✓ UTILISÉ CETTE ANNÉE';
 if(isToday)return '★ DISPONIBLE AUJOURD’HUI';
 return '○ À UTILISER LE JOUR DE VOTRE ANNIVERSAIRE';
}

export async function syncWalletCustomer(customer){
 const token=await walletAccessToken();
 const objectId=customer.wallet_object_id;
 const points=Number(customer.points||0);
 const body={loyaltyPoints:{label:'Points',balance:{int:points}},textModulesData:[
  {id:'reward',header:'⭐ VOS POINTS KING FOOD',body:points.toLocaleString('fr-CH')+' points\n'+next+'\n1 CHF dépensé = 10 points'},
  {id:'birthday',header:'🎂 ANNIVERSAIRE',body:birthdayWalletStatus(customer)+'\n1 menu offert le jour de votre anniversaire'}
 ]};
 const r=await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/'+encodeURIComponent(objectId),{method:'PATCH',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j?.error?.message||'Mise à jour Wallet refusée');}
 return true;
}

export async function updateWalletClass(){
 const token=await walletAccessToken();
 const body={reviewStatus:'UNDER_REVIEW',hexBackgroundColor:'#6D0F1B',programName:'King Food Fidélité',issuerName:'King Food'};
 const r=await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/'+encodeURIComponent(CLASS_ID),{method:'PATCH',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.error?.message||'Mise à jour classe Wallet refusée');return j;
}

export async function createWalletClass(){
  const c=credentials(), now=Math.floor(Date.now()/1000);
  const assertion=jwt.sign({iss:c.client_email,scope:'https://www.googleapis.com/auth/wallet_object.issuer',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600},c.private_key,{algorithm:'RS256'});
  const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const tj=await tr.json(); if(!tr.ok) return {stage:'oauth',status:tr.status,error:tj.error};
  const body={id:CLASS_ID,issuerName:'King Food',programName:'King Food Fidélité',programLogo:{sourceUri:{uri:'https://kingfood-wallet-production.up.railway.app/kingfood-wallet-logo.png'},contentDescription:{defaultValue:{language:'fr-FR',value:'Logo King Food'}}},reviewStatus:'UNDER_REVIEW',multipleDevicesAndHoldersAllowedStatus:'MULTIPLE_HOLDERS',countryCode:'CH',hexBackgroundColor:'#6D0F1B',accountNameLabel:'Client',accountIdLabel:'N° membre',rewardsTierLabel:'Fidélité',rewardsTier:'Membre'};
  const r=await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass',{method:'POST',headers:{authorization:'Bearer '+tj.access_token,'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json(); return r.ok?{status:r.status,id:j.id,reviewStatus:j.reviewStatus}:{status:r.status,error:j.error};
}

export async function walletDiagnostic(){
  const c=credentials(), now=Math.floor(Date.now()/1000);
  const assertion=jwt.sign({
    iss:c.client_email,
    scope:'https://www.googleapis.com/auth/wallet_object.issuer',
    aud:'https://oauth2.googleapis.com/token',
    iat:now, exp:now+3600
  },c.private_key,{algorithm:'RS256'});
  const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const tj=await tr.json();
  if(!tr.ok)return {stage:'oauth',status:tr.status,error:tj.error,description:tj.error_description};
  const ir=await fetch('https://walletobjects.googleapis.com/walletobjects/v1/issuer',{headers:{authorization:'Bearer '+tj.access_token}}); const il=await ir.json(); const visibleIssuers=(il.resources||[]).map(x=>({issuerId:x.issuerId,name:x.name}));
  const cr=await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/'+encodeURIComponent(CLASS_ID),{headers:{authorization:'Bearer '+tj.access_token}});
  const cj=await cr.json();
  return {issuerListStatus:ir.status,visibleIssuers,classResult:cr.ok?{status:cr.status,id:cj.id,reviewStatus:cj.reviewStatus}:{status:cr.status,error:cj.error}};
}
