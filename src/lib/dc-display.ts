export function formatDcCost(value: string | number | null | undefined) {
  const cost = typeof value === "number" ? value : parseFloat(value || "0");
  return `$${cost.toFixed(4)}`;
}
