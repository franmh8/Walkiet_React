import React from 'react';
import { Check, X } from 'lucide-react';

export interface PasswordCriteria {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  matchesConfirm: boolean;
}

export const evaluatePassword = (password: string, confirmPassword?: string): PasswordCriteria => {
  return {
    minLength: password.length >= 6,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password),
    matchesConfirm: Boolean(confirmPassword && password.length > 0 && password === confirmPassword),
  };
};

export const isPasswordStrong = (criteria: PasswordCriteria): boolean => {
  return criteria.minLength;
};

interface PasswordStrengthChecklistProps {
  criteria: PasswordCriteria;
  showConfirmCheck?: boolean;
  hasTypedConfirm?: boolean;
}

export const PasswordStrengthChecklist: React.FC<PasswordStrengthChecklistProps> = ({
  criteria,
  showConfirmCheck = true,
  hasTypedConfirm = true,
}) => {
  return (
    <div className="p-3 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
      <div className="flex items-center gap-2">
        <div
          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
            criteria.minLength
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
          }`}
        >
          {criteria.minLength ? <Check className="w-2.5 h-2.5" /> : '•'}
        </div>
        <span
          className={
            criteria.minLength
              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
              : ''
          }
        >
          Mínimo 6 caracteres
        </span>
      </div>

      {showConfirmCheck && (
        <div className="flex items-center gap-2">
          <div
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
              criteria.matchesConfirm
                ? 'bg-emerald-500 text-white'
                : hasTypedConfirm
                ? 'bg-rose-100 text-rose-500'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
            }`}
          >
            {criteria.matchesConfirm ? (
              <Check className="w-2.5 h-2.5" />
            ) : hasTypedConfirm ? (
              <X className="w-2.5 h-2.5" />
            ) : (
              '•'
            )}
          </div>
          <span
            className={
              criteria.matchesConfirm
                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                : hasTypedConfirm
                ? 'text-rose-600 dark:text-rose-400'
                : ''
            }
          >
            Las contraseñas coinciden
          </span>
        </div>
      )}
    </div>
  );
};
