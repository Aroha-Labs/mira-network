import { Store } from "@tanstack/store";
import { addDays, format, subDays } from "date-fns";

export interface ApiKeysParams {
  page: number;
  pageSize: number;
  startDate: string;
  endDate: string;
  orderBy: string;
  order: string;
}

export const DEFAULT_PARAMS = {
  page: 1,
  pageSize: 10,
  startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
  endDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
  orderBy: "created_at",
  order: "desc",
};

export const apiKeysParamsState = new Store<ApiKeysParams>(DEFAULT_PARAMS);
