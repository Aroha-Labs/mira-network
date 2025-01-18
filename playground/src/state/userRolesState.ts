import { Store } from "@tanstack/store";

export const userRolesState = new Store<("admin" | "user")[]>([]);
