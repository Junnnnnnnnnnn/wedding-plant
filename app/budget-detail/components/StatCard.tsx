import React from 'react';

interface StatCardProps {
    label: string;
    value: number;
    variant: 'white' | 'pink-light' | 'pink-solid';
    size?: 'normal' | 'large';
    /** 초기 자본 카드에만 사용. 우측 하단에 표시 (initialCapital - planned - used) */
    remainingAmount?: number;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, variant, size = 'normal', remainingAmount }) => {
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
                {value.toLocaleString("ko-KR")}만원
            </span>
            {remainingAmount !== undefined && (
                <p className={`mt-auto pt-2 text-right text-sm font-semibold ${labelStyles[variant]}`}>
                    남은 금액 {remainingAmount.toLocaleString("ko-KR")}만원
                </p>
            )}
        </div>
    );
};

export default StatCard;
