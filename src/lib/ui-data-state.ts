export type RemoteQueryStatus = "pending" | "error" | "success";

export type UiDataState = "loading" | "error" | "empty" | "stale" | "sample" | "success";

export function getUiDataState(input: {
  status: RemoteQueryStatus;
  hasData: boolean;
  hasItems?: boolean;
  isFetching?: boolean;
  isSample?: boolean;
  hasError?: boolean;
}): UiDataState {
  if (input.status === "pending") return "loading";
  if (input.status === "error" || !input.hasData || input.hasError) return "error";
  if (input.isFetching) return "stale";
  if (input.isSample) return "sample";
  if (input.hasItems === false) return "empty";
  return "success";
}
