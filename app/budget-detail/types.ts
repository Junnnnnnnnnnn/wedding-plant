export enum ExpenseStatus {
    PAID = 'PAID',
    PENDING = 'PENDING',
    DEPOSIT_PAID = 'DEPOSIT PAID',
    PLANNED = 'PLANNED'
}

// Allow string based categories for flexibility with Korean data
export type Category = string;

export interface Expense {
    id: string;
    title: string;
    description: string;
    amount: number;         // Used Amount
    plannedAmount: number;  // Planned Amount
    status: ExpenseStatus;
    category: Category;
}

export interface BudgetStats {
    initialCapital: number;
    plannedTotal: number;
    usedTotal: number;
}
