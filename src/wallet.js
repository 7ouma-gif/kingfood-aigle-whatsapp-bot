import jwt from 'jsonwebtoken';

export const ISSUER_ID='338800000023213939';
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
  const cr=await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/'+encodeURIComponent(CLASS_ID),{headers:{authorization:'Bearer '+tj.access_token}});
  const cj=await cr.json();
  return cr.ok?{stage:'class',status:cr.status,id:cj.id,reviewStatus:cj.reviewStatus}:{stage:'class',status:cr.status,error:cj.error};
}
