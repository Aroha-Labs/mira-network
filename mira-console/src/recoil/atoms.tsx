import { atom, useRecoilState, useRecoilValue } from "recoil";
import { recoilPersist } from "recoil-persist";
import { DEFAULT_MODEL } from "../config/llm";

const { persistAtom } = recoilPersist();

const selectedProviderState = atom<{
  name: "Mira Network" | "Custom Provider";
  baseUrl?: string;
  apiKey?: string;
}>({
  key: "selectedProviderState",
  default: {
    name: "Mira Network",
    baseUrl: "",
    apiKey: "",
  },
  effects_UNSTABLE: [persistAtom],
});

export const useStateSelectedProvider = () => {
  return useRecoilState(selectedProviderState);
};

export const useValueSelectedProvider = () => {
  return useRecoilValue(selectedProviderState);
};

const selectedModelState = atom<string>({
  key: "selectedModelState",
  default: DEFAULT_MODEL || undefined,
  effects_UNSTABLE: [persistAtom],
});

export const useStateSelectedModel = () => {
  return useRecoilState(selectedModelState);
};

export const useValueSelectedModel = () => {
  return useRecoilValue(selectedModelState);
};

const sidebarOpenState = atom<boolean>({
  key: "sidebarOpenState",
  default: false,
});

export const useStateSidebarOpen = () => {
  return useRecoilState(sidebarOpenState);
};

export const useValueSidebarOpen = () => {
  return useRecoilValue(sidebarOpenState);
};
