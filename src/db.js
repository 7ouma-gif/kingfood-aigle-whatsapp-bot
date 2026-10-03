import pg from 'pg';
const {Pool}=pg;
export const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:false});

export async function initDb(){
 await pool.query(`
 CREATE TABLE IF NOT EXISTS loyalty_customers(
   id BIGSERIAL PRIMARY KEY,
   member_id VARCHAR(32) UNIQUE NOT NULL,
   wallet_object_id VARCHAR(128) UNIQUE NOT NULL,
   first_name VARCHAR(40) NOT NULL,
   last_name VARCHAR(40) NOT NULL,
   birth_date DATE NOT NULL,
   phone VARCHAR(32),
   purchases INTEGER NOT NULL DEFAULT 0 CHECK(purchases>=0),
   rewards_available INTEGER NOT NULL DEFAULT 0 CHECK(rewards_available>=0),
   birthday_redeemed_year INTEGER,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS loyalty_events(
   id BIGSERIAL PRIMARY KEY,
   member_id VARCHAR(32) NOT NULL REFERENCES loyalty_customers(member_id) ON DELETE CASCADE,
   event_type VARCHAR(32) NOT NULL,
   delta INTEGER NOT NULL DEFAULT 0,
   note TEXT,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE INDEX IF NOT EXISTS loyalty_events_member_created_idx ON loyalty_events(member_id,created_at DESC);
 `);
}
export async function createCustomer(c){
 const q=`INSERT INTO loyalty_customers(member_id,wallet_object_id,first_name,last_name,birth_date,phone)
 VALUES($1,$2,$3,$4,$5,$6) RETURNING member_id,first_name,last_name,purchases,rewards_available`;
 return (await pool.query(q,[c.memberId,c.objectId,c.firstName,c.lastName,c.birthDate,c.phone||null])).rows[0];
}
export async function getCustomer(memberId){
 return (await pool.query('SELECT * FROM loyalty_customers WHERE member_id=$1',[memberId])).rows[0]||null;
}
export async function addPurchase(memberId){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const r=await client.query('SELECT * FROM loyalty_customers WHERE member_id=$1 FOR UPDATE',[memberId]);
  if(!r.rows[0]){await client.query('ROLLBACK');return null;}
  let purchases=r.rows[0].purchases+1,rewards=r.rows[0].rewards_available;
  if(purchases>=10){purchases=0;rewards++;}
  const u=(await client.query('UPDATE loyalty_customers SET purchases=$2,rewards_available=$3,updated_at=NOW() WHERE member_id=$1 RETURNING *',[memberId,purchases,rewards])).rows[0];
  await client.query("INSERT INTO loyalty_events(member_id,event_type,delta,note) VALUES($1,'PURCHASE',1,$2)",[memberId,purchases===0?'Récompense débloquée':null]);
  await client.query('COMMIT'); return u;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
export async function redeemReward(memberId){
 const r=await pool.query(`UPDATE loyalty_customers SET rewards_available=rewards_available-1,updated_at=NOW()
 WHERE member_id=$1 AND rewards_available>0 RETURNING *`,[memberId]);
 if(!r.rows[0])return null;
 await pool.query("INSERT INTO loyalty_events(member_id,event_type,note) VALUES($1,'REWARD_REDEEMED','Récompense fidélité utilisée')",[memberId]);
 return r.rows[0];
}
export async function redeemBirthday(memberId){
 const y=new Date().getFullYear();
 const r=await pool.query(`UPDATE loyalty_customers SET birthday_redeemed_year=$2,updated_at=NOW()
 WHERE member_id=$1 AND (birthday_redeemed_year IS NULL OR birthday_redeemed_year<$2)
 AND EXTRACT(MONTH FROM birth_date)=EXTRACT(MONTH FROM CURRENT_DATE)
 AND EXTRACT(DAY FROM birth_date)=EXTRACT(DAY FROM CURRENT_DATE) RETURNING *`,[memberId,y]);
 if(!r.rows[0])return null;
 await pool.query("INSERT INTO loyalty_events(member_id,event_type,note) VALUES($1,'BIRTHDAY_REDEEMED',$2)",[memberId,'Menu anniversaire '+y]);
 return r.rows[0];
}

export async function undoLastPurchase(memberId){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const c=(await client.query('SELECT * FROM loyalty_customers WHERE member_id=$1 FOR UPDATE',[memberId])).rows[0];
  if(!c){await client.query('ROLLBACK');return {status:'missing'};}
  const last=(await client.query('SELECT * FROM loyalty_events WHERE member_id=$1 ORDER BY id DESC LIMIT 1 FOR UPDATE',[memberId])).rows[0];
  if(!last||last.event_type!=='PURCHASE'){await client.query('ROLLBACK');return {status:'nothing'};}
  let purchases=c.purchases,rewards=c.rewards_available;
  if(last.note==='Récompense débloquée'){
   if(rewards<1){await client.query('ROLLBACK');return {status:'nothing'};}
   purchases=9; rewards--;
  }else{
   if(purchases<1){await client.query('ROLLBACK');return {status:'nothing'};}
   purchases--;
  }
  const u=(await client.query('UPDATE loyalty_customers SET purchases=$2,rewards_available=$3,updated_at=NOW() WHERE member_id=$1 RETURNING *',[memberId,purchases,rewards])).rows[0];
  await client.query("INSERT INTO loyalty_events(member_id,event_type,delta,note) VALUES($1,'UNDO_PURCHASE',-1,'Dernier achat annulé')",[memberId]);
  await client.query('COMMIT');
  return {status:'ok',customer:u};
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
