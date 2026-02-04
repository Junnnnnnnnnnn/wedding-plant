"use client";

import React, { useState, useMemo } from 'react';
import { ChevronLeft, MoreVertical, PlusCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Expense, ExpenseStatus, BudgetStats } from './types';
import StatCard from './components/StatCard';
import SpendingAnalysis from './components/SpendingAnalysis';
import ExpenseList from './components/ExpenseList';

// Placeholder modals (can be implemented fully if needed later)
const AddExpenseModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; onAdd: any }) => isOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-white p-6 rounded-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Add Expense (Placeholder)</h3>
            <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg">Close</button>
        </div>
    </div>
) : null;

const AIInsightsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; expenses: any; stats: any }) => isOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-white p-6 rounded-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">AI Insights (Placeholder)</h3>
            <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg">Close</button>
        </div>
    </div>
) : null;

const USER_DATA = {
    "result": true,
    "data": {
        "initialCapital": 10000,
        "totalPlannedAndUsedAmount": 10000, // Not explicitly used mapped, maybe plannedTotal?
        "plannedUseAmount": 10000,
        "usedAmount": 10000
    },
    "list": [
        {
            "categoryName": "혼주 구매",
            "totalAmount": 0,
            "usedAmount": 150
        },
        {
            "categoryName": "저녁 식사",
            "totalAmount": 1000,
            "usedAmount": 0
        },
        {
            "categoryName": "결혼반지",
            "totalAmount": 300,
            "usedAmount": 0
        }
    ]
};

const BudgetDetailsPage = () => {
    const router = useRouter();

    // Transform user data list to Expense[]
    const initialExpenses: Expense[] = useMemo(() => {
        return USER_DATA.list.map((item, index) => {
            let status = ExpenseStatus.PLANNED;
            if (item.usedAmount > 0) {
                status = ExpenseStatus.PAID; // Simplification
            }

            return {
                id: String(index + 1),
                title: item.categoryName,
                description: item.categoryName, // No description provided, using name
                amount: item.usedAmount,
                plannedAmount: item.totalAmount,
                status: status,
                category: item.categoryName
            };
        });
    }, []);

    const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
    const [activeTab, setActiveTab] = useState<'All' | 'Planned' | 'Used'>('All');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);

    // Use the top-level data for initialCapital
    const initialCapital = USER_DATA.data.initialCapital;

    const stats: BudgetStats = useMemo(() => {
        // We can recalculate from expenses OR use the USER_DATA/data fields directly.
        // However, reference App.tsx calculates from expenses list.
        // If we rely on the list, we might miss 'totalPlannedAndUsedAmount' if list is incomplete?
        // Let's recalculate to be consistent with the list shown.

        // Actually, let's trust the expenses list we built.
        const plannedTotal = expenses.reduce((acc, curr) => acc + curr.plannedAmount, 0);
        const usedTotal = expenses.reduce((acc, curr) =>
            // In reference App.tsx logic: curr.status !== ExpenseStatus.PLANNED ? acc + curr.amount : acc
            // But here we set status based on usedAmount > 0.
            curr.amount // Just sum amount? expense.amount IS mapped to usedAmount.
            // Wait, if status is PLANNED, usedAmount should be 0 usually.
            // Let's stick to simple sum of amount.
            , 0);

        return { initialCapital, plannedTotal, usedTotal };
    }, [expenses, initialCapital]);

    const filteredExpenses = useMemo(() => {
        if (activeTab === 'Planned') return expenses.filter(e => e.status === ExpenseStatus.PLANNED);
        if (activeTab === 'Used') return expenses.filter(e => e.status !== ExpenseStatus.PLANNED);
        return expenses;
    }, [expenses, activeTab]);

    const handleAddExpense = (newExpense: Expense) => {
        setExpenses(prev => [newExpense, ...prev]);
    };

    return (
        <div className="min-h-screen bg-[#fcfbfc]">
            <div className="hidden lg:block absolute inset-0 bg-gray-100 z-0" />
            <div className="min-h-screen max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col grid-bg z-10">
                {/* Top Header */}
                <header className="flex items-center justify-between px-4 py-6 z-10 sticky top-0 bg-white/80 backdrop-blur-sm">
                    <button
                        onClick={() => router.back()}
                        className="p-2 text-[#ee2b8c] hover:bg-[#ee2b8c11] rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold text-[#1b0d14]">Wedding Budget</h1>
                    <button className="p-2 text-[#1b0d14] hover:bg-gray-100 rounded-full transition-colors">
                        <MoreVertical className="w-6 h-6" />
                    </button>
                </header>

                <main className="flex-1 pb-32">
                    {/* Prominent Stats Grid - Redesigned for immediate visibility */}
                    <div className="px-4 py-4 space-y-3">
                        <div className="w-full">
                            <StatCard label="Initial Capital" value={stats.initialCapital} variant="white" size="large" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard label="Planned" value={stats.plannedTotal} variant="pink-light" />
                            <StatCard label="Used" value={stats.usedTotal} variant="pink-solid" />
                        </div>
                    </div>

                    {/* AI Insight Trigger */}
                    <div className="px-4 mt-2">
                        <button
                            onClick={() => setIsAIModalOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-purple-500 to-[#ee2b8c] text-white rounded-2xl font-bold shadow-lg shadow-[#ee2b8c22] hover:opacity-95 transition-all transform active:scale-[0.98]"
                        >
                            <Sparkles className="w-5 h-5" />
                            Ask AI for Budget Advice
                        </button>
                    </div>

                    {/* Spending Analysis Section */}
                    <div className="px-4 mt-8">
                        <h2 className="text-xl font-bold text-[#1b0d14] mb-4">Spending Analysis</h2>
                        <SpendingAnalysis stats={stats} expenses={expenses} />
                    </div>

                    {/* Tabs */}
                    <div className="px-4 mt-8">
                        <div className="flex border-b border-gray-100">
                            {(['All', 'Planned', 'Used'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === tab
                                            ? 'text-[#ee2b8c] border-[#ee2b8c]'
                                            : 'text-gray-400 border-transparent hover:text-gray-600'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Expense List */}
                    <div className="mt-4">
                        <ExpenseList expenses={filteredExpenses} />
                    </div>
                </main>

                {/* Sticky Add Button */}
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-20">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="w-full h-16 bg-[#ee2b8c] text-white rounded-2xl flex items-center justify-center gap-3 font-bold text-lg shadow-xl shadow-[#ee2b8c44] hover:bg-[#d4237b] transition-all transform active:scale-95"
                    >
                        <PlusCircle className="w-6 h-6" />
                        Add New Expense
                    </button>
                </div>

                <AddExpenseModal
                    isOpen={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    onAdd={handleAddExpense}
                />

                <AIInsightsModal
                    isOpen={isAIModalOpen}
                    onClose={() => setIsAIModalOpen(false)}
                    expenses={expenses}
                    stats={stats}
                />
            </div>
        </div>
    );
};

export default BudgetDetailsPage;
