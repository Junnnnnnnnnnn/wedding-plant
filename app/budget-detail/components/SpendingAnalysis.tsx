
import React from 'react';
import { BudgetStats, Expense } from '../types';

interface SpendingAnalysisProps {
    stats: BudgetStats;
    expenses: Expense[];
}

const SpendingAnalysis: React.FC<SpendingAnalysisProps> = ({ stats, expenses }) => {
    const usedPercentage = stats.plannedTotal > 0 ? Math.round((stats.usedTotal / stats.plannedTotal) * 100) : 0;
    const savings = stats.initialCapital - stats.plannedTotal;

    // Filter top categories for the progress bars
    const topExpenses = expenses.slice(0, 3);

    return (
        <div className="bg-white rounded-3xl p-6 border border-[#ee2b8c0a] shadow-sm">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <p className="text-[#ee2b8c88] text-sm font-bold mb-1">Budget vs Spending</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-[#1b0d14]">{usedPercentage}%</span>
                        <span className="text-gray-400 font-medium">Used</span>
                    </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-sm font-bold ${savings >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {savings >= 0 ? '+' : '-'}{Math.abs(savings).toLocaleString()}
                </div>
            </div>

            <div className="space-y-6">
                {topExpenses.map((expense) => {
                    // If no plan but spent money, show 100%. If no plan and no spend, 0%.
                    const percentage = expense.plannedAmount > 0
                        ? (expense.amount / expense.plannedAmount) * 100
                        : (expense.amount > 0 ? 100 : 0);
                    const progress = Math.min(100, percentage);

                    return (
                        <div key={expense.id} className="space-y-2">
                            <div className="flex justify-between text-xs font-extrabold">
                                <span className="text-[#1b0d14] opacity-70 uppercase tracking-tight">{expense.title}</span>
                                <span className="text-[#ee2b8c]">
                                    {expense.amount.toLocaleString()} / {expense.plannedAmount.toLocaleString()}
                                </span>
                            </div>
                            <div className="h-3 w-full bg-[#ee2b8c0a] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#ee2b8c] rounded-full transition-all duration-1000"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SpendingAnalysis;
