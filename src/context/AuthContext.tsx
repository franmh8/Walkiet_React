import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, LoginResponse } from '../types';
import { ApiService } from '../services/apiService';

interface RegisterData {
  name: string;
  phone_number: string;
  callsign: string;
  correo?: string;
  password?: string;
  unit?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<LoginResponse>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const DEFAULT_USERS: User[] = [
  {
    id: 'usr-c5i-01',
    name: 'Comandante Roberto Morales',
    phone_number: '7711234567',
    correo: 'rmorales@c5i.hidalgo.gob.mx',
    callsign: 'HALCON-01',
    unit: 'Fuerza Especial de Reacción C5i',
    role: 'Mando Operativo',
    password: '123',
    status: 'online',
  },
  {
    id: 'usr-c5i-02',
    name: 'Oficial Karla Mendoza',
    phone_number: '7719876543',
    correo: 'kmendoza@c5i.hidalgo.gob.mx',
    callsign: 'PATRULLA-04',
    unit: 'Sector Operativo Pachuca Sur',
    role: 'Oficial de Despacho',
    password: '123',
    status: 'online',
  },
];

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false, code: 'USER_NOT_FOUND', message: '' }),
  register: async () => false,
  logout: async () => {},
  updateUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session or initialize
  useEffect(() => {
    (async () => {
      try {
        const storedUser = localStorage.getItem('c5i_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          // Sync status with backend
          if (parsed.id) {
            ApiService.updateUserStatus(parsed.id, 'online').catch(() => {});
          }
        } else {
          // Default officer profile for easy preview
          setUser(DEFAULT_USERS[0]);
          localStorage.setItem('c5i_user', JSON.stringify(DEFAULT_USERS[0]));
        }
      } catch (err) {
        console.warn('Error reading stored user session:', err);
        setUser(DEFAULT_USERS[0]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (identifier: string, pass: string): Promise<LoginResponse> => {
    const cleanId = identifier.trim();
    const cleanPass = pass.trim();

    try {
      // 1. Authenticate with backend API (connected to if0_42687378_walkiet_db)
      const remoteRes = await ApiService.login(cleanId, cleanPass);
      if (remoteRes && remoteRes.success && (remoteRes.user || remoteRes.usuario)) {
        const loggedUser = remoteRes.user || remoteRes.usuario;
        setUser(loggedUser);
        localStorage.setItem('c5i_user', JSON.stringify(loggedUser));
        return {
          success: true,
          code: 'SUCCESS',
          message: remoteRes.message || 'Sesión iniciada correctamente',
          user: loggedUser,
        };
      } else if (remoteRes && !remoteRes.success && remoteRes.message) {
        return {
          success: false,
          code: remoteRes.code || 'USER_NOT_FOUND',
          message: remoteRes.message,
        };
      }

      // 2. Fallback to local DB check
      const storedUsersRaw = localStorage.getItem('c5i_users_db');
      const users: User[] = storedUsersRaw ? JSON.parse(storedUsersRaw) : DEFAULT_USERS;

      const userMatch = users.find(
        (u) =>
          u.phone_number?.toLowerCase() === cleanId.toLowerCase() ||
          u.correo?.toLowerCase() === cleanId.toLowerCase() ||
          u.callsign?.toLowerCase() === cleanId.toLowerCase()
      );

      if (!userMatch) {
        return {
          success: false,
          code: 'USER_NOT_FOUND',
          message: `El usuario «${cleanId}» no se encuentra registrado en el sistema C5i.`,
        };
      }

      if (userMatch.password && cleanPass && userMatch.password !== cleanPass) {
        return {
          success: false,
          code: 'INVALID_PASSWORD',
          message: 'Contraseña incorrecta. Verifica tu clave de acceso.',
        };
      }

      setUser(userMatch);
      localStorage.setItem('c5i_user', JSON.stringify(userMatch));
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Sesión táctica iniciada con éxito',
        user: userMatch,
      };
    } catch (err) {
      console.error('Error during login:', err);
      return {
        success: false,
        code: 'CONNECTION_ERROR',
        message: 'Error al validar credenciales en el sistema.',
      };
    }
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      // Send to backend DB
      const res = await ApiService.register({
        name: data.name,
        phone_number: data.phone_number,
        callsign: data.callsign.toUpperCase(),
        unit: data.unit,
        password: data.password,
      });

      if (res && res.success && res.user) {
        setUser(res.user);
        localStorage.setItem('c5i_user', JSON.stringify(res.user));
        return true;
      }
    } catch (_) {}

    // Fallback store
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: data.name,
      phone_number: data.phone_number,
      callsign: data.callsign.toUpperCase(),
      correo: data.correo || (data.phone_number.includes('@') ? data.phone_number : undefined),
      password: data.password || '123',
      unit: data.unit || 'Sector Operativo Hidalgo',
      role: data.role || 'Oficial Operativo',
      status: 'online',
    };

    const storedUsersRaw = localStorage.getItem('c5i_users_db');
    const users: User[] = storedUsersRaw ? JSON.parse(storedUsersRaw) : DEFAULT_USERS;

    const filtered = users.filter(
      (u) => u.phone_number !== newUser.phone_number && u.callsign !== newUser.callsign
    );
    filtered.push(newUser);

    localStorage.setItem('c5i_users_db', JSON.stringify(filtered));
    setUser(newUser);
    localStorage.setItem('c5i_user', JSON.stringify(newUser));
    return true;
  };

  const logout = async () => {
    if (user?.id) {
      ApiService.updateUserStatus(user.id, 'offline').catch(() => {});
    }
    setUser(null);
    localStorage.removeItem('c5i_user');
  };

  const updateUser = (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem('c5i_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
