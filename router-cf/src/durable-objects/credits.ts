import { DurableObject } from "cloudflare:workers";
import type { api } from "../../alchemy.run";

export class CreditsDO extends DurableObject<typeof api.Env> {
  // Get current balance
  getBalance(): number {
    return Number(this.ctx.storage.kv.get("balance") || 0);
  }

  // Set balance
  setBalance(amount: number): number {
    this.ctx.storage.kv.put("balance", amount.toString());
    return amount;
  }

  // Add credits
  addCredits(amount: number): number {
    const balance = this.getBalance();
    const newBalance = balance + amount;
    this.ctx.storage.kv.put("balance", newBalance.toString());
    return newBalance;
  }

  // Atomic deduct - returns { success, balance }
  deductCredits(amount: number): { success: boolean; balance: number } {
    const balance = this.getBalance();

    if (balance < amount) {
      return { success: false, balance };
    }

    const newBalance = balance - amount;
    this.ctx.storage.kv.put("balance", newBalance.toString());
    return { success: true, balance: newBalance };
  }
}
