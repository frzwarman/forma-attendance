import type { Role } from "../types";
import { createMockRepository } from "./mockRepository";
import { storage } from "./storage";
export * from "./mockRepository";
export const repository = createMockRepository(storage);
export interface AuthRepository {
  login(
    email: string,
    password: string,
  ): Promise<{ employeeId: string; role: Role }>;
  resetPassword(email: string): Promise<string>;
}
export const authRepository: AuthRepository = {
  login: async (email, password) => {
    const db = await repository.read();
    const employee = db.employees.find(
      (e) => e.email.toLowerCase() === email.toLowerCase().trim(),
    );
    if (!employee || password !== "Forma2026!")
      throw new Error("Use a demo account and the password Forma2026!");
    return { employeeId: employee.id, role: employee.role };
  },
  resetPassword: async (email) => {
    if (!email.includes("@")) throw new Error("Enter your corporate email.");
    return "Demo mode: no email was sent. Use Forma2026! to sign in.";
  },
};
