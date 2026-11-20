import React from 'react';
import {Platform} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {CornerUpLeft,CornerUpRight,Copy,Pencil,Trash2} from 'lucide-react';
export type MessageAction='reply'|'forward'|'copy'|'edit'|'delete';
const icons={reply:CornerUpLeft,forward:CornerUpRight,copy:Copy,edit:Pencil,delete:Trash2};
const names={reply:'corner-up-left',forward:'corner-up-right',copy:'copy',edit:'edit-3',delete:'trash-2'} as const;
export function MessageActionIcon({action,color}:{action:MessageAction;color:string}){const Icon=icons[action];return Platform.OS==='web'?<Icon size={18} color={color} strokeWidth={1.8}/>:<Feather name={names[action]} size={18} color={color}/>;}
