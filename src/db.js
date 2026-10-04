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
 ALTER TABLE loyalty_customers ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0 CHECK(points>=0);
 CREATE TABLE IF NOT EXISTS loyalty_rewards(id VARCHAR(40) PRIMARY KEY,name VARCHAR(100) NOT NULL,points_cost INTEGER NOT NULL CHECK(points_cost>0),active BOOLEAN NOT NULL DEFAULT TRUE,sort_order INTEGER NOT NULL DEFAULT 0);
 INSERT INTO loyalty_rewards(id,name,points_cost,sort_order) VALUES
 ('fries-small','Petite frite',600,10),('tiramisu','Tiramisu',750,20),('snack-6','Snack 6 pièces',1000,30),('tasty-m','Tasty Crousty M',1600,40),('tacos-m','Tacos M',1600,50),('menu-cheeseburger','Menu Cheeseburger',1900,60),('menu-choice-19','Menu au choix jusqu’à 19 CHF',2500,70)
 ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,points_cost=EXCLUDED.points_cost,sort_order=EXCLUDED.sort_order;
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
  if(purchases>=9){purchases=0;rewards++;}
  const u=(await client.query('UPDATE loyalty_customers SET purchases=$2,rewards_available=$3,updated_at=NOW() WHERE member_id=$1 RETURNING *',[memberId,purchases,rewards])).rows[0];
  await client.query("INSERT INTO loyalty_events(member_id,event_type,delta,note) VALUES($1,'PURCHASE',1,$2)",[memberId,purchases===0?'Récompense débloquée':null]);
  await client.query('COMMIT'); return u;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
export async function redeemReward(memberId){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const r=await client.query(`UPDATE loyalty_customers SET rewards_available=rewards_available-1,updated_at=NOW()
   WHERE member_id=$1 AND rewards_available>0 RETURNING *`,[memberId]);
  if(!r.rows[0]){await client.query('ROLLBACK');return null;}
  await client.query("INSERT INTO loyalty_events(member_id,event_type,note) VALUES($1,'REWARD_REDEEMED','Récompense fidélité utilisée')",[memberId]);
  await client.query('COMMIT'); return r.rows[0];
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
export async function redeemBirthday(memberId){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const r=await client.query(`UPDATE loyalty_customers SET birthday_redeemed_year=EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Europe/Zurich'))::int,updated_at=NOW()
   WHERE member_id=$1
   AND (birthday_redeemed_year IS NULL OR birthday_redeemed_year<EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Europe/Zurich'))::int)
   AND EXTRACT(MONTH FROM birth_date)=EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'Europe/Zurich'))
   AND EXTRACT(DAY FROM birth_date)=EXTRACT(DAY FROM (NOW() AT TIME ZONE 'Europe/Zurich')) RETURNING *`,[memberId]);
  if(!r.rows[0]){await client.query('ROLLBACK');return null;}
  const y=r.rows[0].birthday_redeemed_year;
  await client.query("INSERT INTO loyalty_events(member_id,event_type,note) VALUES($1,'BIRTHDAY_REDEEMED',$2)",[memberId,'Menu anniversaire '+y]);
  await client.query('COMMIT'); return r.rows[0];
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

export async function undoLastPurchase(memberId){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const c=(await client.query('SELECT * FROM loyalty_customers WHERE member_id=$1 FOR UPDATE',[memberId])).rows[0];
  if(!c){await client.query('ROLLBACK');return {status:'missing'};}
  if(c.purchases<=0){await client.query('ROLLBACK');return {status:'nothing'};}
  const purchases=c.purchases-1;
  const u=(await client.query('UPDATE loyalty_customers SET purchases=$2,updated_at=NOW() WHERE member_id=$1 RETURNING *',[memberId,purchases])).rows[0];
  await client.query("INSERT INTO loyalty_events(member_id,event_type,delta,note) VALUES($1,'MANUAL_MINUS',-1,'Retrait manuel d’un achat')",[memberId]);
  await client.query('COMMIT');
  return {status:'ok',customer:u};
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

export async function searchCustomers(q=''){
 const term=String(q||'').trim();
 const r=await pool.query(`SELECT member_id,first_name,last_name,birth_date,phone,purchases,rewards_available,birthday_redeemed_year,created_at,updated_at
 FROM loyalty_customers WHERE $1='' OR member_id ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2 OR COALESCE(phone,'') ILIKE $2
 ORDER BY updated_at DESC LIMIT 50`,[term,'%'+term+'%']);
 return r.rows;
}
export async function adminUpdateCustomer(memberId,patch){
 const purchases=Math.max(0,Math.min(8,Number.parseInt(patch.purchases,10)||0));
 const rewards=Math.max(0,Math.min(99,Number.parseInt(patch.rewards_available,10)||0));
 const birthday=patch.birthday_redeemed_year===null||patch.birthday_redeemed_year===''?null:Number.parseInt(patch.birthday_redeemed_year,10);
 const r=await pool.query(`UPDATE loyalty_customers SET purchases=$2,rewards_available=$3,birthday_redeemed_year=$4,updated_at=NOW()
 WHERE member_id=$1 RETURNING *`,[memberId,purchases,rewards,Number.isInteger(birthday)?birthday:null]);
 return r.rows[0]||null;
}
export async function deleteCustomer(memberId){
 const r=await pool.query('DELETE FROM loyalty_customers WHERE member_id=$1 RETURNING member_id',[memberId]);
 return !!r.rows[0];
}

export async function getCustomerEvents(memberId){
 const r=await pool.query(`SELECT id,event_type,delta,note,created_at FROM loyalty_events WHERE member_id=$1 ORDER BY id DESC LIMIT 100`,[memberId]);
 return r.rows;
}

export const POINTS_PER_CHF=10;
export async function getRewardsCatalog(){return (await pool.query("SELECT id,name,points_cost,active,sort_order FROM loyalty_rewards WHERE active=TRUE ORDER BY sort_order,id")).rows;}
export async function addPointsForAmount(memberId,amountChf){const cents=Math.round(Number(amountChf)*100);if(!Number.isInteger(cents)||cents<=0||cents>100000)return {status:'invalid'};const points=Math.round((cents/100)*POINTS_PER_CHF);const client=await pool.connect();try{await client.query('BEGIN');const r=await client.query('UPDATE loyalty_customers SET points=points+$2,updated_at=NOW() WHERE member_id=$1 RETURNING *',[memberId,points]);if(!r.rows[0]){await client.query('ROLLBACK');return {status:'missing'}}await client.query("INSERT INTO loyalty_events(member_id,event_type,delta,note) VALUES($1,'POINTS_EARNED',$2,$3)",[memberId,points,(cents/100).toFixed(2)+' CHF']);await client.query('COMMIT');return {status:'ok',customer:r.rows[0],pointsAdded:points}}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
export async function redeemPointsReward(memberId,rewardId){const client=await pool.connect();try{await client.query('BEGIN');const reward=(await client.query('SELECT * FROM loyalty_rewards WHERE id=$1 AND active=TRUE',[rewardId])).rows[0];if(!reward){await client.query('ROLLBACK');return {status:'reward_missing'}}const r=await client.query('UPDATE loyalty_customers SET points=points-$2,updated_at=NOW() WHERE member_id=$1 AND points>=$2 RETURNING *',[memberId,reward.points_cost]);if(!r.rows[0]){await client.query('ROLLBACK');return {status:'insufficient'}}await client.query("INSERT INTO loyalty_events(member_id,event_type,delta,note) VALUES($1,'POINTS_REDEEMED',$2,$3)",[memberId,-reward.points_cost,reward.name]);await client.query('COMMIT');return {status:'ok',customer:r.rows[0],reward}}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
