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
    origins:[],
    payload:{loyaltyObjects:[loyaltyObject]}
  };
  const token=jwt.sign(claims,c.private_key,{algorithm:'RS256'});
  return {url:'https://pay.google.com/gp/v/save/'+token,objectId};
}
