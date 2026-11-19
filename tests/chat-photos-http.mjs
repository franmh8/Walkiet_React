import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {readFileSync} from 'node:fs';
const base=process.env.ACCOUNT_TEST_BACKEND,socket=process.env.CONTACTS_TEST_SOCKET;
if(base!=='http://127.0.0.1:8103'||!socket)throw Error('Usa solo contacts_test_account local.');
const db=await mysql.createConnection({socketPath:socket,user:'root',database:'contacts_test_account'});
const post=async(path,token,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'text/plain',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
const login=async phone=>(await post('/login.php',null,{phone_number:phone,password:'profile-test-password'})).body.token;
const api=(token,action,fields={})=>post('/account.php',token,{action,...fields});
const migration=readFileSync(new URL('../backend-alwaysdata/migrations/009_chat_photo_gallery.sql',import.meta.url),'utf8');
try{
 const a=await login('7710000301'),b=await login('7710000302');
 assert.equal((await api(a,'get')).body.settings.autoSavePhotos,true);
 assert.equal((await api(a,'settings',{settings:{autoSavePhotos:false},user_id:'account-b'})).body.settings.autoSavePhotos,false);
 assert.equal((await api(b,'get')).body.settings.autoSavePhotos,true);
 const again=await login('7710000301');assert.equal((await api(again,'get')).body.settings.autoSavePhotos,false);
 for(const value of [0,1,'false',null,[],{}])assert.equal((await api(a,'settings',{settings:{autoSavePhotos:value}})).status,400);
 assert.equal((await api(a,'settings',{settings:{theme:'dark',autoSavePhotos:1}})).status,400);assert.equal((await api(a,'get')).body.settings.theme,'light','El parche inválido revierte sus otros campos.');
 for(let n=0;n<2;n++)for(const sql of migration.split(';'))if(sql.trim())await db.query(sql);
 assert.equal((await api(a,'get')).body.settings.autoSavePhotos,false,'La migración repetida conserva la preferencia.');
 const [columns]=await db.query("SELECT TABLE_NAME,COLUMN_TYPE,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='users' AND COLUMN_NAME='id') OR (TABLE_NAME='account_media_preferences' AND COLUMN_NAME='user_id'))");
 assert.equal(columns[0].COLUMN_TYPE,columns[1].COLUMN_TYPE);assert.equal(columns[0].COLLATION_NAME,columns[1].COLLATION_NAME);
 await db.query('RENAME TABLE account_media_preferences TO account_media_preferences_test_backup');
 try {const fallback=await api(a,'get');assert.equal(fallback.status,200);assert.equal(fallback.body.settings.autoSavePhotos,false);const missing=await api(a,'settings',{settings:{autoSavePhotos:true}});assert.equal(missing.status,503);assert.match(missing.body.message,/009/);}
 finally{await db.query('RENAME TABLE account_media_preferences_test_backup TO account_media_preferences');}
 assert.equal((await api(a,'get')).body.settings.autoSavePhotos,false);
 console.log('OK fotos HTTP: preferencia persistente por cuenta, booleanos, rollback, migración repetible y falta de 009 sin romper el perfil.');
}finally{await db.end();}
