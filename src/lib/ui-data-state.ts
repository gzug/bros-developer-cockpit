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
  // Sample data stays labelled "sample" even during a background refetch — checking
  // isFetching first made it briefly flash "stale"/"Refreshing" over the sample notice.
  // "stale" is only for real resolved data being refreshed.
  if (input.isSample) return "sample";
  if (input.isFetching) return "stale";
  if (input.hasItems === false) return "empty";
  return "success";
}
