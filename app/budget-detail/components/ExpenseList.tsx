
import React from 'react';
import { Expense, ExpenseStatus } from '../types';
import { CATEGORY_ICONS } from '../constants';

interface ExpenseListProps {
    expenses: Expense[];
}

const ExpenseList: React.FC<ExpenseListProps> = ({ expenses }) => {
    return (
        <div className="px-4 space-y-4">
            {expenses.length === 0 ? (
                <div className="text-center py-12 text-gray-400 font-medium italic">
                    No items found in this category.
                </div>
            ) : (
                expenses.map((expense) => (
                    <div
                        key={expense.id}
                        className={`flex items-center gap-4 bg-white p-4 rounded-3xl border border-[#ee2b8c0a] shadow-sm transition-transform active:scale-[0.98] ${expense.status === ExpenseStatus.PLANNED ? 'opacity-60 grayscale-[0.3]' : ''}`}
                    >
                        <div className="w-14 h-14 bg-[#ee2b8c0a] rounded-2xl flex items-center justify-center text-[#ee2b8c] shrink-0">
                            {CATEGORY_ICONS[expense.category] || CATEGORY_ICONS['Others']}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className="text-[#1b0d14] font-bold text-lg truncate">{expense.title}</h4>
                            <p className="text-gray-400 text-xs font-semibold truncate uppercase tracking-tight">{expense.description}</p>
                        </div>

                        <div className="text-right shrink-0">
                            <div className="text-lg font-extrabold text-[#1b0d14] mb-1">
                                {expense.amount.toLocaleString()}
                            </div>
                            <StatusBadge status={expense.status} />
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

const StatusBadge: React.FC<{ status: ExpenseStatus }> = ({ status }) => {
    const styles: Record<ExpenseStatus, string> = {
        [ExpenseStatus.PAID]: 'bg-[#ee2b8c] text-white',
        [ExpenseStatus.PENDING]: 'bg-[#ee2b8c1a] text-[#ee2b8c]',
        [ExpenseStatus.DEPOSIT_PAID]: 'bg-green-100 text-green-600',
        [ExpenseStatus.PLANNED]: 'bg-gray-100 text-gray-500'
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-tight ${styles[status]}`}>
            {status}
        </span>
    );
};

export default ExpenseList;
