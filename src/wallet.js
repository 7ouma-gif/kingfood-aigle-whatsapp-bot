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
    accountName:'Client Test',
    accountId:'KF-TEST-001',
    loyaltyPoints:{label:'Achats',balance:{int:0}},
    barcode:{type:'QR_CODE',value:'KF-TEST-001',alternateText:'KF-TEST-001'},
    textModulesData:[
      {id:'reward',header:'Fidélité',body:'0 / 10 achats'},
      {id:'birthday',header:'Anniversaire',body:'Menu offert le jour de votre anniversaire'}
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
    accountName:displayName,accountId:member,
    loyaltyPoints:{label:'Achats',balance:{int:0}},
    barcode:{type:'QR_CODE',value:member,alternateText:member},
    textModulesData:[
      {id:'reward',header:'Fidélité',body:'0 / 10 achats'},
      {id:'birthday',header:'Anniversaire',body:'Menu offert le jour de votre anniversaire'}
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
export async function syncWalletCustomer(customer){
 const token=await walletAccessToken();
 const objectId=customer.wallet_object_id;
 const body={loyaltyPoints:{label:'Achats',balance:{int:customer.purchases}},textModulesData:[
  {id:'reward',header:'Fidélité',body:`${customer.purchases} / 10 achats`},
  {id:'available',header:'Récompenses disponibles',body:String(customer.rewards_available)},
  {id:'birthday',header:'Anniversaire',body:'Menu offert le jour de votre anniversaire'}
 ]};
 const r=await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/'+encodeURIComponent(objectId),{method:'PATCH',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j?.error?.message||'Mise à jour Wallet refusée');}
 return true;
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
