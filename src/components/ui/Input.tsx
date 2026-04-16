import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import './Input.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="input-wrapper">
                {label && <label className="label-base">{label}</label>}
                <input
                    ref={ref}
                    className={cn(
                        'input-base',
                        error && 'input-error',
                        className
                    )}
                    {...props}
                />
                {error && <span className="text-danger text-sm mt-1 block">{error}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';
