import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false, code: 'USER_NOT_FOUND', message: '' }),
  register: async () => false,
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga sesión persistente sólo si existe un login previo real
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('c5i_user');
        if (stored) {
          setUser(JSON.parse(stored));
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn('Error leyendo sesión guardada:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (identifier: string, pass: string): Promise<LoginResponse> => {
    const cleanId = identifier.trim();
    const cleanPass = pass.trim();

    try {
      // 1. Intentar backend del servidor C5i
      try {
        const remoteRes = await ApiService.login(cleanId, cleanPass);
        if (remoteRes && (remoteRes.success || remoteRes.status === 'success') && (remoteRes.user || remoteRes.usuario)) {
          const loggedUser = remoteRes.user || remoteRes.usuario;
          setUser(loggedUser);
          await AsyncStorage.setItem('c5i_user', JSON.stringify(loggedUser));
          return {
            success: true,
            code: 'SUCCESS',
            message: remoteRes.message || 'Sesión iniciada correctamente',
            user: loggedUser,
          };
        } else if (remoteRes && (!remoteRes.success || remoteRes.status === 'error')) {
          const isPassError = remoteRes.code === 'INVALID_PASSWORD' || remoteRes.message?.toLowerCase().includes('contraseña');
          return {
            success: false,
            code: isPassError ? 'INVALID_PASSWORD' : 'USER_NOT_FOUND',
            message: remoteRes.message || `El usuario «${cleanId}» no se encuentra registrado en el sistema.`,
          };
        }
      } catch (apiErr: any) {
        if (apiErr?.response?.data) {
          const d = apiErr.response.data;
          const isPassError = d.code === 'INVALID_PASSWORD' || d.message?.toLowerCase().includes('contraseña');
          return {
            success: false,
            code: isPassError ? 'INVALID_PASSWORD' : 'USER_NOT_FOUND',
            message: d.message || `El usuario «${cleanId}» no se encuentra registrado en el sistema.`,
          };
        }
      }

      // 2. Verificar en usuarios registrados en el dispositivo
      const storedUsersRaw = await AsyncStorage.getItem('c5i_users_db');
      const users: User[] = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];

      const userMatch = users.find(
        (u) =>
          u.phone_number?.toLowerCase() === cleanId.toLowerCase() ||
          u.correo?.toLowerCase() === cleanId.toLowerCase() ||
          u.callsign?.toLowerCase() === cleanId.toLowerCase()
      );

      // CASO A: Usuario no encontrado
      if (!userMatch) {
        return {
          success: false,
          code: 'USER_NOT_FOUND',
          message: `El usuario «${cleanId}» no se encuentra registrado en el sistema.`,
        };
      }

      // CASO B: Contraseña incorrecta
      if (userMatch.password && userMatch.password !== cleanPass) {
        return {
          success: false,
          code: 'INVALID_PASSWORD',
          message: 'Contraseña incorrecta. Verifica tu contraseña o solicítala nuevamente.',
        };
      }

      // Login exitoso con base de datos local
      setUser(userMatch);
      await AsyncStorage.setItem('c5i_user', JSON.stringify(userMatch));
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Sesión iniciada con éxito',
        user: userMatch,
      };
    } catch (err: any) {
      console.error('Error en proceso de login:', err);
      return {
        success: false,
        code: 'CONNECTION_ERROR',
        message: 'Error al validar credenciales en el sistema.',
      };
    }
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: data.name,
      phone_number: data.phone_number,
      callsign: data.callsign,
      correo: data.correo || (data.phone_number.includes('@') ? data.phone_number : undefined),
      password: data.password,
      unit: data.unit || 'Sector Operativo Hidalgo',
      role: data.role || 'Oficial Operativo',
      status: 'online',
    };

    const storedUsersRaw = await AsyncStorage.getItem('c5i_users_db');
    const users: User[] = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];

    // Reemplaza o agrega
    const filtered = users.filter(
      (u) => u.phone_number !== newUser.phone_number && u.correo !== newUser.correo
    );
    filtered.push(newUser);

    await AsyncStorage.setItem('c5i_users_db', JSON.stringify(filtered));
    setUser(newUser);
    await AsyncStorage.setItem('c5i_user', JSON.stringify(newUser));
    return true;
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem('c5i_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
