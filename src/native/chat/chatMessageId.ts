import {digestStringAsync, CryptoDigestAlgorithm} from 'expo-crypto';
export async function serverMessageId(userId:string, clientId:string) {
  return 'cm-'+(await digestStringAsync(CryptoDigestAlgorithm.SHA256,userId+':'+clientId)).slice(0,32);
}
