export function candleReadout(barsByTime, latest, selectedTime) {
  return selectedTime == null ? latest : (barsByTime.get(Number(selectedTime)) ?? null);
}
