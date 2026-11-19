import React from 'react';
import {Text,View} from 'react-native';
import {mediaLabel,type ReplyPreview} from './messageTypes';
export function ReplyQuote({reply,name,isSelf=false}:{reply:ReplyPreview;name:string;isSelf?:boolean}){
  return <View testID="message-reply-quote" style={{maxWidth:270,borderLeftWidth:3,borderLeftColor:isSelf?'#f2bac8':'#691c32',borderRadius:7,backgroundColor:isSelf?'#ffffff15':'#691c320c',paddingHorizontal:8,paddingVertical:6,marginBottom:6}}>
    {!!name&&<Text numberOfLines={1} style={{fontSize:11,fontWeight:'700',color:isSelf?'#ffe0e8':'#691c32',marginBottom:2}}>{name}</Text>}
    <Text numberOfLines={2} style={{fontSize:12,color:isSelf?'#fffd':'#64748b'}}>{reply.text||mediaLabel(reply.mediaType)}</Text>
  </View>;
}
