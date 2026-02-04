
import React from 'react';

interface StatCardProps {
    label: string;
    value: number;
    variant: 'white' | 'pink-light' | 'pink-solid';
    size?: 'normal' | 'large';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, variant, size = 'normal' }) => {
    const styles = {
        white: 'bg-white border border-[#ee2b8c1a] text-[#1b0d14] shadow-sm',
        'pink-light': 'bg-[#fff0f7] border border-[#ee2b8c11] text-[#ee2b8c]',
        'pink-solid': 'bg-[#ee2b8c] text-white shadow-lg shadow-[#ee2b8c33]'
    };

    const labelStyles = {
        white: 'text-[#ee2b8c88]',
        'pink-light': 'text-[#ee2b8cbb]',
        'pink-solid': 'text-white/80'
    };

    const containerPadding = size === 'large' ? 'p-6' : 'p-5';
    const labelSize = size === 'large' ? 'text-xs' : 'text-[10px]';
    const valueSize = size === 'large' ? 'text-3xl' : 'text-2xl';

    return (
        <div className={`${containerPadding} rounded-[28px] flex flex-col gap-1.5 ${styles[variant]} transition-transform hover:scale-[1.01]`}>
            <span className={`${labelSize} font-extrabold uppercase tracking-[0.15em] ${labelStyles[variant]}`}>
                {label}
            </span>
            <span className={`${valueSize} font-extrabold tracking-tight`}>
                {value.toLocaleString()}만원
            </span>
        </div>
    );
}; // Changed unit to 만원 as per user context usually? Or just locale string. The reference used $. The user data context implies "만 원".
// Wait, user data: "남은 예산 550만 원". So the values are in 'man-won' likely.
// I'll append "만원" or just let it be numbers. The reference had `$`.
// I'll switch to `만원` or just number. Reference: lines 34 `${value.toLocaleString()}`
// I'll stick to `{value.toLocaleString()}` and maybe add "만원" or just match the reference visual but with Korean context if implicit.
// The user prompt screenshot text says "550만 원". I'll use "만원".

export default StatCard;
