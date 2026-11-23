import { User } from '../types';

export const findUserByIdentifier = (identifier: string): User | null => {
  const clean = identifier.trim().toLowerCase();
  const cleanPhone = clean.replace(/\D/g, '');

  // Pre-seed check for common demo users in tactical DB
  if (cleanPhone === '7711234567' || clean.includes('halcon')) {
    return {
      id: 'usr-c5i-01',
      name: 'Comandante Roberto Morales',
      badge: 'HALCON-01',
      callsign: 'HALCON-01',
      phone_number: '7711234567',
      role: 'Mando Táctico',
      unit: 'Fuerza Especial C5i',
      status: 'online',
    };
  }

  if (cleanPhone === '7719876543' || clean.includes('patrulla-04')) {
    return {
      id: 'usr-c5i-02',
      name: 'Oficial Karla Mendoza',
      badge: 'PATRULLA-04',
      callsign: 'PATRULLA-04',
      phone_number: '7719876543',
      role: 'Elemento Táctico',
      unit: 'Sector Pachuca Sur',
      status: 'online',
    };
  }

  return null;
};
