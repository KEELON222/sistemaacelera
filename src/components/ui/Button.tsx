import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={cn(
                    'btn-base',
                    `btn-${variant}`,
                    `btn-${size}`,
                    isLoading && 'btn-loading',
                    className
                )}
                {...props}
            >
                {isLoading ? <span className="loader" /> : null}
                <span className={cn(isLoading && 'opacity-0')}>{children}</span>
            </button>
        );
    }
);

Button.displayName = 'Button';
